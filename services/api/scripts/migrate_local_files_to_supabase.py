from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.database import create_session_factory
from app.models import Document, Quiz, TutorAttachment, User
from app.storage.providers import (
    FileStorageProvider,
    StorageConfigurationError,
    StorageObjectNotFoundError,
    create_storage_provider,
)


_LOCAL_KEY = re.compile(r"^[A-Za-z0-9_-]{40,60}(?:\.(?:jpg|png|webp|pdf|docx|md|txt))?$")
_DIRECTORIES = {
    "profile-avatars": "profile-images",
    "documents": "documents",
    "tutor-attachments": "tutor-attachments",
    "quiz-sources": "quiz-sources",
}
_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".md": "text/markdown",
    ".txt": "text/plain",
}


def _database_references(session_factory) -> list[tuple[str, str]]:
    references: list[tuple[str, str]] = []
    with session_factory() as session:
        references.extend(
            ("profile-avatars", key)
            for (_user_id, key) in session.execute(
                select(User.id, User.avatar_key).where(User.avatar_key.is_not(None))
            ).all()
            if key
        )
        references.extend(
            ("documents", key)
            for (key,) in session.execute(
                select(Document.storage_key).where(Document.storage_key.is_not(None))
            ).all()
            if key
        )
        references.extend(
            ("tutor-attachments", key)
            for (key,) in session.execute(
                select(TutorAttachment.storage_key).where(TutorAttachment.storage_key.is_not(None))
            ).all()
            if key
        )
        references.extend(
            ("quiz-sources", key)
            for (key,) in session.execute(
                select(Quiz.source_storage_key).where(Quiz.source_storage_key.is_not(None))
            ).all()
            if key
        )

    # A key can be referenced more than once (for example, a reused avatar).
    return list(dict.fromkeys(references))


def _safe_local_path(data_dir: Path, bucket: str, key: str) -> tuple[Path | None, str | None]:
    if "/" in key or "\\" in key:
        # Owner-prefixed keys are already in remote storage, not local filenames.
        return None, None
    if not _LOCAL_KEY.fullmatch(key):
        return None, "local storage key is invalid"

    root = data_dir / _DIRECTORIES[bucket]
    path = root / key
    if path.is_symlink():
        return None, "local source file is not a regular file"
    try:
        resolved_root = root.resolve()
        resolved_path = path.resolve(strict=True)
    except FileNotFoundError:
        return path, "local source file is missing"
    except OSError:
        return None, "local source file could not be accessed"
    if resolved_path.parent != resolved_root or not resolved_path.is_file():
        return None, "local source file is not a regular file"
    return resolved_path, None


def _safe_operation_error(error: Exception) -> str:
    # Never echo upstream response bodies, file contents, paths, or credentials.
    return f"remote storage operation failed ({type(error).__name__})"


def _migrate_one(
    data_dir: Path,
    storage: FileStorageProvider,
    bucket: str,
    key: str,
    *,
    apply: bool,
) -> dict[str, Any] | None:
    local_path, path_error = _safe_local_path(data_dir, bucket, key)
    if local_path is None and path_error is None:
        return None

    result: dict[str, Any] = {
        "bucket": bucket,
        "key": key,
        "source_bytes": None,
        "source_sha256": None,
        "verified": False if path_error else None,
        "status": "error" if path_error else "planned",
        "error": path_error,
    }
    if path_error:
        result["status"] = "missing_local_file" if path_error == "local source file is missing" else "error"
        return result

    try:
        content = local_path.read_bytes()
    except OSError:
        result.update(status="error", verified=False, error="local source file could not be read")
        return result

    digest = hashlib.sha256(content).hexdigest()
    result.update(source_bytes=len(content), source_sha256=digest)
    if not apply:
        return result

    try:
        remote_content = storage.read(bucket, key)
    except StorageObjectNotFoundError:
        suffix = Path(key).suffix.lower()
        content_type = _CONTENT_TYPES.get(suffix, "application/octet-stream")
        try:
            storage.put(bucket, key, content, content_type)
            remote_content = storage.read(bucket, key)
        except Exception as error:
            result.update(status="error", verified=False, error=_safe_operation_error(error))
            return result
        remote_digest = hashlib.sha256(remote_content).hexdigest()
        is_verified = len(remote_content) == len(content) and remote_digest == digest
        result.update(
            status="uploaded_and_verified" if is_verified else "verification_failed",
            verified=is_verified,
            error=None if is_verified else "uploaded object did not match local byte length and SHA-256",
        )
        return result
    except Exception as error:
        result.update(status="error", verified=False, error=_safe_operation_error(error))
        return result

    remote_digest = hashlib.sha256(remote_content).hexdigest()
    if len(remote_content) != len(content) or remote_digest != digest:
        result.update(
            status="conflict",
            verified=False,
            error="remote object differs from local source; not overwritten",
        )
        return result

    result.update(status="already_identical", verified=True, error=None)
    return result


def migrate_referenced_local_files(
    session_factory,
    data_dir: str | Path,
    storage: FileStorageProvider,
    *,
    apply: bool = False,
) -> list[dict[str, Any]]:
    """Report or upload local files referenced by database rows; never mutate DB or source files."""
    root = Path(data_dir)
    report: list[dict[str, Any]] = []
    for bucket, key in _database_references(session_factory):
        result = _migrate_one(root, storage, bucket, key, apply=apply)
        if result is not None:
            report.append(result)
    return report


def _default_data_dir() -> Path:
    configured = os.environ.get("SYNAPSESYNC_DATA_DIR")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[3] / ".local"


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Dry-run or copy database-referenced local user files into private Supabase Storage. "
            "Local files and database keys are never changed."
        )
    )
    parser.add_argument("--data-dir", type=Path, help="Local data directory (default: SYNAPSESYNC_DATA_DIR or .local)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Upload missing objects and verify them; existing different objects are never overwritten",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if os.environ.get("STORAGE_BACKEND", "").strip().lower() != "supabase":
        parser.error("Set STORAGE_BACKEND=supabase before running this migration")

    database_url = os.environ.get("DATABASE_URL", "").strip()
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_secret_key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if not database_url:
        parser.error("DATABASE_URL is required")
    if not supabase_url or not supabase_secret_key:
        parser.error("SUPABASE_URL and SUPABASE_SECRET_KEY are required")

    data_dir = args.data_dir or _default_data_dir()
    engine = None
    try:
        session_factory = create_session_factory(database_url)
        engine = session_factory.kw["bind"]
        storage = create_storage_provider(
            image_storage_dir=data_dir / _DIRECTORIES["profile-avatars"],
            document_storage_dir=data_dir / _DIRECTORIES["documents"],
            tutor_attachment_storage_dir=data_dir / _DIRECTORIES["tutor-attachments"],
            quiz_source_storage_dir=data_dir / _DIRECTORIES["quiz-sources"],
            supabase_url=supabase_url,
            supabase_secret_key=supabase_secret_key,
            storage_backend="supabase",
            is_render=False,
        )
    except StorageConfigurationError as error:
        if engine is not None:
            engine.dispose()
        parser.error(str(error))
    except Exception:
        if engine is not None:
            engine.dispose()
        parser.error("Unable to initialize migration from the configured database and storage settings")

    try:
        report = migrate_referenced_local_files(
            session_factory,
            data_dir,
            storage,
            apply=args.apply,
        )
        print(json.dumps({"mode": "apply" if args.apply else "dry-run", "results": report}, ensure_ascii=False, indent=2))
        failed_statuses = {"missing_local_file", "conflict", "verification_failed", "error"}
        return 1 if any(item["status"] in failed_statuses for item in report) else 0
    except Exception:
        print(
            json.dumps(
                {
                    "mode": "apply" if args.apply else "dry-run",
                    "results": [],
                    "error": "migration could not read database references; check configuration and connectivity",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1
    finally:
        close_storage = getattr(storage, "close", None)
        if close_storage is not None:
            close_storage()
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
