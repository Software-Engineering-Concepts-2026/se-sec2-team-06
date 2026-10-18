# Shared Flat Tags and Deadline Tag Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove parent-subject selection from the shared tag system while preserving existing tag assignments, and let deadlines select from the same flat catalog.

**Architecture:** Keep `Tag.parent_id` only as legacy metadata for existing records. Return one flat, owner-scoped catalog from the API; new tags have no parent. Update shared picker/assignment code and migrate deadline subject values to tag references without discarding their display labels.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, SQLite startup migrations, vanilla JavaScript DOM modules, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-tag-library-and-quiz-polish-design.md`

## Global Constraints

- Tags created by a learner remain private to that learner.
- Remove the user-facing “หลัก/ย่อย” hierarchy and the parent-subject selection step when creating a tag.
- Preserve any existing parent metadata internally as legacy data; do not delete or rewrite existing assignments as part of the UI change.
- Keep the ten-color palette for custom tags. Built-in tags retain their current assigned colors.
- Selecting a chip applies or removes it immediately; there is no separate save-tags action.
- Do not edit the main folder `D:\Project SE Sce 2\se-sec2-team-06`.
- Do not commit or push changes.

## Review Focus

- Same-owner flat-tag duplicates must be case-insensitive, while different learners may reuse a name: `test_create_flat_tag_rejects_casefold_duplicate_for_owner` and `test_create_flat_tag_allows_same_name_for_other_owner` in `services/api/tests/test_tags.py`.
- Catalog flattening must preserve legacy child rows and all existing joins: `test_flat_catalog_preserves_legacy_child_and_assignments` in `services/api/tests/test_tags.py`.
- Independent document tags must no longer require a shared parent: `test_replace_document_tags_accepts_independent_tags` and `test_document_can_toggle_unrelated_tags` in the owning API and page tests.
- Deadline tag IDs must be built-in or current-owner tags: `test_create_deadline_rejects_unknown_or_foreign_tag` in `services/api/tests/test_deadlines_api.py`.
- Existing unmatched deadline subjects must survive migration unchanged: `test_migrate_deadline_tag_id_preserves_unmatched_subject` in `services/api/tests/test_database.py`.

---

### Task 1: Flat tag catalog and parentless tag API

**Files:**
- Modify: `services/api/app/models/tag.py`
- Modify: `services/api/app/schemas/tag.py`
- Modify: `services/api/app/tags/service.py`
- Modify: `services/api/app/routers/tags.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/app/main.py`
- Test: `services/api/tests/test_tags.py`
- Test: `services/api/tests/test_database.py`

**Interfaces:**
- Produces `GET /api/tags -> TagCatalogResponse`, where `TagCatalogResponse = { tags: TagSummary[] }`, ordered as built-ins followed by the learner’s custom tags by ascending ID (creation order). `TagSummary = { id: number, name: string, color: TagColor, is_builtin: boolean, parent_id: number | null }`; consumers ignore legacy parent values for display.
- Produces `POST /api/tags` with `{ "name": string, "color": TagColor } -> TagSummary`; `parent_tag_id` is not accepted and newly created rows use `parent_id = null`.
- Replaces `list_tag_catalog(session: Session, user_id: int) -> dict[str, object]` and `create_topic_tag(...)` with `list_tag_catalog(...)` and `create_tag(session: Session, user_id: int, name: str, color: TagColor = "violet") -> Tag`.

- [ ] **Step 1: Write failing API tests** named `test_list_tags_returns_builtin_then_only_owner_flat_tags`, `test_create_tag_is_parentless_and_keeps_selected_color`, `test_create_flat_tag_rejects_casefold_duplicate_for_owner`, and `test_create_flat_tag_allows_same_name_for_other_owner`; assert legacy `parent_id` is unchanged and not used to group the response.
- [ ] **Step 2: Run the focused tests and verify they fail**: `python -m pytest tests/test_tags.py -q` from `services/api`.
- [ ] **Step 3: Implement `TagSummary`, `TagCatalogResponse(tags=...)`, and `create_tag(...)`**. Keep old `parent_id` values intact and return them as metadata; order custom tags by ID.
- [ ] **Step 4: Add `migrate_flat_tag_uniqueness(engine)`** in `services/api/app/database.py` and call it from the SQLite startup migration sequence in `services/api/app/main.py`. Create `uq_tag_owner_flat_name_key` as a partial unique index on `(owner_id, name_key)` where `owner_id IS NOT NULL AND parent_id IS NULL`; do not touch legacy child rows. `test_migrate_flat_tag_uniqueness_is_idempotent_and_preserves_children` must pass on a pre-existing SQLite database.
- [ ] **Step 5: Run tag and database tests**: `python -m pytest tests/test_tags.py tests/test_database.py -q` from `services/api`.

### Task 2: Flat picker and independent tag assignments

**Files:**
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/tags/tag-components.js`
- Modify: `WebApp/src/tags/document-tag-selection.js`
- Modify: `WebApp/src/pages/DocumentsPage.js`
- Modify: `WebApp/src/pages/QuizLibraryPage.js`
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/src/pages/ProgressPage.js`
- Test: `WebApp/tests/tag-components.test.js`
- Test: `WebApp/tests/tag-assignment-queue.test.js`
- Test: `WebApp/tests/documents-page.test.js`
- Test: `WebApp/tests/quiz-library-page.test.js`
- Test: `WebApp/tests/tutor-page.test.js`
- Test: `WebApp/tests/progress-page.test.js`

**Interfaces:**
- Consumes `TagCatalogResponse` from Task 1, reading the list only from `catalog.tags`.
- `renderTagPicker({ catalog, selectedTagIds, onToggle, onCreate })` renders flat chips and posts `{ name, color }`; it retains the ten-color palette (`violet`, `blue`, `cyan`, `teal`, `green`, `lime`, `amber`, `orange`, `rose`, `pink`) and search.
- `nextDocumentTagSelection(currentTagIds: number[], toggledTagId: number, catalog: TagCatalog) -> number[]` toggles only the requested tag and imposes no parent/subject rule.

- [ ] **Step 1: Write failing component tests** named `test_tag_picker_searches_flat_catalog`, `test_tag_picker_appends_custom_tags_after_builtins`, `test_tag_picker_creates_without_parent_and_with_color`, `test_tag_chip_toggles_immediately_and_keeps_focus`, and `test_tag_selection_allows_unrelated_tags`; assert `aria-pressed` and the exact `{name,color}` create payload.
- [ ] **Step 2: Run the focused tests and verify failure**: `npm test -- tests/tag-components.test.js tests/tag-assignment-queue.test.js` from `WebApp`.
- [ ] **Step 3: Implement the flat picker and independent selection helper**; update all tag-catalog consumers so none render parent groups or prepend a parent subject to custom tags.
- [ ] **Step 4: Update page tests** to prove documents, quizzes, Tutor conversations, and progress show the flat tag order; assert an assignment failure leaves the persisted selection unchanged and announces the error.
- [ ] **Step 5: Run affected frontend tests**: `npm test -- tests/tag-components.test.js tests/tag-assignment-queue.test.js tests/documents-page.test.js tests/quiz-library-page.test.js tests/tutor-page.test.js tests/progress-page.test.js`.

### Task 3: Permit independent tags in documents, quizzes, Tutor, and Progress

**Files:**
- Modify: `services/api/app/tags/service.py`
- Modify: `services/api/app/routers/documents.py`
- Modify: `services/api/app/routers/quizzes.py`
- Modify: `services/api/app/routers/tutor.py`
- Modify: `services/api/app/services/tutor_conversations.py`
- Modify: `services/api/app/services/progress.py`
- Test: `services/api/tests/test_documents_api.py`
- Test: `services/api/tests/test_quiz_library.py`
- Test: `services/api/tests/test_tutor_api.py`
- Test: `services/api/tests/test_tutor_conversations.py`
- Test: `services/api/tests/test_progress_api.py`
- Test: `services/api/tests/test_tags.py`

**Interfaces:**
- Existing `replace_document_tags(session, user_id, document_id, tag_ids)` and `replace_quiz_tags(session, user_id, quiz_id, tag_ids)` keep their signatures, but accept any combination of built-in tags and tags owned by the learner.
- Tutor conversation creation accepts any combination of built-in tags and current-owner tags through `_accessible_tags(session: Session, user_id: int, tag_ids: list[int]) -> list[Tag]`.
- Document/quiz `GET` filters accept any current-owner custom tag. Selecting a custom tag matches that exact tag; selecting a built-in root continues to include its legacy descendants for backwards compatibility.
- Tutor tag filters match the exact selected available tag.
- `get_progress_overview(..., tag_id=...)` and `get_topic_progress(session, user_id, tag_id)` match an exact custom tag; selecting a built-in root retains its legacy descendant behavior. Both reject unavailable/foreign tag IDs.
- Legacy `parent_id` never grants access to a tag belonging to another user.

- [ ] **Step 1: Add failing API tests** named `test_replace_document_tags_accepts_independent_tags`, `test_replace_quiz_tags_accepts_independent_tags`, `test_replace_tags_removes_only_unselected_tag`, `test_replace_tags_rejects_foreign_custom_tag`, `test_document_filter_accepts_parentless_owner_tag`, `test_quiz_filter_accepts_parentless_owner_tag`, `test_builtin_filter_keeps_legacy_child_matches`, `test_tutor_conversation_accepts_parentless_owner_tag`, and `test_progress_topic_filter_matches_exact_flat_tag`; assert a foreign tag returns the existing not-found/unavailable response.
- [ ] **Step 2: Run the focused tests and verify failure**: `python -m pytest tests/test_tags.py tests/test_documents_api.py tests/test_quiz_library.py tests/test_tutor_api.py tests/test_tutor_conversations.py tests/test_progress_api.py -q` from `services/api`.
- [ ] **Step 3: Replace parent/subject validation with a built-in-or-owner predicate** in document/quiz filters and assignments, Tutor conversation creation/filtering, and Progress tag matching; keep built-in-root filters compatible with legacy descendants while flat custom tags match exactly.
- [ ] **Step 4: Run `python -m pytest tests/test_tags.py tests/test_documents_api.py tests/test_quiz_library.py tests/test_tutor_api.py tests/test_tutor_conversations.py tests/test_progress_api.py -q`** from `services/api` and confirm owner-scoping and legacy-assignment tests pass.

### Task 4: Use shared tags for deadline subjects

**Files:**
- Modify: `services/api/app/models/deadline.py`
- Modify: `services/api/app/schemas/deadline.py`
- Modify: `services/api/app/routers/deadlines.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/app/main.py`
- Modify: `WebApp/src/pages/DeadlinesPage.js`
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/main.js`
- Test: `services/api/tests/test_deadlines_api.py`
- Test: `services/api/tests/test_database.py`
- Test: `WebApp/tests/deadlines-page.test.js`

**Interfaces:**
- `Deadline.tag_id` is nullable for legacy unmatched subjects. `POST /api/deadlines` accepts a selected `tag_id`; response includes `tag_id` and the existing display `subject` name resolved from that tag.
- Existing `subject` strings are backfilled to matching built-in tag IDs when available; unmatched legacy strings remain displayable and are not deleted.
- `renderDeadlinesPage({ loadTags, loadDeadlines, createDeadline, updateDeadline, deleteDeadline })` uses the flat catalog for subject selection.

- [ ] **Step 1: Write failing tests** named `test_create_deadline_from_builtin_tag`, `test_create_deadline_from_owner_tag`, `test_create_deadline_rejects_unknown_or_foreign_tag`, and `test_migrate_deadline_tag_id_preserves_unmatched_subject`; assert response `tag_id` plus the exact existing `subject` label.
- [ ] **Step 2: Run focused API/UI tests and verify failure**: `python -m pytest tests/test_deadlines_api.py tests/test_database.py -q` from `services/api`; then `npm test -- tests/deadlines-page.test.js` from `WebApp`.
- [ ] **Step 3: Add an idempotent nullable `deadlines.tag_id` migration** that matches existing subject text only to a built-in tag by normalized name, leaves unmatched labels with `tag_id = null`, and updates create responses from the selected tag while retaining `subject` for legacy display.
- [ ] **Step 4: Update the deadline form** to list all flat tags and submit the selected tag ID.
- [ ] **Step 5: Run all tag, document, quiz, deadline, Tutor, and progress tests**: `python -m pytest tests/test_tags.py tests/test_documents_api.py tests/test_quiz_library.py tests/test_deadlines_api.py tests/test_database.py tests/test_tutor_api.py tests/test_tutor_conversations.py tests/test_progress_api.py -q` from `services/api`; `npm test -- tests/tag-components.test.js tests/tag-assignment-queue.test.js tests/documents-page.test.js tests/quiz-library-page.test.js tests/deadlines-page.test.js tests/tutor-page.test.js tests/progress-page.test.js` from `WebApp`.
