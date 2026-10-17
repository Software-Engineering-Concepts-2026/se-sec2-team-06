from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.database import Base, create_session_factory
from app.models import Tag, TutorConversation, TutorMessage, User
from app.schemas.tutor import TutorMessageInput
from app.services.tutor_conversations import create_conversation, get_owned_conversation
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
