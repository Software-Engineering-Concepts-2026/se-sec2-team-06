from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Document, Quiz, Tag


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
