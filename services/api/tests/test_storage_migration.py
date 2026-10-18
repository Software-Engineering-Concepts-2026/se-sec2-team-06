from __future__ import annotations

import hashlib
import importlib
import importlib.util
import sys
from pathlib import Path

import pytest
from sqlalchemy import select


def _migration_module():
    script_path = Path(__file__).parent.parent / "scripts" / "migrate_local_files_to_supabase.py"
    spec = importlib.util.spec_from_file_location("migrate_local_files_to_supabase", script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class _MemoryStorageProvider:
    def __init__(self) -> None:
        providers = importlib.import_module("app.storage.providers")
        self._not_found = providers.StorageObjectNotFoundError
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}
        self.read_calls: list[tuple[str, str]] = []
        self.put_calls: list[tuple[str, str, bytes, str]] = []

    def new_key(self, owner_id: int, suffix: str = "") -> str:
        return f"{owner_id}/{'x' * 43}{suffix}"

    def put(self, bucket: str, key: str, content: bytes, content_type: str) -> None:
        self.put_calls.append((bucket, key, content, content_type))
        self.objects[(bucket, key)] = (content, content_type)

    def read(self, bucket: str, key: str) -> bytes:
        self.read_calls.append((bucket, key))
        try:
            return self.objects[(bucket, key)][0]
        except KeyError as error:
            raise self._not_found("Storage object not found") from error

    def delete(self, bucket: str, key: str) -> None:
        self.objects.pop((bucket, key), None)


def _seed_local_references(tmp_path):
    database = importlib.import_module("app.database")
    models = importlib.import_module("app.models")
    data_dir = tmp_path / "local-data"
    session_factory = database.create_session_factory(
        f"sqlite:///{(tmp_path / 'migration.db').as_posix()}"
    )
    database.Base.metadata.create_all(session_factory.kw["bind"])
    keys = {
        "profile-avatars": "a" * 48 + ".png",
        "documents": "b" * 43 + ".pdf",
        "tutor-attachments": "c" * 48 + ".jpg",
        "quiz-sources": "d" * 43 + ".md",
    }
    contents = {
        "profile-avatars": b"avatar-png-bytes",
        "documents": b"document-pdf-bytes",
        "tutor-attachments": b"tutor-jpeg-bytes",
        "quiz-sources": b"quiz-markdown-bytes",
    }

    with session_factory() as session:
        user = models.User(
            email="storage-migration@example.test",
            display_name="Migration",
            password_hash="$argon2id$test",
            avatar_key=keys["profile-avatars"],
        )
        session.add(user)
        session.flush()
        conversation = models.TutorConversation(
            user_id=user.id,
            title="Tutor image",
            create_request_id="migration-conversation",
        )
        document = models.Document(
            user_id=user.id,
            title="Lesson document",
            original_filename="lesson.pdf",
            file_type="pdf",
            size_bytes=len(contents["documents"]),
            storage_key=keys["documents"],
        )
        quiz = models.Quiz(
            user_id=user.id,
            title="Source quiz",
            source_filename="lesson.md",
            source_type="md",
            source_storage_key=keys["quiz-sources"],
            language="en",
            difficulty="basic",
            question_count=0,
            prompt_version="quiz_generation_v1",
        )
        session.add_all([conversation, document, quiz])
        session.flush()
        session.add(
            models.TutorAttachment(
                user_id=user.id,
                conversation_id=conversation.id,
                storage_key=keys["tutor-attachments"],
                original_filename="diagram.jpg",
                mime_type="image/jpeg",
                byte_size=len(contents["tutor-attachments"]),
            )
        )
        session.commit()

    directory_names = {
        "profile-avatars": "profile-images",
        "documents": "documents",
        "tutor-attachments": "tutor-attachments",
        "quiz-sources": "quiz-sources",
    }
    for bucket, key in keys.items():
        directory = data_dir / directory_names[bucket]
        directory.mkdir(parents=True, exist_ok=True)
        (directory / key).write_bytes(contents[bucket])

    return session_factory, data_dir, keys, contents


def test_storage_migration_dry_run_performs_no_writes(tmp_path) -> None:
    migration = _migration_module()
    session_factory, data_dir, keys, contents = _seed_local_references(tmp_path)
    storage = _MemoryStorageProvider()

    report = migration.migrate_referenced_local_files(
        session_factory,
        data_dir,
        storage,
        apply=False,
    )

    assert {(item["bucket"], item["key"]) for item in report} == {
        (bucket, key) for bucket, key in keys.items()
    }
    assert all(item["status"] == "planned" and item["verified"] is None for item in report)
    assert {item["source_bytes"] for item in report} == {
        len(content) for content in contents.values()
    }
    assert storage.put_calls == []
    assert storage.read_calls == []
    assert storage.objects == {}


def test_storage_migration_uploads_and_verifies_sha256(tmp_path) -> None:
    migration = _migration_module()
    session_factory, data_dir, keys, contents = _seed_local_references(tmp_path)
    storage = _MemoryStorageProvider()

    report = migration.migrate_referenced_local_files(
        session_factory,
        data_dir,
        storage,
        apply=True,
    )

    assert all(item["status"] == "uploaded_and_verified" and item["verified"] is True for item in report)
    for item in report:
        bucket, key = item["bucket"], item["key"]
        assert item["source_bytes"] == len(contents[bucket])
        assert item["source_sha256"] == hashlib.sha256(contents[bucket]).hexdigest()
        assert storage.objects[(bucket, key)][0] == contents[bucket]
        assert (data_dir / {
            "profile-avatars": "profile-images",
            "documents": "documents",
            "tutor-attachments": "tutor-attachments",
            "quiz-sources": "quiz-sources",
        }[bucket] / key).is_file()
    assert {(bucket, key) for bucket, key, _, _ in storage.put_calls} == {
        (bucket, key) for bucket, key in keys.items()
    }


def test_storage_migration_skips_identical_remote_object(tmp_path) -> None:
    migration = _migration_module()
    session_factory, data_dir, keys, contents = _seed_local_references(tmp_path)
    storage = _MemoryStorageProvider()
    bucket = "profile-avatars"
    existing_key = keys[bucket]
    storage.objects[(bucket, existing_key)] = (contents[bucket], "image/png")

    report = migration.migrate_referenced_local_files(
        session_factory,
        data_dir,
        storage,
        apply=True,
    )

    existing = next(item for item in report if item["bucket"] == bucket)
    assert existing["status"] == "already_identical"
    assert existing["verified"] is True
    assert all((put_bucket, put_key) != (bucket, existing_key) for put_bucket, put_key, _, _ in storage.put_calls)


def test_storage_migration_reports_remote_hash_conflict_without_overwrite(tmp_path) -> None:
    migration = _migration_module()
    session_factory, data_dir, keys, contents = _seed_local_references(tmp_path)
    storage = _MemoryStorageProvider()
    bucket = "documents"
    conflicting_key = keys[bucket]
    remote_bytes = b"different remote object"
    storage.objects[(bucket, conflicting_key)] = (remote_bytes, "application/pdf")

    report = migration.migrate_referenced_local_files(
        session_factory,
        data_dir,
        storage,
        apply=True,
    )

    conflict = next(item for item in report if item["bucket"] == bucket)
    assert conflict["status"] == "conflict"
    assert conflict["verified"] is False
    assert conflict["error"] == "remote object differs from local source; not overwritten"
    assert storage.objects[(bucket, conflicting_key)][0] == remote_bytes
    assert all((put_bucket, put_key) != (bucket, conflicting_key) for put_bucket, put_key, _, _ in storage.put_calls)


def test_storage_migration_reports_missing_local_file_without_database_change(tmp_path) -> None:
    migration = _migration_module()
    session_factory, data_dir, keys, _contents = _seed_local_references(tmp_path)
    database = importlib.import_module("app.models")
    storage = _MemoryStorageProvider()
    missing_bucket = "documents"
    missing_key = keys[missing_bucket]
    (data_dir / "documents" / missing_key).unlink()

    before_keys: dict[str, list[str | None]] = {}
    with session_factory() as session:
        before_keys["documents"] = list(
            session.scalars(select(database.Document.storage_key)).all()
        )

    report = migration.migrate_referenced_local_files(
        session_factory,
        data_dir,
        storage,
        apply=True,
    )

    missing = next(item for item in report if item["bucket"] == missing_bucket)
    assert missing["status"] == "missing_local_file"
    assert missing["verified"] is False
    assert missing["error"] == "local source file is missing"
    with session_factory() as session:
        after_keys = list(session.scalars(select(database.Document.storage_key)).all())
    assert after_keys == before_keys["documents"] == [missing_key]
    assert all((bucket, key) != (missing_bucket, missing_key) for bucket, key, _, _ in storage.put_calls)


def test_migration_cli_does_not_echo_database_credentials_when_setup_fails(monkeypatch, capsys) -> None:
    migration = _migration_module()
    database_url = "postgresql://migration-user:must-not-be-printed@example.test/app"
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_must-not-be-printed")

    def fail_session_factory(configured_url):
        raise ValueError(configured_url)

    monkeypatch.setattr(migration, "create_session_factory", fail_session_factory)
    with pytest.raises(SystemExit):
        migration.main([])

    captured = capsys.readouterr()
    assert database_url not in captured.out + captured.err
    assert "must-not-be-printed" not in captured.out + captured.err
    assert "Unable to initialize" in captured.err
