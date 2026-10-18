# Quiz Library and Attempt Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users find and rename generated quizzes, take and retake them, and review the score, saved answers, and explanations for every submitted attempt.

**Architecture:** Extend the existing FastAPI quiz API with owner-scoped library summaries, title updates, and persisted attempt reviews; reuse the existing quiz and attempt tables. Add same-origin WebApp API calls, authenticated routes, and focused DOM-rendered pages that consume the existing theme tokens.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Pydantic, SQLite, JavaScript ES modules, Vite, Vitest, jsdom.

**Spec:** `docs/superpowers/specs/2026-10-11-quiz-library-and-attempt-review-design.md`

## Global Constraints

- Work only in `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`; do not modify `D:\Project SE Sce 2\se-sec2-team-06` or `prototypes/`.
- Preserve all pre-existing changes in the worktree; do not reset, clean, or overwrite unrelated files.
- Do not commit or push unless the user separately requests it.
- All quiz and attempt endpoints require the existing authenticated session and enforce owner scope; missing or unauthorized resources return non-disclosing `404`.
- Quiz titles are trimmed and must contain 1–160 characters after trimming.
- Quiz-taking responses never include `correct_answer`, `explanation`, or `evidence`; answer keys are shown only after a saved submission.
- Every successful submission creates a separate attempt; retaking never overwrites an earlier attempt.
- The server is authoritative for submitted answers, correctness, and score; no AI/provider call is added to reading, renaming, grading, or review.
- Run backend tests from `services/api/` and frontend tests/build from `WebApp/`; use local test fixtures and no live AI key/network.

## Review Focus

- A quiz/attempt ID belonging to a different user or a different quiz must not disclose data — pin with cross-owner and cross-quiz `404` tests in Task 3.
- Whitespace, control-only, and overlong quiz titles must not be saved — pin with validation tests in Task 2.
- Quizzes with no attempts must have a stable empty state, not a false score or crash — pin in Task 1 and Task 5.
- A quiz must not leak its answer key before submit, including through new response schemas — pin in Task 3 and Task 7.
- A repeated submission must preserve the first result and have a distinct attempt ID — pin in Task 3 and Task 6.

## File Map

| File | Responsibility |
| --- | --- |
| `services/api/app/schemas/quiz.py` | Add library, title-update, and review response schemas. |
| `services/api/app/routers/quizzes.py` | Owner-scoped library aggregation, rename, submit-review response, and attempt-detail route. |
| `services/api/tests/test_quiz_library.py` | Library summaries, title validation, and ownership tests. |
| `services/api/tests/test_quiz_attempts.py` | Submission persistence, repeated attempts, detailed review, and access-control tests. |
| `WebApp/src/api/client.js` | Same-origin list/read/rename/submit/history/review calls. |
| `WebApp/tests/api-client.test.js` | Verify methods, paths, payloads, and same-origin request behavior. |
| `WebApp/src/router.js` | Parse authenticated quiz routes and safely preserve internal return paths. |
| `WebApp/src/components/Navbar.js` | Show the quiz-library link only to signed-in users. |
| `WebApp/src/main.js` | Connect route data and API functions to page renderers. |
| `WebApp/src/pages/QuizLibraryPage.js` | Render library cards, score summaries, and title editing. |
| `WebApp/src/pages/QuizDetailPage.js` | Render quiz metadata and attempt history. |
| `WebApp/src/pages/QuizTakePage.js` | Render answerable questions without answer-key data. |
| `WebApp/src/pages/QuizAttemptReviewPage.js` | Render a persisted score and per-question review. |
| `WebApp/src/pages/QuizCreatePage.js` | Add links from successful generation to taking and library. |
| `WebApp/src/styles.css` | Add responsive library/detail/take/review styles using existing theme variables. |
| `WebApp/tests/router.test.js` | Test authenticated routes, route params, login redirects, and safe return targets. |
| `WebApp/tests/quiz-library-page.test.js` | Test library and detail/history loading, empty, error, and rename flows. |
| `WebApp/tests/quiz-taking-pages.test.js` | Test question input, submit/result rendering, historical review, and retake links. |
| `WebApp/tests/quiz-create-page.test.js` | Test post-generation start/library links. |

---

### Task 1: Enrich the quiz library with attempt summaries

**Files:**
- Modify: `services/api/app/schemas/quiz.py`
- Modify: `services/api/app/routers/quizzes.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- Produces `QuizLibraryItem`, based on the current `QuizSummary`, with `attempt_count: int`, `latest_attempt: QuizAttemptSummary | None`, and `best_score: int | None`.
- `GET /api/quizzes` keeps `limit` and `offset`, returns the new response schema, and remains newest-first and owner-scoped.

- [x] **Step 1: Write failing library summary tests**

Add `test_list_includes_attempt_count_latest_and_best_score` with three attempts having distinct submitted times and scores; assert count `3`, latest-attempt ID/score from the newest row, and best score from the highest score. Add `test_list_has_null_scores_for_quizzes_without_attempts`; assert count `0`, latest attempt `null`, and best score `null`.

- [x] **Step 2: Run the focused backend tests and verify the new assertions fail**

Run from `services/api/`: `python -m pytest tests/test_quiz_library.py -q`

Expected: the tests fail because current library items do not include attempt summaries.

- [x] **Step 3: Implement `QuizLibraryItem` and an efficient owner-scoped library query**

Return the latest attempt ordered by `submitted_at DESC, id DESC`; compute attempt count and maximum score without issuing one query per quiz. Preserve `QuizSummary` fields and pagination.

- [x] **Step 4: Re-run the focused backend tests**

Run: `python -m pytest tests/test_quiz_library.py -q`

Expected: PASS, including existing owner-scope and newest-first tests.

### Task 2: Add owner-scoped quiz title editing

**Files:**
- Modify: `services/api/app/schemas/quiz.py`
- Modify: `services/api/app/routers/quizzes.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- Produces `QuizTitleUpdate(title: str)` with trimmed 1–160 printable characters.
- Adds `PATCH /api/quizzes/{quiz_id}`; accepts `{ "title": "..." }`, applies `require_same_origin`, and returns the updated `QuizLibraryItem`.

- [x] **Step 1: Write failing rename tests**

Add `test_owner_can_rename_quiz_and_title_is_trimmed`, `test_rename_rejects_blank_control_only_and_overlong_title`, and `test_rename_other_users_quiz_returns_not_found`. Assert invalid updates do not change the stored title.

- [x] **Step 2: Run the focused backend tests and verify the new assertions fail**

Run from `services/api/`: `python -m pytest tests/test_quiz_library.py -q`

Expected: FAIL because the update schema/route is not implemented.

- [x] **Step 3: Implement title validation and the PATCH route**

Trim before enforcing the 160-character limit; reject empty or control-only titles with `422`. Look up the quiz by both `quiz_id` and the current user's ID; commit/refresh only after validation.

- [x] **Step 4: Re-run the focused backend tests**

Run: `python -m pytest tests/test_quiz_library.py -q`

Expected: PASS, including existing privacy tests.

### Task 3: Return and retrieve persisted attempt reviews

**Files:**
- Modify: `services/api/app/schemas/quiz.py`
- Modify: `services/api/app/routers/quizzes.py`
- Test: `services/api/tests/test_quiz_attempts.py`
- Test: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- Produces `QuizQuestionReview` with `question_id`, `position`, `kind`, `prompt`, `choices`, `submitted_answer`, `is_correct`, `correct_answer`, `explanation`, `evidence`, and `source_locator`.
- Produces `QuizAttemptReview` with `attempt_id`, `quiz_id`, `quiz_title`, `score`, `total_questions`, `submitted_at`, and ordered `questions`.
- `POST /api/quizzes/{quiz_id}/attempts` returns `QuizAttemptReview` for the just-saved attempt.
- Adds `GET /api/quizzes/{quiz_id}/attempts/{attempt_id}` returning the same review shape from persisted data.

- [x] **Step 1: Write failing submission and historical-review tests**

Add `test_submit_returns_question_text_choices_and_saved_answer`, `test_attempt_detail_returns_persisted_review`, `test_repeated_submission_creates_distinct_attempts_without_changing_first_review`, and `test_attempt_detail_rejects_cross_owner_cross_quiz_and_unknown_ids`. Assert the saved selected answer, prompt, choices, correct answer, explanation, and evidence correspond to each question.

- [x] **Step 2: Run focused backend tests and verify the new assertions fail**

Run from `services/api/`: `python -m pytest tests/test_quiz_attempts.py tests/test_quiz_library.py -q`

Expected: FAIL because submit responses omit review context and no attempt-detail route exists.

- [x] **Step 3: Implement schemas and persisted attempt lookup**

Build the post-submit review from the graded quiz and saved answer mapping. For historical reads, require the owned quiz and query the attempt by `attempt_id`, `quiz_id`, and `user_id`; join/select-load question data, order by question position, and return the same response schema. Preserve the current key-free `GET /api/quizzes/{quiz_id}` response.

- [x] **Step 4: Re-run focused backend tests**

Run: `python -m pytest tests/test_quiz_attempts.py tests/test_quiz_library.py -q`

Expected: PASS; repeated submits have different IDs and the first review is unchanged.

### Task 4: Add typed WebApp API client functions

**Files:**
- Modify: `WebApp/src/api/client.js`
- Test: `WebApp/tests/api-client.test.js`

**Interfaces:**
- Add `listQuizzes({ limit, offset } = {}, options)`, `getQuiz(quizId, options)`, `renameQuiz(quizId, payload, options)`, `submitQuizAttempt(quizId, payload, options)`, `getQuizAttempts(quizId, options)`, and `getQuizAttempt(quizId, attemptId, options)`.
- All functions use the existing `requestJson`, same-origin credentials, error handling, and `/api` base path.

- [x] **Step 1: Write failing client tests**

Add tests verifying the exact URL/method/body for each function, URL-encoded pagination, JSON content type for PATCH/POST, and `credentials: 'same-origin'`.

- [x] **Step 2: Run the focused frontend test and verify the new assertions fail**

Run from `WebApp/`: `npm test -- tests/api-client.test.js`

Expected: FAIL because the new client functions are not exported.

- [x] **Step 3: Implement the client functions**

Use numeric IDs in the path and JSON payloads for title updates and attempt submissions. Do not add provider or secret data to these requests.

- [x] **Step 4: Re-run the focused frontend test**

Run: `npm test -- tests/api-client.test.js`

Expected: PASS with the existing API client tests.

### Task 5: Add authenticated quiz navigation and safe routes

**Files:**
- Modify: `WebApp/src/router.js`
- Modify: `WebApp/src/components/Navbar.js`
- Test: `WebApp/tests/router.test.js`
- Test: `WebApp/tests/pages.test.js`

**Interfaces:**
- `resolveRoute(pathname, user, search)` maps `/quizzes`, `/quizzes/:quizId`, `/quizzes/:quizId/take`, and `/quizzes/:quizId/attempts/:attemptId` to `quiz-library`, `quiz-detail`, `quiz-take`, and `quiz-attempt-review`, with numeric IDs in `params`.
- Add a signed-in navbar link labeled `คลังข้อสอบ` to `/quizzes`.
- Signed-out private-route resolution returns login with the original internal route in `returnTo`.

- [x] **Step 1: Write failing route and navbar tests**

Add one route-resolution assertion for each path/page/ID, signed-out redirect assertions for all private quiz paths, rejection of external/malformed `next` values, and a navbar assertion that the library link appears only when `user` is present.

- [x] **Step 2: Run focused frontend tests and verify the new assertions fail**

Run from `WebApp/`: `npm test -- tests/router.test.js tests/pages.test.js`

Expected: FAIL because dynamic quiz routes and the library link are not present.

- [x] **Step 3: Implement route matching, safe return allow-list, and navbar link**

Match only the supported paths with positive decimal IDs; do not accept arbitrary paths or external URLs as login destinations. Preserve existing public and profile/create routes.

- [x] **Step 4: Re-run focused frontend tests**

Run: `npm test -- tests/router.test.js tests/pages.test.js`

Expected: PASS with existing route/navbar behavior retained.

### Task 6: Build library and quiz-history pages

**Files:**
- Create: `WebApp/src/pages/QuizLibraryPage.js`
- Create: `WebApp/src/pages/QuizDetailPage.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/quiz-library-page.test.js`

**Interfaces:**
- `renderQuizLibraryPage({ loadQuizzes = listQuizzes, updateTitle = renameQuiz, navigate })` renders owned quiz cards and title editing.
- `renderQuizDetailPage({ quizId, loadQuiz = getQuiz, loadAttempts = getQuizAttempts, navigate })` renders quiz metadata, attempt summaries, and start/retake/review links.
- `main.js` dispatches `quiz-library` and `quiz-detail` route params and supplies the client functions.

- [x] **Step 1: Write failing library/detail page tests**

Add tests for loading and empty states, card metadata and latest/best/attempt count, title edit save/error, newest-first attempt rows, no-attempt state, and navigation to take/review routes. Assert scores are rendered as `score / total_questions`.

- [x] **Step 2: Run the focused frontend test and verify the new assertions fail**

Run from `WebApp/`: `npm test -- tests/quiz-library-page.test.js`

Expected: FAIL because the pages do not exist.

- [x] **Step 3: Implement the two pages and connect route rendering**

Use semantic headings/buttons and `textContent` for API-provided text; never interpolate quiz titles or source filenames as HTML. Keep loading, empty, API-error, and rename-error states accessible with status messaging.

- [x] **Step 4: Add responsive styles and run focused frontend tests**

Use existing theme variables and preserve contrast in all configured themes. Run: `npm test -- tests/quiz-library-page.test.js tests/router.test.js`

Expected: PASS for library/detail rendering and route navigation.

### Task 7: Build quiz-taking and saved review flows

**Files:**
- Create: `WebApp/src/pages/QuizTakePage.js`
- Create: `WebApp/src/pages/QuizAttemptReviewPage.js`
- Modify: `WebApp/src/pages/QuizCreatePage.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/quiz-taking-pages.test.js`
- Test: `WebApp/tests/quiz-create-page.test.js`

**Interfaces:**
- `renderQuizTakePage({ quizId, loadQuiz = getQuiz, submitAttempt = submitQuizAttempt, navigate })` renders multiple-choice and true/false inputs and submits `{ answers: [...] }`.
- `renderQuizAttemptReviewPage({ quizId, attemptId, loadReview = getQuizAttempt, navigate })` renders the persisted review response and retake link.
- On successful submit, navigate to `/quizzes/${quizId}/attempts/${attemptId}`; the review page reloads the saved response rather than relying on transient page state.
- On successful generation, `QuizCreatePage` offers `เริ่มทำข้อสอบ` to `/quizzes/${quiz.id}/take` and `ไปคลังข้อสอบ` to `/quizzes`.

- [x] **Step 1: Write failing taking/review/create-link tests**

Add tests for rendering both question kinds, `test_take_view_never_renders_answer_key_before_submit` (even if a test fixture contains extra answer-key fields), selecting answers, submitting the exact question IDs and selected values, navigating to the new attempt ID, rendering the score and every saved answer/explanation/evidence, a historical review reload, and a retake link to the same quiz. Add a quiz-create test asserting both success links include the returned quiz ID where appropriate.

- [x] **Step 2: Run focused frontend tests and verify the new assertions fail**

Run from `WebApp/`: `npm test -- tests/quiz-taking-pages.test.js tests/quiz-create-page.test.js`

Expected: FAIL because taking/review pages and success links are not implemented.

- [x] **Step 3: Implement taking, submission, and persisted review pages**

Render questions and choices with DOM APIs. Send selected-choice indexes for multiple-choice and booleans for true/false; omit unanswered questions so existing server grading treats them as incorrect. Never render correct answer/explanation/evidence before submit. Navigate to the addressable review route after receiving the saved attempt ID.

- [x] **Step 4: Add create-success navigation and connect route rendering**

Pass the app's internal `navigate` function into the create page; do not construct external links from API data.

- [x] **Step 5: Add responsive styles and run focused frontend tests**

Use the shared theme variables. Run: `npm test -- tests/quiz-taking-pages.test.js tests/quiz-create-page.test.js tests/router.test.js`

Expected: PASS; a retake starts unselected and review is loaded from the API.

### Task 8: Verify the complete feature and existing behavior

**Files:**
- No new files; run the full relevant test suites and build.

- [x] **Step 1: Run the complete backend test suite**

Run from `services/api/`: `python -m pytest tests -q`

Expected: PASS with no real AI key or network dependency.

- [x] **Step 2: Run the complete frontend test suite**

Run from `WebApp/`: `npm test`

Expected: PASS for existing auth/theme/generation tests and all new library/taking/review tests.

- [x] **Step 3: Build the WebApp**

Run from `WebApp/`: `npm run build`

Expected: Vite completes successfully and emits the production bundle.

- [x] **Step 4: Review the working-tree scope**

Confirm only the planned app files changed in addition to the pre-existing user changes; confirm the D: working directory and `prototypes/` remain untouched. Do not commit or push.

Expected: report exact test/build outcomes and any pre-existing dirty changes without cleaning them.

**Review gate:** User approved the plan and execution approach. Final review completed; pagination and answer-key privacy coverage were addressed. No commit or push was made.
