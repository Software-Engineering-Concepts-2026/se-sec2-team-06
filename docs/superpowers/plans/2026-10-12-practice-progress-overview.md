# Practice History and Progress Overview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for Native execution or superpowers:subagent-driven-development if the user explicitly chooses delegated execution. Complete one task and its checks before moving to the next.

**Goal:** Show learner progress and topic-based quiz history using existing completed quiz attempts and the shared tag catalog.

**Architecture:** Add owner-scoped read-only aggregation APIs over existing Quiz, QuizAttempt, QuizAnswer, and Tag records. Add a Progress page that filters by shared tags and links to the existing attempt review; do not create a duplicate progress store.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Pydantic, SQLite, JavaScript ES modules, Vite, Vitest.

**Spec:** docs/superpowers/specs/2026-10-12-student-ai-tutoring-and-progress-design.md, sections 5.3, 6.4, 7–8.

## Global Constraints

- Implementation target: C:/Users/Admin/.codex/worktrees/synapsesync-local-auth/se-sec2-team-06, branch codex/home-local-auth.
- Do not modify D:/Project SE Sce 2/se-sec2-team-06, prototypes, or unrelated worktree changes.
- Do not commit or push unless the user separately asks.
- The API is FastAPI with SQLAlchemy and SQLite for local use.
- The WebApp already has session authentication, a shared API client, router, navbar, and theme manager.
- Existing QuizAttempt and QuizAnswer data is created on submission and stores scores, submitted time, and reviewed answers. This is the source of truth for quiz history.
- Existing quiz and document features share the tag catalog, including builtin subject tags and user-created topic tags.
- Preserve existing quiz grading and retake behavior. Do not add a second quiz-attempt or progress-record table.
- Teacher dashboard, teacher accounts/roles, class rosters, group assignment, and US-05/US-10 are deferred.
- AI keys remain server-only; this feature makes no AI provider calls.
- A score of zero is a result, not missing data. Unsubmitted work is not a completed attempt.

## Review Focus

- No attempts must produce an explicit empty state and nullable latest result, not fabricated zeroes; pin this in Task 1 and Task 2.
- A genuine zero-score submission must remain present and distinct from no data; pin this in Task 1.
- Retakes must remain independent and newest-first; pin this in Task 1.
- A subject filter must include matching descendant topic tags without duplicating an attempt in the general list; pin this in Task 1.
- Cross-user quiz, tag, or attempt data must never appear; pin this in Task 1.

---

### Task 1: Owner-scoped progress aggregation API

**Files:**
- Create: services/api/app/schemas/progress.py
- Create: services/api/app/services/progress.py
- Create: services/api/app/routers/progress.py
- Modify: services/api/app/main.py
- Test: services/api/tests/test_progress_api.py

**Interfaces:**
- Produces ProgressAttemptSummary(attempt_id, quiz_id, quiz_title, score, total_questions, submitted_at, tags).
- Produces TopicProgress(tag_id, name, color, parent_id, attempt_count, latest_attempt).
- Produces ProgressOverview(topics_practiced, latest_attempt, recent_attempts, topics).
- GET /api/progress accepts optional q and tag_id and returns the owner’s overview; q matches quiz titles and associated tag names. GET /api/progress/topics/{tag_id} returns the owner’s matching submitted attempts newest first.
- A builtin subject filter includes quizzes tagged with that subject or its descendants. An attempt occurs only once in recent_attempts even if its quiz has multiple tags; topic-level summaries may include it for each associated tag.

- [x] **Step 1: Write failing API tests**

Test names: test_empty_progress_returns_empty_not_zero_result, test_zero_score_is_a_real_latest_result, test_retakes_are_kept_and_newest_first, test_progress_filters_by_subject_and_descendant_topic, test_recent_attempt_is_not_duplicated_for_multiple_tags, test_unsubmitted_quiz_has_no_progress_record, and test_progress_never_exposes_another_users_data.

- [x] **Step 2: Run the new progress API tests and confirm the expected failures**

Run: python -m pytest services/api/tests/test_progress_api.py -q
Expected: FAIL because the progress API and schemas do not exist.

- [x] **Step 3: Implement read-only aggregation over existing quiz and attempt records**

Scope every query by the authenticated user and owned quiz. Use submitted_at for result ordering and display; do not calculate elapsed duration because the current quiz flow sets started_at equal to submitted_at. Return empty collections and a null latest_attempt when no records exist.

- [x] **Step 4: Run the progress API tests and confirm they pass**

Run: python -m pytest services/api/tests/test_progress_api.py -q
Expected: PASS against the test database, with no new tables.

### Task 2: Authenticated Progress page and shared tag filters

**Files:**
- Create: WebApp/src/pages/ProgressPage.js
- Modify: WebApp/src/api/client.js
- Modify: WebApp/src/router.js
- Modify: WebApp/src/main.js
- Modify: WebApp/src/components/Navbar.js
- Modify: WebApp/src/styles.css
- Test: WebApp/tests/progress-page.test.js
- Test: WebApp/tests/api-client.test.js
- Test: WebApp/tests/router.test.js

**Interfaces:**
- Produces getProgress({q, tagId}) and getProgressTopic(tagId).
- Produces renderProgressPage({loadProgress, loadTopic, loadTags, navigate}).
- Authenticated route /progress; each attempt’s review link targets /quizzes/{quiz_id}/attempts/{attempt_id}.
- Page shows topic count, latest completed result/date-time, recent activity, tag filter/search, and selected-topic attempt history. It does not show elapsed duration.

- [x] **Step 1: Write failing Progress page, client, and route tests**

Test names: test_empty_state_invites_learner_to_start_a_quiz, test_zero_score_renders_as_result_not_empty, test_latest_attempt_and_retake_history_render_newest_first, test_subject_tag_filter_includes_descendants, and test_progress_route_requires_login_and_preserves_return_path.

- [x] **Step 2: Run focused WebApp tests and confirm the expected failures**

Run: npm --prefix WebApp test -- tests/progress-page.test.js tests/api-client.test.js tests/router.test.js
Expected: FAIL because progress APIs, route, page, and navigation link are not present.

- [x] **Step 3: Implement the page using the existing theme and tag filter**

Load tag catalog and progress data from the API. Keep zero-score and no-history states distinct. Link each result to the existing saved attempt review; do not add a second review flow.

- [x] **Step 4: Run focused WebApp tests and build**

Run: npm --prefix WebApp test -- tests/progress-page.test.js tests/api-client.test.js tests/router.test.js
Expected: PASS.

Run: npm --prefix WebApp run build
Expected: production build succeeds.

## Completion checks

- Run: python -m pytest services/api/tests/test_progress_api.py -q
- Run: npm --prefix WebApp test -- tests/progress-page.test.js tests/api-client.test.js tests/router.test.js
- Run: npm --prefix WebApp run build
- Confirm no files outside the approved worktree changed. Do not commit or push.
