# Quiz Tag Colors and Inline Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist 10-key tag colors, let users assign/remove tags by clicking colored pills with immediate save, create-and-attach colored topic tags inline, and make the quiz library more space-efficient.

**Architecture:** Store a validated palette key on each `Tag` and add an idempotent SQLite migration that backfills fixed colors for built-in subjects. Extend existing tag and quiz response schemas with the key, then render it through a reusable frontend palette and pill picker. A per-quiz save queue, retained across search-result card refreshes, serializes full-set updates so rapid clicks cannot leave stale tag assignments.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, SQLite, pytest, vanilla JavaScript DOM, Vitest/jsdom, CSS, Vite.

**Spec:** `docs/superpowers/specs/2026-10-11-quiz-tag-colors-and-inline-picker-design.md`

## Global Constraints

- Work only in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`. Do not access or modify `D:\Project SE Sce 2\se-sec2-team-06`, do not modify `prototypes/`, and do not commit or push.
- The palette contains 10 stable keys: `violet`, `blue`, `cyan`, `teal`, `green`, `lime`, `amber`, `orange`, `rose`, and `pink`.
- Store a palette key, never an arbitrary CSS value.
- Clicking an available tag adds it; clicking an attached tag removes it. The change saves automatically.
- A newly created custom topic tag is attached to the quiz from which it was created immediately.
- Each built-in subject has one fixed palette key assigned in the subject catalog.
- Keep title/tag search, subject/topic filtering, quiz history, and repeat attempts working.
- No new dependency, color picker widget, AI-based tagging, tag sharing, tag deletion/renaming, per-user palette, or arbitrary custom colors in this phase.

## Review Focus

- **Existing SQLite DB with tags and quiz associations:** startup migration must preserve tag IDs, custom tag ownership, and `quiz_tags`; pin with `test_startup_migrates_existing_sqlite_tag_colors_idempotently` in Task 1.
- **A built-in subject whose stored color drifted and a custom tag with its own color:** reseeding must restore built-in colors without overwriting custom colors; pin with `test_builtin_seed_restores_fixed_colors_without_mutating_custom_tag_color` in Task 1.
- **Unknown or raw CSS color submitted to the API:** reject it with 422 and never echo it into a style; pin with `test_create_topic_tag_rejects_unknown_color_key` in Task 2 and `test_tag_chips_only_use_palette_keys` in Task 3.
- **Several tag clicks while one request is pending:** writes for one quiz must be serialized and the final server set must match the last desired set; pin with `test_rapid_tag_toggles_are_serialized_and_last_desired_set_wins` in Task 4.
- **Save or create/attach failure:** restore the confirmed tag set accessibly, preserve entered values, and distinguish an existing-but-unattached tag; pin with `test_tag_save_failure_restores_confirmed_selection_accessibly` and `test_create_then_attach_failure_keeps_tag_available_and_reports_attachment_error` in Task 4.

---

### Task 1: Tag color persistence, migration, and built-in catalog

**Files:**
- Create: `services/api/app/tags/colors.py`
- Modify: `services/api/app/models/tag.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/app/main.py`
- Modify: `services/api/app/tags/catalog.py`
- Test: `services/api/tests/test_database.py`
- Test: `services/api/tests/test_tags.py`

**Interfaces:**
- `services/api/app/tags/colors.py` exports `TAG_COLOR_KEYS: tuple[str, ...]` and `DEFAULT_TAG_COLOR: str = "violet"`.
- `Tag.color` is a non-null string with ORM/server default `violet`.
- `migrate_tag_colors(engine) -> None` is idempotent for SQLite and is called after `Base.metadata.create_all` and before built-in seeding.
- `BUILTIN_SUBJECT_COLORS` in `app/tags/catalog.py` maps `math→blue`, `english→violet`, `thai→rose`, `physics→cyan`, `chemistry→green`, `biology→lime`, and `social-studies→amber`.
- `seed_builtin_subjects(session_factory)` inserts missing subjects and refreshes only built-in subject color values; it never updates custom tags.

- [x] **Step 1: Write failing database/catalog tests** named `test_startup_migrates_existing_sqlite_tag_colors_idempotently` and `test_builtin_seed_restores_fixed_colors_without_mutating_custom_tag_color`. The legacy-database test creates old `tags` and `quiz_tags` tables without `color`, includes an existing custom tag and association, starts the app twice, then asserts the new column/defaults, fixed built-in colors, and existing IDs/association remain.
- [x] **Step 2: Run the focused tests and verify the expected failure** from `services/api`: `.venv/Scripts/python.exe -m pytest tests/test_database.py tests/test_tags.py -q`.
- [x] **Step 3: Implement the palette constants, model field, migration, startup call, and idempotent built-in color assignment** in the files above. Add the SQLite column with `violet` as its safe default, then backfill built-in rows by stable slug.
- [x] **Step 4: Run the focused tests and verify both migration and seed behavior pass** with the same pytest command.

### Task 2: Color-aware tag API and quiz summaries

**Files:**
- Modify: `services/api/app/schemas/tag.py`
- Modify: `services/api/app/schemas/quiz.py`
- Modify: `services/api/app/tags/service.py`
- Modify: `services/api/app/routers/tags.py`
- Test: `services/api/tests/test_tags.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- `TagColor` is a Pydantic `Literal` containing exactly the 10 keys from Task 1.
- `TagChild`, `TagSubject`, and `QuizTagSummary` each expose `color: TagColor`.
- `TagCreate.color: TagColor = "violet"` remains optional for existing clients.
- `create_topic_tag(session, user_id, name, parent_tag_id, color="violet") -> Tag` persists the validated key.
- `GET /api/tags`, `POST /api/tags`, quiz list responses, and `PUT /api/quizzes/{quiz_id}/tags` include the tag color without changing authentication, same-origin, ownership, or atomic replacement behavior.

- [x] **Step 1: Write failing API tests** named `test_builtin_subject_catalog_exposes_fixed_palette_colors`, `test_create_topic_tag_persists_requested_color`, `test_create_topic_tag_rejects_unknown_color_key`, and `test_quiz_tag_responses_include_color_for_subject_and_custom_tags`.
- [x] **Step 2: Run** `.venv/Scripts/python.exe -m pytest tests/test_tags.py tests/test_quiz_library.py -q` from `services/api`; confirm color response fields and request validation are missing.
- [x] **Step 3: Implement `TagColor`, color-bearing response schemas, request parsing, service persistence, catalog serialization, and route forwarding.** Keep colors as allow-listed keys and preserve `violet` default behavior for clients that omit `color`.
- [x] **Step 4: Run** the same focused pytest command and verify catalog, create, assignment, and quiz-list color assertions pass.

### Task 3: Reusable colored tag pills, picker, and palette

**Files:**
- Create: `WebApp/src/tags/tag-colors.js`
- Modify: `WebApp/src/tags/tag-components.js`
- Modify: `WebApp/tests/tag-components.test.js`

**Interfaces:**
- `TAG_COLOR_PALETTE` exports the 10 `{ key, label }` choices in the spec's stable order.
- `renderTagChips(tags) -> HTMLElement` renders non-interactive attached pills with `data-tag-id` and an allow-listed `data-color`.
- `renderTagColorPalette({ selectedColor, onChange }) -> HTMLFieldSetElement` renders 10 labeled radio swatches and calls `onChange(colorKey)` on selection.
- `renderTagPicker({ catalog, selectedTagIds, onToggle, onCreate }) -> HTMLElement` renders a search input, clickable built-in subject pills, custom topic pills grouped by subject, and an inline create form. `onToggle(tagId, nextSelected)` is called immediately; `onCreate({ name, parent_tag_id, color })` receives the selected color. It renders no checkboxes and no Save-tags button.
- Every interactive tag pill is a button with `aria-pressed`; keyboard focus and visible selected state are supported.

- [x] **Step 1: Write failing DOM tests** named `test_tag_chips_render_persisted_palette_keys`, `test_palette_has_ten_keyboard_accessible_choices`, `test_picker_toggles_subject_and_topic_buttons_without_checkbox_or_save`, `test_picker_search_filters_subject_and_topic_buttons`, and `test_picker_create_includes_selected_color`.
- [x] **Step 2: Run** `npm test -- tests/tag-components.test.js` from `WebApp`; verify the new controls and behaviors fail as expected.
- [x] **Step 3: Implement the reusable palette and colored pill controls.** Search filters visible pills by tag name; subject pills and child-topic pills both toggle assignment; use text nodes and fixed CSS palette tokens rather than interpolating arbitrary styles.
- [x] **Step 4: Run** `npm test -- tests/tag-components.test.js` and verify all 10 palette choices, accessible states, search, toggles, and create payloads.

### Task 4: Immediate tag assignment, create-and-attach, and race-safe saves

**Files:**
- Create: `WebApp/src/tags/tag-assignment-queue.js`
- Modify: `WebApp/src/pages/QuizLibraryPage.js`
- Test: `WebApp/tests/tag-assignment-queue.test.js`
- Test: `WebApp/tests/quiz-library-page.test.js`

**Interfaces:**
- `createTagAssignmentQueue({ initialTagIds, save, onChange, onError })` returns `{ toggle(tagId), include(tagId), getTagIds() }`. `save(tagIds)` is an async function that replaces the quiz's full tag set. The queue updates optimistically, serializes writes for one quiz, updates its confirmed set on success, and restores the last confirmed set and calls `onError(error)` on failure.
- `createQuizCard` uses the queue with `saveQuizTags(quiz.id, { tag_ids: tagIds })`, renders the current set from the tag catalog/response, and reports status/errors through the existing accessible page message. The queue is keyed by quiz ID and reused across search refreshes; different quizzes remain isolated.
- Successful `createTag({ name, parent_tag_id, color })` reloads the catalog and calls `include(created.id)` so the new topic is attached immediately. Creation and assignment failures are reported separately; a tag whose creation succeeded remains in the refreshed catalog if attachment fails.
- Tag search and library-level filters remain unchanged; each quiz ID owns an independent assignment queue that survives card replacement.

- [x] **Step 1: Write failing queue tests** named `test_rapid_tag_toggles_are_serialized_and_last_desired_set_wins` and `test_failed_tag_save_restores_last_confirmed_set_and_stops_queue`. Use deferred promises to assert that only one write is in flight and failure restores the last confirmed IDs.
- [x] **Step 2: Run** `npm test -- tests/tag-assignment-queue.test.js` from `WebApp`; verify the queue module is absent.
- [x] **Step 3: Implement only the per-quiz assignment queue** in `tag-assignment-queue.js`; keep the page unchanged in this step.
- [x] **Step 4: Run** `npm test -- tests/tag-assignment-queue.test.js`; verify queue serialization, last-desired-set behavior, and rollback pass.
- [x] **Step 5: Write failing page tests** named `test_tag_pill_click_autosaves_add_and_remove_without_save_button`, `test_tag_save_failure_restores_confirmed_selection_accessibly`, `test_created_colored_tag_is_attached_immediately`, and `test_create_then_attach_failure_keeps_tag_available_and_reports_attachment_error`.
- [x] **Step 6: Run** `npm test -- tests/quiz-library-page.test.js`; verify these page-level assertions fail against the checkbox/save workflow.
- [x] **Step 7: Integrate the queue into `QuizLibraryPage.js`**, replace the checkbox/save workflow with optimistic pill toggles, preserve inputs on create failure, and attach a successfully created tag immediately.
- [x] **Step 8: Run** `npm test -- tests/tag-assignment-queue.test.js tests/quiz-library-page.test.js`; verify optimistic state, confirmed rollback, create-and-attach, and per-card isolation pass.

### Task 5: Denser responsive library layout and full verification

**Files:**
- Modify: `WebApp/src/styles.css`
- Modify: `WebApp/src/pages/QuizLibraryPage.js`
- Modify: `WebApp/src/tags/tag-components.js`
- Test: `WebApp/tests/quiz-library-page.test.js`
- Test: `WebApp/tests/tag-components.test.js`

**Interfaces:**
- The library page has a dedicated desktop width cap of approximately `1180px`; quiz detail remains at its existing `900px` width.
- Reduce library top/bottom padding and vertical gaps while keeping cards readable; keep metadata responsive and stack controls at narrow widths.
- Use palette styles compatible with the existing theme tokens and keep focus/selected-state contrast accessible.
- An already-open picker receives later catalog updates without losing search/form state, and tag selection updates do not detach the focused button.

- [x] **Step 1: Adjust library-only CSS** for width, spacing, colored tag pills, selected/unselected contrast, create palette swatches, focus states, and mobile wrapping. The create action also uses the shared primary button treatment; do not change `.quiz-detail-page` width or shared theme definitions.
- [x] **Step 2: Run focused frontend tests** from `WebApp` with `npm test -- tests/tag-components.test.js tests/tag-assignment-queue.test.js tests/quiz-library-page.test.js`; 31 passed.
- [x] **Step 3: Run the full API suite** from `services/api` with `.venv/Scripts/python.exe -m pytest -q`; 149 passed (one existing Starlette/httpx deprecation warning).
- [x] **Step 4: Run the full WebApp suite** from `WebApp` with `npm test`; 113 passed across 13 files.
- [x] **Step 5: Build the WebApp** from `WebApp` with `npm run build`; Vite exited successfully.
- [x] **Step 6: Visually inspect** the library at desktop and narrow mobile widths; confirmed the library layout, wrapping, color picker, and primary Add tag button. The quiz detail width remains 900px in its existing rule.
- [x] **Step 7: Review the final diff and worktree status** in the approved C: worktree only; preserved other working-tree changes and confirmed HEAD unchanged with no commit or push.
- [x] **Step 8: Write regression tests** for pending saves across search refreshes, catalog updates in open pickers, keyboard focus retention, and light-theme contrast; run focused tests and verify all five new behaviors fail for the expected reasons before implementation.
- [x] **Step 9: Fix the review findings** by retaining tag queues per quiz ID, notifying mounted pickers when the catalog changes, updating selected states in place, and using theme ink for unselected tags in light mode.
- [x] **Step 10: Re-run final verification**: WebApp 118 passed across 13 files, API 149 passed with one existing deprecation warning, Vite build succeeded, and `git diff --check` reported no whitespace errors. Preserve the no-commit/no-push constraint.
