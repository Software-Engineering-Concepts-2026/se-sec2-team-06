# Home Dashboard and Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, data-backed Home dashboard with four charts and a three-state task workflow, while keeping a useful animated public Home and Login.

**Architecture:** Add an owner-scoped dashboard overview service/API that aggregates complete records, not paginated client fragments. Add a canonical task status with an additive SQLite migration. Home consumes the overview plus existing deadlines/progress/library APIs and renders accessible charts from real data only.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, SQLite startup migrations, vanilla JavaScript DOM/SVG, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-tag-library-and-quiz-polish-design.md`

## Global Constraints

- Dashboard requests and results are isolated to the signed-in learner.
- Charts use actual persisted data only; zero scores are distinct from missing data.
- Quiz activity counts submitted attempts only.
- Document counts are per tag; a multi-tag document appears once under each assigned tag.
- Topics-to-review scores are grouped by quiz tag and are not question-level mastery.
- The study-time chart, timer, teacher/group dashboard, and fake seeded chart data are out of scope.
- Shared tag integration depends on `2026-10-12-shared-flat-tags.md`.
- Run the global theme/motion plan first; the dashboard period control uses its shared `.themed-select` class and guest Home/Login share its `createAtomVisual()` component.
- Do not edit `D:\Project SE Sce 2\se-sec2-team-06`; do not commit or push.

## Review Focus

- Empty tables must return empty/zero summaries without seeded values, while a real score of zero remains a result: pin this in `services/api/tests/test_dashboard_api.py` and `WebApp/tests/home-dashboard.test.js`.
- A multi-tag quiz/document must not accidentally duplicate global totals; pin per-tag counts and submitted-attempt totals in `services/api/tests/test_dashboard_api.py`.
- A learner must never see another account’s tasks, documents, attempts, or tags: pin cross-owner fixtures in `services/api/tests/test_dashboard_api.py`.
- Legacy boolean completion values must migrate without losing titles, deadlines, priorities, or completion state: pin this in `services/api/tests/test_database.py`.
- Day/week boundaries must use the learner browser's IANA timezone and be deterministic at midnight/Monday boundaries: `test_dashboard_buckets_use_requested_iana_timezone` and `test_dashboard_rejects_invalid_timezone` in `services/api/tests/test_dashboard_api.py`.

---

### Task 1: Add three-state deadline status and migration

**Files:**
- Modify: `services/api/app/models/deadline.py`
- Modify: `services/api/app/schemas/deadline.py`
- Modify: `services/api/app/routers/deadlines.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/app/main.py`
- Modify: `WebApp/src/pages/DeadlinesPage.js`
- Modify: `WebApp/src/api/client.js`
- Test: `services/api/tests/test_database.py`
- Test: `services/api/tests/test_deadlines_api.py`
- Test: `WebApp/tests/deadlines-page.test.js`

**Interfaces:**
- Canonical `Deadline.status` is one of `not_started`, `in_progress`, or `completed`.
- `PATCH /api/deadlines/{id}` accepts a validated status; the response includes `status` and a derived `is_completed` compatibility value.
- Existing rows migrate from `is_completed=false` to `not_started` and `is_completed=true` to `completed`; the migration is idempotent and preserves other columns.
- The UI’s existing all/incomplete/completed filters remain, with incomplete including both `not_started` and `in_progress`; a saved task can be moved among all three states.

- [x] **Step 1: Write failing migration, API, and UI tests** for legacy completion mapping, idempotence, all three status values, and incomplete filtering; assert title, due time, priority, and selected status survive migration/update.
- [x] **Step 2: Run `python -m pytest tests/test_database.py tests/test_deadlines_api.py -q` from `services/api` and `npm test -- tests/deadlines-page.test.js` from `WebApp`; verify the new tests fail.
- [x] **Step 3: Add the `status` column and idempotent data migration**, then use status as the model/API source of truth while keeping the derived compatibility value.
- [x] **Step 4: Update deadline controls and filters** to set/read the three statuses and keep all other task fields intact.
- [x] **Step 5: Run `python -m pytest tests/test_database.py tests/test_deadlines_api.py -q`** from `services/api` and `npm test -- tests/deadlines-page.test.js` from `WebApp`; verify old task records remain intact.

### Task 2: Add dashboard overview aggregation API

**Files:**
- Create: `services/api/app/schemas/dashboard.py`
- Create: `services/api/app/services/dashboard.py`
- Create: `services/api/app/routers/dashboard.py`
- Modify: `services/api/app/main.py`
- Test: `services/api/tests/test_dashboard_api.py`
- Test: `services/api/tests/test_database.py`

**Interfaces:**
- `GET /api/dashboard/overview?period=day|week&time_zone=<IANA name>` requires authentication and returns:
  - `quiz_activity`: ordered `{ label: string, count: int }[]`; day mode has the seven local calendar dates ending today, week mode has the current Monday-start week and previous seven weeks; labels are ISO local dates or ISO week keys;
  - `task_status`: counts for `not_started`, `in_progress`, and `completed`;
  - `documents_by_tag`: `{ tag_id: int | null, tag_name: string, color: string, count: int }[]`, where null identifies untagged documents;
  - `topics_to_review`: `{ tag_id: int, tag_name: string, color: string, average_percent: number, attempt_count: int }[]` sorted lowest average first.
- `get_dashboard_overview(session: Session, user_id: int, period: Literal["day", "week"], time_zone: str) -> DashboardOverview` performs complete owner-scoped aggregation using `zoneinfo.ZoneInfo`; score percentages are calculated as `100 * score / total_questions`, and each submitted attempt is grouped once per quiz tag. Invalid IANA zones return HTTP 422.

- [x] **Step 1: Add failing API regression tests** for authentication, owner-scoped aggregation, empty and zero-score states, IANA timezone buckets, and invalid timezones; the aggregate fixture covers tasks and multi-/untagged documents.
- [x] **Step 2: Run `python -m pytest tests/test_dashboard_api.py -q`** from `services/api` and verify failure before the route exists.
- [x] **Step 3: Implement Pydantic response models and the aggregation service** using SQLAlchemy queries scoped by `user_id`; do not pull only the first library page.
- [x] **Step 4: Register the router under `/api`** and run `python -m pytest tests/test_dashboard_api.py tests/test_deadlines_api.py tests/test_progress_api.py -q` from `services/api`.

### Task 3: Render Home dashboard, charts, and guest atom

**Files:**
- Create: `WebApp/src/dashboard/dashboard-charts.js`
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/pages/HomePage.js`
- Modify: `WebApp/src/pages/LoginPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/home-dashboard.test.js`
- Test: `WebApp/tests/pages.test.js`
- Test: `WebApp/tests/api-client.test.js`

**Interfaces:**
- `getDashboardOverview({ period: "day" | "week", timeZone: string }, options?)` calls the overview API; Home derives `timeZone` from `Intl.DateTimeFormat().resolvedOptions().timeZone` and falls back to `UTC` only if unavailable.
- `renderDashboardCharts(overview: DashboardOverview) -> HTMLElement` renders semantic SVG bar/donut/horizontal-bar charts plus text values and per-widget empty states.
- `renderHomePage({ user, onNavigate, loadOverview, loadDeadlines, loadProgress, loadQuizzes, loadDocuments })` uses injected loaders for the signed-in dashboard; `loadQuizzes({ limit: 3, offset: 0 })`, `loadDocuments({ limit: 3, offset: 0 })`, `loadDeadlines()`, and `loadProgress({})` provide the existing library/plan/progress data; guest mode does not issue authenticated data requests.
- The day/week control remains a native `<select class="themed-select">` with accessible label `ช่วงเวลาแสดงกราฟ`; changing it requests the selected period without reloading unrelated page data.
- Reuse the Home atom markup through a shared `createAtomVisual()` component used by signed-out Home and Login.

- [x] **Step 1: Add failing client, chart, and Home tests** for guest isolation, sorted deadlines, zero scores and practice summary, feature links, chart values and empty states, period switching, and API query parameters; assert the period control has the shared `.themed-select` class and accessible name `ช่วงเวลาแสดงกราฟ`.
- [x] **Step 2: Run `npm test -- tests/home-dashboard.test.js tests/pages.test.js tests/api-client.test.js`** from `WebApp` and verify the new tests fail.
- [x] **Step 3: Implement the client method and accessible chart renderer** with explicit labels/values that do not depend on color alone.
- [x] **Step 4: Update Home/Login and `main.js`** to load real signed-in data, render recent quizzes/documents and upcoming deadlines, reuse the atom in guest flows, and provide links to existing libraries.
- [x] **Step 5: Run the focused frontend tests** and verify no guest-only route calls private dashboard endpoints.

### Task 4: Validate dashboard behavior and production build

- [x] **Step 1: Run backend dashboard/deadline/migration tests**: `python -m pytest tests/test_dashboard_api.py tests/test_deadlines_api.py tests/test_database.py -q` from `services/api`.
- [x] **Step 2: Run frontend dashboard/deadline/progress tests**: `npm test -- tests/home-dashboard.test.js tests/deadlines-page.test.js tests/progress-page.test.js tests/pages.test.js` from `WebApp`.
- [x] **Step 3: Run focused frontend regressions and production build** from `WebApp`; the full test suite was intentionally omitted to keep verification focused as requested.
- [ ] **Step 4: Manually inspect** daily/weekly buckets around local midnight and Monday, empty data, a zero score, all three themes, and narrow-screen layout.
