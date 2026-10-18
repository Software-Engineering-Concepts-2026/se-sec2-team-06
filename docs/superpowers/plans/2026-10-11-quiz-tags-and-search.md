# Quiz Tags and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable, owner-safe subject/topic tags to quizzes and let users search the library by quiz title or attached tag and filter by a subject or topic.

**Architecture:** Store tags in a normalized shared `Tag` table and connect quizzes through a unique `quiz_tags` association table. Seed the seven built-in subjects idempotently; expose authenticated tag APIs and extend the existing quiz-list API. Implement reusable DOM tag controls in `WebApp/src/tags/` and integrate them into the existing quiz library.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, SQLite, pytest, vanilla JavaScript DOM, Vitest/jsdom, Vite.

**Spec:** `docs/superpowers/specs/2026-10-11-quiz-tags-and-search-design.md`

## Global Constraints

- Work only in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`; do not modify `D:\Project SE Sce 2\se-sec2-team-06` or `prototypes/`.
- Do not commit or push.
- The built-in roots are exactly `math` — `คณิตศาสตร์`, `english` — `ภาษาอังกฤษ`, `thai` — `ภาษาไทย`, `physics` — `ฟิสิกส์`, `chemistry` — `เคมี`, `biology` — `ชีววิทยา`, and `social-studies` — `สังคมศึกษา`; do not add `วิทยาการคำนวณ`.
- User-defined topic tags are private to their owner and are one level below a built-in subject; tag names are printable, trimmed, and at most 40 characters.
- Each quiz may have multiple tags; existing quizzes start untagged.
- Library search is case-insensitive substring matching over quiz title OR attached tag name; a selected tag filter is an additional condition.
- A subject filter includes its direct assignments and child-topic assignments; a topic filter matches that topic only.
- Keep newest-first ordering and the existing 20-item pagination; reset to page one when search or filter changes.
- Require the existing authenticated session for all tag APIs and same-origin protection for mutations; keep foreign quizzes/tags non-disclosing.
- Do not add a search service or dependency; do not auto-assign tags from source documents or during quiz generation.

## Review Focus

- A mixed assignment request containing one foreign, unknown, or duplicate tag ID must not partially change a quiz's current associations; pin with `test_replace_quiz_tags_rejects_unavailable_or_duplicate_ids_atomically` in Task 3.
- Two custom topic names that differ only by Latin letter case must conflict under the same owner and subject, while the same name under another owner or subject remains valid; pin all three cases with `test_create_topic_tag_enforces_owner_parent_casefolded_uniqueness` in Task 2.
- A user must never see or infer another user's custom tags through the catalog, quiz cards, search, or filters; pin catalog and search isolation in Tasks 2 and 4.
- A quiz matching several attached tags must appear once, and pagination must be applied after search/filter conditions; pin with `test_quiz_search_and_tag_filter_do_not_duplicate_paginated_rows` in Task 4.
- An existing quiz with no tags must still appear in the unfiltered list and remain title-searchable after the additive schema change; pin with `test_existing_untagged_quizzes_remain_listable_and_searchable` in Tasks 1 and 4.
- Deleting a tagged quiz must remove its association rows without deleting reusable tags; pin with `test_deleting_quiz_removes_only_tag_associations` in Task 3.

---

### Task 1: Tag data model and built-in subject seeding

**Files:**
- Create: `services/api/app/models/tag.py`
- Create: `services/api/app/tags/__init__.py`
- Create: `services/api/app/tags/catalog.py`
- Modify: `services/api/app/models/quiz.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/main.py`
- Test: `services/api/tests/test_tags.py`
- Test: `services/api/tests/test_quiz_database.py`

**Interfaces:**
- Produces `Tag` with `id`, `name`, nullable `slug`, nullable `owner_id`, nullable `parent_id`, `is_builtin`, and normalized `name_key` fields.
- Produces the `quiz_tags` SQLAlchemy association table keyed by `(quiz_id, tag_id)` and `Quiz.tags` / `Tag.quizzes` relationships.
- Produces `BUILTIN_SUBJECTS` and `seed_builtin_subjects(session_factory) -> None`.
- Seeding runs after `Base.metadata.create_all()` and is safe to run on every app startup; adding the tables must not rewrite or delete existing quiz or attempt rows.

- [x] **Step 1: Write the failing model/seeding tests** named `test_seed_subject_tags_is_idempotent_and_preserves_existing_quiz_data`, `test_quiz_tag_association_rejects_duplicate_pairs`, and `test_app_startup_creates_tag_tables_additively`.
- [x] **Step 2: Run those tests** from `services/api` with `python -m pytest tests/test_tags.py tests/test_quiz_database.py -q`; confirm they fail because the tag model, seeder, or association is missing.
- [x] **Step 3: Implement** the model, association, seven catalog records with the approved stable slugs/names, and startup seeding. Enforce unique tag/quiz pairs in the database; store case-folded names for custom-tag uniqueness.
- [x] **Step 4: Run the focused tests** from `services/api` with the same command; confirm all three tests pass and existing quiz/attempt records remain readable.

### Task 2: Reusable tag catalog and private topic-tag API

**Files:**
- Create: `services/api/app/schemas/tag.py`
- Create: `services/api/app/tags/service.py`
- Create: `services/api/app/routers/tags.py`
- Modify: `services/api/app/main.py`
- Test: `services/api/tests/test_tags.py`

**Interfaces:**
- `GET /api/tags` returns `{ "subjects": [{"id", "name", "slug", "is_builtin": true, "children": [{"id", "name", "parent_id", "is_builtin": false}]}] }`; children include only the current user's topic tags.
- `POST /api/tags` accepts `{ "name": str, "parent_tag_id": int }` and returns `{ "id", "name", "parent_id", "is_builtin": false }` with status 201.
- The route calls `list_tag_catalog(session, user_id)` and `create_topic_tag(session, user_id, name, parent_tag_id)` from `app/tags/service.py`.
- A built-in subject is the only valid parent. Duplicate owner+parent names, compared using the stored case-folded name key, return 409; invalid names/parents return 422; other users' private children are never returned.

- [x] **Step 1: Write failing API tests** named `test_list_tags_returns_exact_subjects_and_only_owned_children`, `test_create_topic_tag_trims_name_and_returns_child`, `test_create_topic_tag_enforces_owner_parent_casefolded_uniqueness`, and `test_tag_endpoints_require_authentication_and_same_origin_for_mutation`.
- [x] **Step 2: Run** from `services/api` with `python -m pytest tests/test_tags.py -q`; confirm the new routes and validation are absent.
- [x] **Step 3: Implement** the Pydantic request/response schemas, catalog and creation service, authenticated router, non-disclosing lookups, and same-origin check for POST; include the router in `create_app` under `/api`.
- [x] **Step 4: Run** from `services/api` with `python -m pytest tests/test_tags.py -q`; confirm catalog shape, validation, duplicate handling, and ownership tests pass.

### Task 3: Atomic quiz-tag assignment and library response metadata

**Files:**
- Modify: `services/api/app/schemas/quiz.py`
- Modify: `services/api/app/routers/quizzes.py`
- Modify: `services/api/app/tags/service.py`
- Test: `services/api/tests/test_tags.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- `QuizLibraryItem.tags` is `list[QuizTagSummary]`, where `QuizTagSummary` has `id: int`, `name: str`, `parent_id: int | None`, and `is_builtin: bool`; an untagged quiz returns `[]`.
- `PUT /api/quizzes/{quiz_id}/tags` accepts `{ "tag_ids": list[int] }`, checks same-origin, and returns the updated `QuizLibraryItem`.
- `replace_quiz_tags(session, user_id, quiz_id, tag_ids) -> Quiz` validates every ID before mutation and commits the replacement atomically. Allowed IDs are built-in subjects and the requester's own child tags.
- An unknown/foreign quiz or unavailable tag returns non-disclosing 404; repeated IDs and invalid request shapes return 422; failures leave the previous association set untouched.
- Deleting a quiz removes its `quiz_tags` rows while leaving its built-in and user-owned reusable tags intact.

- [x] **Step 1: Write failing tests** named `test_owner_can_assign_multiple_tags_and_remove_all_tags`, `test_replace_quiz_tags_rejects_unavailable_or_duplicate_ids_atomically`, `test_replace_tags_on_another_users_quiz_returns_not_found`, `test_library_items_include_tag_metadata_and_empty_tags`, and `test_deleting_quiz_removes_only_tag_associations`.
- [x] **Step 2: Run** from `services/api` with `python -m pytest tests/test_tags.py tests/test_quiz_library.py -q`; confirm response schemas and assignment route are missing.
- [x] **Step 3: Implement** `QuizTagSummary`, the strict assignment payload schema, and the transaction-safe assignment service/route. Include tag metadata in list and rename responses without exposing question answers or unrelated profile data.
- [x] **Step 4: Run** from `services/api` with the same focused test command; confirm assignment, removal, response shape, isolation, and rollback behavior pass.

### Task 4: Owner-scoped title/tag search and subject/topic filtering

**Files:**
- Modify: `services/api/app/routers/quizzes.py`
- Modify: `services/api/app/schemas/quiz.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- Extend `GET /api/quizzes` with `q: str | None` and `tag_id: int | None`, preserving `limit` (1–100; default 20) and `offset` (default 0).
- `q` matches case-insensitive substrings in `Quiz.title` OR attached `Tag.name`; the selected `tag_id` filter is ANDed with that search condition.
- A root tag matches direct root associations and associations to its child tags; a child tag matches only itself.
- A `tag_id` that is unknown or not available to the current user returns a non-disclosing 404.
- Use `EXISTS`-style predicates (or an equivalent de-duplicating query) so tag joins cannot duplicate quizzes before newest-first ordering and pagination.
- Every result contains its attached `tags` summaries and remains restricted to the authenticated owner.

- [x] **Step 1: Write failing tests** named `test_quiz_search_matches_title_or_attached_tag_case_insensitively`, `test_subject_filter_includes_child_tags_and_child_filter_is_exact`, `test_search_and_tag_filter_are_combined_and_remain_owner_scoped`, `test_library_filter_rejects_unavailable_tag_without_disclosing_it`, `test_quiz_search_and_tag_filter_do_not_duplicate_paginated_rows`, and `test_existing_untagged_quizzes_remain_listable_and_searchable`.
- [x] **Step 2: Run** from `services/api` with `python -m pytest tests/test_quiz_library.py -q`; confirm query parameters are ignored or rejected and new assertions fail.
- [x] **Step 3: Implement** owner-scoped search/filter predicates, child expansion for a root filter, eager loading for tags, and response serialization; apply filters before ordering/offset/limit.
- [x] **Step 4: Run** from `services/api` with `python -m pytest tests/test_quiz_library.py -q`; confirm matching, filtering, uniqueness, pagination, and untagged compatibility pass.

### Task 5: API client and reusable frontend tag controls

**Files:**
- Create: `WebApp/src/tags/tag-components.js`
- Modify: `WebApp/src/api/client.js`
- Test: `WebApp/tests/api-client.test.js`
- Test: `WebApp/tests/tag-components.test.js`

**Interfaces:**
- Add `listTags(options)`, `createTag(payload, options)`, and `replaceQuizTags(quizId, payload, options)` API-client functions.
- Extend `listQuizzes({ limit, offset, q, tagId } = {}, options)` to serialize `tagId` as `tag_id` and omit absent/blank filters.
- Export `renderTagChips(tags) -> HTMLElement`, `renderTagFilter(catalog, selectedTagId, onChange) -> HTMLSelectElement`, and `renderTagPicker({ catalog, selectedTagIds, onSave, onCreate }) -> HTMLElement` from the reusable tag module.
- The picker presents built-in subjects and their own child tags, supports multiple selection, and creates a child under a selected subject; it uses semantic labels, fieldsets, and buttons.

- [x] **Step 1: Write failing client tests** for query serialization and the three tag API paths, plus DOM tests for chips, root/topic options, multiple selection, and accessible control names.
- [x] **Step 2: Run** from `WebApp` with `npm test -- tests/api-client.test.js tests/tag-components.test.js`; confirm the new methods/components are not present.
- [x] **Step 3: Implement** the API client functions and reusable DOM controls in the exact modules above; do not add a frontend dependency.
- [x] **Step 4: Run** from `WebApp` with the same focused Vitest command; confirm URLs, payloads, accessible controls, and selection state pass.

### Task 6: Integrate search, filters, and tag management into the quiz library

**Files:**
- Modify: `WebApp/src/pages/QuizLibraryPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/quiz-library-page.test.js`

**Interfaces:**
- `renderQuizLibraryPage` accepts injectable `loadTags`, `createTag`, and `saveQuizTags` alongside the existing `loadQuizzes`, `updateTitle`, and `navigate` dependencies.
- Render the search field with accessible name/placeholder `ค้นหาชื่อข้อสอบหรือ tag`, one subject/topic filter, and an explicit search submit action. Submission (Enter or button) calls `loadQuizzes({limit: 20, offset: 0, q, tagId})`.
- On load-more, preserve the active `q` and `tagId`, increment offset by returned page length, and retain existing ID deduplication.
- Quiz cards display tag chips and open an inline reusable picker. Saving calls `saveQuizTags(quizId, {tag_ids})`; creating calls `createTag({name, parent_tag_id})`, refreshes the catalog, and keeps the user in the library.
- Search and filter values apply together only on search-form submission (Enter or the button), not on every keystroke. Submitting changed values clears current cards, resets offset to 0, and reloads; load-more preserves the submitted values. Loading, API failure, no quizzes, no matches, and save/create success/failure use accessible status/alert messages; a clear-filter action is available for no matches.

- [x] **Step 1: Write failing page tests** for chips, title/tag search submit, root/topic filter submission, filter reset and load-more preservation, tag creation and multi-tag save, empty/no-match state, and accessible API/save errors.
- [x] **Step 2: Run** from `WebApp` with `npm test -- tests/quiz-library-page.test.js`; confirm the current library has no search, filters, catalog, or tag editing.
- [x] **Step 3: Implement** the library integration using the reusable tag controls; add focused responsive styles in `WebApp/src/styles.css` without changing the shared theme system.
- [x] **Step 4: Run** from `WebApp` with `npm test -- tests/quiz-library-page.test.js`; confirm all new interactions and existing quiz title/history behaviors pass.

### Task 7: Full regression and production-build verification

**Files:**
- Test: `services/api/tests/`
- Test: `WebApp/tests/`

**Interfaces:**
- No new public interface; this task verifies the interfaces produced in Tasks 1–6 and their integration with existing quiz generation, taking, history, authentication, and theme behavior.

- [x] **Step 1: Run the full API suite** from `services/api` with `python -m pytest -q`; confirm all tests pass. (Windows alias unavailable; used the existing `.venv` Python executable.)
- [x] **Step 2: Run the full WebApp suite** from `WebApp` with `npm test`; confirm all tests pass.
- [x] **Step 3: Build the WebApp** from `WebApp` with `npm run build`; confirm Vite exits successfully.
- [x] **Step 4: Review** the final diff and `git status --short` within the approved C: worktree; preserve unrelated pre-existing modifications and confirm no commit or push was made.
