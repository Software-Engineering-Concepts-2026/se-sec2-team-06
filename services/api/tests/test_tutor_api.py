from __future__ import annotations

import asyncio
from dataclasses import replace
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from io import BytesIO
from threading import Event

from PIL import Image
import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import app.ai.catalog as ai_catalog
from app.ai.catalog import ModelSelection
from app.ai.provider import ProviderError, ProviderQuotaExceeded
from app.ai.tutor import TutorReply, TutorRequest
from app.models import TutorAttachment, TutorConversation, TutorMessage
from app.database import create_session_factory


class ScriptedTutorProvider:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests: list[TutorRequest] = []

    async def respond(self, request: TutorRequest) -> TutorReply:
        self.requests.append(request)
        response = self.responses.pop(0) if self.responses else TutorReply(
            kind="answer",
            message="Here is a concise explanation.",
        )
        if isinstance(response, Exception):
            raise response
        return response


class BlockingTutorProvider:
    def __init__(self, *, fail_first: bool = False):
        self.requests: list[TutorRequest] = []
        self.entered = Event()
        self.release = Event()
        self.fail_first = fail_first

    async def respond(self, request: TutorRequest) -> TutorReply:
        self.requests.append(request)
        call_number = len(self.requests)
        if self.fail_first and call_number == 1:
            raise ProviderError("temporary provider failure")
        if call_number == 2:
            self.entered.set()
            await asyncio.to_thread(self.release.wait, 4)
        return TutorReply(kind="answer", message=f"reply-{call_number}")


class IdentifiedTutorProvider(ScriptedTutorProvider):
    def __init__(self, provider_id: str, model_id: str, *responses):
        super().__init__(*responses)
        self.provider_id = provider_id
        self.model_name = model_id


class _MemoryStorageProvider:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}
        self.put_calls: list[tuple[str, str, bytes, str]] = []
        self.read_calls: list[tuple[str, str]] = []
        self.delete_calls: list[tuple[str, str]] = []
        self._next_key_id = 0

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        self._next_key_id += 1
        return f"{owner_id}/{self._next_key_id:043d}{suffix}"

    def put(self, bucket: str, key: str, content: bytes, content_type: str) -> None:
        self.put_calls.append((bucket, key, content, content_type))
        self.objects[(bucket, key)] = (content, content_type)

    def read(self, bucket: str, key: str) -> bytes:
        self.read_calls.append((bucket, key))
        return self.objects[(bucket, key)][0]

    def delete(self, bucket: str, key: str) -> None:
        self.delete_calls.append((bucket, key))
        self.objects.pop((bucket, key), None)


def _register(client, email: str) -> dict[str, object]:
    response = client.post(
        "/api/auth/register",
        json={
            "display_name": "Tutor Learner",
            "email": email,
            "password": "studyPlan42",
        },
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201
    return response.json()


def _create_conversation(client, *, message: str, tag_ids: list[int], request_id: str):
    return client.post(
        "/api/tutor/conversations",
        json={"message": message, "tag_ids": tag_ids, "request_id": request_id},
        headers={"Origin": "http://testserver"},
    )


def _png_bytes() -> bytes:
    stream = BytesIO()
    Image.new("RGB", (3, 2), color=(24, 68, 120)).save(stream, format="PNG")
    return stream.getvalue()


def _enable_test_image_models(monkeypatch, *selections: tuple[str, str]) -> None:
    by_provider: dict[str, set[str]] = {}
    for provider_id, model_id in selections:
        by_provider.setdefault(provider_id, set()).add(model_id)
    monkeypatch.setattr(
        ai_catalog,
        "PROVIDERS",
        tuple(
            replace(
                provider,
                image_capable_models=frozenset(by_provider.get(provider.id, set())),
            )
            for provider in ai_catalog.PROVIDERS
        ),
    )


def _create_with_image(
    client,
    *,
    request_id: str,
    provider_id: str = "openai",
    model_id: str = "gpt-5.4-mini",
    response_language: str = "th",
):
    return client.post(
        "/api/tutor/conversations/with-images",
        data={
            "message": "Please explain the attached diagram.",
            "request_id": request_id,
            "provider_id": provider_id,
            "model_id": model_id,
            "response_language": response_language,
        },
        files={"images": ("diagram.png", _png_bytes(), "image/png")},
        headers={"Origin": "http://testserver"},
    )


def test_selected_provider_and_model_are_persisted_on_each_turn(client_factory):
    provider = IdentifiedTutorProvider("openai", "gpt-5.4-mini")
    with client_factory(tutor_provider=provider) as client:
        _register(client, "selected-tutor-model@example.com")
        response = client.post(
            "/api/tutor/conversations",
            json={
                "message": "Explain this set question.",
                "request_id": "selected-model-question",
                "tag_ids": [],
                "provider_id": "openai",
                "model_id": "gpt-5.4-mini",
            },
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 201, response.text
    messages = response.json()["messages"]
    assert [(item["provider_id"], item["model_id"]) for item in messages] == [
        ("openai", "gpt-5.4-mini"),
        ("openai", "gpt-5.4-mini"),
    ]
    assert response.json()["provider_id"] == "openai"
    assert response.json()["model_id"] == "gpt-5.4-mini"


def test_selected_response_language_is_sent_to_ai_and_persisted(client_factory):
    provider = ScriptedTutorProvider(TutorReply(kind="answer", message="The empty set is a subset of every set."))
    with client_factory(tutor_provider=provider) as client:
        _register(client, "tutor-response-language@example.com")
        response = client.post(
            "/api/tutor/conversations",
            json={
                "message": "Explain the empty set.",
                "request_id": "english-language-question",
                "tag_ids": [],
                "response_language": "en",
            },
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 201, response.text
    assert provider.requests[0].response_language == "en"
    assert [item["response_language"] for item in response.json()["messages"]] == ["en", "en"]


def test_saved_failure_retry_keeps_the_original_response_language(client_factory):
    provider = ScriptedTutorProvider(
        ProviderError("temporary failure"),
        TutorReply(kind="answer", message="Here is the answer."),
    )
    with client_factory(tutor_provider=provider) as client:
        _register(client, "tutor-language-retry@example.com")
        failed = client.post(
            "/api/tutor/conversations",
            json={
                "message": "Explain the empty set.",
                "request_id": "english-retry-question",
                "tag_ids": [],
                "response_language": "en",
            },
            headers={"Origin": "http://testserver"},
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        retried = client.post(
            f"/api/tutor/conversations/{conversation_id}/retry",
            json={},
            headers={"Origin": "http://testserver"},
        )

    assert failed.status_code == 503
    assert retried.status_code == 200, retried.text
    assert [request.response_language for request in provider.requests] == ["en", "en"]
    assert [item["response_language"] for item in retried.json()["messages"]] == ["en", "en"]


def test_saved_failure_retry_can_use_a_new_selected_response_language(client_factory):
    provider = ScriptedTutorProvider(
        ProviderError("temporary failure"),
        TutorReply(kind="answer", message="คำตอบภาษาไทย"),
    )
    with client_factory(tutor_provider=provider) as client:
        _register(client, "tutor-language-retry-override@example.com")
        failed = client.post(
            "/api/tutor/conversations",
            json={
                "message": "Explain the empty set.",
                "request_id": "language-override-question",
                "tag_ids": [],
                "response_language": "en",
            },
            headers={"Origin": "http://testserver"},
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        retried = client.post(
            f"/api/tutor/conversations/{conversation_id}/retry",
            json={"response_language": "th"},
            headers={"Origin": "http://testserver"},
        )

    assert failed.status_code == 503
    assert retried.status_code == 200, retried.text
    assert [request.response_language for request in provider.requests] == ["en", "th"]
    assert [item["response_language"] for item in retried.json()["messages"]] == ["th", "th"]


def test_tutor_rejects_unsupported_response_language(client_factory):
    provider = ScriptedTutorProvider()
    with client_factory(tutor_provider=provider) as client:
        _register(client, "tutor-invalid-language@example.com")
        response = client.post(
            "/api/tutor/conversations",
            json={
                "message": "Explain the empty set.",
                "request_id": "unsupported-language-question",
                "tag_ids": [],
                "response_language": "fr",
            },
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 422
    assert provider.requests == []


def test_image_message_is_saved_before_provider_failure_and_can_retry_without_duplicate_turn(
    client_factory, monkeypatch, tmp_path
):
    _enable_test_image_models(monkeypatch, ("openai", "gpt-5.4-mini"))
    provider = IdentifiedTutorProvider(
        "openai",
        "gpt-5.4-mini",
        ProviderError("private provider detail"),
        TutorReply(kind="answer", message="The diagram shows a set relationship."),
    )
    with client_factory(
        tutor_provider=provider,
        tutor_attachment_storage_dir=tmp_path / "tutor-images",
    ) as client:
        _register(client, "image-retry@example.com")
        failed = _create_with_image(
            client,
            request_id="image-retry-question",
            response_language="en",
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        saved = client.get(f"/api/tutor/conversations/{conversation_id}")
        retried = client.post(
            f"/api/tutor/conversations/{conversation_id}/retry",
            json={"provider_id": "openai", "model_id": "gpt-5.4-mini"},
            headers={"Origin": "http://testserver"},
        )

    assert failed.status_code == 503
    assert saved.status_code == 200
    saved_user = saved.json()["messages"][0]
    assert saved.json()["status"] == "retryable_error"
    assert len(saved_user["attachments"]) == 1
    assert retried.status_code == 200, retried.text
    assert [item["role"] for item in retried.json()["messages"]] == ["user", "assistant"]
    assert len(retried.json()["messages"][0]["attachments"]) == 1
    assert len(provider.requests) == 2
    assert [request.response_language for request in provider.requests] == ["en", "en"]
    assert len(provider.requests[0].turns[-1].images) == 1
    assert len(provider.requests[1].turns[-1].images) == 1
    assert len(list((tmp_path / "tutor-images").iterdir())) == 1


def test_image_attachment_can_be_referenced_again_without_copying_file(
    client_factory, monkeypatch, tmp_path
):
    _enable_test_image_models(monkeypatch, ("openai", "gpt-5.4-mini"))
    provider = IdentifiedTutorProvider("openai", "gpt-5.4-mini")
    with client_factory(
        tutor_provider=provider,
        tutor_attachment_storage_dir=tmp_path / "tutor-images",
    ) as client:
        _register(client, "image-reference@example.com")
        created = _create_with_image(client, request_id="image-reference-start")
        conversation_id = created.json()["id"]
        image_id = created.json()["messages"][0]["attachments"][0]["id"]
        follow_up = client.post(
            f"/api/tutor/conversations/{conversation_id}/messages",
            json={
                "message": "Please use that same diagram again.",
                "request_id": "image-reference-followup",
                "provider_id": "openai",
                "model_id": "gpt-5.4-mini",
                "attachment_ids": [image_id],
            },
            headers={"Origin": "http://testserver"},
        )
        with client.app.state.session_factory() as session:
            stored_count = session.query(TutorAttachment).count()

    assert created.status_code == 201, created.text
    assert follow_up.status_code == 200, follow_up.text
    follow_up_user = follow_up.json()["messages"][-2]
    assert [item["id"] for item in follow_up_user["attachments"]] == [image_id]
    assert len(provider.requests[-1].turns[-1].images) == 1
    assert stored_count == 1
    assert len(list((tmp_path / "tutor-images").iterdir())) == 1


def test_tutor_upload_db_failure_deletes_uploaded_objects(client_factory, monkeypatch, tmp_path):
    _enable_test_image_models(monkeypatch, ("openai", "gpt-5.4-mini"))
    storage = _MemoryStorageProvider()
    with client_factory(
        tutor_provider=IdentifiedTutorProvider("openai", "gpt-5.4-mini"),
        storage_provider=storage,
        tutor_attachment_storage_dir=tmp_path / "tutor-images",
    ) as client:
        _register(client, "tutor-storage-rollback@example.com")

        def fail_commit(_session):
            raise SQLAlchemyError("database unavailable")

        monkeypatch.setattr(Session, "commit", fail_commit)
        with pytest.raises(SQLAlchemyError, match="database unavailable"):
            _create_with_image(client, request_id="tutor-storage-rollback")
        monkeypatch.undo()

    assert len(storage.put_calls) == 1
    bucket, key, payload, content_type = storage.put_calls[0]
    assert (bucket, payload, content_type) == ("tutor-attachments", _png_bytes(), "image/png")
    assert storage.delete_calls == [("tutor-attachments", key)]
    assert storage.objects == {}


def test_attachment_read_and_reference_are_owner_and_conversation_scoped(
    client_factory, monkeypatch, tmp_path
):
    _enable_test_image_models(monkeypatch, ("openai", "gpt-5.4-mini"))
    provider = IdentifiedTutorProvider("openai", "gpt-5.4-mini")
    storage = _MemoryStorageProvider()
    with client_factory(
        tutor_provider=provider,
        storage_provider=storage,
        tutor_attachment_storage_dir=tmp_path / "tutor-images",
    ) as owner, client_factory(tutor_provider=provider, storage_provider=storage) as another_user:
        _register(owner, "image-owner@example.com")
        created = _create_with_image(owner, request_id="private-image-start")
        conversation_id = created.json()["id"]
        attachment_id = created.json()["messages"][0]["attachments"][0]["id"]
        other_conversation = _create_conversation(
            owner,
            message="A separate conversation.",
            tag_ids=[],
            request_id="other-image-conversation",
        ).json()["id"]
        own_read = owner.get(
            f"/api/tutor/conversations/{conversation_id}/attachments/{attachment_id}"
        )
        cross_conversation_read = owner.get(
            f"/api/tutor/conversations/{other_conversation}/attachments/{attachment_id}"
        )
        cross_conversation_reference = owner.post(
            f"/api/tutor/conversations/{other_conversation}/messages",
            json={
                "message": "Try using an image from another conversation.",
                "request_id": "cross-conversation-reference",
                "attachment_ids": [attachment_id],
            },
            headers={"Origin": "http://testserver"},
        )
        _register(another_user, "image-not-owner@example.com")
        reads_before_cross_owner = list(storage.read_calls)
        cross_owner_read = another_user.get(
            f"/api/tutor/conversations/{conversation_id}/attachments/{attachment_id}"
        )
        reads_after_cross_owner = list(storage.read_calls)

    assert created.status_code == 201
    assert own_read.status_code == 200
    assert own_read.headers["content-type"] == "image/png"
    assert cross_conversation_read.status_code == 404
    assert cross_conversation_reference.status_code == 404
    assert cross_owner_read.status_code == 404
    assert reads_after_cross_owner == reads_before_cross_owner
    assert len(storage.put_calls) == 1
    assert storage.put_calls[0][0] == "tutor-attachments"
    assert storage.put_calls[0][2] == _png_bytes()
    assert len(storage.read_calls) == 2


def test_non_image_model_rejects_attachment_before_provider_call(client_factory, tmp_path):
    provider = ScriptedTutorProvider()
    with client_factory(
        tutor_provider=provider,
        tutor_attachment_storage_dir=tmp_path / "tutor-images",
    ) as client:
        _register(client, "text-only-image-model@example.com")
        response = _create_with_image(
            client,
            request_id="text-model-image",
            provider_id="gemini",
            model_id="gemini-3.8-flash",
        )

    assert response.status_code == 422
    assert provider.requests == []
    assert list((tmp_path / "tutor-images").iterdir()) == []


def test_quota_failure_names_selected_provider_and_preserves_image_for_manual_alternate_retry(
    client_factory, monkeypatch, tmp_path
):
    _enable_test_image_models(
        monkeypatch,
        ("gemini", "gemini-3.8-flash"),
        ("openai", "gpt-5.4-mini"),
    )
    factory_calls: list[tuple[str | None, str | None]] = []

    def provider_factory(provider_id: str | None, model_id: str | None):
        factory_calls.append((provider_id, model_id))
        if provider_id == "gemini":
            return IdentifiedTutorProvider(
                "gemini",
                model_id or "gemini-3.8-flash",
                ProviderQuotaExceeded(
                    ModelSelection("gemini", "Gemini", model_id or "gemini-3.8-flash")
                ),
            )
        return IdentifiedTutorProvider(
            "openai",
            model_id or "gpt-5.4-mini",
            TutorReply(kind="answer", message="Retry succeeded with another model."),
        )

    with client_factory(
        tutor_provider_factory=provider_factory,
        tutor_attachment_storage_dir=tmp_path / "tutor-images",
    ) as client:
        _register(client, "image-quota-retry@example.com")
        failed = _create_with_image(
            client,
            request_id="image-quota-question",
            provider_id="gemini",
            model_id="gemini-3.8-flash",
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        retried = client.post(
            f"/api/tutor/conversations/{conversation_id}/retry",
            json={"provider_id": "openai", "model_id": "gpt-5.4-mini"},
            headers={"Origin": "http://testserver"},
        )

    assert failed.status_code == 429
    assert "Gemini" in failed.json()["detail"]["message"]
    assert retried.status_code == 200, retried.text
    assert factory_calls == [
        ("gemini", "gemini-3.8-flash"),
        ("openai", "gpt-5.4-mini"),
    ]
    assert retried.json()["messages"][0]["model_id"] == "gemini-3.8-flash"
    assert retried.json()["messages"][1]["model_id"] == "gpt-5.4-mini"
    assert len(retried.json()["messages"][0]["attachments"]) == 1
    assert len(list((tmp_path / "tutor-images").iterdir())) == 1


def test_empty_message_returns_422_without_provider_call(client_factory):
    provider = ScriptedTutorProvider()
    with client_factory(tutor_provider=provider) as client:
        _register(client, "empty-tutor-question@example.com")

        response = _create_conversation(
            client,
            message=" \t\n ",
            tag_ids=[],
            request_id="empty-question",
        )

    assert response.status_code == 422
    assert provider.requests == []


def test_clarification_reply_uses_same_conversation(client_factory):
    provider = ScriptedTutorProvider(
        TutorReply(kind="clarification", message="Which two sets are you comparing?"),
        TutorReply(kind="answer", message="The union contains both sets' elements."),
    )
    with client_factory(tutor_provider=provider) as client:
        _register(client, "clarification@example.com")
        first = _create_conversation(
            client,
            message="How do I find the union?",
            tag_ids=[],
            request_id="union-question",
        )
        conversation_id = first.json()["id"]
        follow_up = client.post(
            f"/api/tutor/conversations/{conversation_id}/messages",
            json={"message": "A = {1, 2} and B = {2, 3}.", "request_id": "union-context"},
            headers={"Origin": "http://testserver"},
        )

    assert first.status_code == 201
    assert first.json()["status"] == "awaiting_clarification"
    assert follow_up.status_code == 200
    assert follow_up.json()["id"] == conversation_id
    assert follow_up.json()["status"] == "answered"
    assert [message["kind"] for message in follow_up.json()["messages"]] == [
        "question",
        "clarification",
        "clarification_reply",
        "answer",
    ]
    assert [turn.content for turn in provider.requests[1].turns] == [
        "How do I find the union?",
        "Which two sets are you comparing?",
        "A = {1, 2} and B = {2, 3}.",
    ]


def test_replayed_message_request_id_does_not_duplicate_turn(client_factory):
    provider = ScriptedTutorProvider(
        TutorReply(kind="answer", message="A subset contains only elements from the set."),
        TutorReply(kind="answer", message="A proper subset is not equal to the original set."),
    )
    with client_factory(tutor_provider=provider) as client:
        _register(client, "duplicate-message@example.com")
        created = _create_conversation(
            client,
            message="What is a subset?",
            tag_ids=[],
            request_id="create-subset",
        )
        conversation_id = created.json().get("id")
        payload = {"message": "What is a proper subset?", "request_id": "proper-subset-follow-up"}
        first = client.post(
            f"/api/tutor/conversations/{conversation_id}/messages",
            json=payload,
            headers={"Origin": "http://testserver"},
        )
        replay = client.post(
            f"/api/tutor/conversations/{conversation_id}/messages",
            json=payload,
            headers={"Origin": "http://testserver"},
        )

    assert created.status_code == 201
    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json()["id"] == conversation_id
    assert len(replay.json()["messages"]) == 4
    assert len(provider.requests) == 2


def test_pending_clarification_survives_reload(client_factory):
    provider = ScriptedTutorProvider(
        TutorReply(kind="clarification", message="Which chapter is this from?")
    )
    with client_factory(tutor_provider=provider) as client:
        _register(client, "resume-tutor@example.com")
        created = _create_conversation(
            client,
            message="I do not understand this example.",
            tag_ids=[],
            request_id="resume-question",
        )
        conversation_id = created.json()["id"]
        history = client.get("/api/tutor/conversations")
        restored = client.get(f"/api/tutor/conversations/{conversation_id}")

    assert history.status_code == 200
    assert history.json()[0]["status"] == "awaiting_clarification"
    assert restored.status_code == 200
    assert restored.json()["messages"][-1]["content"] == "Which chapter is this from?"


def test_provider_failure_persists_retryable_message(client_factory):
    provider = ScriptedTutorProvider(ProviderError("private provider response body"))
    with client_factory(tutor_provider=provider) as client:
        _register(client, "provider-failure@example.com")
        failed = _create_conversation(
            client,
            message="Why is the empty set a subset?",
            tag_ids=[],
            request_id="retryable-question",
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        stored = client.get(f"/api/tutor/conversations/{conversation_id}")

    assert failed.status_code == 503
    assert "private provider response body" not in failed.text
    assert failed.json()["detail"]["retryable"] is True
    assert stored.status_code == 200
    assert stored.json()["status"] == "retryable_error"
    assert [message["content"] for message in stored.json()["messages"]] == [
        "Why is the empty set a subset?"
    ]


def test_retry_does_not_duplicate_message(client_factory):
    provider = ScriptedTutorProvider(
        ProviderError("temporary provider issue"),
        TutorReply(kind="answer", message="The empty set is a subset of every set."),
    )
    with client_factory(tutor_provider=provider) as client:
        _register(client, "retry-tutor@example.com")
        failed = _create_conversation(
            client,
            message="Why is the empty set a subset?",
            tag_ids=[],
            request_id="same-question-retry",
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        retried = client.post(
            f"/api/tutor/conversations/{conversation_id}/retry",
            headers={"Origin": "http://testserver"},
        )

    assert failed.status_code == 503
    assert retried.status_code == 200
    assert retried.json()["status"] == "answered"
    assert [message["role"] for message in retried.json()["messages"]] == [
        "user",
        "assistant",
    ]
    assert len(provider.requests) == 2


def test_conversation_continues_after_more_than_twenty_exchanges(client_factory):
    provider = ScriptedTutorProvider()
    with client_factory(tutor_provider=provider) as client:
        _register(client, "long-tutor-conversation@example.com")
        created = _create_conversation(
            client,
            message="Starting question",
            tag_ids=[],
            request_id="long-conversation-start",
        )
        conversation_id = created.json()["id"]
        with client.app.state.session_factory() as session:
            conversation = session.get(TutorConversation, conversation_id)
            assert conversation is not None
            for sequence in range(3, 41):
                role = "user" if sequence % 2 else "assistant"
                conversation.messages.append(TutorMessage(
                    sequence=sequence,
                    role=role,
                    kind="question" if role == "user" else "answer",
                    content=f"stored turn {sequence}",
                    request_id=f"stored-turn-{sequence}",
                ))
            conversation.status = "answered"
            session.commit()

        continued = client.post(
            f"/api/tutor/conversations/{conversation_id}/messages",
            json={"message": "Keep going with one more question", "request_id": "long-conversation-next"},
            headers={"Origin": "http://testserver"},
        )

    assert continued.status_code == 200, continued.text
    assert len(provider.requests[1].turns) == 40
    assert provider.requests[1].turns[-1].content == "Keep going with one more question"
    assert len(continued.json()["messages"]) == 42


def test_overlapping_follow_up_is_rejected_while_ai_is_processing(client_factory):
    provider = BlockingTutorProvider()
    with client_factory(tutor_provider=provider) as client:
        _register(client, "overlapping-tutor-turn@example.com")
        created = _create_conversation(
            client,
            message="First question",
            tag_ids=[],
            request_id="overlap-start",
        )
        conversation_id = created.json()["id"]
        first_payload = {"message": "First follow-up", "request_id": "overlap-first"}
        second_payload = {"message": "Second follow-up", "request_id": "overlap-second"}
        headers = {"Origin": "http://testserver"}

        with ThreadPoolExecutor(max_workers=1) as executor:
            first_request = executor.submit(
                client.post,
                f"/api/tutor/conversations/{conversation_id}/messages",
                json=first_payload,
                headers=headers,
            )
            assert provider.entered.wait(timeout=3)
            overlapping = client.post(
                f"/api/tutor/conversations/{conversation_id}/messages",
                json=second_payload,
                headers=headers,
            )
            provider.release.set()
            first = first_request.result(timeout=5)

    assert overlapping.status_code == 409
    assert first.status_code == 200, first.text
    assert len(provider.requests) == 2
    assert first.json()["messages"][-1]["content"] == "reply-2"


def test_only_one_retry_claim_runs_while_ai_retry_is_processing(client_factory):
    provider = BlockingTutorProvider(fail_first=True)
    with client_factory(tutor_provider=provider) as client:
        _register(client, "overlapping-tutor-retry@example.com")
        failed = _create_conversation(
            client,
            message="Retry this explanation",
            tag_ids=[],
            request_id="overlap-retry-start",
        )
        conversation_id = failed.json()["detail"]["conversation_id"]
        headers = {"Origin": "http://testserver"}

        with ThreadPoolExecutor(max_workers=1) as executor:
            first_retry_request = executor.submit(
                client.post,
                f"/api/tutor/conversations/{conversation_id}/retry",
                headers=headers,
            )
            assert provider.entered.wait(timeout=3)
            overlapping = client.post(
                f"/api/tutor/conversations/{conversation_id}/retry",
                headers=headers,
            )
            provider.release.set()
            first_retry = first_retry_request.result(timeout=5)

    assert overlapping.status_code == 409
    assert first_retry.status_code == 200, first_retry.text
    assert len(provider.requests) == 2


def test_tutor_response_timestamps_are_explicitly_utc(client_factory):
    with client_factory(tutor_provider=ScriptedTutorProvider()) as client:
        _register(client, "utc-tutor-timestamps@example.com")
        response = _create_conversation(
            client,
            message="Check the stored time",
            tag_ids=[],
            request_id="utc-tutor-time",
        )
        conversation_id = response.json()["id"]
        detail = client.get(f"/api/tutor/conversations/{conversation_id}")

    assert response.status_code == 201, response.text
    assert detail.status_code == 200, detail.text
    payload = detail.json()
    timestamps = [payload["created_at"], payload["updated_at"], payload["messages"][0]["created_at"]]
    for value in timestamps:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        assert parsed.tzinfo is not None
        assert parsed.utcoffset().total_seconds() == 0


def test_conversation_search_and_tag_filter_are_owner_scoped(client_factory):
    provider = ScriptedTutorProvider()
    with client_factory(tutor_provider=provider) as learner, client_factory(
        tutor_provider=provider
    ) as another_learner:
        _register(learner, "conversation-search-owner@example.com")
        tags = learner.get("/api/tags").json()["tags"]
        math_id = next(tag["id"] for tag in tags if tag["name"] == "คณิตศาสตร์")
        english_id = next(tag["id"] for tag in tags if tag["name"] == "ภาษาอังกฤษ")
        _create_conversation(
            learner,
            message="Set theory basics",
            tag_ids=[math_id],
            request_id="search-math",
        )
        _create_conversation(
            learner,
            message="English grammar notes",
            tag_ids=[english_id],
            request_id="search-english",
        )

        _register(another_learner, "conversation-search-other@example.com")
        _create_conversation(
            another_learner,
            message="Private set theory notes",
            tag_ids=[math_id],
            request_id="search-private",
        )

        searched = learner.get("/api/tutor/conversations", params={"q": "set"})
        by_tag = learner.get(
            "/api/tutor/conversations",
            params={"tag_id": math_id},
        )

    assert searched.status_code == 200
    assert [item["title"] for item in searched.json()] == ["Set theory basics"]
    assert by_tag.status_code == 200
    assert [item["title"] for item in by_tag.json()] == ["Set theory basics"]


def test_foreign_conversation_returns_404(client_factory):
    provider = ScriptedTutorProvider()
    with client_factory(tutor_provider=provider) as owner, client_factory(
        tutor_provider=provider
    ) as other:
        _register(owner, "conversation-owner@example.com")
        created = _create_conversation(
            owner,
            message="Owner-only question",
            tag_ids=[],
            request_id="private-conversation",
        )
        conversation_id = created.json()["id"]
        _register(other, "conversation-reader@example.com")
        hidden = other.get(f"/api/tutor/conversations/{conversation_id}")

    assert hidden.status_code == 404
    assert "owner-only" not in hidden.text.lower()
