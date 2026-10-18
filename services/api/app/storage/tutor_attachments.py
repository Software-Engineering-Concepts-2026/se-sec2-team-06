from __future__ import annotations

import logging
import re
import warnings
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, UnidentifiedImageError
from starlette.datastructures import UploadFile

from app.storage.providers import FileStorageProvider, StorageBucket

MAX_TUTOR_ATTACHMENT_BYTES = 5 * 1024 * 1024
_ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}
_STORAGE_KEY_PATTERN = re.compile(
    r"\A(?:[0-9a-f]{48}|[1-9][0-9]{0,18}/[A-Za-z0-9_-]{40,60})\.(?:jpg|png|webp)\Z"
)
_STORAGE_BUCKET: StorageBucket = "tutor-attachments"
_LOGGER = logging.getLogger(__name__)


class TutorAttachmentTooLargeError(ValueError):
    """The uploaded image exceeds the Tutor attachment byte limit."""


class InvalidTutorAttachmentError(ValueError):
    """The attachment is unsupported, corrupt, or has an unsafe storage key."""


@dataclass(frozen=True)
class StoredTutorAttachment:
    storage_key: str
    mime_type: str
    byte_size: int


def _validate_image(payload: bytes, declared_mime: str) -> tuple[str, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(payload)) as image:
                detected_format = image.format
                image.verify()
            with Image.open(BytesIO(payload)) as image:
                image.load()
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        OSError,
        ValueError,
        UnidentifiedImageError,
    ) as error:
        raise InvalidTutorAttachmentError(
            "รองรับเฉพาะภาพ JPEG, PNG หรือ WebP ที่อ่านได้"
        ) from error

    details = _ALLOWED_FORMATS.get(detected_format or "")
    if details is None:
        raise InvalidTutorAttachmentError("รองรับเฉพาะภาพ JPEG, PNG หรือ WebP")
    expected_mime, extension = details
    normalized_mime = (declared_mime or "").split(";", 1)[0].strip().lower()
    if normalized_mime != expected_mime:
        raise InvalidTutorAttachmentError("ชนิดไฟล์ไม่ตรงกับเนื้อหาภาพ")
    return expected_mime, extension


def store_tutor_attachment(
    upload: UploadFile,
    storage: FileStorageProvider,
    owner_id: int,
) -> StoredTutorAttachment:
    payload = upload.file.read(MAX_TUTOR_ATTACHMENT_BYTES + 1)
    if len(payload) > MAX_TUTOR_ATTACHMENT_BYTES:
        raise TutorAttachmentTooLargeError("ภาพต้องมีขนาดไม่เกิน 5 MiB")
    if not payload:
        raise InvalidTutorAttachmentError("ไฟล์ภาพว่างเปล่า")

    mime_type, extension = _validate_image(payload, upload.content_type or "")
    storage_key = storage.new_key(owner_id, extension)
    try:
        storage.put(_STORAGE_BUCKET, storage_key, payload, mime_type)
    except Exception:
        cleanup_tutor_attachments(storage, [storage_key])
        raise
    return StoredTutorAttachment(storage_key, mime_type, len(payload))


def read_tutor_attachment(storage_key: str, storage: FileStorageProvider) -> bytes:
    if not isinstance(storage_key, str) or not _STORAGE_KEY_PATTERN.fullmatch(storage_key):
        raise InvalidTutorAttachmentError("คีย์ไฟล์ภาพไม่ถูกต้อง")
    payload = storage.read(_STORAGE_BUCKET, storage_key)
    if len(payload) > MAX_TUTOR_ATTACHMENT_BYTES:
        raise InvalidTutorAttachmentError("ไฟล์ภาพที่จัดเก็บมีขนาดไม่ถูกต้อง")
    return payload


def cleanup_tutor_attachments(storage: FileStorageProvider, storage_keys: list[str]) -> None:
    for storage_key in storage_keys:
        try:
            storage.delete(_STORAGE_BUCKET, storage_key)
        except Exception:
            # Keep rollback errors from masking the original database/provider failure.
            _LOGGER.warning("Could not remove a Tutor attachment from private storage")
