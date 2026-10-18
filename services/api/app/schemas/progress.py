from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator


class ProgressTagSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: int
    name: str
    color: str
    parent_id: int | None


class ProgressAttemptSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    attempt_id: int
    quiz_id: int
    quiz_title: str
    score: int
    total_questions: int
    submitted_at: datetime
    tags: list[ProgressTagSummary]

    @field_validator("submitted_at", mode="before")
    @classmethod
    def add_utc_to_naive_timestamp(cls, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class TopicProgress(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tag_id: int
    name: str
    color: str
    parent_id: int | None
    attempt_count: int
    latest_attempt: ProgressAttemptSummary


class ProgressOverview(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    topics_practiced: int
    latest_attempt: ProgressAttemptSummary | None
    recent_attempts: list[ProgressAttemptSummary]
    topics: list[TopicProgress]


class TopicProgressDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tag_id: int
    name: str
    color: str
    parent_id: int | None
    attempts: list[ProgressAttemptSummary]
