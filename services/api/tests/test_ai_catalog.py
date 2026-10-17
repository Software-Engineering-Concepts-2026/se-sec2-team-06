from __future__ import annotations

from app.ai.catalog import resolve_model_selection
from app.ai.config import AISettings

from conftest import registration_payload, same_origin_headers


def _register(client, *, email: str = "ai-catalog@example.com") -> None:
    response = client.post(
        "/api/auth/register",
        json=registration_payload(email=email),
        headers=same_origin_headers(),
    )
    assert response.status_code == 201


def test_ai_provider_catalog_requires_authentication(client_factory) -> None:
    with client_factory() as client:
        response = client.get("/api/ai/providers")

    assert response.status_code == 401


def test_ai_provider_catalog_includes_image_capabilities_and_default_selection(client_factory) -> None:
    settings = AISettings(
        provider="university",
        base_url="https://example.invalid/v1",
        model="gemini-3.8-flash",
        api_key="server-only-secret",
    )
    with client_factory(ai_settings=settings) as client:
        _register(client)
        response = client.get("/api/ai/providers")

    assert response.status_code == 200
    body = response.json()
    assert body["default_selection"] == {
        "provider_id": "gemini",
        "model_id": "gemini-3.8-flash",
    }
    gemini = next(item for item in body["providers"] if item["id"] == "gemini")
    selected_model = next(
        model for model in gemini["models"] if model["id"] == "gemini-3.8-flash"
    )
    assert selected_model == {
        "id": "gemini-3.8-flash",
        "name": "gemini-3.8-flash",
        "supports_images": False,
    }
    assert all(
        model["supports_images"] is False
        for provider in body["providers"]
        for model in provider["models"]
    )
    assert "server-only-secret" not in response.text
    assert "api_key" not in response.text.lower()


def test_unknown_model_is_not_resolved_as_image_capable() -> None:
    try:
        resolve_model_selection("gemini", "unconfirmed-vision-model")
    except ValueError:
        pass
    else:
        raise AssertionError("an unknown model must not be accepted as image-capable")
