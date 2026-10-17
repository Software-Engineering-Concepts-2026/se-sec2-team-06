from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TutorMessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4_000)
    request_id: str = Field(min_length=1, max_length=80)
    provider_id: str | None = Field(default=None, min_length=1, max_length=40)
    model_id: str | None = Field(default=None, min_length=1, max_length=160)
    response_language: Literal["th", "en"] = "th"
    attachment_ids: list[int] = Field(default_factory=list, max_length=3)

    @field_validator("message", "request_id", mode="before")
    @classmethod
    def trim_required_text(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def require_selection_pair(self):
        if bool(self.provider_id) != bool(self.model_id):
            raise ValueError("Provider and model must be selected together")
        if len(set(self.attachment_ids)) != len(self.attachment_ids):
            raise ValueError("Attachment IDs must be unique")
        return self


class TutorConversationCreate(TutorMessageInput):
    tag_ids: list[int] = Field(default_factory=list, max_length=10)


class TutorRetryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_id: str | None = Field(default=None, min_length=1, max_length=40)
    model_id: str | None = Field(default=None, min_length=1, max_length=160)
    response_language: Literal["th", "en"] | None = None

    @model_validator(mode="after")
    def require_selection_pair(self):
        if bool(self.provider_id) != bool(self.model_id):
            raise ValueError("Provider and model must be selected together")
        return self


class TutorTagSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    parent_id: int | None
    is_builtin: bool


class TutorAttachmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str = Field(validation_alias="original_filename")
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    byte_size: int


class TutorMessageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence: int
    role: Literal["user", "assistant"]
    kind: Literal["question", "clarification_reply", "answer", "clarification"]
    content: str
    created_at: datetime
    provider_id: str | None = None
    model_id: str | None = None
    response_language: Literal["th", "en"] = "th"
    attachments: list[TutorAttachmentSummary] = Field(default_factory=list)

    @field_validator("created_at", mode="before")
    @classmethod
    def add_utc_to_naive_timestamp(cls, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class TutorConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: Literal["processing", "awaiting_clarification", "retryable_error", "answered"]
    provider_id: str | None
    model_id: str | None
    created_at: datetime
    updated_at: datetime
    tags: list[TutorTagSummary]

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def add_utc_to_naive_timestamps(cls, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class TutorConversationDetail(TutorConversationSummary):
    messages: list[TutorMessageSummary]
