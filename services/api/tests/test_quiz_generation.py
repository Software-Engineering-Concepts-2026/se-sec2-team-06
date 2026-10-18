from __future__ import annotations

import asyncio
import json
from io import BytesIO
from pathlib import Path

import pytest
from starlette.formparsers import MultiPartParser
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.ai.catalog import ModelSelection
from app.ai.config import AISettings
from app.ai.provider import ProviderError, ProviderQuotaExceeded
from app.models import Quiz, QuizQuestion
from app.routers.quizzes import read_upload_limited
from app.services.document_extractor import MAX_UPLOAD_BYTES, UploadTooLargeError


def _registration_payload():
    return {
        "display_name": "Study Learner",
        "email": "learner@example.com",
        "password": "studyPlan42",
    }


def _same_origin_headers():
    return {"Origin": "http://testserver"}


class FakeUpload:
    filename = "large.txt"
    content_type = "text/plain"

    def __init__(self, content: bytes):
        self.content = content
        self.offset = 0
        self.bytes_read = 0
        self.read_sizes: list[int] = []

    async def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)
        chunk = self.content[self.offset : self.offset + size]
        self.offset += len(chunk)
        self.bytes_read += len(chunk)
        return chunk


class FakeProvider:
    provider_name = "fake"
    model_name = "fake-model"

    def __init__(self, responses=None, error: Exception | None = None):
        self.responses = list(responses or [])
        self.error = error
        self.requests = []

    async def generate_quiz(self, request):
        self.requests.append(request)
        if self.error is not None:
            raise self.error
        if not self.responses:
            raise AssertionError("FakeProvider has no more configured responses")
        response = self.responses.pop(0)
        return response if isinstance(response, str) else json.dumps(response)


class _MemoryStorageProvider:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}
        self.put_calls: list[tuple[str, str, bytes, str]] = []
        self.delete_calls: list[tuple[str, str]] = []
        self._next_key_id = 0

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        self._next_key_id += 1
        return f"{owner_id}/{self._next_key_id:043d}{suffix}"

    def put(self, bucket: str, key: str, content: bytes, content_type: str) -> None:
        self.put_calls.append((bucket, key, content, content_type))
        self.objects[(bucket, key)] = (content, content_type)

    def read(self, bucket: str, key: str) -> bytes:
        return self.objects[(bucket, key)][0]

    def delete(self, bucket: str, key: str) -> None:
        self.delete_calls.append((bucket, key))
        self.objects.pop((bucket, key), None)


def _register(client):
    response = client.post(
        "/api/auth/register",
        json=_registration_payload(),
        headers=_same_origin_headers(),
    )
    assert response.status_code == 201
    return response.json()


def _question(kind: str = "multiple_choice", position: int = 1):
    common = {
        "kind": kind,
        "prompt": f"Question {position}?",
        "explanation": "The source supports this answer.",
        "evidence": "The source states this fact.",
        "source_locator": "Heading: Topic",
    }
    if kind == "true_false":
        return {**common, "correct_answer": True}
    return {
        **common,
        "choices": ["A", "B", "C", "D"],
        "correct_answer": 1,
    }


def _valid_quiz(count: int = 5, kind: str = "multiple_choice"):
    return {
        "title": "Generated study quiz",
        "questions": [_question(kind, position) for position in range(1, count + 1)],
    }


def _docx_bytes() -> bytes:
    from docx import Document

    document = Document()
    document.add_paragraph("Original DOCX source text.")
    stream = BytesIO()
    document.save(stream)
    return stream.getvalue()


def _form_data(
    question_count: str = "5",
    question_types=None,
    *,
    provider: str = "gemini",
    model: str = "gemini-2.5-flash-lite",
):
    types = question_types or ["multiple_choice"]
    return {
        "question_count": question_count,
        "language": "th",
        "difficulty": "intermediate",
        "question_types": types,
        "provider": provider,
        "model": model,
    }


def _generate(client, content: bytes = b"# Topic\r\n\r\nStudy content.", filename="lesson.md", data=None):
    return client.post(
        "/api/quizzes/generate",
        files={"file": (filename, content, "text/plain")},
        data=data or _form_data(),
        headers=_same_origin_headers(),
    )


def test_generate_requires_authenticated_same_origin_request(client_factory):
    with client_factory(quiz_provider=FakeProvider([_valid_quiz()])) as client:
        unauthenticated = _generate(client)
        assert unauthenticated.status_code == 401

        _register(client)
        missing_origin = client.post(
            "/api/quizzes/generate",
            files={"file": ("lesson.md", b"content", "text/markdown")},
            data=_form_data(),
        )

    assert missing_origin.status_code == 403


def test_generate_rejects_unauthenticated_request_before_parsing_multipart(
    client_factory, monkeypatch
):
    def unexpected_parse(_parser):
        raise AssertionError("multipart parser ran before authentication")

    monkeypatch.setattr(MultiPartParser, "parse", unexpected_parse)
    with client_factory(quiz_provider=FakeProvider([_valid_quiz()])) as client:
        response = _generate(client, content=b"x" * 1024)

    assert response.status_code == 401


def test_generate_rejects_declared_oversize_before_parsing_multipart(
    client_factory, monkeypatch
):
    from app.middleware.quiz_upload_guard import MAX_QUIZ_REQUEST_BYTES

    def unexpected_parse(_parser):
        raise AssertionError("oversized request reached multipart parser")

    monkeypatch.setattr(MultiPartParser, "parse", unexpected_parse)
    with client_factory(quiz_provider=FakeProvider([_valid_quiz()])) as client:
        _register(client)
        body = b"x" * (MAX_QUIZ_REQUEST_BYTES + 1)
        response = client.post(
            "/api/quizzes/generate",
            content=body,
            headers={
                **_same_origin_headers(),
                "Content-Type": "multipart/form-data; boundary=test",
            },
        )

    assert response.status_code == 413


def test_generate_stream_bounds_multipart_consumption_without_content_length(
    client_factory, monkeypatch
):
    from app.middleware.quiz_upload_guard import MAX_QUIZ_REQUEST_BYTES

    parser = MultiPartParser.parse
    parser_called = False

    async def track_parse(instance):
        nonlocal parser_called
        parser_called = True
        return await parser(instance)

    monkeypatch.setattr(MultiPartParser, "parse", track_parse)
    with client_factory(quiz_provider=FakeProvider([_valid_quiz()])) as client:
        _register(client)
        cookie = client.cookies.get("synapsesync_session")
        total_bytes = MAX_QUIZ_REQUEST_BYTES + 1024 * 1024
        multipart_prefix = (
            b"--test\r\n"
            b'Content-Disposition: form-data; name="file"; filename="lesson.txt"\r\n'
            b"Content-Type: text/plain\r\n\r\n"
        )
        multipart_suffix = b"\r\n--test--\r\n"
        body = (
            multipart_prefix
            + b"x" * (total_bytes - len(multipart_prefix) - len(multipart_suffix))
            + multipart_suffix
        )
        offset = 0
        consumed = 0
        messages = []

        async def receive():
            nonlocal offset, consumed
            if offset >= len(body):
                return {"type": "http.request", "body": b"", "more_body": False}
            size = min(16 * 1024, len(body) - offset)
            offset += size
            consumed = offset
            return {
                "type": "http.request",
                "body": body[offset - size : offset],
                "more_body": offset < len(body),
            }

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/quizzes/generate",
            "raw_path": b"/api/quizzes/generate",
            "query_string": b"",
            "root_path": "",
            "headers": [
                (b"host", b"testserver"),
                (b"origin", b"http://testserver"),
                (b"cookie", f"synapsesync_session={cookie}".encode()),
                (b"content-type", b"multipart/form-data; boundary=test"),
            ],
            "client": ("testclient", 123),
            "server": ("testserver", 80),
            "state": {},
            "app": client.app,
        }

        asyncio.run(client.app(scope, receive, send))

    status_code = next(
        message["status"]
        for message in messages
        if message["type"] == "http.response.start"
    )
    assert status_code == 413, messages
    assert MAX_QUIZ_REQUEST_BYTES < consumed <= MAX_QUIZ_REQUEST_BYTES + 16 * 1024
    assert consumed < total_bytes
    assert parser_called is True


def test_generate_validates_options_and_supported_file(client_factory):
    with client_factory(quiz_provider=FakeProvider([_valid_quiz()])) as client:
        _register(client)
        invalid_options = _generate(client, data=_form_data(question_count="4"))
        unsupported_file = _generate(client, filename="lesson.doc")

    assert invalid_options.status_code == 422
    assert unsupported_file.status_code == 415


def test_authenticated_provider_catalog_lists_selectable_models(client_factory):
    with client_factory() as client:
        _register(client)
        response = client.get("/api/quizzes/providers")

    assert response.status_code == 200
    catalog = response.json()
    gemini = next(provider for provider in catalog["providers"] if provider["id"] == "gemini")
    assert "gemini-2.5-flash-lite" in [model["id"] for model in gemini["models"]]
    assert "api_key" not in response.text.lower()


def test_generate_rejects_model_that_does_not_belong_to_selected_provider(client_factory):
    provider = FakeProvider([_valid_quiz()])
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(
            client,
            data=_form_data(provider="gemini", model="gpt-5.4"),
        )

    assert response.status_code == 422
    assert provider.requests == []


def test_generate_uses_the_selected_provider_and_model(client_factory):
    created = []

    def provider_factory(provider_id: str, model_id: str):
        selected = FakeProvider([_valid_quiz()])
        selected.provider_name = "Claude" if provider_id == "claude" else provider_id
        selected.model_name = model_id
        created.append((provider_id, model_id, selected))
        return selected

    with client_factory(quiz_provider_factory=provider_factory) as client:
        _register(client)
        response = _generate(
            client,
            data=_form_data(provider="claude", model="claude-sonnet-5.5"),
        )
        with client.app.state.session_factory() as session:
            saved_quiz = session.scalar(select(Quiz))

    assert response.status_code == 201
    assert [(provider_id, model_id) for provider_id, model_id, _ in created] == [
        ("claude", "claude-sonnet-5.5")
    ]
    assert saved_quiz.provider == "Claude"
    assert saved_quiz.model == "claude-sonnet-5.5"


def test_generate_uses_normalized_markdown_and_selected_options(client_factory):
    provider = FakeProvider([_valid_quiz()])
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(
            client,
            content=b"\xef\xbb\xbf# Topic\r\n\r\n<!-- private note -->\r\n\r\nThe lesson.",
            data=_form_data(question_types=["multiple_choice", "true_false"]),
        )

    assert response.status_code == 201
    assert provider.requests[0].source_text == "# Topic\n\nThe lesson."
    assert provider.requests[0].options.question_types == ["multiple_choice", "true_false"]


def test_generate_saves_quiz_and_questions_for_current_user(client_factory):
    provider = FakeProvider([_valid_quiz()])
    with client_factory(quiz_provider=provider) as client:
        owner = _register(client)
        response = _generate(client, filename="folder\\lesson.md")
        assert response.status_code == 201
        with client.app.state.session_factory() as session:
            quiz = session.scalar(select(Quiz))
            questions = session.scalars(select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)).all()

    assert quiz.user_id == owner["id"]
    assert quiz.source_filename == "lesson.md"
    assert len(questions) == 5
    assert [question.position for question in questions] == [1, 2, 3, 4, 5]


@pytest.mark.parametrize(
    ("filename", "source_bytes", "expected_content_type"),
    [
        ("lesson.pdf", (Path(__file__).parent / "fixtures" / "tiny-text.pdf").read_bytes(), "application/pdf"),
        (
            "lesson.docx",
            _docx_bytes(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        ("lesson.md", b"# Topic\n\nOriginal text source.", "text/markdown"),
        ("lesson.txt", b"Original plain text source.", "text/plain"),
    ],
    ids=["pdf", "docx", "markdown", "text"],
)
def test_generate_upload_persists_source_key_in_private_storage(
    client_factory,
    filename: str,
    source_bytes: bytes,
    expected_content_type: str,
):
    provider = _MemoryStorageProvider()
    with client_factory(
        quiz_provider=FakeProvider([_valid_quiz()]),
        storage_provider=provider,
    ) as client:
        owner = _register(client)
        response = _generate(client, content=source_bytes, filename=filename)
        with client.app.state.session_factory() as session:
            saved_quiz = session.scalar(select(Quiz))

    assert response.status_code == 201, response.text
    assert saved_quiz is not None
    assert provider.put_calls == [
        ("quiz-sources", saved_quiz.source_storage_key, source_bytes, expected_content_type)
    ]
    assert saved_quiz.source_storage_key.startswith(f"{owner['id']}/")
    assert provider.objects[("quiz-sources", saved_quiz.source_storage_key)] == (
        source_bytes,
        expected_content_type,
    )
    assert saved_quiz.source_storage_key not in response.text


def test_generate_failure_removes_uploaded_source_object(client_factory):
    provider = _MemoryStorageProvider()
    with client_factory(
        quiz_provider=FakeProvider(error=ProviderError("private provider detail")),
        storage_provider=provider,
    ) as client:
        _register(client)
        response = _generate(client, filename="lesson.txt", content=b"Original source text.")

    assert response.status_code == 502
    assert len(provider.put_calls) == 1
    assert provider.put_calls[0][0] == "quiz-sources"
    assert provider.delete_calls == [("quiz-sources", provider.put_calls[0][1])]
    assert provider.objects == {}


def test_generate_database_failure_removes_uploaded_source_object(client_factory, monkeypatch):
    provider = _MemoryStorageProvider()
    with client_factory(
        quiz_provider=FakeProvider([_valid_quiz()]),
        storage_provider=provider,
    ) as client:
        _register(client)

        def fail_commit(_session):
            raise SQLAlchemyError("database unavailable")

        monkeypatch.setattr(Session, "commit", fail_commit)
        response = _generate(client, filename="lesson.txt", content=b"Original source text.")
        monkeypatch.undo()
        with client.app.state.session_factory() as session:
            saved_quizzes = session.scalars(select(Quiz)).all()

    assert response.status_code == 500
    assert saved_quizzes == []
    assert len(provider.put_calls) == 1
    assert provider.put_calls[0][0] == "quiz-sources"
    assert provider.delete_calls == [("quiz-sources", provider.put_calls[0][1])]
    assert provider.objects == {}


def test_generate_response_never_contains_answer_key(client_factory):
    with client_factory(quiz_provider=FakeProvider([_valid_quiz()])) as client:
        _register(client)
        response = _generate(client)

    assert response.status_code == 201
    assert "correct_answer" not in response.text
    assert "explanation" not in response.text
    assert len(response.json()["questions"]) == 5


def test_generate_rejects_extracted_text_over_limit_without_provider_call(client_factory):
    provider = FakeProvider([_valid_quiz()])
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client, filename="long.txt", content=b"x" * 20_001)

    assert response.status_code == 422
    assert provider.requests == []


def test_generate_stops_reading_after_20mb_plus_one_byte():
    upload = FakeUpload(b"x" * (MAX_UPLOAD_BYTES + 10_000))

    with pytest.raises(UploadTooLargeError):
        asyncio.run(read_upload_limited(upload))

    assert upload.bytes_read == MAX_UPLOAD_BYTES + 1
    assert all(size <= 64 * 1024 for size in upload.read_sizes)


def test_generate_returns_503_when_provider_is_unconfigured(client_factory):
    settings = AISettings(provider="unconfigured", base_url=None, model=None, api_key=None)
    with client_factory(ai_settings=settings) as client:
        _register(client)
        response = _generate(client)

    assert response.status_code == 503
    assert "api key" in response.json()["detail"].lower()


def test_insufficient_material_returns_422_without_saving(client_factory):
    provider = FakeProvider([{"status": "insufficient_material", "message": "Add more content."}])
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client)
        with client.app.state.session_factory() as session:
            saved_quizzes = session.scalars(select(Quiz)).all()

    assert response.status_code == 422
    assert saved_quizzes == []
    assert len(provider.requests) == 1


def test_malformed_provider_json_retries_once_then_fails_without_saving(client_factory):
    provider = FakeProvider(["{broken", "still not json"])
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client)
        with client.app.state.session_factory() as session:
            saved_quizzes = session.scalars(select(Quiz)).all()

    assert response.status_code == 502
    assert saved_quizzes == []
    assert len(provider.requests) == 2
    assert provider.requests[1].repair_errors


def test_whitespace_provider_text_retries_once_then_fails_without_saving(client_factory):
    malformed = _valid_quiz()
    malformed["questions"][0]["evidence"] = " \t "
    provider = FakeProvider([malformed, malformed])
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client)
        with client.app.state.session_factory() as session:
            saved_quizzes = session.scalars(select(Quiz)).all()

    assert response.status_code == 502
    assert saved_quizzes == []
    assert len(provider.requests) == 2
    assert provider.requests[1].repair_errors


def test_provider_failure_saves_no_partial_quiz(client_factory):
    provider = FakeProvider(error=ProviderError("private provider diagnostic"))
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client)
        with client.app.state.session_factory() as session:
            saved_quizzes = session.scalars(select(Quiz)).all()

    assert response.status_code == 502
    assert saved_quizzes == []


def test_provider_quota_error_identifies_provider_and_saves_no_quiz(client_factory):
    quota_error = ProviderQuotaExceeded(
        ModelSelection("gemini", "Gemini", "gemini-2.5-flash-lite")
    )
    provider = FakeProvider(error=quota_error)
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client)
        with client.app.state.session_factory() as session:
            saved_quizzes = session.scalars(select(Quiz)).all()

    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "provider_quota_full"
    assert response.json()["detail"]["provider"] == "gemini"
    assert response.json()["detail"]["provider_name"] == "Gemini"
    assert "เต็ม" in response.json()["detail"]["message"]
    assert saved_quizzes == []
    assert len(provider.requests) == 1


def test_provider_error_response_is_sanitized(client_factory):
    secret_detail = "private source excerpt and api-secret-123"
    provider = FakeProvider(error=RuntimeError(secret_detail))
    with client_factory(quiz_provider=provider) as client:
        _register(client)
        response = _generate(client)

    assert response.status_code == 502
    assert secret_detail not in response.text
    assert "api-secret-123" not in response.text
