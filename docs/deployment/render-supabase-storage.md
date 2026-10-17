# Persistent user-file storage on Render

SynapseSync stores file metadata and ownership in Supabase Postgres and the file bytes in private Supabase Storage buckets. Render's local filesystem is ephemeral, so **production must use Supabase Storage**; the API rejects local or unset storage mode when it detects the Render environment.

## 1. Create private Supabase Storage buckets

Create all four buckets in Supabase **Storage**. Keep **Public bucket** turned off. Set the per-bucket file-size limits and allowed MIME types to match the API validators:

| Bucket | File-size limit | Allowed MIME types |
| --- | ---: | --- |
| `profile-avatars` | 5 MiB | `image/jpeg`, `image/png`, `image/webp` |
| `documents` | 20,000,000 bytes | `application/pdf`, `text/markdown`, `text/plain` |
| `tutor-attachments` | 5 MiB per image | `image/jpeg`, `image/png`, `image/webp` |
| `quiz-sources` | 20,000,000 bytes | `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/markdown`, `text/plain` |

The document library intentionally accepts PDF, Markdown, and TXT—not DOCX. Quiz generation separately accepts PDF, DOCX, Markdown, and TXT. Tutor allows up to three images per message, with a combined payload limit of 15 MiB.

All reads go through authenticated, owner-scoped SynapseSync API routes. Do not make these buckets public or expose Supabase storage URLs as a substitute for the API.

## 2. Configure the Render Web Service

In Render, open the SynapseSync **Web Service → Environment** and set:

| Key | Value |
| --- | --- |
| `STORAGE_BACKEND` | `supabase` |
| `SUPABASE_URL` | The project URL from Supabase **Project Settings → API** |
| `SUPABASE_SECRET_KEY` | A server-only Supabase secret key from the project's API keys page |
| `DATABASE_URL` | The existing Supabase Postgres connection string used by this deployment |

Render supplies `RENDER_SERVICE_ID` automatically; do not add it manually. The application uses it to detect production and refuses to start with local/unset storage or missing Supabase configuration. Save the variables and deploy the application after the buckets exist.

Keep `SUPABASE_SECRET_KEY` server-side only. Never put it in `VITE_*` variables, frontend source, `.env.example`, Git, browser storage, logs, or client requests. Do not replace the existing `DATABASE_URL` with a local SQLite path.

For local development, `services/api/.env.example` sets `STORAGE_BACKEND=local`. Leave the local setup on that mode, or explicitly configure both Supabase values and select `supabase` when testing cloud storage. Never use local mode on Render.

## 3. Existing files and safe migration

New uploads use private Supabase Storage after the service is configured. Existing database rows keep their storage keys, so the key column does not need to be rewritten. The API startup migration adds the nullable `quizzes.source_storage_key` column for existing quizzes.

If the old local files still exist, the migration script can discover only files referenced by current database rows in the four storage folders (`profile-images`, `documents`, `tutor-attachments`, `quiz-sources`). It defaults to a read-only dry run. From `services/api`, run:

```powershell
.venv\Scripts\python.exe scripts\migrate_local_files_to_supabase.py --data-dir <path-to-existing-data-dir>
```

The process environment must securely provide `STORAGE_BACKEND=supabase`, `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. The script reports bucket, key, byte count, SHA-256, status, and a sanitized error without printing file contents or credentials. Review the dry-run report first. Only after verifying the source directory and report should an authorized operator rerun with `--apply`; apply mode uploads only missing, database-referenced objects, verifies their byte length and SHA-256, skips identical objects, and refuses to overwrite different remote objects. It does not delete source files or change database keys.

Files already lost from an ephemeral Render filesystem cannot be recovered by this script. Older quiz originals that were never retained also cannot be migrated; they need to be re-uploaded by their owner if the original is still available. Do not claim a historical file has been migrated unless it appears as verified in the apply report.

## Troubleshooting

- Startup error that Render requires `STORAGE_BACKEND=supabase`: set that variable exactly as shown above.
- Startup error about Supabase URL/secret: check both server-side variables are present; do not paste the secret into logs or chat.
- Upload failure: confirm the exact bucket name, that it is private, and that its size/MIME constraints include the values above.
- Missing old file during migration: the referenced local file is no longer present at the chosen data directory; the script will not invent a replacement or change the database reference.
- Do not make a bucket public as a workaround. Inspect only sanitized API errors and verify configuration in the Render/Supabase dashboards.
