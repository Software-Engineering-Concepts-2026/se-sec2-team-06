from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


TagColor = Literal[
    "violet",
    "blue",
    "cyan",
    "teal",
    "green",
    "lime",
    "amber",
    "orange",
    "rose",
    "pink",
]


class TagSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", frozen=True)

    id: int
    name: str
    parent_id: int | None
    is_builtin: bool
    color: TagColor


class TagCatalogResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tags: list[TagSummary]


class TagCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(min_length=1, max_length=40)
    color: TagColor = "violet"

    @field_validator("name", mode="before")
    @classmethod
    def trim_and_validate_name(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value or not value.isprintable():
            raise ValueError("Tag name must contain printable characters")
        return value
