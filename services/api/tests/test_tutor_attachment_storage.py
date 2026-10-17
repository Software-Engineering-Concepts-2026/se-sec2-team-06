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
