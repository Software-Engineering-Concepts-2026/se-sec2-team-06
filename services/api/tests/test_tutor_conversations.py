from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.database import Base, create_session_factory
from app.models import Tag, TutorAttachment, TutorConversation, TutorMessage, User
from app.schemas.tutor import TutorMessageInput
from app.services.tutor_conversations import (
    NewTutorAttachment,
    TutorAttachmentUnavailableError,
    TutorConversationNotFoundError,
    TutorRequestConflictError,
    TutorTagUnavailableError,
    TutorTurnInProgressError,
    add_user_message,
    claim_retryable_conversation,
    create_conversation,
    get_owned_conversation,
    mark_retryable_error,
    save_tutor_reply,
)
from app.services import tutor_conversations as tutor_conversation_service
from app.tags.catalog import seed_builtin_subjects


@pytest.fixture
def session_factory():
    factory = create_session_factory("sqlite://")
    engine = factory.kw["bind"]
    Base.metadata.create_all(bind=engine)
    seed_builtin_subjects(factory)
    yield factory
    engine.dispose()


def _user(email: str) -> User:
    return User(
        email=email,
        display_name="Study Learner",
        password_hash="$argon2id$test",
    )


def _conversation(session, user: User, *, status: str = "processing", request_id: str = "create"):
    conversation, _created = create_conversation(
        session,
        user_id=user.id,
        message="Explain the topic.",
        tag_ids=[],
        request_id=request_id,
    )
    if status != "processing":
        conversation.status = status
        session.commit()
    return conversation


def _attachment(session, user: User, conversation: TutorConversation, key: str) -> TutorAttachment:
    attachment = TutorAttachment(
        user_id=user.id,
        conversation_id=conversation.id,
        storage_key=key,
        original_filename=f"{key}.png",
        mime_type="image/png",
        byte_size=12,
    )
    session.add(attachment)
    session.commit()
    session.refresh(attachment)
    return attachment


def test_conversation_persists_ordered_messages(session_factory):
    with session_factory() as session:
        user = _user("ordered@example.test")
        session.add(user)
        session.commit()

        conversation, created = create_conversation(
            session,
            user_id=user.id,
            message="What is a set?",
            tag_ids=[],
            request_id="create-ordered",
        )
        conversation.messages.append(
            TutorMessage(
                sequence=2,
                role="assistant",
                kind="answer",
                content="A set is a collection of distinct elements.",
                request_id="response-ordered",
            )
        )
        session.commit()

        loaded = get_owned_conversation(session, user.id, conversation.id)

    assert loaded is not None
    assert loaded.title == "What is a set?"
    assert [message.sequence for message in loaded.messages] == [1, 2]
    assert [message.role for message in loaded.messages] == ["user", "assistant"]


def test_replayed_create_request_returns_same_conversation(session_factory):
    with session_factory() as session:
        user = _user("replay@example.test")
        session.add(user)
        session.commit()

        first, first_created = create_conversation(
            session,
            user_id=user.id,
            message="Explain subsets.",
            tag_ids=[],
            request_id="request-replay",
        )
        replay, replay_created = create_conversation(
            session,
            user_id=user.id,
            message="Explain subsets.",
            tag_ids=[],
            request_id="request-replay",
        )
        message_count = session.scalar(
            select(func.count(TutorMessage.id)).where(
                TutorMessage.conversation_id == first.id
            )
        )

    assert replay.id == first.id
    assert first_created is True
    assert replay_created is False
    assert message_count == 1


def test_message_request_id_is_unique_within_conversation(session_factory):
    with session_factory() as session:
        user = _user("message-id@example.test")
        session.add(user)
        session.commit()
        conversation, _created = create_conversation(
            session,
            user_id=user.id,
            message="Explain unions.",
            tag_ids=[],
            request_id="create-message-id",
        )
        session.add_all(
            [
                TutorMessage(
                    sequence=2,
                    role="user",
                    kind="clarification_reply",
                    content="The set union.",
                    request_id="same-message-id",
                ),
                TutorMessage(
                    sequence=3,
                    role="user",
                    kind="clarification_reply",
                    content="A duplicate request.",
                    request_id="same-message-id",
                ),
            ]
        )

        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        assert session.get(TutorConversation, conversation.id) is not None


def test_conversation_tags_accept_builtin_or_owned_tags(session_factory):
    with session_factory() as session:
        user = _user("tag-owner@example.test")
        session.add(user)
        session.flush()
        math = session.scalar(select(Tag).where(Tag.slug == "math"))
        assert math is not None
        topic = Tag(
            name="Sets",
            name_key="sets",
            owner_id=user.id,
            parent_id=math.id,
            is_builtin=False,
        )
        session.add(topic)
        session.commit()

        conversation, _created = create_conversation(
            session,
            user_id=user.id,
            message="What is a subset?",
            tag_ids=[math.id, topic.id],
            request_id="create-tagged",
        )

    assert {tag.name for tag in conversation.tags} == {"คณิตศาสตร์", "Sets"}


def test_tutor_conversation_accepts_parentless_owner_tag(session_factory):
    with session_factory() as session:
        user = _user("flat-tag-owner@example.test")
        session.add(user)
        session.flush()
        math = session.scalar(select(Tag).where(Tag.slug == "math"))
        assert math is not None
        custom = Tag(
            name="Study session",
            name_key="study session",
            owner_id=user.id,
            parent_id=None,
            is_builtin=False,
            color="teal",
        )
        session.add(custom)
        session.commit()

        conversation, _created = create_conversation(
            session,
            user_id=user.id,
            message="Explain this study topic.",
            tag_ids=[math.id, custom.id],
            request_id="create-flat-tagged",
        )

    assert {tag.id for tag in conversation.tags} == {math.id, custom.id}


def test_conversation_rejects_another_users_tag(session_factory):
    with session_factory() as session:
        learner = _user("learner@example.test")
        tag_owner = _user("other-tag-owner@example.test")
        session.add_all([learner, tag_owner])
        session.flush()
        math = session.scalar(select(Tag).where(Tag.slug == "math"))
        assert math is not None
        foreign_tag = Tag(
            name="Private topic",
            name_key="private topic",
            owner_id=tag_owner.id,
            parent_id=math.id,
            is_builtin=False,
        )
        session.add(foreign_tag)
        session.commit()

        with pytest.raises(ValueError, match="tag"):
            create_conversation(
                session,
                user_id=learner.id,
                message="Question with a foreign tag.",
                tag_ids=[foreign_tag.id],
                request_id="create-foreign-tag",
            )

        assert session.scalar(select(func.count(TutorConversation.id))) == 0


def test_tutor_message_input_rejects_whitespace_only_text():
    with pytest.raises(ValidationError):
        TutorMessageInput(message=" \t\n ", request_id="request-1")


@pytest.mark.parametrize(
    ("message", "request_id", "expected_error"),
    [
        ("  \n", "request", "message is required"),
        ("x" * 4_001, "request", "message is too long"),
        ("valid message", "  ", "request identifier"),
        ("valid message", "x" * 81, "request identifier"),
    ],
)
def test_create_conversation_validates_message_and_request_id(
    session_factory, message, request_id, expected_error
):
    with session_factory() as session:
        user = _user("create-validation@example.test")
        session.add(user)
        session.commit()

        with pytest.raises(ValueError, match=expected_error):
            create_conversation(
                session,
                user_id=user.id,
                message=message,
                tag_ids=[],
                request_id=request_id,
            )


def test_create_request_id_reuse_with_different_message_is_conflict(session_factory):
    with session_factory() as session:
        user = _user("create-conflict@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, request_id="same-create-id")

        with pytest.raises(TutorRequestConflictError, match="already used"):
            create_conversation(
                session,
                user_id=user.id,
                message="A different question",
                tag_ids=[],
                request_id="same-create-id",
            )

        assert session.get(TutorConversation, conversation.id) is not None


def test_create_conversation_persists_new_attachment_metadata(session_factory):
    with session_factory() as session:
        user = _user("create-attachment@example.test")
        session.add(user)
        session.commit()

        conversation, created = create_conversation(
            session,
            user_id=user.id,
            message="What is in this image?",
            tag_ids=[],
            request_id="create-with-attachment",
            new_attachments=[
                NewTutorAttachment("17/image-key.png", "diagram.png", "image/png", 512)
            ],
        )
        loaded = get_owned_conversation(session, user.id, conversation.id)

    assert created is True
    assert loaded is not None
    user_message = loaded.messages[0]
    assert [(item.storage_key, item.original_filename, item.byte_size) for item in user_message.attachments] == [
        ("17/image-key.png", "diagram.png", 512)
    ]


def test_create_conversation_rejects_repeated_tag_ids(session_factory):
    with session_factory() as session:
        user = _user("duplicate-tag@example.test")
        session.add(user)
        session.flush()
        math = session.scalar(select(Tag).where(Tag.slug == "math"))
        assert math is not None

        with pytest.raises(TutorTagUnavailableError):
            create_conversation(
                session,
                user_id=user.id,
                message="Question",
                tag_ids=[math.id, math.id],
                request_id="duplicate-tags",
            )


@pytest.mark.parametrize(
    ("message", "request_id", "expected_error"),
    [
        (" \t", "request", "message is required"),
        ("x" * 4_001, "request", "message is too long"),
        ("valid", "", "request identifier"),
        ("valid", "x" * 81, "request identifier"),
    ],
)
def test_add_user_message_validates_message_and_request_id(
    session_factory, message, request_id, expected_error
):
    with session_factory() as session:
        user = _user("message-validation@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")

        with pytest.raises(ValueError, match=expected_error):
            add_user_message(
                session,
                user.id,
                conversation.id,
                message,
                request_id,
            )


def test_add_user_message_is_idempotent_and_normalizes_request_id(session_factory):
    with session_factory() as session:
        user = _user("followup-replay@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")

        updated, first_message, created = add_user_message(
            session,
            user.id,
            conversation.id,
            "  Follow up question  ",
            " followup-1 ",
            provider_id="gemini",
            model_id="gemini-test",
            response_language="en",
        )
        replay, replay_message, replay_created = add_user_message(
            session,
            user.id,
            conversation.id,
            "Follow up question",
            "followup-1",
        )

        assert created is True
        assert updated.status == "processing"
        assert first_message.sequence == 2
        assert first_message.kind == "question"
        assert first_message.provider_id == "gemini"
        assert first_message.response_language == "en"
        assert replay.id == updated.id
        assert replay_message.id == first_message.id
        assert replay_created is False
        assert len(replay.messages) == 2


def test_add_user_message_rejects_reused_request_id_with_changed_content(session_factory):
    with session_factory() as session:
        user = _user("followup-conflict@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        add_user_message(session, user.id, conversation.id, "First text", "reused-id")

        with pytest.raises(TutorRequestConflictError, match="already used"):
            add_user_message(session, user.id, conversation.id, "Changed text", "reused-id")


def test_add_user_message_marks_clarification_reply_and_links_existing_attachment(session_factory):
    with session_factory() as session:
        user = _user("clarification-reply@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="awaiting_clarification")
        attachment = _attachment(session, user, conversation, "clarification-image")

        updated, message, created = add_user_message(
            session,
            user.id,
            conversation.id,
            "Here is the missing detail.",
            "clarification-1",
            attachment_ids=[attachment.id],
            new_attachments=[
                NewTutorAttachment("17/new-image.png", "new-image.png", "image/png", 128)
            ],
        )

    assert created is True
    assert updated.status == "processing"
    assert message.kind == "clarification_reply"
    assert {item.storage_key for item in message.attachments} == {
        "clarification-image",
        "17/new-image.png",
    }


def test_add_user_message_rejects_duplicate_or_other_conversation_attachment_ids(session_factory):
    with session_factory() as session:
        user = _user("attachment-scope@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        other_conversation = _conversation(session, user, request_id="other-conversation")
        other_attachment = _attachment(session, user, other_conversation, "other-conversation-image")

        for attachment_ids in ([other_attachment.id, other_attachment.id], [other_attachment.id]):
            with pytest.raises(TutorAttachmentUnavailableError):
                add_user_message(
                    session,
                    user.id,
                    conversation.id,
                    "Follow-up",
                    f"invalid-attachment-{len(attachment_ids)}",
                    attachment_ids=attachment_ids,
                )

        assert session.get(TutorConversation, conversation.id).status == "answered"


def test_add_user_message_requires_finished_current_turn_and_owned_conversation(session_factory):
    with session_factory() as session:
        user = _user("turn-in-progress@example.test")
        other_user = _user("another-learner@example.test")
        session.add_all([user, other_user])
        session.commit()
        conversation = _conversation(session, user)

        with pytest.raises(TutorTurnInProgressError):
            add_user_message(session, user.id, conversation.id, "Wait", "while-processing")
        with pytest.raises(TutorConversationNotFoundError):
            add_user_message(session, other_user.id, conversation.id, "Not yours", "foreign-chat")


@pytest.mark.parametrize(
    ("reply_kind", "expected_status"),
    [("answer", "answered"), ("clarification", "awaiting_clarification")],
)
def test_save_tutor_reply_persists_reply_once_and_updates_conversation_status(
    session_factory, reply_kind, expected_status
):
    with session_factory() as session:
        user = _user(f"reply-{reply_kind}@example.test")
        session.add(user)
        session.commit()
        conversation, _created = create_conversation(
            session,
            user.id,
            "Question in English",
            [],
            f"reply-create-{reply_kind}",
            response_language="en",
        )
        user_message = conversation.messages[0]

        saved = save_tutor_reply(
            session,
            user.id,
            conversation.id,
            user_message.id,
            reply_kind,
            "A helpful response",
            "gemini",
            "gemini-test",
        )
        replay = save_tutor_reply(
            session,
            user.id,
            conversation.id,
            user_message.id,
            reply_kind,
            "A duplicate response should be ignored",
            "other-provider",
            "other-model",
        )

    assert saved.status == expected_status
    assert replay.status == expected_status
    assert len(replay.messages) == 2
    reply = replay.messages[1]
    assert reply.kind == reply_kind
    assert reply.content == "A helpful response"
    assert reply.response_language == "en"
    assert reply.provider_id == "gemini"
    assert reply.model_id == "gemini-test"


def test_save_tutor_reply_ignores_reply_for_a_non_latest_user_message(session_factory):
    with session_factory() as session:
        user = _user("stale-reply@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        old_user_message_id = conversation.messages[0].id
        updated, _new_message, _created = add_user_message(
            session, user.id, conversation.id, "Newer question", "newer-question"
        )

        saved = save_tutor_reply(
            session,
            user.id,
            conversation.id,
            old_user_message_id,
            "answer",
            "Stale answer",
            None,
            None,
        )

    assert updated.status == "processing"
    assert saved.status == "processing"
    assert len(saved.messages) == 2


def test_save_tutor_reply_requires_a_saved_user_message_and_existing_conversation(session_factory):
    with session_factory() as session:
        user = _user("reply-validation@example.test")
        other_user = _user("reply-other@example.test")
        session.add_all([user, other_user])
        session.commit()
        conversation = _conversation(session, user)

        with pytest.raises(ValueError, match="saved learner message"):
            save_tutor_reply(
                session, user.id, conversation.id, 99999, "answer", "reply", None, None
            )
        with pytest.raises(TutorConversationNotFoundError):
            save_tutor_reply(
                session, other_user.id, conversation.id, conversation.messages[0].id,
                "answer", "reply", None, None,
            )


def test_mark_error_then_claim_retryable_conversation_once(session_factory):
    with session_factory() as session:
        user = _user("retryable@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user)
        user_message_id = conversation.messages[0].id

        retryable = mark_retryable_error(session, user.id, conversation.id, user_message_id)
        retryable_status = retryable.status
        claimed = claim_retryable_conversation(session, user.id, conversation.id)
        claimed_status = claimed.status if claimed is not None else None
        second_claim = claim_retryable_conversation(session, user.id, conversation.id)
        other_user_claim = claim_retryable_conversation(session, user.id + 1000, conversation.id)

    assert retryable_status == "retryable_error"
    assert claimed is not None and claimed_status == "processing"
    assert second_claim is None
    assert other_user_claim is None


def test_mark_retryable_error_returns_not_found_for_unowned_conversation(session_factory):
    with session_factory() as session:
        with pytest.raises(TutorConversationNotFoundError):
            mark_retryable_error(session, 12345, 98765, 1)


@pytest.mark.parametrize("competing_message", ["Same question", "Changed question"])
def test_create_conversation_recovers_from_a_concurrent_duplicate_request(
    session_factory, monkeypatch, competing_message
):
    with session_factory() as session:
        user = _user(f"create-race-{len(competing_message)}@example.test")
        session.add(user)
        session.commit()
        real_commit = session.commit

        def commit_competing_request():
            session.rollback()
            competing = TutorConversation(
                user_id=user.id,
                title=competing_message,
                status="processing",
                create_request_id="racing-create",
            )
            competing.messages.append(
                TutorMessage(
                    sequence=1,
                    role="user",
                    kind="question",
                    content=competing_message,
                    request_id="racing-create",
                )
            )
            session.add(competing)
            real_commit()
            raise IntegrityError("simulated concurrent unique insert", {}, RuntimeError())

        monkeypatch.setattr(session, "commit", commit_competing_request)
        if competing_message == "Changed question":
            with pytest.raises(TutorRequestConflictError):
                create_conversation(
                    session, user.id, "Same question", [], "racing-create"
                )
        else:
            conversation, created = create_conversation(
                session, user.id, "Same question", [], "racing-create"
            )
            assert created is False
            assert conversation.messages[0].content == "Same question"

        assert session.scalar(select(func.count(TutorConversation.id))) == 1


@pytest.mark.parametrize("competing_message", ["Same question", "Changed question"])
def test_add_message_recovers_or_reports_conflict_when_another_request_wins_the_turn(
    session_factory, monkeypatch, competing_message
):
    with session_factory() as session:
        user = _user(f"message-race-{len(competing_message)}@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        real_execute = session.execute
        injected = False

        def execute_after_competing_turn(statement, *args, **kwargs):
            nonlocal injected
            if not injected and getattr(statement, "is_update", False):
                injected = True
                real_execute(
                    update(TutorConversation)
                    .where(TutorConversation.id == conversation.id)
                    .values(status="processing")
                )
                session.add(
                    TutorMessage(
                        conversation_id=conversation.id,
                        sequence=2,
                        role="user",
                        kind="question",
                        content=competing_message,
                        request_id="racing-followup",
                    )
                )
                session.commit()
                return SimpleNamespace(rowcount=0)
            return real_execute(statement, *args, **kwargs)

        monkeypatch.setattr(session, "execute", execute_after_competing_turn)
        if competing_message == "Changed question":
            with pytest.raises(TutorRequestConflictError):
                add_user_message(
                    session,
                    user.id,
                    conversation.id,
                    "Same question",
                    "racing-followup",
                )
        else:
            replayed_conversation, replayed_message, created = add_user_message(
                session,
                user.id,
                conversation.id,
                "Same question",
                "racing-followup",
            )
            assert created is False
            assert replayed_message.content == "Same question"
            assert len(replayed_conversation.messages) == 2


def test_add_user_message_reports_when_the_conversation_disappears_after_claim(
    session_factory, monkeypatch
):
    import app.services.tutor_conversations as service

    with session_factory() as session:
        user = _user("conversation-disappeared@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        real_get = service.get_owned_conversation
        calls = 0

        def disappear_after_claim(current_session, user_id, conversation_id):
            nonlocal calls
            calls += 1
            if calls == 2:
                return None
            return real_get(current_session, user_id, conversation_id)

        monkeypatch.setattr(service, "get_owned_conversation", disappear_after_claim)

        with pytest.raises(TutorConversationNotFoundError):
            service.add_user_message(
                session, user.id, conversation.id, "Follow up", "vanishing-chat"
            )


@pytest.mark.parametrize(
    ("competing_message", "competing_status", "expected_error"),
    [
        ("Same question", "processing", None),
        ("Changed question", "processing", TutorTurnInProgressError),
        ("Changed question", "answered", TutorRequestConflictError),
        (None, "processing", TutorTurnInProgressError),
    ],
)
def test_add_user_message_recovers_from_concurrent_commit_conflicts(
    session_factory, monkeypatch, competing_message, competing_status, expected_error
):
    with session_factory() as session:
        user = _user(f"commit-race-{competing_status}-{competing_message}@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        real_commit = session.commit

        def commit_competing_turn():
            session.rollback()
            competing = session.get(TutorConversation, conversation.id)
            assert competing is not None
            competing.status = competing_status
            if competing_message is not None:
                session.add(
                    TutorMessage(
                        conversation_id=conversation.id,
                        sequence=2,
                        role="user",
                        kind="question",
                        content=competing_message,
                        request_id="commit-race",
                    )
                )
            real_commit()
            raise IntegrityError("simulated concurrent message insert", {}, RuntimeError())

        monkeypatch.setattr(session, "commit", commit_competing_turn)
        if expected_error is not None:
            with pytest.raises(expected_error):
                add_user_message(
                    session, user.id, conversation.id, "Same question", "commit-race"
                )
        else:
            replay, message, created = add_user_message(
                session, user.id, conversation.id, "Same question", "commit-race"
            )
            assert created is False
            assert message.content == "Same question"
            assert len(replay.messages) == 2


@pytest.mark.parametrize("mutation", ["update_tags", "delete"])
def test_conversation_mutation_rejects_when_processing_claim_wins_race(
    session_factory, monkeypatch, mutation
):
    with session_factory() as session:
        user = _user(f"mutation-race-{mutation}@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user, status="answered")
        conversation_id = conversation.id
        math_id = session.scalar(select(Tag.id).where(Tag.name == "คณิตศาสตร์"))
        original_claim = getattr(tutor_conversation_service, "_claim_mutable_conversation", None)

        def processing_claim_wins(current_session, user_id, current_conversation_id):
            with session_factory() as competing_session:
                competing = competing_session.get(TutorConversation, current_conversation_id)
                assert competing is not None
                competing.status = "processing"
                competing_session.commit()
            return original_claim(current_session, user_id, current_conversation_id)

        monkeypatch.setattr(
            tutor_conversation_service,
            "_claim_mutable_conversation",
            processing_claim_wins,
            raising=False,
        )

        if mutation == "update_tags":
            with pytest.raises(TutorTurnInProgressError):
                tutor_conversation_service.update_conversation_tags(
                    session, user.id, conversation_id, [math_id]
                )
        else:
            with pytest.raises(TutorTurnInProgressError):
                tutor_conversation_service.delete_conversation(
                    session, user.id, conversation_id
                )

        current = get_owned_conversation(session, user.id, conversation_id)
        assert current is not None
        assert current.status == "processing"
        assert current.tags == []


def test_create_conversation_propagates_integrity_error_without_a_winning_request(
    session_factory, monkeypatch
):
    with session_factory() as session:
        user = _user("create-no-winner@example.test")
        session.add(user)
        session.commit()

        def fail_after_rollback():
            session.rollback()
            raise IntegrityError("simulated unrelated integrity failure", {}, RuntimeError())

        monkeypatch.setattr(session, "commit", fail_after_rollback)
        with pytest.raises(IntegrityError, match="simulated unrelated"):
            create_conversation(session, user.id, "Question", [], "no-winner")


def test_create_conversation_reports_a_saved_record_that_cannot_be_reloaded(
    session_factory, monkeypatch
):
    import app.services.tutor_conversations as service

    with session_factory() as session:
        user = _user("create-readback@example.test")
        session.add(user)
        session.commit()
        monkeypatch.setattr(service, "get_owned_conversation", lambda *_args: None)

        with pytest.raises(RuntimeError, match="could not be loaded after saving"):
            service.create_conversation(session, user.id, "Question", [], "readback")


def test_save_reply_and_retry_marker_report_records_removed_before_readback(
    session_factory, monkeypatch
):
    import app.services.tutor_conversations as service

    with session_factory() as session:
        user = _user("readback-disappeared@example.test")
        session.add(user)
        session.commit()
        conversation = _conversation(session, user)
        user_message_id = conversation.messages[0].id
        real_get = service.get_owned_conversation

        lookups = 0

        def disappear_on_second_lookup(current_session, user_id, conversation_id):
            nonlocal lookups
            lookups += 1
            return (
                real_get(current_session, user_id, conversation_id)
                if lookups % 2 == 1
                else None
            )

        monkeypatch.setattr(service, "get_owned_conversation", disappear_on_second_lookup)
        with pytest.raises(TutorConversationNotFoundError):
            service.save_tutor_reply(
                session,
                user.id,
                conversation.id,
                user_message_id,
                "answer",
                "reply",
                None,
                None,
            )

        lookups = 0
        with pytest.raises(TutorConversationNotFoundError):
            service.mark_retryable_error(session, user.id, conversation.id, user_message_id)
