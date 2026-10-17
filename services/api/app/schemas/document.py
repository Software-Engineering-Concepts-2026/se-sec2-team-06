from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, field_validator, model_validator

from app.schemas.tag import TagColor


class DocumentTagSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", frozen=True)

    id: int
    name: str
    parent_id: int | None
    is_builtin: bool
    color: TagColor


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    title: str
    original_filename: str
    file_type: Literal["pdf", "docx", "md", "txt"]
    size_bytes: int
    search_text_truncated: bool
    created_at: datetime
    updated_at: datetime
    last_page: int | None
    scroll_ratio: float | None
    tags: list[DocumentTagSummary] = Field(default_factory=list)


class DocumentText(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    text: str
    text_truncated: bool
    search_text_truncated: bool
    search_available: bool


class DocumentTitleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: str = Field(min_length=1, max_length=160)

    @field_validator("title", mode="before")
    @classmethod
    def trim_and_validate_title(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value or not value.isprintable():
            raise ValueError("Title must contain printable characters")
        return value


class DocumentTagAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    tag_ids: list[StrictInt]

    @field_validator("tag_ids")
    @classmethod
    def require_unique_tag_ids(cls, value: list[int]) -> list[int]:
        if any(tag_id <= 0 for tag_id in value):
            raise ValueError("Tag IDs must be positive")
        if len(set(value)) != len(value):
            raise ValueError("Tag IDs must be unique")
        return value


class DocumentProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    page: StrictInt | None = Field(default=None, gt=0)
    scroll_ratio: StrictFloat | None = Field(default=None, ge=0, le=1)

    @model_validator(mode="after")
    def require_one_progress_value(self) -> DocumentProgressUpdate:
        if (self.page is None) == (self.scroll_ratio is None):
            raise ValueError("Provide exactly one progress value")
        return self
