from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelProvider:
    id: str
    name: str
    models: tuple[str, ...]
    image_capable_models: frozenset[str] = frozenset()


@dataclass(frozen=True)
class ModelSelection:
    provider_id: str
    provider_name: str
    model_id: str
    supports_images: bool = False


PROVIDERS: tuple[ModelProvider, ...] = (
    ModelProvider("claude", "Claude", ("claude-sonnet-5.5", "claude-sonnet-5", "claude-sonnet-4.6")),
    ModelProvider("deepseek", "DeepSeek", ("deepseek-v4-pro", "deepseek-v4-flash")),
    ModelProvider(
        "gemini",
        "Gemini",
        (
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.1-pro-preview",
            "gemini-3.1-flash-lite",
            "gemini-3.1-flash-lite-preview",
            "gemini-2.5-flash-lite",
        ),
    ),
    ModelProvider("meta-ai", "Meta AI", ("llama-4-maverick", "llama-4-scout")),
    ModelProvider("mistral", "Mistral", ("mistral-medium-3.1",)),
    ModelProvider("nova-aws", "Nova (AWS)", ("nova-2-lite-v1", "nova-pro-v1")),
    ModelProvider(
        "openai",
        "OpenAI",
        (
            "gpt-6-sol-pro",
            "gpt-6-luna-pro",
            "gpt-5.6-terra-pro",
            "gpt-5.6-luna-pro",
            "gpt-5.4",
            "gpt-5.4-mini",
            "gpt-5.4-nano",
            "gpt-5-mini",
            "gpt-5-nano",
        ),
    ),
    ModelProvider("perplexity", "Perplexity", ("sonar-pro",)),
    ModelProvider("qwen", "Qwen", ("qwen3.5-9b",)),
    ModelProvider("xai", "xAI", ("grok-4.3",)),
)


def get_provider_catalog() -> list[dict[str, object]]:
    return [
        {
            "id": provider.id,
            "name": provider.name,
            "models": [
                {
                    "id": model,
                    "name": model,
                    "supports_images": model in provider.image_capable_models,
                }
                for model in provider.models
            ],
        }
        for provider in PROVIDERS
    ]


def find_model_selection(provider_id: str | None, model_id: str | None) -> ModelSelection | None:
    if not model_id:
        return None
    normalized_provider = provider_id.strip().casefold() if provider_id else None
    normalized_model = model_id.strip()
    for provider in PROVIDERS:
        if normalized_provider is not None and normalized_provider != provider.id:
            continue
        if normalized_model in provider.models:
            return ModelSelection(
                provider.id,
                provider.name,
                normalized_model,
                supports_images=normalized_model in provider.image_capable_models,
            )
    return None


def resolve_model_selection(
    provider_id: str | None,
    model_id: str | None,
    *,
    default_model: str | None = None,
) -> ModelSelection:
    if not provider_id and not model_id:
        model_id = default_model
    selection = find_model_selection(provider_id, model_id)
    if selection is None:
        raise ValueError("เลือก Provider และโมเดลที่รองรับจากรายการ")
    return selection
