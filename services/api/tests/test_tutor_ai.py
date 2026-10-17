from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.ai.config import AISettings
from app.ai.catalog import ModelProvider
from app.ai.provider import ProviderError, ProviderQuotaExceeded
from app.ai.tutor import TutorReply, TutorRequest, TutorTurn, build_tutor_provider
from app.main import create_app


def _configured_settings() -> AISettings:
    return AISettings(
        provider="university",
        base_url="https://example.test/v1",
        model="gemini-2.5-flash-lite",
        api_key="test-only-key",
    )


def _provider_response(content: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [
                {"message": {"role": "assistant", "content": content}}
            ]
        },
    )


def test_create_app_accepts_tutor_provider_factory():
    provider = object()
    app = create_app(
        database_url="sqlite:///:memory:",
        tutor_provider_factory=lambda _provider_id, _model_id: provider,
    )

    assert app.state.tutor_provider_factory("gemini", "gemini-3.8-flash") is provider


def test_provider_uses_selected_provider_model_and_server_key():
    captured: list[httpx.Request] = []

    async def respond(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return _provider_response(json.dumps({"kind": "answer", "message": "Selected model."}))

    provider = build_tutor_provider(
        _configured_settings(),
        provider_id="openai",
        model_id="gpt-5.4-mini",
        transport=httpx.MockTransport(respond),
    )
    reply = asyncio.run(
        provider.respond(
            TutorRequest(turns=[TutorTurn(role="user", content="Explain this.")])
        )
    )

    assert reply.message == "Selected model."
    assert len(captured) == 1
    assert captured[0].headers["authorization"] == "Bearer test-only-key"
    assert json.loads(captured[0].content)["model"] == "gpt-5.4-mini"


def test_provider_can_use_explicit_selection_without_server_default_model():
    captured: list[httpx.Request] = []

    async def respond(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return _provider_response(json.dumps({"kind": "answer", "message": "Selected model."}))

    settings = AISettings(
        provider="university",
        base_url="https://example.test/v1",
        model=None,
        api_key="test-only-key",
    )
    provider = build_tutor_provider(
        settings,
        provider_id="openai",
        model_id="gpt-5.4-mini",
        transport=httpx.MockTransport(respond),
    )

    reply = asyncio.run(
        provider.respond(
            TutorRequest(turns=[TutorTurn(role="user", content="Explain this.")])
        )
    )

    assert reply.message == "Selected model."
    assert json.loads(captured[0].content)["model"] == "gpt-5.4-mini"


def test_provider_encodes_images_as_openai_compatible_user_content_blocks(monkeypatch):
    import app.ai.catalog as catalog

    monkeypatch.setattr(
        catalog,
        "PROVIDERS",
        (ModelProvider("test-provider", "Test Provider", ("vision-v1",), frozenset({"vision-v1"})),),
    )
    captured: list[httpx.Request] = []

    async def respond(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return _provider_response(json.dumps({"kind": "answer", "message": "A triangle."}))

    provider = build_tutor_provider(
        _configured_settings(),
        provider_id="test-provider",
        model_id="vision-v1",
        transport=httpx.MockTransport(respond),
    )
    asyncio.run(
        provider.respond(
            TutorRequest(
                turns=[
                    TutorTurn(
                        role="user",
                        content="What is in this picture?",
                        images=[{"mime_type": "image/png", "base64_data": "aGVsbG8="}],
                    )
                ]
            )
        )
    )

    payload = json.loads(captured[0].content)
    assert payload["messages"][1]["content"] == [
        {"type": "text", "text": "What is in this picture?"},
        {
            "type": "image_url",
            "image_url": {"url": "data:image/png;base64,aGVsbG8="},
        },
    ]
    assert "image" in payload["messages"][0]["content"].lower()


def test_provider_rejects_image_turn_for_model_without_image_capability():
    requests: list[httpx.Request] = []

    async def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _provider_response(json.dumps({"kind": "answer", "message": "Unexpected."}))

    provider = build_tutor_provider(
        _configured_settings(),
        provider_id="gemini",
        model_id="gemini-3.8-flash",
        transport=httpx.MockTransport(respond),
    )

    with pytest.raises(ProviderError):
        asyncio.run(
            provider.respond(
                TutorRequest(
                    turns=[
                        TutorTurn(
                            role="user",
                            content="Look at the picture.",
                            images=[{"mime_type": "image/png", "base64_data": "aGVsbG8="}],
                        )
                    ]
                )
            )
        )

    assert requests == []


def test_provider_returns_valid_answer():
    captured: list[httpx.Request] = []
    content = json.dumps({"kind": "answer", "message": "เซตคือกลุ่มของสมาชิก"})

    async def respond(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return _provider_response(content)

    provider = build_tutor_provider(
        _configured_settings(),
        transport=httpx.MockTransport(respond),
    )
    reply = asyncio.run(
        provider.respond(
            TutorRequest(
                turns=[TutorTurn(role="user", content="เซตคืออะไร?")],
                tag_labels=["คณิตศาสตร์"],
            )
        )
    )

    assert reply == TutorReply(kind="answer", message="เซตคือกลุ่มของสมาชิก")
    assert len(captured) == 1
    assert str(captured[0].url) == "https://example.test/v1/chat/completions"
    assert captured[0].headers["authorization"] == "Bearer test-only-key"
    payload = json.loads(captured[0].content)
    assert payload["model"] == "gemini-2.5-flash-lite"
    assert payload["stream"] is False
    assert payload["messages"][0]["role"] == "system"
    assert "เซตคืออะไร?" in json.dumps(payload["messages"], ensure_ascii=False)
    assert "คณิตศาสตร์" in json.dumps(payload["messages"], ensure_ascii=False)


def test_provider_instructs_the_selected_response_language():
    captured: list[httpx.Request] = []

    async def respond(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return _provider_response(json.dumps({"kind": "answer", "message": "The empty set has no members."}))

    provider = build_tutor_provider(
        _configured_settings(),
        transport=httpx.MockTransport(respond),
    )
    asyncio.run(
        provider.respond(
            TutorRequest(
                turns=[TutorTurn(role="user", content="Explain the empty set.")],
                response_language="en",
            )
        )
    )

    system_prompt = json.loads(captured[0].content)["messages"][0]["content"]
    assert "English" in system_prompt


def test_provider_returns_clarification():
    async def respond(_request: httpx.Request) -> httpx.Response:
        return _provider_response(
            json.dumps(
                {
                    "kind": "clarification",
                    "message": "โจทย์ถามเรื่องสับเซตหรือเพาเวอร์เซต?",
                }
            )
        )

    provider = build_tutor_provider(
        _configured_settings(),
        transport=httpx.MockTransport(respond),
    )

    reply = asyncio.run(
        provider.respond(
            TutorRequest(
                turns=[TutorTurn(role="user", content="ช่วยอธิบายข้อนี้")],
                tag_labels=[],
            )
        )
    )

    assert reply == TutorReply(
        kind="clarification",
        message="โจทย์ถามเรื่องสับเซตหรือเพาเวอร์เซต?",
    )


def test_provider_rejects_malformed_result():
    private_body = '{"kind":"answer","message":"raw detail","unexpected":true}'

    async def respond(_request: httpx.Request) -> httpx.Response:
        return _provider_response(private_body)

    provider = build_tutor_provider(
        _configured_settings(),
        transport=httpx.MockTransport(respond),
    )

    with pytest.raises(ProviderError) as caught:
        asyncio.run(
            provider.respond(
                TutorRequest(
                    turns=[TutorTurn(role="user", content="ช่วยอธิบาย")],
                    tag_labels=[],
                )
            )
        )

    assert "raw detail" not in str(caught.value)
    assert "unexpected" not in str(caught.value)


def test_provider_maps_quota_and_network_failure_to_safe_errors():
    async def quota_response(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            json={
                "error": {
                    "message": "private account quota diagnostics",
                    "code": "insufficient_quota",
                }
            },
        )

    quota_provider = build_tutor_provider(
        _configured_settings(),
        transport=httpx.MockTransport(quota_response),
    )
    request = TutorRequest(
        turns=[TutorTurn(role="user", content="ช่วยอธิบาย")],
        tag_labels=[],
    )

    with pytest.raises(ProviderQuotaExceeded) as quota_error:
        asyncio.run(quota_provider.respond(request))
    assert quota_error.value.provider_name == "Gemini"
    assert "private account quota diagnostics" not in str(quota_error.value)

    async def network_failure(http_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("private network detail", request=http_request)

    network_provider = build_tutor_provider(
        _configured_settings(),
        transport=httpx.MockTransport(network_failure),
    )
    with pytest.raises(ProviderError) as network_error:
        asyncio.run(network_provider.respond(request))
    assert "private network detail" not in str(network_error.value)
