from __future__ import annotations

import re
import secrets
from pathlib import Path
from typing import Literal, Protocol


StorageBucket = Literal["profile-avatars", "documents", "tutor-attachments", "quiz-sources"]
_LOCAL_KEY = re.compile(r"^[A-Za-z0-9_-]{40,60}(?:\.(?:jpg|png|webp|pdf|docx|md|txt))?$")
_ALLOWED_SUFFIXES = {"", ".jpg", ".png", ".webp", ".pdf", ".docx", ".md", ".txt"}


class StorageConfigurationError(ValueError):
    """The configured storage backend cannot be initialized safely."""


class StorageProviderError(RuntimeError):
    """A storage operation failed without exposing credentials or response bodies."""


class StorageObjectNotFoundError(FileNotFoundError):
    """The requested object does not exist in the configured provider."""


class FileStorageProvider(Protocol):
    def new_key(self, owner_id: int, suffix: str = "") -> str: ...

    def put(self, bucket: StorageBucket, key: str, content: bytes, content_type: str) -> None: ...

    def read(self, bucket: StorageBucket, key: str) -> bytes: ...

    def delete(self, bucket: StorageBucket, key: str) -> None: ...


class LocalStorageProvider:
    """Private local file storage used by development and the existing tests."""

    def __init__(
        self,
        image_storage_dir: str | Path,
        document_storage_dir: str | Path,
        tutor_attachment_storage_dir: str | Path | None = None,
        quiz_source_storage_dir: str | Path | None = None,
    ) -> None:
        data_dir = Path(document_storage_dir).parent
        self._directories: dict[StorageBucket, Path] = {
            "profile-avatars": Path(image_storage_dir),
            "documents": Path(document_storage_dir),
            "tutor-attachments": (
                Path(tutor_attachment_storage_dir)
                if tutor_attachment_storage_dir is not None
                else data_dir / "tutor-attachments"
            ),
            "quiz-sources": (
                Path(quiz_source_storage_dir)
                if quiz_source_storage_dir is not None
                else data_dir / "quiz-sources"
            ),
        }

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        if owner_id <= 0:
            raise ValueError("owner_id must be positive")
        if suffix not in _ALLOWED_SUFFIXES:
            raise ValueError("storage key suffix is unsupported")
        if suffix:
            # Keep the existing avatar-key shape so current local records remain readable.
            return f"{secrets.token_hex(24)}{suffix}"
        return secrets.token_urlsafe(32)

    def put(self, bucket: StorageBucket, key: str, content: bytes, content_type: str) -> None:
        del content_type  # The content type is carried by application metadata/responses.
        path = self._resolve(bucket, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as output:
            output.write(content)

    def read(self, bucket: StorageBucket, key: str) -> bytes:
        return self._resolve(bucket, key).read_bytes()

    def delete(self, bucket: StorageBucket, key: str) -> None:
        self._resolve(bucket, key).unlink(missing_ok=True)

    def _resolve(self, bucket: StorageBucket, key: str) -> Path:
        if bucket not in self._directories:
            raise ValueError("storage bucket is not configured")
        if not isinstance(key, str) or not _LOCAL_KEY.fullmatch(key):
            raise ValueError("storage key is invalid")
        return self._directories[bucket] / key


def create_storage_provider(
    *,
    image_storage_dir: str | Path,
    document_storage_dir: str | Path,
    supabase_url: str | None,
    supabase_secret_key: str | None,
    storage_backend: str | None = None,
    is_render: bool = False,
    tutor_attachment_storage_dir: str | Path | None = None,
    quiz_source_storage_dir: str | Path | None = None,
    http_client: object | None = None,
) -> FileStorageProvider:
    configured_backend = (storage_backend or "").strip().lower() or None
    if configured_backend not in {None, "local", "supabase"}:
        raise StorageConfigurationError("STORAGE_BACKEND must be either local or supabase")
    if is_render and configured_backend != "supabase":
        raise StorageConfigurationError(
            "Render requires STORAGE_BACKEND=supabase; local file storage is not durable"
        )

    has_url = bool((supabase_url or "").strip())
    has_secret = bool((supabase_secret_key or "").strip())
    if has_url != has_secret:
        raise StorageConfigurationError(
            "Set both SUPABASE_URL and SUPABASE_SECRET_KEY to enable Supabase Storage"
        )
    use_supabase = configured_backend == "supabase" or (
        configured_backend is None and has_url and has_secret
    )
    if not use_supabase:
        return LocalStorageProvider(
            image_storage_dir,
            document_storage_dir,
            tutor_attachment_storage_dir,
            quiz_source_storage_dir,
        )
    if not has_url:
        raise StorageConfigurationError(
            "Set both SUPABASE_URL and SUPABASE_SECRET_KEY to enable Supabase Storage"
        )

    try:
        from app.storage.supabase_storage import SupabaseStorageProvider
    except ImportError as error:
        raise StorageConfigurationError("Supabase Storage provider is unavailable") from error
    return SupabaseStorageProvider(
        supabase_url.strip(),
        supabase_secret_key.strip(),
        client=http_client,
    )
