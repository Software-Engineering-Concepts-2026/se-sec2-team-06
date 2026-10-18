from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from starlette.formparsers import MultiPartParser

from app.models import Document, Tag
from app.storage.providers import StorageProviderError


class _MemoryStorageProvider:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}
        self.put_calls: list[tuple[str, str, str]] = []
        self.read_calls: list[tuple[str, str]] = []
        self.delete_calls: list[tuple[str, str]] = []
        self.fail_put = False

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        return f"{owner_id}/object-{len(self.put_calls) + 1}{suffix}"

    def put(self, bucket: str, key: str, content: bytes, content_type: str) -> None:
        self.put_calls.append((bucket, key, content_type))
        if self.fail_put:
            raise StorageProviderError("provider is unavailable")
        self.objects[(bucket, key)] = (content, content_type)

    def read(self, bucket: str, key: str) -> bytes:
        self.read_calls.append((bucket, key))
        try:
            return self.objects[(bucket, key)][0]
        except KeyError as error:
            raise FileNotFoundError from error

    def delete(self, bucket: str, key: str) -> None:
        self.delete_calls.append((bucket, key))
        self.objects.pop((bucket, key), None)


def _new_client(client_factory, tmp_path: Path):
    return client_factory(
        document_storage_dir=tmp_path / "documents",
        document_staging_dir=tmp_path / "document-staging",
    )


def _register(client, email="owner@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"display_name": "Document Owner", "email": email, "password": "studyPlan42"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _upload(client, filename="lesson.txt", content=b"Set theory is a branch of mathematics.", title=None):
    data = {"title": title} if title is not None else {}
    response = client.post(
        "/api/documents",
        data=data,
        files={"file": (filename, content, "application/octet-stream")},
        headers={"Origin": "http://testserver"},
    )
    return response


def _document_storage_path(client, document_id: int) -> Path:
    with client.app.state.session_factory() as session:
        document = session.get(Document, document_id)
        assert document is not None
        return client.app.state.document_storage_dir / document.storage_key


def test_document_endpoints_require_a_signed_in_user(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        listed = client.get("/api/documents")
        uploaded = _upload(client)

    assert listed.status_code == 401
    assert uploaded.status_code == 401


def test_document_upload_rejects_unauthenticated_request_before_parsing_multipart(
    client_factory, tmp_path, monkeypatch
):
    def unexpected_parse(_parser):
        raise AssertionError("multipart parser ran before authentication")

    monkeypatch.setattr(MultiPartParser, "parse", unexpected_parse)
    with _new_client(client_factory, tmp_path) as client:
        response = _upload(client, content=b"small document")

    assert response.status_code == 401


def test_document_upload_rejects_declared_oversize_before_parsing_multipart(
    client_factory, tmp_path, monkeypatch
):
    from app.middleware.quiz_upload_guard import MAX_DOCUMENT_REQUEST_BYTES

    def unexpected_parse(_parser):
        raise AssertionError("oversized document request reached multipart parser")

    monkeypatch.setattr(MultiPartParser, "parse", unexpected_parse)
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        body = b"x" * (MAX_DOCUMENT_REQUEST_BYTES + 1)
        response = client.post(
            "/api/documents",
            content=body,
            headers={
                "Origin": "http://testserver",
                "Content-Type": "multipart/form-data; boundary=test",
            },
        )

    assert response.status_code == 413


def test_document_upload_bounds_streamed_body_without_content_length(client_factory, tmp_path):
    from app.middleware.quiz_upload_guard import MAX_DOCUMENT_REQUEST_BYTES

    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        cookie = client.cookies.get("synapsesync_session")
        total_bytes = MAX_DOCUMENT_REQUEST_BYTES + 1024 * 1024
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
            "path": "/api/documents",
            "raw_path": b"/api/documents",
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
    assert MAX_DOCUMENT_REQUEST_BYTES < consumed <= MAX_DOCUMENT_REQUEST_BYTES + 16 * 1024
    assert consumed < total_bytes


def test_upload_stores_private_original_and_extracted_text_for_search_and_reading(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        uploaded = _upload(client, content=b"The cardinality of a finite set is its number of elements.")

        assert uploaded.status_code == 201, uploaded.text
        item = uploaded.json()
        assert item["title"] == "lesson"
        assert item["original_filename"] == "lesson.txt"
        assert item["file_type"] == "txt"
        assert "storage_key" not in item
        assert "local_path" not in item
        assert _document_storage_path(client, item["id"]).read_bytes() == (
            b"The cardinality of a finite set is its number of elements."
        )

        text = client.get(f"/api/documents/{item['id']}/text")
        matches = client.get("/api/documents", params={"q": "CARDINALITY"})

    assert text.status_code == 200
    assert text.json() == {
        "text": "The cardinality of a finite set is its number of elements.",
        "text_truncated": False,
        "search_text_truncated": False,
        "search_available": True,
    }
    assert [match["id"] for match in matches.json()] == [item["id"]]


def test_document_library_rejects_docx_uploads_without_storing_them(client_factory, tmp_path):
    from io import BytesIO

    from docx import Document as WordDocument
    from docx.oxml import OxmlElement

    document = WordDocument()
    control = OxmlElement("w:sdt")
    content = OxmlElement("w:sdtContent")
    paragraph = OxmlElement("w:p")
    run = OxmlElement("w:r")
    text = OxmlElement("w:t")
    text.text = "A lesson stored in a Word content control."
    run.append(text)
    paragraph.append(run)
    content.append(paragraph)
    control.append(content)
    document.element.body.insert(0, control)
    data = BytesIO()
    document.save(data)

    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        uploaded = _upload(client, "controlled.docx", data.getvalue())

        with client.app.state.session_factory() as session:
            count = session.scalar(select(func.count(Document.id)))

    assert uploaded.status_code == 415
    assert "PDF, Markdown, and TXT" in uploaded.json()["detail"]
    assert count == 0
    assert list((tmp_path / "documents").iterdir()) == []
    assert list((tmp_path / "document-staging").iterdir()) == []


@pytest.mark.parametrize(
    ("filename", "content", "expected_status"),
    [
        ("legacy.doc", b"not supported", 415),
        ("broken.pdf", b"not a PDF", 415),
        ("empty.txt", b"", 422),
        ("blank.md", b" \n ", 422),
    ],
)
def test_invalid_upload_leaves_no_metadata_or_file(
    client_factory, tmp_path, filename, content, expected_status
):
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        response = _upload(client, filename, content)

        with client.app.state.session_factory() as session:
            count = session.scalar(select(func.count(Document.id)))

    assert response.status_code == expected_status
    assert count == 0
    assert list((tmp_path / "documents").iterdir()) == []
    assert list((tmp_path / "document-staging").iterdir()) == []


def test_oversized_upload_is_rejected_without_partial_storage_or_record(client_factory, tmp_path):
    payload = b"x" * 20_000_001
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        response = _upload(client, "too-large.txt", payload)

        with client.app.state.session_factory() as session:
            count = session.query(Document).count()

    assert response.status_code == 413
    assert count == 0
    assert list((tmp_path / "documents").iterdir()) == []
    assert list((tmp_path / "document-staging").iterdir()) == []


def test_search_escapes_like_wildcards_and_combines_with_tag_filter(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        owner = _register(client)
        literal = _upload(client, "literal.txt", b"100% is written literally; marker _ stays literal")
        other = _upload(client, "ordinary.txt", b"100X is not a percent marker")
        assert literal.status_code == other.status_code == 201
        tags = client.get("/api/tags").json()
        math = next(tag for tag in tags["tags"] if tag["name"] == "คณิตศาสตร์")
        assigned = client.put(
            f"/api/documents/{literal.json()['id']}/tags",
            json={"tag_ids": [math["id"]]},
            headers={"Origin": "http://testserver"},
        )

        by_literal = client.get("/api/documents", params={"q": "%", "tag_id": math["id"]})
        by_casefolded_text = client.get("/api/documents", params={"q": "MARKER", "tag_id": math["id"]})

    assert owner["id"] > 0
    assert assigned.status_code == 200
    assert [item["id"] for item in by_literal.json()] == [literal.json()["id"]]
    assert [item["id"] for item in by_casefolded_text.json()] == [literal.json()["id"]]


def test_search_matches_display_title_and_original_filename_and_supports_paging(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        documents = [
            _upload(client, f"chapter-{index}.txt", f"body {index}".encode(), title=f"Lesson {index}").json()
            for index in range(1, 5)
        ]
        by_title = client.get("/api/documents", params={"q": "LESSON 2"})
        by_filename = client.get("/api/documents", params={"q": "CHAPTER-3.TXT"})
        first_page = client.get("/api/documents", params={"limit": 2, "offset": 0})
        second_page = client.get("/api/documents", params={"limit": 2, "offset": 2})

    assert [item["id"] for item in by_title.json()] == [documents[1]["id"]]
    assert [item["id"] for item in by_filename.json()] == [documents[2]["id"]]
    assert [item["id"] for item in first_page.json()] == [documents[3]["id"], documents[2]["id"]]
    assert [item["id"] for item in second_page.json()] == [documents[1]["id"], documents[0]["id"]]


def test_replace_document_tags_accepts_independent_tags(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        uploaded = _upload(client)
        untagged = _upload(client, "untagged.txt", b"No tags here")
        catalog = client.get("/api/tags").json()
        math = next(tag for tag in catalog["tags"] if tag["name"] == "คณิตศาสตร์")
        biology = next(tag for tag in catalog["tags"] if tag["name"] == "ชีววิทยา")
        created = client.post(
            "/api/tags",
            json={"name": "Finite sets", "color": "cyan"},
            headers={"Origin": "http://testserver"},
        )
        topic_id = created.json()["id"]
        document_id = uploaded.json()["id"]
        assigned = client.put(
            f"/api/documents/{document_id}/tags",
            json={"tag_ids": [math["id"], biology["id"], topic_id]},
            headers={"Origin": "http://testserver"},
        )
        removed_one = client.put(
            f"/api/documents/{document_id}/tags",
            json={"tag_ids": [math["id"], topic_id]},
            headers={"Origin": "http://testserver"},
        )
        topic_results = client.get("/api/documents", params={"tag_id": topic_id})

    assert created.status_code == 201
    assert assigned.status_code == 200
    assert {tag["id"] for tag in assigned.json()["tags"]} == {math["id"], biology["id"], topic_id}
    assert removed_one.status_code == 200
    assert {tag["id"] for tag in removed_one.json()["tags"]} == {math["id"], topic_id}
    assert [item["id"] for item in topic_results.json()] == [document_id]
    assert untagged.status_code == 201


def test_document_filter_accepts_parentless_owner_tag(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        _register(client, "flat-document-filter@example.com")
        tagged_document = _upload(client, "tagged.txt", b"one")
        _upload(client, "untagged.txt", b"two")
        custom = client.post(
            "/api/tags",
            json={"name": "Exam review", "color": "amber"},
            headers={"Origin": "http://testserver"},
        )
        assignment = client.put(
            f"/api/documents/{tagged_document.json()['id']}/tags",
            json={"tag_ids": [custom.json()["id"]]},
            headers={"Origin": "http://testserver"},
        )
        filtered = client.get("/api/documents", params={"tag_id": custom.json()["id"]})

    assert custom.status_code == 201, custom.text
    assert assignment.status_code == 200, assignment.text
    assert [item["id"] for item in filtered.json()] == [tagged_document.json()["id"]]


def test_builtin_filter_keeps_legacy_child_matches(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        owner = _register(client, "legacy-child-filter@example.com")
        uploaded = _upload(client)
        math = next(tag for tag in client.get("/api/tags").json()["tags"] if tag["name"] == "คณิตศาสตร์")
        with client.app.state.session_factory() as session:
            legacy_child = Tag(
                name="Legacy subject child",
                name_key="legacy subject child",
                owner_id=owner["id"],
                parent_id=math["id"],
                is_builtin=False,
                color="pink",
            )
            session.add(legacy_child)
            session.flush()
            legacy_child_id = legacy_child.id
            session.commit()
        assigned = client.put(
            f"/api/documents/{uploaded.json()['id']}/tags",
            json={"tag_ids": [legacy_child_id]},
            headers={"Origin": "http://testserver"},
        )
        filtered = client.get("/api/documents", params={"tag_id": math["id"]})

    assert assigned.status_code == 200
    assert [item["id"] for item in filtered.json()] == [uploaded.json()["id"]]


def test_owner_can_rename_and_save_valid_progress_but_invalid_progress_is_rejected(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        uploaded = _upload(client)
        document_id = uploaded.json()["id"]
        renamed = client.patch(
            f"/api/documents/{document_id}",
            json={"title": "  Set theory notes  "},
            headers={"Origin": "http://testserver"},
        )
        saved = client.put(
            f"/api/documents/{document_id}/progress",
            json={"scroll_ratio": 0.5},
            headers={"Origin": "http://testserver"},
        )
        out_of_range = client.put(
            f"/api/documents/{document_id}/progress",
            json={"scroll_ratio": 1.1},
            headers={"Origin": "http://testserver"},
        )
        wrong_kind = client.put(
            f"/api/documents/{document_id}/progress",
            json={"page": 2},
            headers={"Origin": "http://testserver"},
        )

    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Set theory notes"
    assert saved.status_code == 200
    assert saved.json()["scroll_ratio"] == 0.5
    assert out_of_range.status_code == 422
    assert wrong_kind.status_code == 422


def test_pdf_progress_uses_page_and_foreign_topic_tag_is_hidden(client_factory, tmp_path):
    options = {
        "document_storage_dir": tmp_path / "documents",
        "document_staging_dir": tmp_path / "document-staging",
    }
    with client_factory(**options) as owner_client, client_factory(**options) as other_client:
        _register(owner_client, "pdf-owner@example.com")
        _register(other_client, "tag-owner@example.com")
        subject = next(
            item for item in other_client.get("/api/tags").json()["tags"] if item["name"] == "คณิตศาสตร์"
        )
        foreign_topic = other_client.post(
            "/api/tags",
            json={"name": "Foreign topic", "color": "cyan"},
            headers={"Origin": "http://testserver"},
        ).json()
        pdf = (Path(__file__).parent / "fixtures" / "tiny-text.pdf").read_bytes()
        document = _upload(owner_client, "lesson.pdf", pdf).json()
        progress = owner_client.put(
            f"/api/documents/{document['id']}/progress",
            json={"page": 2},
            headers={"Origin": "http://testserver"},
        )
        wrong_progress_kind = owner_client.put(
            f"/api/documents/{document['id']}/progress",
            json={"scroll_ratio": 0.5},
            headers={"Origin": "http://testserver"},
        )
        foreign_assignment = owner_client.put(
            f"/api/documents/{document['id']}/tags",
            json={"tag_ids": [subject["id"], foreign_topic["id"]]},
            headers={"Origin": "http://testserver"},
        )

    assert progress.status_code == 200
    assert progress.json()["last_page"] == 2
    assert progress.json()["scroll_ratio"] is None
    assert wrong_progress_kind.status_code == 422
    assert foreign_assignment.status_code == 404


def test_document_mutations_reject_missing_same_origin_header(client_factory, tmp_path):
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        document = _upload(client).json()
        renamed = client.patch(f"/api/documents/{document['id']}", json={"title": "No origin"})

    assert renamed.status_code == 403


def test_foreign_owner_cannot_list_read_update_tag_progress_or_delete_documents(client_factory, tmp_path):
    options = {
        "document_storage_dir": tmp_path / "documents",
        "document_staging_dir": tmp_path / "document-staging",
    }
    with client_factory(**options) as owner_client, client_factory(**options) as other_client:
        _register(owner_client, "first@example.com")
        document = _upload(owner_client, content=b"Private lesson content").json()
        _register(other_client, "second@example.com")
        document_id = document["id"]

        assert other_client.get("/api/documents").json() == []
        responses = [
            other_client.get(f"/api/documents/{document_id}"),
            other_client.get(f"/api/documents/{document_id}/content"),
            other_client.get(f"/api/documents/{document_id}/text"),
            other_client.patch(
                f"/api/documents/{document_id}",
                json={"title": "Stolen"},
                headers={"Origin": "http://testserver"},
            ),
            other_client.put(
                f"/api/documents/{document_id}/tags",
                json={"tag_ids": []},
                headers={"Origin": "http://testserver"},
            ),
            other_client.put(
                f"/api/documents/{document_id}/progress",
                json={"scroll_ratio": 0.2},
                headers={"Origin": "http://testserver"},
            ),
            other_client.delete(
                f"/api/documents/{document_id}",
                headers={"Origin": "http://testserver"},
            ),
        ]
        file_path = _document_storage_path(owner_client, document_id)
        owner_still_has_document = owner_client.get(f"/api/documents/{document_id}")

    assert [response.status_code for response in responses] == [404] * 7
    assert file_path.exists()
    assert owner_still_has_document.status_code == 200


def test_pdf_content_has_safe_headers_and_delete_removes_record_and_file(client_factory, tmp_path):
    pdf = (Path(__file__).parent / "fixtures" / "tiny-text.pdf").read_bytes()
    with _new_client(client_factory, tmp_path) as client:
        _register(client)
        document = _upload(client, "lesson.pdf", pdf).json()
        document_id = document["id"]
        file_path = _document_storage_path(client, document_id)
        content = client.get(f"/api/documents/{document_id}/content")
        deleted = client.delete(
            f"/api/documents/{document_id}",
            headers={"Origin": "http://testserver"},
        )
        after = client.get(f"/api/documents/{document_id}")

    assert content.status_code == 200
    assert content.headers["content-type"].startswith("application/pdf")
    assert content.headers["x-content-type-options"] == "nosniff"
    assert content.headers["content-disposition"] == "inline"
    assert deleted.status_code == 204
    assert not file_path.exists()
    assert after.status_code == 404


def test_pdf_download_returns_original_bytes_with_encoded_safe_filename(client_factory):
    pdf = (Path(__file__).parent / "fixtures" / "tiny-text.pdf").read_bytes()
    filename = "ชีวะ & สังคม.pdf"
    with client_factory() as client:
        _register(client)
        document = _upload(client, filename, pdf).json()

        downloaded = client.get(f"/api/documents/{document['id']}/download")

    assert downloaded.status_code == 200
    assert downloaded.content == pdf
    assert downloaded.headers["content-type"].startswith("application/pdf")
    assert downloaded.headers["content-disposition"] == (
        'attachment; filename="document.pdf"; filename*=UTF-8\'\'%E0%B8%8A%E0%B8%B5%E0%B8%A7%E0%B8%B0%20%26%20'
        '%E0%B8%AA%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%A1.pdf'
    )
    assert downloaded.headers["cache-control"] == "private, no-store"
    assert downloaded.headers["x-content-type-options"] == "nosniff"


def test_pdf_download_requires_session_and_document_ownership(client_factory):
    pdf = (Path(__file__).parent / "fixtures" / "tiny-text.pdf").read_bytes()
    with client_factory() as owner, client_factory() as other_user, client_factory() as anonymous:
        _register(owner, "download-owner@example.com")
        document = _upload(owner, "lesson.pdf", pdf).json()
        _register(other_user, "download-other@example.com")

        unauthenticated = anonymous.get(f"/api/documents/{document['id']}/download")
        foreign = other_user.get(f"/api/documents/{document['id']}/download")

    assert unauthenticated.status_code == 401
    assert foreign.status_code == 404


def test_pdf_download_rejects_non_pdf_documents(client_factory):
    with client_factory() as client:
        _register(client)
        document = _upload(client, "notes.txt", b"text only").json()

        response = client.get(f"/api/documents/{document['id']}/download")

    assert response.status_code == 415


def test_document_upload_and_pdf_content_use_injected_private_storage(client_factory, tmp_path):
    provider = _MemoryStorageProvider()
    pdf = (Path(__file__).parent / "fixtures" / "tiny-text.pdf").read_bytes()
    with client_factory(
        storage_provider=provider,
        document_storage_dir=tmp_path / "documents",
        document_staging_dir=tmp_path / "document-staging",
    ) as owner, client_factory(
        storage_provider=provider,
        document_storage_dir=tmp_path / "documents",
        document_staging_dir=tmp_path / "document-staging",
    ) as another_user:
        owner_data = _register(owner, "private-storage-owner@example.com")
        uploaded = _upload(owner, "original.pdf", pdf)
        assert uploaded.status_code == 201, uploaded.text
        document_id = uploaded.json()["id"]
        storage_key = provider.put_calls[0][1]
        inline_content = owner.get(f"/api/documents/{document_id}/content")

        _register(another_user, "private-storage-other@example.com")
        read_calls_before_foreign_access = list(provider.read_calls)
        foreign_content = another_user.get(f"/api/documents/{document_id}/content")

    assert provider.put_calls == [("documents", storage_key, "application/pdf")]
    assert storage_key.startswith(f"{owner_data['id']}/")
    assert len(storage_key) <= 64
    assert inline_content.status_code == 200
    assert inline_content.content == pdf
    assert inline_content.headers["content-disposition"] == "inline"
    assert foreign_content.status_code == 404
    assert provider.read_calls == read_calls_before_foreign_access
    assert not list((tmp_path / "documents").iterdir())


def test_document_delete_only_removes_selected_provider_object(client_factory, tmp_path):
    provider = _MemoryStorageProvider()
    with client_factory(
        storage_provider=provider,
        document_storage_dir=tmp_path / "documents",
        document_staging_dir=tmp_path / "document-staging",
    ) as client:
        _register(client)
        first = _upload(client, "first.txt", b"first object").json()
        second = _upload(client, "second.txt", b"second object").json()
        first_key, second_key = provider.put_calls[0][1], provider.put_calls[1][1]

        deleted = client.delete(
            f"/api/documents/{first['id']}",
            headers={"Origin": "http://testserver"},
        )

    assert deleted.status_code == 204
    assert provider.delete_calls == [("documents", first_key)]
    assert ("documents", first_key) not in provider.objects
    assert provider.objects[("documents", second_key)][0] == b"second object"


def test_document_upload_database_failure_compensates_provider_object(client_factory, monkeypatch):
    provider = _MemoryStorageProvider()
    with client_factory(storage_provider=provider) as client:
        _register(client)

        def fail_commit(_session):
            raise SQLAlchemyError("database unavailable")

        monkeypatch.setattr(Session, "commit", fail_commit)
        response = _upload(client, "temporary.txt", b"validated text")
        monkeypatch.undo()
        listing = client.get("/api/documents")

    assert response.status_code == 500
    assert provider.put_calls == [("documents", provider.put_calls[0][1], "text/plain")]
    assert provider.delete_calls == [("documents", provider.put_calls[0][1])]
    assert provider.objects == {}
    assert listing.status_code == 200
    assert listing.json() == []


def test_uploaded_document_and_extracted_text_survive_api_restart(client_factory, tmp_path):
    options = {
        "document_storage_dir": tmp_path / "documents",
        "document_staging_dir": tmp_path / "document-staging",
    }
    with client_factory(**options) as client:
        _register(client)
        document = _upload(client, content=b"Persisted private reading text").json()
        session_cookie = client.cookies.get("synapsesync_session")

    with client_factory(**options) as restarted:
        restarted.cookies.set("synapsesync_session", session_cookie)
        metadata = restarted.get(f"/api/documents/{document['id']}")
        text = restarted.get(f"/api/documents/{document['id']}/text")

    assert metadata.status_code == 200
    assert text.status_code == 200
    assert text.json()["text"] == "Persisted private reading text"


def test_document_library_reader_progress_and_delete_flow_is_owner_scoped(client_factory, tmp_path):
    options = {
        "document_storage_dir": tmp_path / "documents",
        "document_staging_dir": tmp_path / "document-staging",
    }
    with client_factory(**options) as owner, client_factory(**options) as another_user:
        _register(owner, "library-owner@example.com")
        uploaded = _upload(
            owner,
            "finite-sets.md",
            b"# Finite sets\n\nA finite set has a countable number of elements.",
            title="Finite sets: introduction",
        )
        assert uploaded.status_code == 201, uploaded.text
        document_id = uploaded.json()["id"]

        subjects = owner.get("/api/tags").json()["tags"]
        math = next(tag for tag in subjects if tag["name"] == "คณิตศาสตร์")
        topic = owner.post(
            "/api/tags",
            json={"name": "Finite sets", "color": "cyan"},
            headers={"Origin": "http://testserver"},
        )
        assert topic.status_code == 201, topic.text
        assigned = owner.put(
            f"/api/documents/{document_id}/tags",
            json={"tag_ids": [math["id"], topic.json()["id"]]},
            headers={"Origin": "http://testserver"},
        )

        library = owner.get(
            "/api/documents",
            params={"q": "FINITE SETS", "tag_id": topic.json()["id"]},
        )
        reader_metadata = owner.get(f"/api/documents/{document_id}")
        reader_text = owner.get(f"/api/documents/{document_id}/text")
        saved_progress = owner.put(
            f"/api/documents/{document_id}/progress",
            json={"scroll_ratio": 0.42},
            headers={"Origin": "http://testserver"},
        )
        resumed_metadata = owner.get(f"/api/documents/{document_id}")
        resumed_text = owner.get(f"/api/documents/{document_id}/text")
        file_path = _document_storage_path(owner, document_id)

        _register(another_user, "library-other@example.com")
        other_list = another_user.get("/api/documents")
        other_metadata = another_user.get(f"/api/documents/{document_id}")
        other_text = another_user.get(f"/api/documents/{document_id}/text")
        other_progress = another_user.put(
            f"/api/documents/{document_id}/progress",
            json={"scroll_ratio": 0.9},
            headers={"Origin": "http://testserver"},
        )
        other_delete = another_user.delete(
            f"/api/documents/{document_id}",
            headers={"Origin": "http://testserver"},
        )

        deleted = owner.delete(
            f"/api/documents/{document_id}",
            headers={"Origin": "http://testserver"},
        )
        empty_library = owner.get("/api/documents")

    assert assigned.status_code == 200
    assert [item["id"] for item in library.json()] == [document_id]
    assert {tag["id"] for tag in library.json()[0]["tags"]} == {math["id"], topic.json()["id"]}
    assert reader_metadata.status_code == 200
    assert reader_text.json()["text"].startswith("# Finite sets")
    assert saved_progress.status_code == 200
    assert resumed_metadata.json()["scroll_ratio"] == 0.42
    assert resumed_text.json() == reader_text.json()
    assert other_list.json() == []
    assert [other_metadata.status_code, other_text.status_code, other_progress.status_code, other_delete.status_code] == [404] * 4
    assert deleted.status_code == 204
    assert empty_library.json() == []
    assert not file_path.exists()
