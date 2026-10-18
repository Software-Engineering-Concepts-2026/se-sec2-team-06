from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class AIModelOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    supports_images: bool


class AIProviderOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    models: list[AIModelOption]


class AIDefaultSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_id: str
    model_id: str


class AIProviderCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid")

    providers: list[AIProviderOption]
    default_selection: AIDefaultSelection | None
