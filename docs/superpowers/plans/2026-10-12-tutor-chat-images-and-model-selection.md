# Tutor Chat Model Selection and Image Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Tutor with per-message provider/model selection, private image attachments, and a familiar responsive chat layout without losing retryable turns or legacy conversations.

**Architecture:** Reuse the server's existing provider catalog and UP AI Connect configuration, adding confirmed image-capability metadata and a shared catalog route. Store validated image files in private local storage with SQLite metadata and owner-scoped API access; pass only images attached/referenced for the current turn to the selected multimodal model. Keep the current text-only JSON Tutor API compatible.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, SQLite, Pillow, httpx, vanilla JavaScript, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-tutor-chat-images-and-model-selection-design.md`

## Global Constraints

- Work only in `C:/Users/Admin/.codex/worktrees/synapsesync-local-auth/se-sec2-team-06`; never modify `D:/Project SE Sce 2/se-sec2-team-06`, prototypes, or unrelated worktree changes.
- Do not commit or push without a separate user request.
- Accept JPEG, PNG, and WebP only; maximum 3 images per user message, 5 MiB per image, 15 MiB total image payload.
- The server is authoritative for provider/model pairs and image capability; unknown models are not image-capable.
- Keep API credentials on the server and never switch provider/model automatically.
- Preserve existing text-only request compatibility, conversation history, clarification flow, tags/search, retry idempotency, and owner checks.
- Keep images in private local storage, never in SQLite blobs or a static public directory; only send images explicitly attached/referenced for the current turn to UP AI Connect.
- Use fake providers and synthetic image fixtures in tests; do not make live AI calls or require a real API key.

## Review Focus

- Invalid, truncated, MIME-mismatched, oversized, or too-many images must be rejected before provider invocation and leave no orphan file (Task 2 storage tests).
- A guessed attachment ID from another account or conversation must return non-disclosing 404 and must not reach the provider (Task 4 API tests).
- Unknown provider/model pairs and text-only models selected for image turns must be rejected before provider invocation (Tasks 1 and 4 tests).
- Quota, network, malformed-output, and retry failures after persistence must retain exactly one learner turn and its images; manual alternate-model retry must not duplicate either (Task 4 API tests).
- A legacy SQLite database with existing Tutor messages but no new columns must migrate additively and keep all old content (Task 2 migration test).

---

### Task 1: Shared provider catalog and image capability

**Files:**
- Modify: `services/api/app/ai/catalog.py`
- Create: `services/api/app/schemas/ai.py`
- Create: `services/api/app/routers/ai.py`
- Modify: `services/api/app/main.py`
- Create: `services/api/tests/test_ai_catalog.py`
- Modify: `services/api/tests/test_quiz_provider.py`

**Interfaces:**
- Produces: `get_provider_catalog() -> list[dict[str, object]]` with provider `{id, name, models}` and model `{id, name, supports_images}`; `resolve_model_selection(provider_id, model_id, *, default_model=None) -> ModelSelection` where `ModelSelection.supports_images: bool` is authoritative.
- Produces: authenticated `GET /api/ai/providers` returning `{providers: [...], default_selection: {provider_id, model_id} | null}`. `default_selection` is derived from server AI settings; `null` means no valid configured default.
- Preserves: `GET /api/quizzes/providers` response shape `{providers: [{id, name, models: [{id, name}]}]}` and existing quiz selection behavior.

- [x] **Step 1: Write failing API/catalog tests**
  - Add `test_ai_provider_catalog_requires_authentication`.
  - Add `test_ai_provider_catalog_includes_image_capabilities_and_default_selection`.
  - Add `test_quiz_provider_catalog_keeps_existing_response_shape` to pin the legacy quiz response.
  - Add `test_unknown_model_is_not_resolved_as_image_capable` for server-side selection validation.
- [x] **Step 2: Run the new tests and confirm they fail**

  Run from `services/api`: `python -m pytest tests/test_ai_catalog.py tests/test_quiz_provider.py -q`

  Expected: new route/schema/capability assertions fail; existing quiz tests remain diagnostic.
- [x] **Step 3: Confirm the image-capability boundary from authoritative documentation**
  - The official public UP AI Connect user guide documents model selection and daily quota, but does not specify multimodal image input or its request format. Do not make a live provider request for this implementation and do not infer capability from provider/model names.
  - Keep every production catalog model at `supports_images=False` until official API documentation or user-provided platform guidance confirms the model IDs and payload format. Exercise the image-adapter path with an explicitly image-capable test catalog fixture only. The UI must still allow private upload/history and explain that analysis is unavailable until a confirmed image-capable model is configured.
- [x] **Step 4: Implement the catalog contract**
  - Extend `ModelSelection` and the catalog model representation with `supports_images`.
  - Add Pydantic catalog schemas in `schemas/ai.py` and an authenticated route in `routers/ai.py`.
  - Resolve the server-configured default model from `request.app.state.ai_settings`; return null if no catalog pair can be resolved.
  - Include the router in `create_app()` in `main.py`. Keep the existing quiz route and schema unchanged; its response model must continue stripping the new internal field.
- [x] **Step 5: Run the focused API tests and confirm they pass**

  Run from `services/api`: `python -m pytest tests/test_ai_catalog.py tests/test_quiz_provider.py -q`

  Expected: all selected tests pass, including the existing quiz catalog contract.

### Task 2: Private image storage, attachment records, and migration

**Files:**
- Create: `services/api/app/storage/tutor_attachments.py`
- Create: `services/api/app/models/tutor_attachment.py`
- Modify: `services/api/app/models/tutor.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/app/main.py`
- Create: `services/api/tests/test_tutor_attachment_storage.py`
- Modify: `services/api/tests/test_database.py`

**Interfaces:**
- Produces: `store_tutor_attachment(upload: UploadFile, storage_dir: str | Path) -> StoredTutorAttachment` and `read_tutor_attachment(storage_key: str, storage_dir: str | Path) -> bytes`.
- `StoredTutorAttachment` contains only `storage_key`, validated `mime_type`, and `byte_size`; the original filename is stored as metadata, never used as a filesystem path.
- Produces: `TutorAttachment` metadata owned by one user/conversation and a message-to-attachment association so a saved image can be explicitly reused in a later turn without duplicating bytes.
- Produces: `migrate_tutor_message_selection(engine) -> None`, adding nullable `provider_id` and `model_id` to existing `tutor_messages` only when missing. New attachment tables are created through registered SQLAlchemy metadata.

- [x] **Step 1: Write failing image-storage and migration tests**
  - Add `test_store_tutor_attachment_accepts_supported_image_and_uses_random_key`.
  - Add `test_store_tutor_attachment_rejects_mime_mismatch_and_corrupt_image`.
  - Add `test_store_tutor_attachment_rejects_more_than_five_mib_and_cleans_partial_file`.
  - Add `test_migrate_tutor_message_selection_adds_nullable_columns_without_losing_rows` using a legacy Tutor schema and seeded message.
- [x] **Step 2: Run the tests and confirm they fail**

  Run from `services/api`: `python -m pytest tests/test_tutor_attachment_storage.py tests/test_database.py -q`

  Expected: storage module, metadata models, and migration are missing.
- [x] **Step 3: Implement validation and private storage**
  - Reuse the existing Pillow validation pattern from `storage/profile_images.py`, with Tutor-specific constants for 5 MiB and JPEG/PNG/WebP.
  - Read at most limit + 1 bytes; verify/load the image; require declared MIME to match detected format; write to a random server-generated key with atomic staging/replace; remove a partial file on any exception.
  - Reject a storage key containing path separators or traversal before reading.
- [x] **Step 4: Implement models and additive migration**
  - Add `TutorAttachment` and a unique `TutorMessageAttachment` association, with foreign keys/cascades for SQLite metadata and owner/conversation fields for server checks.
  - Register the models in `models/__init__.py` and `main.py` before `Base.metadata.create_all()`.
  - Add `migrate_tutor_message_selection()` in `database.py` and call it after `create_all()` in the application lifespan.
  - Add `tutor_attachment_storage_dir: str | Path | None` to `create_app()`, default it to `<data_dir>/tutor-attachments`, create it at startup, and expose it on `application.state` for the route layer.
- [x] **Step 5: Run the focused tests and confirm they pass**

  Run from `services/api`: `python -m pytest tests/test_tutor_attachment_storage.py tests/test_database.py -q`

  Expected: all storage and migration tests pass; old Tutor rows remain unchanged.

### Task 3: Selection-aware multimodal Tutor provider

**Files:**
- Modify: `services/api/app/ai/tutor.py`
- Modify: `services/api/app/ai/prompts/tutor_v1.md`
- Modify: `services/api/app/main.py`
- Modify: `services/api/tests/test_tutor_ai.py`

**Interfaces:**
- Produces: `TutorImageInput(mime_type: Literal["image/jpeg", "image/png", "image/webp"], base64_data: str)` and `TutorTurn(role, content, images: list[TutorImageInput] = [])`.
- Produces: `build_tutor_provider(settings: AISettings, *, provider_id: str | None = None, model_id: str | None = None, transport: httpx.AsyncBaseTransport | None = None) -> TutorProvider`.
- Produces: `create_app(..., tutor_provider_factory: Callable[[str | None, str | None], TutorProvider] | None = None)`; the default factory closes over server-side `AISettings` and resolves the requested pair.
- Preserves: text-only `TutorRequest`/`TutorReply` validation and the current default provider behavior when no selection is supplied.

- [x] **Step 1: Write failing adapter tests**
  - Add `test_provider_uses_selected_provider_model_and_server_key`.
  - Add `test_provider_encodes_images_as_openai_compatible_user_content_blocks` and assert the request contains one text block followed by the expected image data URL.
  - Add `test_provider_rejects_image_turn_for_model_without_image_capability`.
  - Keep existing answer, clarification, malformed response, quota, and network tests unchanged.
- [x] **Step 2: Run the tests and confirm the new assertions fail**

  Run from `services/api`: `python -m pytest tests/test_tutor_ai.py -q`

  Expected: provider selection and image content serialization are not implemented.
- [x] **Step 3: Implement the request and provider selection contract**
  - Add optional image inputs to user turns and build OpenAI-compatible multimodal `content` only for turns carrying explicit images; leave text-only turns as strings.
  - Resolve the selected catalog pair with `resolve_model_selection`; reject invalid pairs and non-image-capable selections before any HTTP request.
  - Extend `build_tutor_provider()` to accept optional provider/model IDs while retaining server settings for URL, key, timeout, and default selection.
  - Update `create_app()` provider-factory injection to accept `(provider_id, model_id)` while keeping the default factory bound to server-side settings.
  - Update the Tutor prompt to describe how to interpret an explicitly attached image while preserving its structured answer/clarification contract.
- [x] **Step 4: Run the focused adapter tests and confirm they pass**

  Run from `services/api`: `python -m pytest tests/test_tutor_ai.py -q`

  Expected: all provider tests pass using `httpx.MockTransport`; no real network request occurs.

### Task 4: Tutor conversation/API integration, private reads, and retry

**Files:**
- Modify: `services/api/app/models/tutor.py`
- Modify: `services/api/app/schemas/tutor.py`
- Modify: `services/api/app/services/tutor_conversations.py`
- Modify: `services/api/app/routers/tutor.py`
- Modify: `services/api/app/main.py`
- Modify: `services/api/tests/test_tutor_conversations.py`
- Modify: `services/api/tests/test_tutor_api.py`

**Interfaces:**
- Produces: `TutorMessageInput` and `TutorConversationCreate` with optional `provider_id`, `model_id`, and `attachment_ids`; `TutorRetryInput` with optional `provider_id` and `model_id`; `TutorMessageSummary` with provider/model fields and attachment summaries.
- Preserves text-only JSON routes: `POST /api/tutor/conversations` and `POST /api/tutor/conversations/{conversation_id}/messages`.
- Adds multipart `POST /api/tutor/conversations/with-images` and `POST /api/tutor/conversations/{conversation_id}/messages/with-images` with fields `message`, `request_id`, `provider_id`, `model_id`, repeated `tag_ids` on create, repeated `attachment_ids`, and repeated `images` files.
- Adds authenticated `GET /api/tutor/conversations/{conversation_id}/attachments/{attachment_id}`; every access checks the current user, conversation, and attachment relationship.
- Retry becomes `POST /api/tutor/conversations/{conversation_id}/retry` with optional JSON `{provider_id, model_id}`; omission retries the saved selection.

- [x] **Step 1: Write failing service/API tests**
  - Add `test_selected_provider_and_model_are_persisted_on_each_turn`.
  - Add `test_image_message_is_saved_before_provider_failure_and_can_retry_without_duplicate_turn`.
  - Add `test_image_attachment_can_be_referenced_again_without_copying_file`.
  - Add `test_attachment_read_and_reference_are_owner_and_conversation_scoped`.
  - Add `test_non_image_model_rejects_attachment_before_provider_call`.
  - Add `test_quota_failure_names_selected_provider_and_preserves_image_for_manual_alternate_retry`.
- [x] **Step 2: Run the tests and confirm the new cases fail**

  Run from `services/api`: `python -m pytest tests/test_tutor_conversations.py tests/test_tutor_api.py -q`

  Expected: selected pair, attachment association, multipart routes, and protected reads are missing.
- [x] **Step 3: Implement message persistence and request assembly**
  - Extend `create_conversation()`, `add_user_message()`, and `save_tutor_reply()` to persist the learner's selected pair and the actual assistant pair; update conversation-level pair to the latest used pair.
  - Associate newly stored and explicitly reselected attachment IDs with the current user message after verifying same-user/same-conversation ownership.
  - Build `TutorRequest` from the most recent 40 text turns and only the images linked to the current learner message. Load image bytes from the configured private storage.
  - Commit the learner turn and attachment metadata before provider I/O; on provider error, mark the existing conversation retryable and keep the same turn and files.
- [x] **Step 4: Implement route-level selection, upload, and ownership checks**
  - Refactor the shared generate/reply path to call `tutor_provider_factory(provider_id, model_id)` when not using an injected test provider.
  - Keep the existing JSON create/send/retry flows; support attachment IDs in JSON for explicit history re-reference.
  - Add the two multipart `with-images` routes and parse file uploads using the exact limits in the spec. If persistence fails after writing files, remove unlinked files.
  - Add the authenticated attachment read route with a non-disclosing 404 for missing or unowned records and safe MIME response headers.
  - Return retryable quota/unavailable errors while retaining the user turn; ensure retry with an alternate model does not insert a duplicate user message or attachment record.
- [x] **Step 5: Run the focused service/API tests and confirm they pass**

  Run from `services/api`: `python -m pytest tests/test_tutor_conversations.py tests/test_tutor_api.py tests/test_ai_catalog.py tests/test_tutor_attachment_storage.py -q`

  Expected: all selected tests pass; provider fakes are used throughout.

### Task 5: Provider/model controls and per-answer labels in Tutor

**Files:**
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/tests/api-client.test.js`
- Modify: `WebApp/tests/tutor-page.test.js`

**Interfaces:**
- Produces: `getAiProviders(options)`, which calls `/ai/providers`; `retryTutorMessage(conversationId, payload, options)`, which optionally sends provider/model JSON.
- `TutorPage` receives provider catalog through the existing page loader, restores the latest pair for an opened conversation, and otherwise uses `default_selection` from the catalog.
- A send operation includes `provider_id` and `model_id`; each assistant message renders its persisted pair, while historical messages with null IDs render without a fabricated label.

- [x] **Step 1: Write failing client/UI tests**
  - Add `getAiProviders` URL/auth-fetch contract coverage in `api-client.test.js`.
  - Add `test_tutor_model_selectors_send_selected_pair`.
  - Add `test_tutor_restores_conversation_selection_and_labels_each_answer`.
  - Add `test_tutor_disables_unconfirmed_image_models_when_attachment_is_selected`.
- [x] **Step 2: Run the selected WebApp tests and confirm they fail**

  Run from `WebApp`: `npm test -- tests/api-client.test.js tests/tutor-page.test.js`

  Expected: shared catalog wrapper and Tutor selection controls are absent.
- [x] **Step 3: Implement catalog loading and selection state**
  - Add the shared catalog API method and wire the Tutor page loader/state to fetch it.
  - Render provider then dependent model selectors using server IDs/names/capability; use `default_selection` for a new conversation and the conversation's saved pair when opening history.
  - Pass the current pair with every send; allow changing the pair before retry; never change it automatically on quota errors.
  - Add the provider/model label to assistant replies only when those IDs were recorded.
- [x] **Step 4: Run the selected WebApp tests and confirm they pass**

  Run from `WebApp`: `npm test -- tests/api-client.test.js tests/tutor-page.test.js`

  Expected: current Tutor search, tag, clarification, and retry tests still pass alongside new selector tests.

### Task 6: Image composer, history preview, and responsive chat layout

**Files:**
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/src/styles.css`
- Modify: `WebApp/tests/api-client.test.js`
- Modify: `WebApp/tests/tutor-page.test.js`

**Interfaces:**
- Produces: `createTutorConversationWithImages(formData, options)` and `sendTutorMessageWithImages(conversationId, formData, options)` using existing FormData request handling.
- Produces: `getTutorAttachmentUrl(conversationId, attachmentId)` for an authenticated same-origin image endpoint; image URLs use the session cookie and never expose a storage path.
- Form fields are `message`, `request_id`, `provider_id`, `model_id`, optional repeated `tag_ids`/`attachment_ids`, and repeated `images` files.

- [x] **Step 1: Write failing upload/API/UI tests**
  - Add client tests confirming multipart bodies are passed through without manually setting a `Content-Type` boundary.
  - Add UI tests for choosing/previewing/removing an image, rejecting 4 images/unsupported type/>5 MiB, sending valid images with the chosen model, and selecting a prior image from history by ID.
  - Add a UI test that a provider failure retains the message and image selection for retry.
  - Add a scroll behavior test that new turns scroll only when the reader was already at the bottom.
- [x] **Step 2: Run the selected WebApp tests and confirm they fail**

  Run from `WebApp`: `npm test -- tests/api-client.test.js tests/tutor-page.test.js`

  Expected: attachment client methods, composer, and message image rendering are absent.
- [x] **Step 3: Implement the attachment composer and history renderer**
  - Add file input/button, local image previews, remove controls, and validation matching the server's 3-image/5 MiB/15 MiB limits.
  - Use multipart methods only when newly selected files exist; use JSON attachment IDs when the learner explicitly reselects an image from the same conversation.
  - Render saved attachments via the authenticated API URL, with accessible filename text and an explicit “use this image” action.
  - Keep pending text/files after retryable errors and clear the composer only after the request is accepted for processing.
- [x] **Step 4: Implement chat scrolling and responsive styles**
  - Keep history scroll separate from the vertically scrolling message region; anchor the composer at the bottom without introducing page-level horizontal overflow.
  - Collapse the history side panel on narrow screens and keep model/image controls reachable above the composer.
  - Respect reader position when auto-scrolling after new messages.
- [x] **Step 5: Run the selected WebApp tests and confirm they pass**

  Run from `WebApp`: `npm test -- tests/api-client.test.js tests/tutor-page.test.js`

  Expected: existing and new Tutor UI/client tests pass.

### Task 7: Cross-feature verification

**Files:**
- Verify only; no new product files unless a failing test requires a scoped fix.

**Interfaces:**
- Consumes: catalog, attachment storage/migration, multimodal provider, Tutor API, and WebApp interfaces from Tasks 1–6.
- Produces: recorded test/build results and a concise user handoff. Do not commit or push.

- [x] **Step 1: Run focused API regression suite**

  Run from `services/api`: `python -m pytest tests/test_ai_catalog.py tests/test_tutor_attachment_storage.py tests/test_tutor_ai.py tests/test_tutor_conversations.py tests/test_tutor_api.py tests/test_database.py tests/test_quiz_provider.py -q`

  Expected: all selected tests pass without a live provider call.
- [x] **Step 2: Run focused WebApp regression suite and production build**

  Run from `WebApp`: `npm test -- tests/api-client.test.js tests/tutor-page.test.js`

  Run from `WebApp`: `npm run build`

  Expected: selected tests pass and Vite exits successfully.
- [ ] **Step 3: Review the final scoped diff**

  Run from the approved worktree: `git status --short` and `git diff --check`.

  Expected: no whitespace errors; preserve all unrelated pre-existing worktree changes; no files changed under the prohibited main folder.
