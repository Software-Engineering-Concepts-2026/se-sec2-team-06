from __future__ import annotations

import os
import re
import secrets
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable


MAX_DOCUMENT_BYTES = 20_000_000
SUPPORTED_EXTENSIONS = {".pdf", ".md", ".txt"}
_STORAGE_KEY = re.compile(r"^[A-Za-z0-9_-]{40,50}$")


class DocumentStorageError(ValueError):
    """Base class for document storage validation errors."""


class UnsupportedDocumentError(DocumentStorageError):
    pass


class UploadTooLargeError(DocumentStorageError):
    pass


class EmptyUploadError(DocumentStorageError):
    pass


class InvalidStorageKeyError(DocumentStorageError):
    pass


@dataclass(frozen=True)
class StagedDocument:
    temporary_path: Path
    original_filename: str
    size_bytes: int
    extension: str


def _safe_original_filename(filename: str) -> str:
    if not isinstance(filename, str):
        raise UnsupportedDocumentError("Document filename is invalid")
    basename = PurePosixPath(filename.replace("\\", "/")).name.strip()
    extension = PurePosixPath(basename).suffix.lower()
    if not basename or extension not in SUPPORTED_EXTENSIONS:
        raise UnsupportedDocumentError("Supported formats are PDF, Markdown, and TXT")
    if len(basename) > 255:
        suffix = PurePosixPath(basename).suffix
        basename = f"{basename[: 255 - len(suffix)]}{suffix}"
    return basename


def stage_document(
    chunks: Iterable[bytes],
    filename: str,
    staging_dir: Path,
    max_bytes: int = MAX_DOCUMENT_BYTES,
) -> StagedDocument:
    safe_filename = _safe_original_filename(filename)
    staging_dir = Path(staging_dir)
    staging_dir.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix="document-", suffix=".upload", dir=staging_dir)
    temporary_path = Path(temporary_name)
    total_bytes = 0

    try:
        with os.fdopen(descriptor, "wb") as output:
            for chunk in chunks:
                if not isinstance(chunk, (bytes, bytearray, memoryview)):
                    raise DocumentStorageError("Upload stream returned invalid data")
                chunk_bytes = bytes(chunk)
                if total_bytes + len(chunk_bytes) > max_bytes:
                    raise UploadTooLargeError(f"Document exceeds the {max_bytes}-byte limit")
                output.write(chunk_bytes)
                total_bytes += len(chunk_bytes)
            output.flush()
            os.fsync(output.fileno())

        if total_bytes == 0:
            raise EmptyUploadError("The uploaded document is empty")

        return StagedDocument(
            temporary_path=temporary_path,
            original_filename=safe_filename,
            size_bytes=total_bytes,
            extension=PurePosixPath(safe_filename).suffix.lower(),
        )
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def promote_document(staged: StagedDocument, storage_dir: Path) -> str:
    storage_dir = Path(storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    if not staged.temporary_path.is_file():
        raise DocumentStorageError("Staged document is no longer available")

    while True:
        storage_key = secrets.token_urlsafe(32)
        if not _STORAGE_KEY.fullmatch(storage_key):
            continue
        destination = storage_dir / storage_key
        try:
            os.replace(staged.temporary_path, destination)
            return storage_key
        except FileExistsError:
            continue


def discard_staged_document(staged: StagedDocument) -> None:
    staged.temporary_path.unlink(missing_ok=True)


def _resolve_storage_path(storage_key: str, storage_dir: Path) -> Path:
    if not isinstance(storage_key, str) or not _STORAGE_KEY.fullmatch(storage_key):
        raise InvalidStorageKeyError("Document storage key is invalid")
    return Path(storage_dir) / storage_key


def read_document(storage_key: str, storage_dir: Path) -> bytes:
    return _resolve_storage_path(storage_key, storage_dir).read_bytes()


def delete_document_file(storage_key: str, storage_dir: Path) -> None:
    _resolve_storage_path(storage_key, storage_dir).unlink(missing_ok=True)


def quarantine_document_file(
    storage_key: str,
    storage_dir: Path,
    staging_dir: Path,
) -> Path | None:
    """Move an owned document out of the live store before deleting its row."""
    source = _resolve_storage_path(storage_key, storage_dir)
    if not source.exists():
        return None
    staging_dir = Path(staging_dir)
    staging_dir.mkdir(parents=True, exist_ok=True)
    while True:
        quarantine_path = staging_dir / f"deleted-{secrets.token_urlsafe(24)}.quarantine"
        if quarantine_path.exists():
            continue
        try:
            os.replace(source, quarantine_path)
            return quarantine_path
        except FileNotFoundError:
            return None
        except FileExistsError:
            continue


def restore_quarantined_document_file(
    storage_key: str,
    storage_dir: Path,
    quarantine_path: Path,
) -> None:
    destination = _resolve_storage_path(storage_key, storage_dir)
    destination.parent.mkdir(parents=True, exist_ok=True)
    os.replace(quarantine_path, destination)


def remove_quarantined_document_file(quarantine_path: Path) -> None:
    Path(quarantine_path).unlink(missing_ok=True)
