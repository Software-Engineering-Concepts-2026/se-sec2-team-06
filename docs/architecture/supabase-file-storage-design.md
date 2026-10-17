# Supabase Storage for all user-uploaded files

## Status

Approved and implemented in branch `codex/home-local-auth`. The four private buckets were provisioned in the production Supabase project on 2026-10-17. Render environment configuration and code deployment are still pending, so live uploads have not yet been verified in Supabase Storage. Existing-file migration has not been run.

## Goal

Persist every durable user-uploaded file in private Supabase Storage so Render redeploys cannot remove it. Keep structured application data and file metadata in Supabase Postgres. Never expose a Supabase secret key or private object URL to the browser.

“All files” means user uploads retained by the product: profile avatars, document-library uploads, Tutor image attachments, and the original files used to generate quizzes. Static application assets remain part of the deployed app, while short-lived extraction/AI-processing scratch data may remain temporary and must not be the only copy of a retained upload.

## Current behavior found in the code

- The storage adapter handles only `profile-avatars` and `documents`; when both Supabase settings are absent, it selects local filesystem storage.
- Profile avatars and document-library files already use that adapter.
- Tutor image attachments are written directly under `SYNAPSESYNC_DATA_DIR`.
- Quiz generation reads and extracts the uploaded file, then stores its filename and generated quiz data, but not the original bytes.
- The previously shared Render Environment screenshot showed `DATABASE_URL` and `SYNAPSESYNC_DATA_DIR=/tmp/synapsesync-data`, but did not show `SUPABASE_URL` or `SUPABASE_SECRET_KEY`. Since `/tmp` is ephemeral on Render, local-mode files can disappear on redeploy.

## Proposed design

Extend the existing `FileStorageProvider` instead of introducing a second file registry:

| Purpose | Private bucket | Database reference |
| --- | --- | --- |
| Profile avatar | `profile-avatars` | `users.avatar_key` |
| Document library | `documents` | `documents.storage_key` |
| Tutor image attachment | `tutor-attachments` | `tutor_attachments.storage_key` |
| Quiz-generation source file | `quiz-sources` | new nullable `quizzes.source_storage_key` |

- Keep every bucket private. The API server reads and writes using server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; authenticated API routes continue checking user ownership before returning bytes.
- Add `STORAGE_BACKEND=supabase` as an explicit production requirement. Detect Render using its built-in `RENDER_SERVICE_ID`; if that value is present and the backend setting is absent or `local`, fail clearly rather than silently falling back to Render's ephemeral filesystem. If Supabase mode is selected but credentials are missing, fail startup. Outside Render, preserve the existing resolution when the setting is omitted: both Supabase settings select Supabase, neither selects local development storage, and a partial pair is an error. Local development and tests may explicitly use local/fake providers.
- Reuse existing metadata where present. Add a backward-compatible database migration for `quizzes.source_storage_key`; retain `source_filename` and `source_type`.
- Validate file size and content before persisting. Store the original quiz source only after it passes extraction validation; if quiz generation or the database save fails, remove the newly uploaded object. Existing delete flows remove corresponding objects after the database change; failures must be logged without exposing credentials or user file contents.
- Keep `/tmp` or `SYNAPSESYNC_DATA_DIR` only for temporary staging/cache work, never as the durable source of a user upload.

## Existing-file migration

Provide a dry-run-first migration for files that still exist in local storage. Resolve candidates only from database-owned keys, upload to the matching private bucket, and verify byte length and SHA-256 before reporting success. Do not delete the source files or rewrite metadata until the report confirms every candidate. Report missing local bytes and leave their database rows intact; a file already lost from an earlier ephemeral Render deploy cannot be reconstructed from metadata alone. Quiz source files from before this change were not retained by the app and therefore cannot be migrated unless the user has a separate copy.

No existing user files have been migrated. Render credentials/configuration have not been changed. The app code must not be pushed to the auto-deploying Render branch until the required storage environment variables are configured.

## Deployment requirements

1. Confirm/create the four named buckets as private, with size and MIME limits matching API validation.
2. Configure Render with `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, and server-only `SUPABASE_SECRET_KEY`; keep the existing `DATABASE_URL` pointed at Supabase Postgres.
3. Deploy the code only after bucket configuration and the migration plan are verified. Never put the secret key in frontend variables, source control, logs, or chat.

## Acceptance criteria

- Upload, read, replacement, and deletion for avatars/documents continue to use private Supabase Storage.
- Tutor image attachments and quiz-generation source files are written to the correct private buckets, with keys saved in Supabase Postgres.
- A redeploy/restart does not remove any newly retained upload.
- Users cannot read another user's files by guessing a storage key.
- Production cannot start in local-file fallback mode when `STORAGE_BACKEND=supabase` is required.
- Tests cover storage/provider errors, upload rollback, ownership, schema migration, and delete behavior without touching production Supabase.
- The migration dry-run verifies file counts and hashes and never deletes source data.
