from __future__ import annotations

import secrets
import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from starlette.datastructures import UploadFile

MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


class AvatarTooLargeError(ValueError):
    """The uploaded image exceeds the configured byte limit."""


class InvalidAvatarError(ValueError):
    """The upload is not a supported, valid raster image."""


@dataclass(frozen=True)
class ValidatedAvatar:
    content: bytes
    content_type: str
    suffix: str


def validate_avatar_upload(upload: UploadFile) -> ValidatedAvatar:
    payload = upload.file.read(MAX_AVATAR_BYTES + 1)
    if len(payload) > MAX_AVATAR_BYTES:
        raise AvatarTooLargeError("ภาพโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB")
    if not payload:
        raise InvalidAvatarError("ไฟล์ภาพไม่ถูกต้อง")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(payload)) as image:
                detected_format = image.format
                image.verify()
            with Image.open(BytesIO(payload)) as image:
                image.load()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning, OSError, ValueError, UnidentifiedImageError) as error:
        raise InvalidAvatarError("รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP ที่อ่านได้") from error

    format_details = ALLOWED_FORMATS.get(detected_format or "")
    if format_details is None:
        raise InvalidAvatarError("รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP ที่อ่านได้")

    expected_mime, extension = format_details
    declared_mime = (upload.content_type or "").split(";", 1)[0].strip().lower()
    if declared_mime != expected_mime:
        raise InvalidAvatarError("ชนิดไฟล์ไม่ตรงกับเนื้อหาภาพ")


    return ValidatedAvatar(content=payload, content_type=expected_mime, suffix=extension)


def validate_and_store_avatar(upload: UploadFile, storage_dir: str | Path) -> str:
    """Retain the original local helper for callers that still need local paths."""
    avatar = validate_avatar_upload(upload)
    directory = Path(storage_dir)
    directory.mkdir(parents=True, exist_ok=True)
    storage_key = f"{secrets.token_hex(24)}{avatar.suffix}"
    (directory / storage_key).write_bytes(avatar.content)
    return storage_key
