from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_serializer, field_validator, model_validator


DeadlinePriority = Literal["high", "medium", "low"]
DeadlineStatus = Literal["not_started", "in_progress", "completed"]


class DeadlineCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: str = Field(min_length=1, max_length=160)
    tag_id: int | None = Field(default=None, ge=1)
    subject: str | None = Field(default=None, min_length=1, max_length=40)
    due_at: datetime
    priority: DeadlinePriority

    @field_validator("title", mode="before")
    @classmethod
    def trim_and_validate_title(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value or not value.isprintable():
            raise ValueError("Title must contain printable characters")
        return value

    @field_validator("subject", mode="before")
    @classmethod
    def trim_and_validate_subject(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value or not value.isprintable():
            raise ValueError("Subject must contain printable characters")
        return value

    @model_validator(mode="after")
    def require_tag_or_legacy_subject(self):
        if self.tag_id is None and self.subject is None:
            raise ValueError("A subject tag is required")
        return self

    @field_validator("due_at")
    @classmethod
    def require_timezone_and_normalize_to_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Deadline must include a timezone")
        return value.astimezone(timezone.utc)


class DeadlineCompletionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    status: DeadlineStatus | None = None
    is_completed: StrictBool | None = None

    @model_validator(mode="after")
    def require_one_status_value(self):
        if self.status is None and self.is_completed is None:
            raise ValueError("A task status is required")
        if self.status is not None and self.is_completed is not None:
            raise ValueError("Provide either status or is_completed")
        return self


class DeadlineSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", frozen=True)

    id: int
    title: str
    subject: str
    tag_id: int | None
    due_at: datetime
    priority: DeadlinePriority
    status: DeadlineStatus
    is_completed: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("due_at", "created_at", "updated_at")
    def serialize_as_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
