from __future__ import annotations

import re
import secrets
from urllib.parse import quote, urlsplit

import httpx

from app.storage.providers import (
    StorageBucket,
    StorageObjectNotFoundError,
    StorageProviderError,
)


_SAFE_KEY_PART = re.compile(r"^[A-Za-z0-9_-]{40,60}(?:\.(?:jpg|png|webp|pdf|docx|md|txt))?$")
_ALLOWED_SUFFIXES = {"", ".jpg", ".png", ".webp", ".pdf", ".docx", ".md", ".txt"}
_BUCKETS: dict[StorageBucket, str] = {
    "profile-avatars": "profile-avatars",
    "documents": "documents",
    "tutor-attachments": "tutor-attachments",
    "quiz-sources": "quiz-sources",
}


class SupabaseStorageProvider:
    """Server-only adapter for private Supabase Storage buckets."""

    def __init__(
        self,
        supabase_url: str,
        secret_key: str,
        *,
        client: httpx.Client | None = None,
        timeout_seconds: float = 20,
    ) -> None:
        parsed_url = urlsplit(supabase_url.strip())
        if parsed_url.scheme != "https" or not parsed_url.netloc or parsed_url.query or parsed_url.fragment:
            raise ValueError("SUPABASE_URL must be an HTTPS project URL")
        if not secret_key.strip():
            raise ValueError("SUPABASE_SECRET_KEY is required")
        self._base_url = supabase_url.rstrip("/")
        self._secret_key = secret_key.strip()
        self._client = client or httpx.Client(timeout=timeout_seconds, follow_redirects=False)
        self._owns_client = client is None
        if client is not None:
            # The new sb_secret key is an API key, not a JWT bearer token.
            self._client.headers.pop("Authorization", None)

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        if owner_id <= 0:
            raise ValueError("owner_id must be positive")
        if suffix not in _ALLOWED_SUFFIXES:
            raise ValueError("storage key suffix is unsupported")
        return f"{owner_id}/{secrets.token_urlsafe(32)}{suffix}"

    def put(self, bucket: StorageBucket, key: str, content: bytes, content_type: str) -> None:
        self._request("POST", bucket, key, content=content, content_type=content_type)

    def read(self, bucket: StorageBucket, key: str) -> bytes:
        response = self._request("GET", bucket, key, private_read=True)
        return response.content

    def delete(self, bucket: StorageBucket, key: str) -> None:
        try:
            self._request("DELETE", bucket, key)
        except StorageObjectNotFoundError:
            return

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def _request(
        self,
        method: str,
        bucket: StorageBucket,
        key: str,
        *,
        content: bytes | None = None,
        content_type: str | None = None,
        private_read: bool = False,
    ) -> httpx.Response:
        bucket_name = _BUCKETS.get(bucket)
        if bucket_name is None:
            raise ValueError("storage bucket is not configured")
        object_path = _validated_key_path(key)
        endpoint = "object/authenticated" if private_read else "object"
        url = f"{self._base_url}/storage/v1/{endpoint}/{quote(bucket_name, safe='')}/{object_path}"
        headers = {"apikey": self._secret_key}
        if content_type:
            headers["Content-Type"] = content_type
        try:
            response = self._client.request(method, url, headers=headers, content=content)
        except httpx.RequestError:
            raise StorageProviderError("Supabase Storage is temporarily unavailable") from None

        if response.status_code == 404 and (private_read or method == "DELETE"):
            raise StorageObjectNotFoundError("Storage object not found")
        if not response.is_success:
            raise StorageProviderError(f"Supabase Storage request failed (HTTP {response.status_code})")
        return response


def _validated_key_path(key: str) -> str:
    if not isinstance(key, str) or "\\" in key or ".." in key or "?" in key or "#" in key:
        raise ValueError("storage key is invalid")
    parts = key.split("/")
    if len(parts) == 1:
        # Existing local-format keys remain valid for deliberate/manual migrations.
        object_name = parts[0]
    elif len(parts) == 2 and parts[0].isdigit():
        object_name = parts[1]
    else:
        raise ValueError("storage key is invalid")
    if not _SAFE_KEY_PART.fullmatch(object_name):
        raise ValueError("storage key is invalid")
    return "/".join(quote(part, safe="-_.~") for part in parts)
