from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Tag, TutorAttachment, TutorConversation, TutorMessage


class TutorTagUnavailableError(ValueError):
    """Raised when a requested tag is not builtin or owned by the learner."""


class TutorRequestConflictError(ValueError):
    """Raised when a request identifier is reused with different message text."""


class TutorTurnInProgressError(ValueError):
    """Raised when a conversation already has an active provider turn."""


class TutorConversationNotFoundError(LookupError):
    """Raised when a conversation is not available to its requesting learner."""


class TutorAttachmentUnavailableError(LookupError):
    """Raised when an attachment is not owned by this learner and conversation."""


@dataclass(frozen=True)
class NewTutorAttachment:
    storage_key: str
    original_filename: str
    mime_type: str
    byte_size: int


def _owned_attachments(
    session: Session,
    user_id: int,
    conversation_id: int,
    attachment_ids: list[int],
) -> list[TutorAttachment]:
    if not attachment_ids:
        return []
    if len(set(attachment_ids)) != len(attachment_ids):
        raise TutorAttachmentUnavailableError("Duplicate attachments are not allowed")
    attachments = session.scalars(
        select(TutorAttachment)
        .where(
            TutorAttachment.id.in_(attachment_ids),
            TutorAttachment.user_id == user_id,
            TutorAttachment.conversation_id == conversation_id,
        )
        .order_by(TutorAttachment.id)
    ).all()
    if len(attachments) != len(attachment_ids):
        raise TutorAttachmentUnavailableError("One or more attachments are not available")
    by_id = {attachment.id: attachment for attachment in attachments}
    return [by_id[attachment_id] for attachment_id in attachment_ids]


def _new_attachment_records(
    user_id: int,
    conversation_id: int,
    attachments: list[NewTutorAttachment],
) -> list[TutorAttachment]:
    return [
        TutorAttachment(
            user_id=user_id,
            conversation_id=conversation_id,
            storage_key=attachment.storage_key,
            original_filename=attachment.original_filename,
            mime_type=attachment.mime_type,
            byte_size=attachment.byte_size,
        )
        for attachment in attachments
    ]


def _accessible_tags(session: Session, user_id: int, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []

    tags = session.scalars(
        select(Tag)
        .where(
            Tag.id.in_(tag_ids),
            or_(
                and_(
                    Tag.is_builtin.is_(True),
                    Tag.owner_id.is_(None),
                    Tag.parent_id.is_(None),
                ),
                and_(
                    Tag.is_builtin.is_(False),
                    Tag.owner_id == user_id,
                ),
            ),
        )
        .order_by(Tag.id)
    ).all()
    if len(tags) != len(tag_ids):
        raise TutorTagUnavailableError("One or more requested tags are not available")
    return list(tags)


def create_conversation(
    session: Session,
    user_id: int,
    message: str,
    tag_ids: list[int],
    request_id: str,
    *,
    provider_id: str | None = None,
    model_id: str | None = None,
    response_language: str = "th",
    new_attachments: list[NewTutorAttachment] | None = None,
) -> tuple[TutorConversation, bool]:
    normalized_message = message.strip()
    normalized_request_id = request_id.strip()
    if not normalized_message:
        raise ValueError("A tutoring message is required")
    if len(normalized_message) > 4_000:
        raise ValueError("A tutoring message is too long")
    if not normalized_request_id or len(normalized_request_id) > 80:
        raise ValueError("A valid request identifier is required")

    existing = session.scalar(
        select(TutorConversation)
        .options(selectinload(TutorConversation.messages), selectinload(TutorConversation.tags))
        .where(
            TutorConversation.user_id == user_id,
            TutorConversation.create_request_id == normalized_request_id,
        )
    )
    if existing is not None:
        first_user_message = next(
            (item for item in existing.messages if item.role == "user"),
            None,
        )
        if first_user_message is not None and first_user_message.content != normalized_message:
            raise TutorRequestConflictError(
                "This request identifier was already used for another message"
            )
        return existing, False

    tags = _accessible_tags(session, user_id, tag_ids)
    conversation = TutorConversation(
        user_id=user_id,
        title=normalized_message[:160],
        status="processing",
        provider_id=provider_id,
        model_id=model_id,
        create_request_id=normalized_request_id,
        tags=tags,
    )
    user_message = TutorMessage(
        sequence=1,
        role="user",
        kind="question",
        content=normalized_message,
        request_id=normalized_request_id,
        provider_id=provider_id,
        model_id=model_id,
        response_language=response_language,
    )
    conversation.messages.append(user_message)
    session.add(conversation)
    try:
        session.flush()
        stored_attachments = _new_attachment_records(
            user_id,
            conversation.id,
            new_attachments or [],
        )
        user_message.attachments.extend(stored_attachments)
        session.add_all(stored_attachments)
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.scalar(
            select(TutorConversation)
            .options(selectinload(TutorConversation.messages), selectinload(TutorConversation.tags))
            .where(
                TutorConversation.user_id == user_id,
                TutorConversation.create_request_id == normalized_request_id,
            )
        )
        if existing is None:
            raise
        first_user_message = next(
            (item for item in existing.messages if item.role == "user"),
            None,
        )
        if first_user_message is not None and first_user_message.content != normalized_message:
            raise TutorRequestConflictError(
                "This request identifier was already used for another message"
            )
        return existing, False
    saved = get_owned_conversation(session, user_id, conversation.id)
    if saved is None:
        raise RuntimeError("The tutoring conversation could not be loaded after saving")
    return saved, True


def get_owned_conversation(
    session: Session,
    user_id: int,
    conversation_id: int,
) -> TutorConversation | None:
    return session.scalar(
        select(TutorConversation)
        .options(
            selectinload(TutorConversation.messages).selectinload(TutorMessage.attachments),
            selectinload(TutorConversation.tags),
        )
        .execution_options(populate_existing=True)
        .where(
            TutorConversation.id == conversation_id,
            TutorConversation.user_id == user_id,
        )
    )


def add_user_message(
    session: Session,
    user_id: int,
    conversation_id: int,
    message: str,
    request_id: str,
    *,
    provider_id: str | None = None,
    model_id: str | None = None,
    response_language: str = "th",
    attachment_ids: list[int] | None = None,
    new_attachments: list[NewTutorAttachment] | None = None,
) -> tuple[TutorConversation, TutorMessage, bool]:
    normalized_message = message.strip()
    normalized_request_id = request_id.strip()
    if not normalized_message:
        raise ValueError("A tutoring message is required")
    if len(normalized_message) > 4_000:
        raise ValueError("A tutoring message is too long")
    if not normalized_request_id or len(normalized_request_id) > 80:
        raise ValueError("A valid request identifier is required")

    conversation = get_owned_conversation(session, user_id, conversation_id)
    if conversation is None:
        raise TutorConversationNotFoundError("The conversation is not available")

    existing = next(
        (item for item in conversation.messages if item.request_id == normalized_request_id),
        None,
    )
    if existing is not None:
        if existing.role != "user" or existing.content != normalized_message:
            raise TutorRequestConflictError(
                "This request identifier was already used for another message"
            )
        return conversation, existing, False

    previous_status = conversation.status
    if previous_status not in {"answered", "awaiting_clarification"}:
        raise TutorTurnInProgressError("The conversation needs its current turn to finish first")

    referenced_attachments = _owned_attachments(
        session,
        user_id,
        conversation_id,
        attachment_ids or [],
    )

    claimed = session.execute(
        update(TutorConversation)
        .where(
            TutorConversation.id == conversation_id,
            TutorConversation.user_id == user_id,
            TutorConversation.status == previous_status,
        )
        .values(status="processing", updated_at=datetime.now(timezone.utc))
        .execution_options(synchronize_session=False)
    )
    if claimed.rowcount != 1:
        session.rollback()
        conversation = get_owned_conversation(session, user_id, conversation_id)
        if conversation is None:
            raise TutorConversationNotFoundError("The conversation is not available")
        existing = next(
            (item for item in conversation.messages if item.request_id == normalized_request_id),
            None,
        )
        if existing is not None:
            if existing.role != "user" or existing.content != normalized_message:
                raise TutorRequestConflictError(
                    "This request identifier was already used for another message"
                )
            return conversation, existing, False
        raise TutorTurnInProgressError("The conversation needs its current turn to finish first")

    session.expire_all()
    conversation = get_owned_conversation(session, user_id, conversation_id)
    if conversation is None:
        session.rollback()
        raise TutorConversationNotFoundError("The conversation is not available")

    sequence = max((item.sequence for item in conversation.messages), default=0) + 1
    kind = (
        "clarification_reply"
        if previous_status == "awaiting_clarification"
        else "question"
    )
    saved_message = TutorMessage(
        sequence=sequence,
        role="user",
        kind=kind,
        content=normalized_message,
        request_id=normalized_request_id,
        provider_id=provider_id,
        model_id=model_id,
        response_language=response_language,
    )
    saved_message.attachments.extend(referenced_attachments)
    stored_attachments = _new_attachment_records(
        user_id,
        conversation_id,
        new_attachments or [],
    )
    saved_message.attachments.extend(stored_attachments)
    conversation.messages.append(saved_message)
    conversation.updated_at = datetime.now(timezone.utc)
    session.add(conversation)
    session.add_all(stored_attachments)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        conversation = get_owned_conversation(session, user_id, conversation_id)
        if conversation is None:
            raise TutorConversationNotFoundError("The conversation is not available")
        existing = next(
            (item for item in conversation.messages if item.request_id == normalized_request_id),
            None,
        )
        if existing is None or existing.role != "user" or existing.content != normalized_message:
            if conversation.status == "processing":
                raise TutorTurnInProgressError(
                    "The conversation needs its current turn to finish first"
                )
            raise TutorRequestConflictError(
                "This request identifier was already used for another message"
            )
        return conversation, existing, False

    refreshed = get_owned_conversation(session, user_id, conversation_id)
    if refreshed is None:
        raise TutorConversationNotFoundError("The conversation is not available")
    saved_message = next(
        item for item in refreshed.messages if item.request_id == normalized_request_id
    )
    return refreshed, saved_message, True


def save_tutor_reply(
    session: Session,
    user_id: int,
    conversation_id: int,
    user_message_id: int,
    reply_kind: str,
    content: str,
    provider_id: str | None,
    model_id: str | None,
) -> TutorConversation:
    conversation = get_owned_conversation(session, user_id, conversation_id)
    if conversation is None:
        raise TutorConversationNotFoundError("The conversation is not available")

    user_message = next(
        (
            item
            for item in conversation.messages
            if item.id == user_message_id and item.role == "user"
        ),
        None,
    )
    if user_message is None:
        raise ValueError("A tutoring reply requires a saved learner message")
    assistant_request_id = f"assistant-{user_message.id}"
    existing_reply = next(
        (
            item
            for item in conversation.messages
            if item.role == "assistant" and item.request_id == assistant_request_id
        ),
        None,
    )
    if existing_reply is not None:
        return conversation

    latest_user_message = max(
        (item for item in conversation.messages if item.role == "user"),
        key=lambda item: item.sequence,
        default=None,
    )
    if conversation.status != "processing" or latest_user_message is None or latest_user_message.id != user_message.id:
        return conversation

    conversation.messages.append(
        TutorMessage(
            sequence=max((item.sequence for item in conversation.messages), default=0) + 1,
            role="assistant",
            kind=reply_kind,
            content=content,
            request_id=assistant_request_id,
            provider_id=provider_id,
            model_id=model_id,
            response_language=user_message.response_language,
        )
    )
    conversation.status = (
        "awaiting_clarification" if reply_kind == "clarification" else "answered"
    )
    conversation.provider_id = provider_id
    conversation.model_id = model_id
    conversation.updated_at = datetime.now(timezone.utc)
    session.add(conversation)
    session.commit()

    refreshed = get_owned_conversation(session, user_id, conversation_id)
    if refreshed is None:
        raise TutorConversationNotFoundError("The conversation is not available")
    return refreshed


def mark_retryable_error(
    session: Session,
    user_id: int,
    conversation_id: int,
    user_message_id: int,
) -> TutorConversation:
    conversation = get_owned_conversation(session, user_id, conversation_id)
    if conversation is None:
        raise TutorConversationNotFoundError("The conversation is not available")
    session.execute(
        update(TutorConversation)
        .where(
            TutorConversation.id == conversation_id,
            TutorConversation.user_id == user_id,
            TutorConversation.status == "processing",
            TutorConversation.messages.any(TutorMessage.id == user_message_id),
        )
        .values(status="retryable_error", updated_at=datetime.now(timezone.utc))
        .execution_options(synchronize_session=False)
    )
    session.commit()

    refreshed = get_owned_conversation(session, user_id, conversation_id)
    if refreshed is None:
        raise TutorConversationNotFoundError("The conversation is not available")
    return refreshed


def claim_retryable_conversation(
    session: Session,
    user_id: int,
    conversation_id: int,
) -> TutorConversation | None:
    claimed = session.execute(
        update(TutorConversation)
        .where(
            TutorConversation.id == conversation_id,
            TutorConversation.user_id == user_id,
            TutorConversation.status == "retryable_error",
        )
        .values(status="processing", updated_at=datetime.now(timezone.utc))
        .execution_options(synchronize_session=False)
    )
    if claimed.rowcount != 1:
        session.rollback()
        return None
    session.commit()
    return get_owned_conversation(session, user_id, conversation_id)
