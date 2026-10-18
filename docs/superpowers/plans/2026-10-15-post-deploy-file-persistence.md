# Persistent Profile Images and Document Files — Implementation Plan

> **For agentic workers:** execute one task at a time using test-first changes. Do not deploy, provision cloud resources, or handle live secrets.

**Goal:** Preserve avatar and document file bytes across local restarts and Render deployments by adding a private Supabase Storage adapter while retaining local storage for development.

**Architecture:** Keep current API, authentication, and SQL metadata. Add a provider boundary with a local implementation and a Supabase Storage HTTP implementation. Select local mode with no cloud configuration; select cloud mode only when both `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are present. The API authorizes by DB ownership before calling Storage. Objects stay in private buckets; browsers continue to use same-origin API routes.

**Tech Stack:** FastAPI, SQLAlchemy, existing `httpx`, current local storage services, Supabase Storage REST API, pytest.

**Spec:** `docs/superpowers/specs/2026-10-15-post-deploy-file-persistence-design.md`

## Global constraints

- Work only in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`.
- Preserve local uploads and current supported formats/limits. Do not alter the protected D: project.
- Never print, commit, return, or send a Supabase secret to the browser. Never read `.env` values into logs/output.
- Do not modify Render/Supabase remotely, deploy, migrate existing local files, or commit/push.
- Database ownership checks must precede every private-object read/delete. Do not use public buckets or permanent public URLs.
- Keep provider operations behind a small injectable boundary so tests use a fake transport and no network.

## Review focus

- Config matrix: no credentials => local; both cloud values => Supabase; only one => startup/configuration error.
- Cross-user access: a guessed document ID or avatar key cannot read/delete another user's object.
- Consistency: failed upload/DB commit/replace/delete cannot leave a false success or silently destroy the prior valid file.
- Key safety: no original filename or path traversal is used as an object key.
- Existing profile/document tests remain valid with local mode as default.

---

### Task 1: Define provider/configuration contract and tests

**Files:**
- Create: `services/api/app/storage/providers.py` (or a focused provider module)
- Modify: `services/api/app/main.py`
- Modify: `services/api/tests/conftest.py`
- Create: `services/api/tests/test_storage_providers.py`

**Interfaces:**
- A storage provider supports server-generated opaque object keys plus `put`, `read`, and `delete`; binary uploads are streamed or bounded to the already-enforced file limit.
- The local provider wraps existing file helpers and existing data-directory behavior.
- Configuration factory accepts explicit environment/settings inputs so it can be unit-tested without reading real secrets.
- Inject provider through application state/dependencies rather than module-global remote clients.

- [ ] **Step 1: Write failing tests** for provider selection, partial configuration rejection, generated safe keys, content round trip, missing object, and delete idempotency.
- [ ] **Step 2: Run** `python -m pytest tests/test_storage_providers.py -q` from `services/api`; verify failure before implementation.
- [ ] **Step 3: Add the minimal interface and local adapter**, preserving existing local file paths and helper semantics.
- [ ] **Step 4: Add config selection and inject the provider** into application state without changing route behavior yet.
- [ ] **Step 5: Re-run** `python -m pytest tests/test_storage_providers.py tests/test_profile.py tests/test_documents_api.py -q`.

### Task 2: Implement private Supabase Storage adapter

**Files:**
- Create: `services/api/app/storage/supabase_storage.py`
- Modify: `services/api/app/storage/providers.py`
- Modify: `services/api/tests/test_storage_providers.py`
- Modify: `services/api/requirements.txt` only if the current `httpx` dependency is insufficient

**Interfaces:**
- Provider targets a configured private bucket and owner-scoped opaque object key using Supabase Storage's authenticated server API.
- For the current `sb_secret_...` API key format, send the secret in the `apikey` header only; do not also send it as `Authorization: Bearer` because the new key is not a JWT. Use an injectable `httpx` transport/client; enforce timeout, status handling, safe error translation, and no secret-bearing log messages.
- Bucket names default to `profile-avatars` and `documents`; configuration overrides are optional and validated if implemented.
- HTTP response handling distinguishes not-found from transient/service errors; it never falls back to a public object URL.

- [ ] **Step 1: Add failing fake-transport tests** for successful upload/read/delete, unauthorized/missing responses, timeouts, server errors, and redaction of credential values from exception/log text.
- [ ] **Step 2: Verify the current official Supabase Storage REST API contract** and pin the URL, headers, and error mapping in the tests; do not guess endpoint semantics.
- [ ] **Step 3: Run** `python -m pytest tests/test_storage_providers.py -q`; confirm new tests fail.
- [ ] **Step 4: Implement the adapter** using the existing `httpx` dependency where possible; secrets remain server-only.
- [ ] **Step 5: Re-run** `python -m pytest tests/test_storage_providers.py -q` with no outbound network.

### Task 3: Route profile avatar writes/reads/deletes through provider

**Files:**
- Modify: `services/api/app/routers/profile.py`
- Modify: `services/api/app/storage/profile_images.py` only for shared validation, if needed
- Test: `services/api/tests/test_profile.py`

- [ ] **Step 1: Add failing API tests** for local behavior, injected-cloud behavior, owner isolation, replacing avatar, and compensation when DB commit fails.
- [ ] **Step 2: Run** `python -m pytest tests/test_profile.py -q`; verify failures for cloud-backed provider scenarios.
- [ ] **Step 3: Preserve existing image validation**, store the new image before updating `avatar_key`, then clean up the previous object only after commit. Resolve the current account's key before reads/deletes.
- [ ] **Step 4: Return avatar content only through the authenticated route**, with current content type/cache protections and no raw Storage URL.
- [ ] **Step 5: Re-run** `python -m pytest tests/test_profile.py -q`.

### Task 4: Route document lifecycle/content through provider

**Files:**
- Modify: `services/api/app/routers/documents.py`
- Modify: `services/api/app/storage/documents.py` only to retain validation/staging helpers or make lifecycle provider-neutral
- Test: `services/api/tests/test_documents_api.py`

- [ ] **Step 1: Add failing API tests** for provider-backed upload, owner-scoped inline content, delete, rollback after failed commit, and cleanup of prior objects.
- [ ] **Step 2: Run** `python -m pytest tests/test_documents_api.py -q` and verify new cases fail.
- [ ] **Step 3: Keep current extraction, size/type validation, metadata transaction, tags, and progress semantics** while routing original bytes through provider. Persist only the opaque object key in `Document.storage_key`.
- [ ] **Step 4: Keep every DB query owner-scoped before storage access**; make compensation idempotent.
- [ ] **Step 5: Re-run** `python -m pytest tests/test_documents_api.py -q`.

### Task 5: Add safe environment examples and Render/Supabase setup guidance

**Files:**
- Modify: `services/api/.env.example`
- Create or modify: deployment documentation under `docs/deployment/`
- Test: documentation/config assertions only if the repository already tests them

- [ ] **Step 1: Add documentation checks or a concise review checklist** asserting only variable names/placeholders appear, never real values.
- [ ] **Step 2: Document local mode, cloud-mode variable names, two private buckets and matching MIME/size limits, and where to add server environment variables in Render.** Avoid putting service secrets into Vite variables.
- [ ] **Step 3: Explain that existing local/ephemeral uploads are not auto-migrated** and require re-upload or a separately approved migration.
- [ ] **Step 4: Review the diff for secrets, accidental `.env` edits, and public bucket settings.**

### Task 6: Validate storage regressions

- [ ] Run `python -m pytest tests/test_storage_providers.py tests/test_profile.py tests/test_documents_api.py -q` from `services/api`.
- [ ] Run the broader relevant backend suite if focused tests pass: `python -m pytest tests/test_profile.py tests/test_documents_api.py tests/test_tags_api.py -q`.
- [ ] Run frontend API/profile/document tests from `WebApp`: `npm test -- tests/api-client.test.js tests/documents-page.test.js tests/document-reader-page.test.js` (adjust only to actual existing test filenames).
- [ ] Inspect `git diff --check` and ensure no `.env`, live secret, deployment mutation, or generated file is included.
- [ ] Do not claim production persistence is active until the user configures Render variables/buckets and separately authorizes deployment.
