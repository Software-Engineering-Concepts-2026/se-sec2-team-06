# Supabase Storage for All User Uploads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (if selected) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist profile avatars, document uploads, Tutor image attachments, and quiz source files in private Supabase Storage so Render restarts cannot remove retained user uploads.

**Architecture:** Extend the existing injectable `FileStorageProvider` and keep file metadata/ownership in Supabase Postgres. Add private buckets for Tutor attachments and quiz sources, and make production storage mode explicit so it cannot silently use local disk. Provide a dry-run-first migration for legacy local files; do not mutate production resources or remove source files in this implementation.

**Tech Stack:** FastAPI, SQLAlchemy, Supabase Storage REST API, `httpx`, pytest, existing Render environment configuration.

**Spec:** `docs/architecture/supabase-file-storage-design.md`

## Global Constraints

- Work only in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`; do not modify the D: checkout or its uncommitted files.
- Keep every user-file bucket private; all object reads remain behind authenticated, owner-scoped API routes.
- Keep `SUPABASE_SECRET_KEY` server-only; never put it in frontend variables, source control, logs, tests, or responses.
- Detect Render via its documented built-in `RENDER_SERVICE_ID`; production storage must explicitly select Supabase and fail startup if its setting or credentials are absent. Local storage is only for local development/tests.
- Migration defaults to dry-run, verifies SHA-256 and byte length, and never deletes local files or changes database keys automatically.
- Do not provision buckets, change Render/Supabase production configuration, migrate production data, deploy, commit, or push in this plan.

## Review Focus

- Partial/missing storage configuration must fail in production without leaking secret values; pin the full config matrix in Task 1.
- Existing Supabase objects and legacy local-format keys must remain readable; pin key/bucket behavior in Task 1.
- Tutor uploads must compensate if message/attachment persistence fails and must not permit cross-user reads; pin in Task 2.
- Quiz generation/provider/database failures must not leave unreferenced retained source files; pin in Task 3.
- Dry-run migration must not write remotely, overwrite a different object, or delete local data; pin in Task 4.

---

### Task 1: Extend the storage provider and enforce production configuration

**Files:**
- Modify: `services/api/app/storage/providers.py`
- Modify: `services/api/app/storage/supabase_storage.py`
- Modify: `services/api/app/main.py`
- Modify: `services/api/.env.example`
- Test: `services/api/tests/test_storage_providers.py`
- Test: `services/api/tests/test_main.py`

**Interfaces:**
- `StorageBucket` supports `profile-avatars`, `documents`, `tutor-attachments`, and `quiz-sources`.
- `LocalStorageProvider` and `SupabaseStorageProvider` implement the same `new_key(owner_id, suffix)`, `put(bucket, key, content, content_type)`, `read(bucket, key)`, and `delete(bucket, key)` contract for all four buckets.
- `create_storage_provider(..., storage_backend, is_render, ..., tutor_attachment_storage_dir, quiz_source_storage_dir)` accepts explicit backend and local directories. `storage_backend="supabase"` requires both Supabase settings; `storage_backend="local"` is rejected when `RENDER_SERVICE_ID` is present; an unset backend is allowed only outside Render and preserves current behavior (both credentials select Supabase, neither selects local, and a partial pair errors).

- [x] **Step 1: Write failing tests** named `test_local_storage_provider_round_trips_all_buckets`, `test_supabase_storage_maps_every_bucket_name`, `test_render_service_requires_explicit_supabase_backend`, `test_supabase_backend_rejects_partial_credentials`, and `test_local_backend_remains_available_outside_render`. Assert uploaded bytes can be read from the same bucket, each bucket maps to its exact private name, Render (`RENDER_SERVICE_ID` present) fails on unset/local backend, and outside Render both credentials select Supabase while neither selects local.
- [x] **Step 2: Run** `python -m pytest tests/test_storage_providers.py tests/test_main.py -q` from `services/api`; confirm each newly added case fails before the implementation.
- [x] **Step 3: Implement** the four-bucket provider maps and add `STORAGE_BACKEND` resolution in `create_app`; pass the existing Tutor directory and a new quiz-source directory into the local provider. Do not log config values.
- [x] **Step 4: Re-run** `python -m pytest tests/test_storage_providers.py tests/test_main.py -q`; expect all tests to pass without network access.

### Task 2: Store Tutor image attachments through the provider

**Files:**
- Modify: `services/api/app/storage/tutor_attachments.py`
- Modify: `services/api/app/routers/tutor.py`
- Test: `services/api/tests/test_tutor_attachment_storage.py`
- Test: `services/api/tests/test_tutor_api.py`

**Interfaces:**
- `store_tutor_attachment(upload, storage, owner_id) -> StoredTutorAttachment` validates the same JPEG/PNG/WebP and 5 MiB limits, generates a key through the provider, and writes to `tutor-attachments`.
- `read_tutor_attachment(storage_key, storage) -> bytes` validates the key before reading; the route must first resolve the attachment through an owner-scoped database query.
- Cleanup helpers accept the provider and delete objects idempotently.

- [x] **Step 1: Write failing tests** named `test_store_tutor_attachment_uses_injected_storage_provider`, `test_read_tutor_attachment_uses_injected_storage_provider`, `test_tutor_upload_db_failure_deletes_uploaded_objects`, and `test_attachment_read_and_reference_are_owner_and_conversation_scoped`. Assert the fake provider receives the exact bytes and `tutor-attachments` bucket, failure leaves no attachment object, and a different owner receives 404 without a storage read.
- [x] **Step 2: Run** `python -m pytest tests/test_tutor_attachment_storage.py tests/test_tutor_api.py -q`; confirm each new provider-backed case fails before the implementation.
- [x] **Step 3: Implement** provider-backed storage while preserving attachment metadata and API response behavior; remove direct permanent-file operations from Tutor routes.
- [x] **Step 4: Re-run** the focused Tutor tests; expect pass with fake/local providers and no remote calls.

### Task 3: Retain quiz source files with their generated quiz

**Files:**
- Modify: `services/api/app/models/quiz.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/app/main.py`
- Modify: `services/api/app/services/quiz_generator.py`
- Modify: `services/api/app/routers/quizzes.py`
- Test: `services/api/tests/test_database.py`
- Test: `services/api/tests/test_quiz_generation.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- `Quiz.source_storage_key: str | None` is nullable (`String(128)`) for backwards compatibility with existing quizzes.
- Add idempotent `migrate_quiz_source_storage_key(engine) -> None` and call it during application startup after table creation.
- `generate_and_save_quiz(..., source_storage_key: str | None = None)` saves the key with the quiz row.

- [x] **Step 1: Write failing tests** named `test_migrate_quiz_source_storage_key_is_idempotent_and_preserves_rows`, `test_generate_upload_persists_source_key_in_private_storage`, `test_generate_failure_removes_uploaded_source_object`, and `test_owner_can_delete_quiz_and_removes_source_object`. Assert the column is nullable for old rows; accepted bytes go to `quiz-sources` with the MIME mapped from validated `source_type` (`pdf`, `docx`, `md`, `txt`); the DB row stores only the key; provider/database failures compensate; and foreign-owner deletion does not read or delete the object.
- [x] **Step 2: Run** `python -m pytest tests/test_database.py tests/test_quiz_generation.py tests/test_quiz_library.py -q`; confirm each new case fails before the implementation.
- [x] **Step 3: Implement** the migration and upload lifecycle. Validate/extract first, map MIME from the validated `source_type`, store using the safe source filename suffix, pass the key into quiz creation, and delete the object if generation or DB persistence fails. Delete source objects after successful owner-scoped quiz deletion.
- [x] **Step 4: Re-run** focused quiz/database tests; expect pass with no production database or storage access.

### Task 4: Add a dry-run-first migration for recoverable local files

**Files:**
- Create: `services/api/scripts/migrate_local_files_to_supabase.py`
- Test: `services/api/tests/test_storage_migration.py`

**Interfaces:**
- Run `python scripts/migrate_local_files_to_supabase.py [--data-dir PATH] [--apply]` from `services/api`. It requires `STORAGE_BACKEND=supabase` and uses `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`; `--data-dir` defaults to `SYNAPSESYNC_DATA_DIR` or the existing local data path. Default mode is dry-run; `--apply` uploads only local objects referenced by current DB rows.
- The migration report records bucket, key, source byte length, source SHA-256, verification result, and errors, but never file contents or credentials.

- [x] **Step 1: Write failing tests** named `test_storage_migration_dry_run_performs_no_writes`, `test_storage_migration_uploads_and_verifies_sha256`, `test_storage_migration_skips_identical_remote_object`, `test_storage_migration_reports_remote_hash_conflict_without_overwrite`, and `test_storage_migration_reports_missing_local_file_without_database_change`. Assert the dry-run provider write count is zero; apply verifies exact length and SHA-256; a conflicting remote object is never overwritten; and absent local bytes leave every database key unchanged.
- [x] **Step 2: Run** `python -m pytest tests/test_storage_migration.py -q`; confirm each new case fails before the implementation.
- [x] **Step 3: Implement** database-key-driven discovery for avatars, documents, Tutor attachments, and quiz source files. Never overwrite a non-matching remote object and never delete local files or rewrite keys.
- [x] **Step 4: Re-run** migration tests against fake storage and a temporary database; expect pass with no network.

### Task 5: Document setup and run the regression suite

**Files:**
- Modify: `docs/deployment/render-supabase-storage.md`
- Review: all changed storage/API/schema files

- [x] **Step 1: Update** the deployment guide with all four private buckets, matching limits/types, `STORAGE_BACKEND=supabase`, Render server variables, and the safe migration command. Correct any guidance that permits production local fallback.
- [x] **Step 2: Run focused suites** from `services/api`: `python -m pytest tests/test_storage_providers.py tests/test_main.py tests/test_profile.py tests/test_documents_api.py tests/test_tutor_attachment_storage.py tests/test_tutor_api.py tests/test_database.py tests/test_quiz_generation.py tests/test_quiz_library.py tests/test_storage_migration.py -q`.
- [x] **Step 3: Run** the full API test suite with `python -m pytest -q` and `git diff --check`; expect all tests to pass and no secret-like values, `.env`, or production mutation in the diff.
- [x] **Step 4: Report** required manual Render/Supabase setup and any unrecoverable legacy local files. Do not claim live persistence until the user configures the production variables/buckets and a post-deploy upload/read check succeeds.
