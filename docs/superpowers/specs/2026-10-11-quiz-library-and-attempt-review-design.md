# Quiz Library, Taking, History, and Retake — Design Specification

**Status:** Approved by user — 2026-10-11; implementation plan under review.
**Date:** 2026-10-11
**Scope:** Authenticated WebApp experience and additive API support for the existing AI-generated quizzes.

## 1. Purpose

Allow a signed-in SynapseSync user to find quizzes generated from their study documents, give each quiz a clear editable title, complete it for a server-calculated score, and review every submitted attempt later. A user can retake the same quiz; each submission creates a separate history entry and never replaces prior results.

This phase builds on the existing quiz-generation and grading system. It does not change how the AI generates questions or add AI grading.

## 2. Target and constraints

- Implementation target: `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`.
- Do not modify `D:\Project SE Sce 2\se-sec2-team-06` or files under `prototypes/`.
- Preserve all pre-existing working-tree changes in the target worktree.
- Do not commit or push unless the user separately requests it.
- Existing backend is FastAPI + SQLAlchemy + SQLite; the browser uses the same-origin `/api` client and session.
- Existing `Quiz`, `QuizQuestion`, `QuizAttempt`, and `QuizAnswer` data model already persists quiz ownership, answer keys, each submission, and each response. No new database table is required for this feature.

## 3. User experience

### Navigation and access

- Add an authenticated `คลังข้อสอบ` link to the shared navbar.
- The library, quiz detail/history, taking, and attempt-review routes require authentication. Unauthenticated users are sent to login and returned to their requested quiz route after successful login, using an allow-listed internal route only.
- The public home page can keep its existing create-quiz entry point; creating or opening a private quiz still requires login.

### Quiz library

`/quizzes` lists the signed-in user’s quizzes newest first. Each card shows:

- quiz title (editable by the owner), source filename/type, creation date, language/difficulty, and question count;
- attempt count, most recent score/date, and best score if at least one attempt exists;
- actions to open the quiz’s history/details and start or retake the quiz.

The generated title is the initial title. The owner can rename it from the library/details view. Renaming changes only the quiz title; it does not alter questions or prior attempt results. Trim whitespace and reject empty or overlong titles.

Provide clear loading, empty-library, request-error, and save-error states. Empty state links to quiz creation.

### Quiz detail and attempt history

The quiz detail/history view shows quiz metadata, a `เริ่มทำข้อสอบ` / `ทำซ้ำ` action, and previous attempts newest first. Each attempt row shows the submitted time and score. Opening an attempt displays the saved review for that exact attempt.

### Taking and results

- The taking view displays the quiz title, ordered question text, choices, and a submit action. It does not reveal the answer key, explanations, or evidence before submission.
- Validate that each selected value matches the question kind. Unanswered questions may be submitted and are graded as incorrect, preserving current backend behavior.
- After submission, display the server-calculated score and, for every question, the user's saved answer, correctness, correct answer, explanation, evidence excerpt, and source locator when available.
- A `ทำซ้ำ` action returns to the same quiz as a fresh attempt. It does not pre-fill previous responses and does not delete or mutate history.
- The result is addressable by quiz and attempt IDs so a refresh or later visit can retrieve the saved result.

## 4. API contract

All quiz and attempt routes require the existing authenticated session. Every lookup and mutation is scoped by the current user. Return a non-disclosing `404` when a quiz or attempt is missing or belongs to another user.

### Existing routes retained

- `GET /api/quizzes` — current user's library, newest first; enrich each item with attempt count, latest-attempt summary (nullable), and best score (nullable) for card display. Keep existing pagination parameters.
- `GET /api/quizzes/{quiz_id}` — taking data without `correct_answer`, `explanation`, or `evidence`.
- `POST /api/quizzes/{quiz_id}/attempts` — grade and persist one new attempt. Each successful call creates a new attempt ID; do not overwrite earlier attempts. Return the complete safe review data for the newly submitted attempt.
- `GET /api/quizzes/{quiz_id}/attempts` — owner-scoped attempt summaries, newest first.

### Additive routes

- `PATCH /api/quizzes/{quiz_id}` with `{ "title": "..." }` — rename a quiz owned by the current user. Trim outer whitespace; require 1–160 characters after trimming; reject empty/control-only/overlong input with `422`. Return the updated library item. Apply the existing same-origin requirement to this state-changing route.
- `GET /api/quizzes/{quiz_id}/attempts/{attempt_id}` — return the persisted review for an attempt belonging to that quiz and current user, including quiz title, score, total question count, submitted time, and ordered per-question prompt/kind/choices, selected answer, correctness, correct answer, explanation, evidence, and source locator. Verify both quiz ownership and attempt-to-quiz association.

The detailed review response uses the same shape for a just-submitted result and a historical result where practical, so the client can render either consistently. No provider API is called for quiz reads, renaming, attempt submission, or review.

## 5. Data behavior and privacy

- Reuse existing `quiz_attempts` and `quiz_answers`; do not store attempt state in browser local storage as the source of truth.
- The attempt record is created only when the user submits. A started-but-abandoned quiz is not represented as a completed attempt in this phase.
- The database remains authoritative for scores, submitted answers, and correctness. The client must not calculate or submit the score.
- Do not expose answer keys through quiz list, quiz detail, or before-submit responses.
- Historical review may expose correct answers and explanations only after the attempt has been submitted and only to the owner.
- Do not include API keys, full source document contents, or unrelated profile data in quiz responses.

## 6. Frontend architecture

Add authenticated routes and corresponding pages/components, following the current WebApp routing, shared navbar, API client, and styling conventions:

- `/quizzes` — library;
- `/quizzes/{quiz_id}` — quiz details and attempt history;
- `/quizzes/{quiz_id}/take` — taking view;
- `/quizzes/{quiz_id}/attempts/{attempt_id}` — persisted result/review.

Extend `WebApp/src/api/client.js` with list/read/rename/submit/history/detail functions. After quiz generation, provide a direct link to start the newly created quiz and a link to the library. Ensure route protection and safe login return behavior cover all private quiz routes without accepting arbitrary external `next` URLs.

The visual styling should consume the existing shared theme system. A full redesign is not part of this feature.

## 7. Test plan and acceptance criteria

### Backend

- Library results are owner-scoped/newest-first and include correct attempt count, latest score, and best score; quizzes with no attempts have null latest/best values.
- Renaming trims valid input, returns the updated title, rejects blank/control-only/overlong values, and cannot rename another user's quiz.
- A taking response has no correct answer, explanation, or evidence.
- Submitting a quiz calculates score server-side and creates an independent attempt; submitting a second time creates a second record while leaving the first review unchanged.
- Attempt summaries are newest first. Attempt detail returns the exact persisted selected answers and matching question explanations/evidence.
- Attempt detail rejects an unknown ID, another user's quiz/attempt, and an attempt ID attached to a different quiz with non-disclosing `404` behavior.
- Missing answers continue to grade incorrect as specified by current behavior.
- All tests use the local test database and require no network or AI secret.

### Frontend

- Navbar library link and all private routes behave correctly for signed-in and signed-out users.
- Login return targets are limited to supported internal quiz routes.
- Library supports loading, empty, populated, rename success/failure, and API error states.
- Detail page lists history and starts/retakes the same quiz.
- Taking page supports both question kinds, prevents answer-key display before submit, and submits the selected answers.
- Submission shows the score and full per-question review. Historical attempt navigation renders the same saved review after reload.
- Retaking does not prefill previous answers or hide old history; the new result has a distinct attempt ID.
- Existing frontend, backend, authentication, theme, and quiz-generation tests remain passing.

## 8. Out of scope

- Delete/share quizzes, export, search/filter, folders/tags, draft autosave, timed exams, randomization, question editing, AI grading, leaderboards, and analytics beyond latest/best/attempt count.
- New account/profile schema or database migration.
- Changes to AI provider selection, prompt, generation limits, or university API integration.
- Public deployment, commit, push, or PR creation.

## 9. Definition of done

- The authenticated user can find a generated quiz, rename it, take it, receive a server-graded score and explanations, revisit any past attempt, and retake without losing history.
- Ownership and answer-key privacy are enforced by the API, not merely hidden in the frontend.
- Relevant API and UI tests cover the acceptance criteria above.
- No files outside the approved worktree are modified; no commit or push is made.

**Review gate:** This design spec is approved. Review the separate implementation plan before changing application code.
