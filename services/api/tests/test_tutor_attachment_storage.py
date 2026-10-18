from __future__ import annotations

from importlib import import_module
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image
from starlette.datastructures import Headers, UploadFile


class _MemoryStorageProvider:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.put_calls: list[tuple[str, str, bytes, str]] = []
        self.read_calls: list[tuple[str, str]] = []
        self.delete_calls: list[tuple[str, str]] = []

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        return f"{owner_id}/{'x' * 43}{suffix}"

    def put(self, bucket: str, key: str, content: bytes, content_type: str) -> None:
        self.put_calls.append((bucket, key, content, content_type))
        self.objects[(bucket, key)] = content

    def read(self, bucket: str, key: str) -> bytes:
        self.read_calls.append((bucket, key))
        return self.objects[(bucket, key)]

    def delete(self, bucket: str, key: str) -> None:
        self.delete_calls.append((bucket, key))
        self.objects.pop((bucket, key), None)


def _local_provider(tmp_path: Path):
    providers = import_module("app.storage.providers")
    return providers.LocalStorageProvider(
        image_storage_dir=tmp_path / "profile-images",
        document_storage_dir=tmp_path / "documents",
        tutor_attachment_storage_dir=tmp_path / "tutor-attachments",
        quiz_source_storage_dir=tmp_path / "quiz-sources",
    )


def _image_bytes(image_format: str = "PNG") -> bytes:
    stream = BytesIO()
    Image.new("RGB", (3, 2), color=(34, 91, 177)).save(stream, format=image_format)
    return stream.getvalue()


def _upload(payload: bytes, mime_type: str, filename: str = "lesson.png") -> UploadFile:
    return UploadFile(
        file=BytesIO(payload),
        filename=filename,
        headers=Headers({"content-type": mime_type}),
    )


def test_store_tutor_attachment_accepts_supported_image_and_uses_random_key(tmp_path: Path) -> None:
    storage = import_module("app.storage.tutor_attachments")
    payload = _image_bytes()

    provider = _local_provider(tmp_path)
    first = storage.store_tutor_attachment(_upload(payload, "image/png"), provider, owner_id=17)
    second = storage.store_tutor_attachment(_upload(payload, "image/png"), provider, owner_id=17)

    assert first.mime_type == "image/png"
    assert first.byte_size == len(payload)
    assert first.storage_key != second.storage_key
    assert Path(first.storage_key).name == first.storage_key
    assert storage.read_tutor_attachment(first.storage_key, provider) == payload
    assert len(list((tmp_path / "tutor-attachments").iterdir())) == 2


def test_store_tutor_attachment_uses_injected_storage_provider() -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _MemoryStorageProvider()
    payload = _image_bytes()

    stored = storage.store_tutor_attachment(_upload(payload, "image/png"), provider, owner_id=17)

    assert provider.put_calls == [
        ("tutor-attachments", stored.storage_key, payload, "image/png")
    ]
    assert provider.objects[("tutor-attachments", stored.storage_key)] == payload
    assert stored.byte_size == len(payload)


def test_read_tutor_attachment_uses_injected_storage_provider() -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _MemoryStorageProvider()
    key = f"17/{'x' * 43}.png"
    payload = _image_bytes()
    provider.put("tutor-attachments", key, payload, "image/png")

    result = storage.read_tutor_attachment(key, provider)

    assert result == payload
    assert provider.read_calls == [("tutor-attachments", key)]


@pytest.mark.parametrize(
    ("payload", "declared_mime"),
    [
        (_image_bytes("PNG"), "image/jpeg"),
        (b"not an image", "image/png"),
    ],
)
def test_store_tutor_attachment_rejects_mime_mismatch_and_corrupt_image(
    tmp_path: Path,
    payload: bytes,
    declared_mime: str,
) -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _local_provider(tmp_path)

    with pytest.raises(storage.InvalidTutorAttachmentError):
        storage.store_tutor_attachment(_upload(payload, declared_mime), provider, owner_id=17)

    assert not (tmp_path / "tutor-attachments").exists()


def test_store_tutor_attachment_rejects_more_than_five_mib_and_cleans_partial_file(
    tmp_path: Path,
) -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _local_provider(tmp_path)
    payload = b"x" * (5 * 1024 * 1024 + 1)

    with pytest.raises(storage.TutorAttachmentTooLargeError):
        storage.store_tutor_attachment(_upload(payload, "image/png"), provider, owner_id=17)

    assert not (tmp_path / "tutor-attachments").exists()


def test_read_tutor_attachment_rejects_path_traversal(tmp_path: Path) -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _local_provider(tmp_path)

    with pytest.raises(storage.InvalidTutorAttachmentError):
        storage.read_tutor_attachment("../outside.png", provider)


def test_store_tutor_attachment_rejects_empty_and_non_image_uploads(tmp_path: Path) -> None:
    from PIL import Image

    storage = import_module("app.storage.tutor_attachments")
    provider = _local_provider(tmp_path)
    empty = _upload(b"", "image/png")
    gif_stream = BytesIO()
    Image.new("RGB", (2, 2), color=(10, 20, 30)).save(gif_stream, format="GIF")

    with pytest.raises(storage.InvalidTutorAttachmentError):
        storage.store_tutor_attachment(empty, provider, owner_id=17)
    with pytest.raises(storage.InvalidTutorAttachmentError, match="JPEG, PNG"):
        storage.store_tutor_attachment(
            _upload(gif_stream.getvalue(), "image/gif"), provider, owner_id=17
        )


@pytest.mark.parametrize("declared_mime", ["IMAGE/PNG", "image/png; charset=binary"])
def test_tutor_attachment_accepts_normalized_image_content_type(
    tmp_path: Path, declared_mime: str
) -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _local_provider(tmp_path)

    stored = storage.store_tutor_attachment(
        _upload(_image_bytes(), declared_mime), provider, owner_id=17
    )

    assert stored.mime_type == "image/png"
    assert stored.storage_key.endswith(".png")


def test_store_tutor_attachment_cleans_up_after_provider_upload_failure(tmp_path: Path) -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _MemoryStorageProvider()

    def failed_put(_bucket, _key, _content, _content_type):
        raise RuntimeError("temporary storage outage")

    provider.put = failed_put
    with pytest.raises(RuntimeError, match="storage outage"):
        storage.store_tutor_attachment(
            _upload(_image_bytes(), "image/png"), provider, owner_id=17
        )

    assert provider.delete_calls == [("tutor-attachments", f"17/{'x' * 43}.png")]


def test_read_tutor_attachment_rejects_oversized_stored_object() -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _MemoryStorageProvider()
    key = f"17/{'x' * 43}.png"
    provider.put("tutor-attachments", key, b"x" * (5 * 1024 * 1024 + 1), "image/png")

    with pytest.raises(storage.InvalidTutorAttachmentError):
        storage.read_tutor_attachment(key, provider)


def test_cleanup_logs_and_suppresses_provider_delete_errors(caplog) -> None:
    storage = import_module("app.storage.tutor_attachments")
    provider = _MemoryStorageProvider()

    def failed_delete(_bucket, _key):
        raise RuntimeError("secret provider detail")

    provider.delete = failed_delete
    storage.cleanup_tutor_attachments(provider, ["17/private-key"])

    assert "Could not remove a Tutor attachment" in caplog.text
    assert "secret provider detail" not in caplog.text
