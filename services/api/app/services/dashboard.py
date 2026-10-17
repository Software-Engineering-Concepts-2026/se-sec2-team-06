from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Deadline, Document, Quiz, QuizAttempt, Tag
from app.schemas.dashboard import (
    DashboardCountBucket,
    DashboardOverview,
    DashboardTagCount,
    DashboardTaskStatus,
    DashboardWeakTopic,
)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _can_use_tag(tag: Tag, user_id: int) -> bool:
    return (tag.is_builtin and tag.owner_id is None) or (not tag.is_builtin and tag.owner_id == user_id)


def _activity_labels(period: Literal["day", "week"], today: date) -> list[tuple[str, date]]:
    if period == "day":
        first_day = today - timedelta(days=6)
        return [((first_day + timedelta(days=offset)).isoformat(), first_day + timedelta(days=offset)) for offset in range(7)]

    current_monday = today - timedelta(days=today.weekday())
    first_monday = current_monday - timedelta(weeks=7)
    result: list[tuple[str, date]] = []
    for offset in range(8):
        monday = first_monday + timedelta(weeks=offset)
        iso_year, iso_week, _ = monday.isocalendar()
        result.append((f"{iso_year}-W{iso_week:02d}", monday))
    return result


def get_dashboard_overview(
    session: Session,
    user_id: int,
    period: Literal["day", "week"] = "day",
    time_zone: str = "UTC",
    now_utc: datetime | None = None,
) -> DashboardOverview:
    """Build an account-scoped Home summary using the learner's local calendar."""
    try:
        zone = ZoneInfo(time_zone)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError("Invalid IANA time zone") from error

    current_utc = _as_utc(now_utc or datetime.now(timezone.utc))
    today = current_utc.astimezone(zone).date()
    labels = _activity_labels(period, today)
    label_by_day = {bucket_day: label for label, bucket_day in labels}
    counts_by_label = {label: 0 for label, _ in labels}
    first_day = labels[0][1]
    last_day = labels[-1][1]
    last_exclusive = last_day + (timedelta(days=7) if period == "week" else timedelta(days=1))

    attempts = session.scalars(
        select(QuizAttempt)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(
            QuizAttempt.user_id == user_id,
            Quiz.user_id == user_id,
            QuizAttempt.submitted_at.is_not(None),
        )
        .options(selectinload(QuizAttempt.quiz).selectinload(Quiz.tags))
    ).all()

    topic_results: dict[int, dict[str, object]] = {}
    for attempt in attempts:
        submitted = _as_utc(attempt.submitted_at).astimezone(zone)
        local_date = submitted.date()
        if period == "day":
            if first_day <= local_date <= last_day:
                counts_by_label[label_by_day[local_date]] += 1
        else:
            monday = local_date - timedelta(days=local_date.weekday())
            if first_day <= monday < last_exclusive:
                iso_year, iso_week, _ = monday.isocalendar()
                counts_by_label[f"{iso_year}-W{iso_week:02d}"] += 1

        total = int(attempt.total_questions or 0)
        if total <= 0:
            continue
        percent = 100.0 * int(attempt.score or 0) / total
        for tag in attempt.quiz.tags:
            if not _can_use_tag(tag, user_id):
                continue
            aggregate = topic_results.setdefault(
                tag.id,
                {"tag": tag, "total_percent": 0.0, "attempt_count": 0},
            )
            aggregate["total_percent"] = float(aggregate["total_percent"]) + percent
            aggregate["attempt_count"] = int(aggregate["attempt_count"]) + 1

    task_status_counts = {"not_started": 0, "in_progress": 0, "completed": 0}
    deadlines = session.scalars(select(Deadline).where(Deadline.user_id == user_id)).all()
    for deadline in deadlines:
        if deadline.status in task_status_counts:
            task_status_counts[deadline.status] += 1

    document_counts: dict[int, dict[str, object]] = {}
    untagged_count = 0
    documents = session.scalars(
        select(Document)
        .where(Document.user_id == user_id)
        .options(selectinload(Document.tags))
    ).all()
    for document in documents:
        visible_tags = [tag for tag in document.tags if _can_use_tag(tag, user_id)]
        if not visible_tags:
            untagged_count += 1
            continue
        for tag in visible_tags:
            item = document_counts.setdefault(
                tag.id,
                {"tag": tag, "count": 0},
            )
            item["count"] = int(item["count"]) + 1

    documents_by_tag = [
        DashboardTagCount(
            tag_id=tag_id,
            tag_name=str(item["tag"].name),
            color=str(item["tag"].color),
            count=int(item["count"]),
        )
        for tag_id, item in sorted(document_counts.items(), key=lambda entry: (entry[1]["tag"].name.casefold(), entry[0]))
    ]
    if untagged_count:
        documents_by_tag.append(DashboardTagCount(
            tag_id=None,
            tag_name="ยังไม่ติดแท็ก",
            color="violet",
            count=untagged_count,
        ))

    weak_topics = [
        DashboardWeakTopic(
            tag_id=tag_id,
            tag_name=str(item["tag"].name),
            color=str(item["tag"].color),
            average_percent=round(float(item["total_percent"]) / int(item["attempt_count"]), 2),
            attempt_count=int(item["attempt_count"]),
        )
        for tag_id, item in topic_results.items()
    ]
    weak_topics.sort(key=lambda topic: (topic.average_percent, topic.tag_name.casefold(), topic.tag_id))

    return DashboardOverview(
        quiz_activity=[DashboardCountBucket(label=label, count=counts_by_label[label]) for label, _ in labels],
        task_status=DashboardTaskStatus(**task_status_counts),
        documents_by_tag=documents_by_tag,
        topics_to_review=weak_topics,
    )
