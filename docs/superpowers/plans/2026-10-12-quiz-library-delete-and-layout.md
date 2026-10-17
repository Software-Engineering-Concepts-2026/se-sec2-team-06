# Quiz Library Delete and Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep quiz creation easy to find, make quiz cards compact, highlight best scores, and safely delete a quiz together with its complete history.

**Architecture:** Add an owner-scoped DELETE endpoint to the existing quizzes router and reuse SQLAlchemy’s existing quiz/attempt/answer cascades. Add a themed confirmation dialog in the library; after success, reload the current filtered page without affecting any other quiz.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, vanilla JavaScript DOM modules, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-tag-library-and-quiz-polish-design.md`

## Global Constraints

- Keep a visible **Create quiz** action on the quiz library even when quizzes already exist.
- Show at most six desktop rows (12 quizzes) per page; retain responsive one-column layout on narrow screens.
- Highlight best score in green beside the repeat/start action.
- Confirm deletion before permanently removing the selected quiz, all attempts, answers, and review history.
- Enforce owner scope; preserve all unrelated quizzes, tags, and records.
- Integrate flat tag behavior from `2026-10-12-shared-flat-tags.md` before final tag UI validation.
- Do not edit `D:\Project SE Sce 2\se-sec2-team-06`; do not commit or push.

## Review Focus

- Canceling confirmation must make no request: `test_cancel_quiz_delete_preserves_quiz_without_api_call` in `WebApp/tests/quiz-library-page.test.js`.
- A foreign user must not delete or infer existence of a quiz: `test_delete_quiz_returns_same_not_found_for_foreign_and_unknown_ids` in `services/api/tests/test_quiz_library.py`.
- Delete removes dependent attempts, submitted answers, questions, and quiz-tag join rows but keeps shared tags: `test_delete_quiz_cascades_owned_history_but_keeps_tags` in `services/api/tests/test_quiz_library.py`.
- Deleting the last card on a later page must recover to a valid page and keep filters: `test_delete_last_filtered_page_item_returns_to_previous_page` in `WebApp/tests/quiz-library-page.test.js`.
- Failed DELETE must retain the card and announce an accessible error: `test_failed_quiz_delete_keeps_card_and_announces_error` in `WebApp/tests/quiz-library-page.test.js`.

---

### Task 1: Add an owner-scoped quiz deletion API

**Files:**
- Modify: `services/api/app/routers/quizzes.py`
- Modify: `services/api/app/schemas/quiz.py` only if a response schema is required
- Test: `services/api/tests/test_quiz_library.py`
- Test: `services/api/tests/test_quiz_database.py`

**Interfaces:**
- `DELETE /api/quizzes/{quiz_id}` requires the current authenticated user and same-origin request; success returns HTTP 204.
- `delete_quiz(quiz_id: int, request: Request, session: Session, user: User) -> Response` loads the quiz with `_get_owned_quiz`, deletes only that owned quiz, commits, and returns 204.
- Existing `Quiz.questions`, `Quiz.attempts`, and `QuizAttempt.answers` cascades perform dependent cleanup; shared `Tag` rows are never deleted.

- [ ] **Step 1: Add failing API tests** named `test_owner_can_delete_quiz`, `test_delete_quiz_returns_same_not_found_for_foreign_and_unknown_ids`, `test_delete_quiz_requires_same_origin`, and `test_delete_quiz_cascades_owned_history_but_keeps_tags`; assert HTTP 204 on success and no remaining selected quiz/question/attempt/answer/quiz-tag join rows.
- [ ] **Step 2: Run `python -m pytest tests/test_quiz_library.py tests/test_quiz_database.py -q`** from `services/api` and verify the delete tests fail before the route exists.
- [ ] **Step 3: Implement the route** using `_get_owned_quiz`, `require_same_origin`, and the existing cascade relationships.
- [ ] **Step 4: Run `python -m pytest tests/test_quiz_library.py tests/test_quiz_database.py -q`** from `services/api` and verify all deletion and privacy assertions pass.

### Task 2: Add the frontend delete client and confirmation flow

**Files:**
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/pages/QuizLibraryPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/api-client.test.js`
- Test: `WebApp/tests/quiz-library-page.test.js`

**Interfaces:**
- `deleteQuiz(quizId: number, options?)` sends `DELETE /quizzes/{id}` through `requestJson` and validates a positive safe integer ID.
- `renderQuizLibraryPage({ deleteQuiz, confirmDelete, ... })` accepts injected delete and confirmation functions for tests; production confirmation uses an accessible `role="alertdialog"` that names the quiz and warns that all history/reviews are removed.
- `main.js` passes the API client’s `deleteQuiz` function.

- [ ] **Step 1: Add failing client/page tests** named `test_delete_quiz_client_uses_delete_path_and_validates_id`, `test_cancel_quiz_delete_preserves_quiz_without_api_call`, `test_confirm_quiz_delete_removes_only_selected_card`, `test_failed_quiz_delete_keeps_card_and_announces_error`, and `test_delete_last_filtered_page_item_returns_to_previous_page`; assert only the selected ID is sent.
- [ ] **Step 2: Run `npm test -- tests/api-client.test.js tests/quiz-library-page.test.js`** from `WebApp` and verify failure.
- [ ] **Step 3: Implement `deleteQuiz` and the accessible confirm/cancel dialog**; disable duplicate confirmation while the request is pending and restore controls after failure.
- [ ] **Step 4: Run the focused frontend tests** and confirm tags/filters/page state are refreshed only after successful deletion.

### Task 3: Polish quiz cards and detail navigation

**Files:**
- Modify: `WebApp/src/pages/QuizLibraryPage.js`
- Modify: `WebApp/src/pages/QuizDetailPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/quiz-library-page.test.js`
- Test: `WebApp/tests/quiz-taking-pages.test.js`

- [ ] **Step 1: Add failing UI tests** named `test_create_quiz_action_remains_visible_with_existing_quizzes`, `test_best_score_is_green_next_to_repeat_action`, `test_quiz_delete_action_is_circular_red_and_corner_aligned`, and `test_detail_back_to_library_is_red_and_corner_aligned`; assert wide page size 12 and narrow page size 6.
- [ ] **Step 2: Run `npm test -- tests/quiz-library-page.test.js tests/quiz-taking-pages.test.js`** from `WebApp` and verify the new assertions fail.
- [ ] **Step 3: Update card/detail DOM and CSS** without removing history, score, tags, repeat, or search controls; maintain two columns on wide screens and one on narrow screens.
- [ ] **Step 4: Run the focused quiz page tests** and verify pagination remains 12 per wide page and no more than six rows.

### Task 4: Validate safe deletion and quiz browsing

- [ ] **Step 1: Run backend quiz tests**: `python -m pytest tests/test_quiz_library.py tests/test_quiz_database.py tests/test_quiz_attempts.py -q` from `services/api`.
- [ ] **Step 2: Run frontend quiz tests**: `npm test -- tests/api-client.test.js tests/quiz-library-page.test.js tests/quiz-taking-pages.test.js` from `WebApp`.
- [ ] **Step 3: Run `npm run build`** from `WebApp` and manually confirm confirmation/cancel behavior in all three themes.
