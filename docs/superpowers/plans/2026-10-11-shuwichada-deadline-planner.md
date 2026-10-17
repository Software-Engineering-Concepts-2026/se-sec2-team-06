# Shuwichada Deadline Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a signed-in deadline planner whose tasks persist per account, sort by due time, and support urgency, status filters, completion, and confirmed deletion.

**Architecture:** Add an owner-scoped SQLAlchemy `Deadline` model and authenticated FastAPI CRUD endpoints, with SQLite storing normalized UTC timestamps. Add same-origin frontend API methods and a protected `/deadlines` route that renders the Shuwichada planner using shared theme tokens; the page loads and mutates tasks through the API.

**Tech Stack:** FastAPI, Pydantic 2, SQLAlchemy, SQLite, vanilla JavaScript ES modules, Vite, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-11-shuwichada-deadline-planner-design.md`

## Global Constraints

- Work only in the existing isolated worktree `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`.
- Do not inspect or modify the protected main folder `D:\Project SE Sce 2\se-sec2-team-06`.
- Do not commit or push unless the user explicitly requests it.
- Use shared SynapseSync themes and theme tokens; do not add a page-specific palette.
- Do not seed or render sample tasks; a new account starts with an empty list.
- Keep every deadline operation scoped to the authenticated user's ID.

## Review Focus

- A due timestamp with no timezone must be rejected, and an offset timestamp must normalize to UTC — pin in `test_create_deadline_validates_timezone_and_normalizes_due_at`.
- Tasks with identical due times need deterministic order — pin in `test_list_deadlines_orders_by_due_at_then_id`.
- A guessed task ID belonging to another account must not expose or mutate the task — pin in `test_deadline_mutations_are_owner_scoped`.
- A failed completion request must restore the task's prior UI state — pin in `deadlines-page.test.js` as `restores_completion_state_when_update_fails`.
- Cancelling deletion or receiving a delete error must preserve the selected task and all other tasks — pin in `deadlines-page.test.js` as `cancels_or_recovers_delete_without_removing_tasks`.

---

## File Structure

- Create `services/api/app/models/deadline.py` for the SQLAlchemy entity and UTC-naive SQLite storage.
- Modify `services/api/app/models/__init__.py` and `services/api/app/main.py` to register the model and router through existing startup setup.
- Create `services/api/app/schemas/deadline.py` for create, completion-update, and response contracts.
- Create `services/api/app/routers/deadlines.py` for authenticated list/create/complete/delete operations.
- Create `services/api/tests/test_deadlines_api.py` for API, validation, timezone, ownership, and same-origin behavior.
- Modify `WebApp/src/api/client.js` and `WebApp/tests/api-client.test.js` for the JSON CRUD methods.
- Create `WebApp/src/pages/DeadlinesPage.js` and `WebApp/tests/deadlines-page.test.js` for the interactive page.
- Modify `WebApp/src/router.js`, `WebApp/src/main.js`, `WebApp/src/components/Navbar.js`, `WebApp/tests/router.test.js`, `WebApp/tests/pages.test.js`, and `WebApp/src/styles.css` to add the protected route, authenticated nav link, API wiring, and responsive shared-theme styling.

## Interfaces

- Backend JSON task shape: `{ id, title, subject, due_at, priority, is_completed, created_at, updated_at }`; `due_at` is serialized as an ISO UTC timestamp.
- `POST /api/deadlines` accepts `{ title, subject, due_at, priority }` and returns the created task with HTTP 201.
- `GET /api/deadlines` returns the current user's tasks sorted by `due_at ASC, id ASC`.
- `PATCH /api/deadlines/{deadline_id}` accepts `{ is_completed }` and returns the updated task.
- `DELETE /api/deadlines/{deadline_id}` deletes the owned task and returns HTTP 204.
- Frontend API exports: `listDeadlines(options)`, `createDeadline(payload, options)`, `updateDeadline(deadlineId, payload, options)`, and `deleteDeadline(deadlineId, options)`.
- Page export: `renderDeadlinesPage({ loadDeadlines, createDeadline, updateDeadline, deleteDeadline, confirmDelete, now })`; dependencies default to the API client, `confirmDelete` defaults to `window.confirm`, and `now` defaults to `() => new Date()` for the seven-day overview.
- Subject values are the prototype's Thai labels: `ฟิสิกส์`, `คณิตศาสตร์`, `เคมี`, `ชีววิทยา`, `อื่นๆ`. Priority values are `high`, `medium`, and `low`.

### Task 1: Owner-scoped deadline API and persistence

**Files:**
- Create: `services/api/app/models/deadline.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/main.py`
- Create: `services/api/app/schemas/deadline.py`
- Create: `services/api/app/routers/deadlines.py`
- Test: `services/api/tests/test_deadlines_api.py`

**Interfaces:**
- Consumes: existing `get_current_user`, `get_db`, and `require_same_origin` dependencies from `app.routers.auth`.
- Produces: the deadline HTTP contract and response JSON shape defined in the plan-level Interfaces section.

- [ ] **Step 1: Write failing API tests**

Add tests for: unauthenticated GET/POST; valid task creation with trimmed title; rejecting blank/overlong title, unsupported subject/priority, and a timezone-naive `due_at`; normalizing an explicit offset to UTC; allowing a past-due task; list isolation and order by `(due_at, id)`; PATCH completion; 404 for another user's task on PATCH and DELETE; same-origin enforcement on POST/PATCH/DELETE; and deleting only the requested database record.

- [ ] **Step 2: Run the tests and confirm they fail for the missing API**

Run from `services/api`: `python -m pytest tests/test_deadlines_api.py -q`
Expected: FAIL because the deadline router/model/contracts do not exist yet.

- [ ] **Step 3: Implement the model, contracts, router, and registration**

Define `Deadline` with `id`, indexed cascading `user_id`, `title`, `subject`, UTC-naive `due_at`, `priority`, `is_completed`, `created_at`, and `updated_at`. Normalize aware request datetimes to UTC and store them without `tzinfo` for SQLite; attach UTC when serializing stored values. Define `DeadlineCreate`, `DeadlineCompletionUpdate` (strict boolean), and `DeadlineSummary` schemas. Use a `router = APIRouter(prefix="/deadlines", tags=["deadlines"])`, owner-scope every query, order list by `Deadline.due_at.asc(), Deadline.id.asc()`, and use existing same-origin checks for mutations. Register the router at `/api` and import the model for `Base.metadata.create_all`.

- [ ] **Step 4: Run the API tests and confirm they pass**

Run from `services/api`: `python -m pytest tests/test_deadlines_api.py -q`
Expected: PASS, including ownership, invalid payload, timezone, ordering, and mutation checks.

### Task 2: Frontend deadline API client

**Files:**
- Modify: `WebApp/src/api/client.js`
- Test: `WebApp/tests/api-client.test.js`

**Interfaces:**
- Consumes: Task 1's `/api/deadlines` JSON contract and the existing `requestJson` helper.
- Produces: `listDeadlines(options)`, `createDeadline(payload, options)`, `updateDeadline(deadlineId, payload, options)`, and `deleteDeadline(deadlineId, options)`.

- [ ] **Step 1: Write failing API-client tests**

Add tests proving all four functions use same-origin credentials, the correct HTTP method/path, JSON request bodies for POST/PATCH, and parse a 204 DELETE as `null`. Verify invalid deadline IDs (zero, negative, non-integer, and unsafe integer) throw `TypeError` before `fetch` is called.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run from `WebApp`: `npm test -- tests/api-client.test.js`
Expected: FAIL because the deadline client functions are not exported.

- [ ] **Step 3: Implement the four API client functions**

Reuse `requestJson`; add a `deadlinePathId` validator matching the existing positive-safe-integer document/quiz ID pattern. Use `GET /deadlines`, `POST /deadlines`, `PATCH /deadlines/{id}`, and `DELETE /deadlines/{id}`.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run from `WebApp`: `npm test -- tests/api-client.test.js`
Expected: PASS with existing API-client coverage unchanged.

### Task 3: Deadline planner page and app integration

**Files:**
- Create: `WebApp/src/pages/DeadlinesPage.js`
- Modify: `WebApp/src/router.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/components/Navbar.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/deadlines-page.test.js`
- Test: `WebApp/tests/router.test.js`
- Test: `WebApp/tests/pages.test.js`

**Interfaces:**
- Consumes: Task 2's API functions and Task 1's task response shape.
- Produces: a page-level form/list/filters/weekly-summary UI; authenticated `/deadlines` route; signed-in navbar link.

- [ ] **Step 1: Write failing page, route, and navbar tests**

In `deadlines-page.test.js`, cover initial empty state with no seeded cards, required title/subject/date/time, successful creation and reset, create/load errors without fake items, task metadata/priority badge, nearest-first ordering after creation, all/incomplete/completed filters, no-match empty state, only the selected completion update, rollback on failed completion, confirmed/cancelled deletion, preserving other items on delete failure, a seven-day overview containing only saved tasks, and shared-theme-token/responsive styling. In `router.test.js`, cover authenticated route resolution, signed-out redirect/return-to, and safe return-to preservation. In `pages.test.js`, assert the deadline nav link is present only while signed in.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run from `WebApp`: `npm test -- tests/deadlines-page.test.js tests/router.test.js tests/pages.test.js`
Expected: FAIL because the page and `/deadlines` route/link are not implemented.

- [ ] **Step 3: Implement the page and route wiring**

Create `renderDeadlinesPage` with injected API dependencies and stable `data-role`/`data-action` selectors for tests. Load tasks from the API; sort visible tasks by due timestamp then ID; render Thai subject choices and urgency badges; implement all three filters; add tasks only after successful API creation; optimistically update completion with rollback on error; confirm deletion and remove the task only after API success. Render useful empty states and a Monday-first seven-day summary from real tasks only. Add `/deadlines` to the signed-in route and safe `next` paths, add the signed-in navbar link, and wire the page to API functions in `main.js`.

- [ ] **Step 4: Add shared-theme responsive styles**

Append focused `.deadline-*` styles to `WebApp/src/styles.css` using existing `--surface`, `--line`, `--ink`, `--muted`, `--accent`, and status tokens. Match the Shuwichada form/list composition at wide sizes and stack it on narrow screens; ensure focus-visible controls, readable badge contrast, and no fixed-width horizontal overflow.

- [ ] **Step 5: Run focused tests and confirm they pass**

Run from `WebApp`: `npm test -- tests/deadlines-page.test.js tests/router.test.js tests/pages.test.js`
Expected: PASS, including empty states, filters, single-item mutations, failure recovery, routing, and navbar visibility.

### Task 4: Full verification

**Files:**
- Verify: `services/api/app/` and `services/api/tests/`
- Verify: `WebApp/src/` and `WebApp/tests/`

**Interfaces:**
- Consumes: the completed backend and frontend interfaces from Tasks 1–3.
- Produces: test/build evidence for the approved deadline-planner behavior.

- [ ] **Step 1: Run the complete API test suite**

Run from `services/api`: `python -m pytest tests -q`
Expected: all API tests pass.

- [ ] **Step 2: Run the complete WebApp test suite**

Run from `WebApp`: `npm test`
Expected: all WebApp tests pass.

- [ ] **Step 3: Build the WebApp**

Run from `WebApp`: `npm run build`
Expected: Vite exits successfully and produces the production bundle.

- [ ] **Step 4: Inspect the final diff and confirm scope**

Inspect only the files changed for this task; preserve pre-existing dirty and unrelated worktree changes; confirm the deadline diff is scoped and no seeded task data, commit, or push was introduced.
