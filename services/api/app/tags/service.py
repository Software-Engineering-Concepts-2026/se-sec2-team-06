from __future__ import annotations

from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Deadline, Document, Quiz, Tag
from app.models.document import document_tags
from app.models.tag import quiz_tags, tutor_conversation_tags


class DuplicateTagNameError(ValueError):
    """Raised when a user repeats a flat tag name."""


class QuizOrTagNotFoundError(LookupError):
    """Raised when a quiz or tag is unavailable to the current user."""


class TagAssignmentPersistenceError(RuntimeError):
    """Raised when the replacement transaction cannot be committed."""


class DocumentOrTagNotFoundError(LookupError):
    """Raised when a document or a tag is unavailable to the current user."""


class DocumentTagAssignmentPersistenceError(RuntimeError):
    """Raised when a document-tag replacement cannot be committed."""


class TagNotFoundError(LookupError):
    """Raised when a tag is not an editable custom tag owned by the user."""


class TagHasChildrenError(ValueError):
    """Raised when deleting a tag would orphan its child tags."""


def list_tag_catalog(session: Session, user_id: int) -> dict[str, list[dict[str, object]]]:
    builtins = session.scalars(
        select(Tag)
        .where(Tag.is_builtin.is_(True), Tag.parent_id.is_(None), Tag.owner_id.is_(None))
        .order_by(Tag.id.asc())
    ).all()
    custom_tags = session.scalars(
        select(Tag)
        .where(Tag.is_builtin.is_(False), Tag.owner_id == user_id)
        .order_by(Tag.id.asc())
    ).all()

    return {
        "tags": [
            {
                "id": tag.id,
                "name": tag.name,
                "color": tag.color,
                "is_builtin": tag.is_builtin,
                "parent_id": tag.parent_id,
            }
            for tag in [*builtins, *custom_tags]
        ]
    }


def create_tag(
    session: Session,
    user_id: int,
    name: str,
    color: str = "violet",
) -> Tag:
    normalized_name = name.strip().casefold()
    duplicate_id = session.scalar(
        select(Tag.id).where(
            Tag.owner_id == user_id,
            Tag.parent_id.is_(None),
            Tag.name_key == normalized_name,
        )
    )
    if duplicate_id is not None:
        raise DuplicateTagNameError("A tag with this name already exists")

    tag = Tag(
        name=name.strip(),
        name_key=normalized_name,
        slug=None,
        owner_id=user_id,
        parent_id=None,
        is_builtin=False,
        color=color,
    )
    session.add(tag)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise DuplicateTagNameError("A tag with this name already exists") from error
    session.refresh(tag)
    return tag


def _owned_custom_tag(session: Session, user_id: int, tag_id: int) -> Tag:
    tag = session.scalar(
        select(Tag).where(
            Tag.id == tag_id,
            Tag.is_builtin.is_(False),
            Tag.owner_id == user_id,
        )
    )
    if tag is None:
        raise TagNotFoundError("ไม่พบแท็กที่แก้ไขได้")
    return tag


def update_tag(
    session: Session,
    user_id: int,
    tag_id: int,
    name: str,
    color: str,
) -> Tag:
    tag = _owned_custom_tag(session, user_id, tag_id)
    normalized_name = name.strip().casefold()
    duplicate_id = session.scalar(
        select(Tag.id).where(
            Tag.owner_id == user_id,
            Tag.parent_id.is_(tag.parent_id) if tag.parent_id is None else Tag.parent_id == tag.parent_id,
            Tag.name_key == normalized_name,
            Tag.id != tag_id,
        )
    )
    if duplicate_id is not None:
        raise DuplicateTagNameError("A tag with this name already exists")

    tag.name = name.strip()
    tag.name_key = normalized_name
    tag.color = color
    session.execute(
        update(Deadline)
        .where(Deadline.tag_id == tag_id)
        .values(subject=tag.name)
    )
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise DuplicateTagNameError("A tag with this name already exists") from error
    session.refresh(tag)
    return tag


def delete_tag(session: Session, user_id: int, tag_id: int) -> None:
    tag = _owned_custom_tag(session, user_id, tag_id)
    child_id = session.scalar(select(Tag.id).where(Tag.parent_id == tag_id).limit(1))
    if child_id is not None:
        raise TagHasChildrenError("ลบแท็กนี้ไม่ได้ เพราะยังมีแท็กย่อยอยู่")

    session.execute(delete(quiz_tags).where(quiz_tags.c.tag_id == tag_id))
    session.execute(delete(document_tags).where(document_tags.c.tag_id == tag_id))
    session.execute(delete(tutor_conversation_tags).where(tutor_conversation_tags.c.tag_id == tag_id))
    session.execute(update(Deadline).where(Deadline.tag_id == tag_id).values(tag_id=None))
    session.delete(tag)
    session.commit()


def replace_quiz_tags(
    session: Session,
    user_id: int,
    quiz_id: int,
    tag_ids: list[int],
) -> Quiz:
    quiz = session.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions), selectinload(Quiz.tags))
        .where(Quiz.id == quiz_id, Quiz.user_id == user_id)
    )
    if quiz is None:
        raise QuizOrTagNotFoundError("The quiz is not available")

    allowed_tag_clause = or_(
        and_(
            Tag.is_builtin.is_(True),
            Tag.owner_id.is_(None),
            Tag.parent_id.is_(None),
        ),
        and_(
            Tag.is_builtin.is_(False),
            Tag.owner_id == user_id,
        ),
    )
    tags = (
        session.scalars(
            select(Tag).where(Tag.id.in_(tag_ids), allowed_tag_clause).order_by(Tag.id)
        ).all()
        if tag_ids
        else []
    )
    if len(tags) != len(tag_ids):
        raise QuizOrTagNotFoundError("The requested tags are not available")

    quiz.tags = list(tags)
    try:
        session.commit()
        session.refresh(quiz)
    except SQLAlchemyError as error:
        session.rollback()
        raise TagAssignmentPersistenceError("Unable to save quiz tags") from error
    return quiz


def replace_document_tags(
    session: Session,
    user_id: int,
    document_id: int,
    tag_ids: list[int],
) -> Document:
    document = session.scalar(
        select(Document)
        .options(selectinload(Document.tags))
        .where(Document.id == document_id, Document.user_id == user_id)
    )
    if document is None:
        raise DocumentOrTagNotFoundError("The document is not available")

    tags = (
        session.scalars(
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
        if tag_ids
        else []
    )
    if len(tags) != len(tag_ids):
        raise DocumentOrTagNotFoundError("The requested tags are not available")

    document.tags = list(tags)
    try:
        session.commit()
        session.refresh(document)
    except SQLAlchemyError as error:
        session.rollback()
        raise DocumentTagAssignmentPersistenceError("Unable to save document tags") from error
    return document
