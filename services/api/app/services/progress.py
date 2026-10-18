from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Quiz, QuizAttempt, Tag
from app.models.tag import quiz_tags
from app.schemas.progress import (
    ProgressAttemptSummary,
    ProgressOverview,
    ProgressTagSummary,
    TopicProgress,
    TopicProgressDetail,
)


class ProgressTagNotFoundError(Exception):
    pass


def _available_tag_condition(user_id: int):
    return or_(Tag.is_builtin.is_(True), Tag.owner_id == user_id)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _available_tag(session: Session, user_id: int, tag_id: int) -> Tag:
    tag = session.scalar(
        select(Tag).where(Tag.id == tag_id, _available_tag_condition(user_id))
    )
    if tag is None:
        raise ProgressTagNotFoundError
    return tag


def _subject_tag_ids(session: Session, user_id: int, subject: Tag) -> list[int]:
    if not subject.is_builtin or subject.parent_id is not None:
        return [subject.id]

    available_ids = {subject.id}
    frontier = [subject.id]
    while frontier:
        children = list(
            session.scalars(
                select(Tag.id).where(
                    Tag.parent_id.in_(frontier),
                    _available_tag_condition(user_id),
                )
            )
        )
        frontier = [tag_id for tag_id in children if tag_id not in available_ids]
        available_ids.update(frontier)
    return sorted(available_ids)


def _query_predicates(user_id: int, query: str | None, tag_ids: Sequence[int] | None):
    predicates = [Quiz.user_id == user_id, QuizAttempt.user_id == user_id]
    if tag_ids is not None:
        predicates.append(Quiz.tags.any(Tag.id.in_(tag_ids)))
    search = (query or "").strip()
    if search:
        pattern = f"%{_escape_like(search)}%"
        matching_tag = Quiz.tags.any(
            and_(_available_tag_condition(user_id), Tag.name.ilike(pattern, escape="\\"))
        )
        predicates.append(or_(Quiz.title.ilike(pattern, escape="\\"), matching_tag))
    return predicates


def _load_attempts(
    session: Session,
    user_id: int,
    *,
    query: str | None = None,
    tag_ids: Sequence[int] | None = None,
) -> list[QuizAttempt]:
    statement = (
        select(QuizAttempt)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .options(selectinload(QuizAttempt.quiz).selectinload(Quiz.tags))
        .where(*_query_predicates(user_id, query, tag_ids))
        .order_by(QuizAttempt.submitted_at.desc(), QuizAttempt.id.desc())
    )
    return list(session.scalars(statement).unique().all())


def _visible_tags(attempt: QuizAttempt, user_id: int) -> list[Tag]:
    return sorted(
        (tag for tag in attempt.quiz.tags if tag.is_builtin or tag.owner_id == user_id),
        key=lambda tag: (tag.parent_id or 0, tag.name_key, tag.id),
    )


def _attempt_summary(attempt: QuizAttempt, user_id: int) -> ProgressAttemptSummary:
    return ProgressAttemptSummary(
        attempt_id=attempt.id,
        quiz_id=attempt.quiz_id,
        quiz_title=attempt.quiz.title,
        score=attempt.score,
        total_questions=attempt.total_questions,
        submitted_at=attempt.submitted_at,
        tags=[
            ProgressTagSummary(
                id=tag.id,
                name=tag.name,
                color=tag.color,
                parent_id=tag.parent_id,
            )
            for tag in _visible_tags(attempt, user_id)
        ],
    )


def _topic_attempt_counts(
    session: Session,
    user_id: int,
    *,
    query: str | None,
    selected_tag_ids: Sequence[int] | None,
) -> dict[int, int]:
    statement = (
        select(Tag.id, func.count(func.distinct(QuizAttempt.id)))
        .select_from(QuizAttempt)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(quiz_tags, quiz_tags.c.quiz_id == Quiz.id)
        .join(Tag, Tag.id == quiz_tags.c.tag_id)
        .where(
            Quiz.user_id == user_id,
            QuizAttempt.user_id == user_id,
            _available_tag_condition(user_id),
        )
        .group_by(Tag.id)
    )
    search = (query or "").strip()
    if search:
        pattern = f"%{_escape_like(search)}%"
        matching_tag = Quiz.tags.any(
            and_(_available_tag_condition(user_id), Tag.name.ilike(pattern, escape="\\"))
        )
        statement = statement.where(or_(Quiz.title.ilike(pattern, escape="\\"), matching_tag))
    if selected_tag_ids is not None:
        statement = statement.where(Tag.id.in_(selected_tag_ids))
    return {int(tag_id): int(count) for tag_id, count in session.execute(statement)}


def get_progress_overview(
    session: Session,
    user_id: int,
    *,
    query: str | None = None,
    tag_id: int | None = None,
) -> ProgressOverview:
    selected_tag_ids = None
    if tag_id is not None:
        selected_tag = _available_tag(session, user_id, tag_id)
        selected_tag_ids = _subject_tag_ids(session, user_id, selected_tag)

    attempts = _load_attempts(
        session,
        user_id,
        query=query,
        tag_ids=selected_tag_ids,
    )
    recent_attempts = [_attempt_summary(attempt, user_id) for attempt in attempts]
    counts = _topic_attempt_counts(
        session,
        user_id,
        query=query,
        selected_tag_ids=selected_tag_ids,
    )

    latest_by_tag: dict[int, ProgressAttemptSummary] = {}
    tag_by_id: dict[int, Tag] = {}
    for attempt, summary in zip(attempts, recent_attempts, strict=True):
        for tag in _visible_tags(attempt, user_id):
            if selected_tag_ids is not None and tag.id not in selected_tag_ids:
                continue
            if tag.id in counts and tag.id not in latest_by_tag:
                tag_by_id[tag.id] = tag
                latest_by_tag[tag.id] = summary

    topics = [
        TopicProgress(
            tag_id=tag_id_value,
            name=tag_by_id[tag_id_value].name,
            color=tag_by_id[tag_id_value].color,
            parent_id=tag_by_id[tag_id_value].parent_id,
            attempt_count=count,
            latest_attempt=latest_by_tag[tag_id_value],
        )
        for tag_id_value, count in counts.items()
        if tag_id_value in tag_by_id and tag_id_value in latest_by_tag
    ]
    topics.sort(key=lambda item: (item.parent_id or 0, item.name.casefold(), item.tag_id))
    return ProgressOverview(
        topics_practiced=len(topics),
        latest_attempt=recent_attempts[0] if recent_attempts else None,
        recent_attempts=recent_attempts,
        topics=topics,
    )


def get_topic_progress(
    session: Session,
    user_id: int,
    tag_id: int,
) -> TopicProgressDetail:
    tag = _available_tag(session, user_id, tag_id)
    matching_ids = _subject_tag_ids(session, user_id, tag)
    attempts = _load_attempts(session, user_id, tag_ids=matching_ids)
    summaries = [
        _attempt_summary(attempt, user_id)
        for attempt in attempts
        if any(item.id in matching_ids for item in _visible_tags(attempt, user_id))
    ]
    return TopicProgressDetail(
        tag_id=tag.id,
        name=tag.name,
        color=tag.color,
        parent_id=tag.parent_id,
        attempts=summaries,
    )
