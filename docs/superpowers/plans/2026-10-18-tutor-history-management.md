# Tutor History Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a user to add/change tags on saved Tutor chats and safely delete saved chats.

**Architecture:** Add owner-scoped API mutations that reuse existing tag validation and ORM cascades, cleaning private attachment objects after deleting their database records. Extend the Tutor history cards with edit/delete actions, an existing tag-picker dialog, and a confirmation step; keep the frontend API calls injectable for tests.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, vanilla JavaScript, Vitest/jsdom, pytest.

**Spec:** `docs/superpowers/specs/2026-10-18-tutor-history-management.md`

## Global Constraints

- Preserve all existing uncommitted work in the shared repository.
- Scope all mutations to the authenticated conversation owner and apply `require_same_origin`.
- Reuse tag catalog and ownership validation; do not duplicate tag rules.
- Keep behavior and controls unavailable while a conversation is processing.
- Keep UI copy consistent with the app's existing Thai labels and theme.

## Review Focus

- A user cannot edit or delete another user's conversation — API tests assert 404 and unchanged owner data.
- A processing chat cannot be mutated — API tests assert 409 and unchanged tags/messages.
- Tag input cannot reference nonexistent or foreign tags — API test asserts 404 and no partial update.
- Deletion cleans attachment storage as well as database rows — API test asserts the stored object is removed.
- Canceling deletion or closing tag editing leaves the history unchanged — UI tests assert no mutation call is made.

---

### Task 1: Owner-scoped Tutor conversation API mutations

**Files:**
- Modify: `services/api/app/schemas/tutor.py`
- Modify: `services/api/app/services/tutor_conversations.py`
- Modify: `services/api/app/routers/tutor.py`
- Test: `services/api/tests/test_tutor_api.py`

**Interfaces:**
- Add a tags-update payload with `tag_ids: list[int]`.
- Add `PUT /tutor/conversations/{conversation_id}/tags` returning `TutorConversationDetail`.
- Add `DELETE /tutor/conversations/{conversation_id}` returning HTTP 204.

- [x] **Step 1: Write failing API tests** for replacing a saved chat's tags, rejecting unavailable tags/processing/foreign conversations, deleting only the owner's chat, and cleaning its stored attachment objects.
- [x] **Step 2: Run the new tests** from `services/api` with `\.venv\Scripts\python.exe -m pytest tests/test_tutor_api.py -q`; confirm failures describe missing behavior.
- [x] **Step 3: Implement the payload, service operations, and routes.** Reuse existing owned-conversation lookup and tag validation; collect attachment storage keys before deletion and call `cleanup_tutor_attachments` after commit.
- [x] **Step 4: Re-run the focused API tests** from `services/api` with `\.venv\Scripts\python.exe -m pytest tests/test_tutor_api.py -q` and confirm the new tests pass without regressing existing Tutor tests.

### Task 2: Frontend API client and history actions

**Files:**
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/api-client.test.js`
- Test: `WebApp/tests/tutor-page.test.js`

**Interfaces:**
- Export `updateTutorConversationTags(conversationId, tagIds, options)` and `deleteTutorConversation(conversationId, options)` from the API client.
- Inject these mutations and a confirmation function into `renderTutorPage` dependencies.

- [x] **Step 1: Write failing client and UI tests** for request method/path/body, opening tag editing on an existing conversation, saving and reflecting tags, confirmed deletion, canceled deletion, and disabling actions while processing.
- [x] **Step 2: Run only the new WebApp tests** from `WebApp` with `npm test -- tests/api-client.test.js tests/tutor-page.test.js`; confirm they fail for missing behavior.
- [x] **Step 3: Implement client methods and history UI.** Reuse `renderTagPicker` and existing dialog conventions; refresh history and active-chat tags after success; remove a deleted chat from the view and clear the active view if it was selected.
- [x] **Step 4: Re-run the focused WebApp tests** from `WebApp` with `npm test -- tests/api-client.test.js tests/tutor-page.test.js` and confirm the new tests pass.

### Task 3: Full regression verification

**Files:**
- No additional files unless tests expose a regression.

- [x] **Step 1: Run the full WebApp suite** from `WebApp` with `npm test`.
- [x] **Step 2: Run the full API suite** from `services/api` with `\.venv\Scripts\python.exe -m pytest -q`.
- [x] **Step 3: Review the final diff** to confirm the feature changes are scoped to Tutor history and tag-selection behavior; preserve unrelated pre-existing edits without committing or pushing them.
