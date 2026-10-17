# Student AI Tutoring, Practice History, and Progress — Design Specification

**Status:** Approved by user — implementation in progress
**Date:** 2026-10-12
**Scope:** Authenticated learner experience for AI question support, quiz practice history, and progress overview. Teacher analytics are deferred.

## 1. Purpose

Help a learner ask an AI assistant about a confusing question, clarify missing context, and return to an unfinished exchange later. Reuse the existing quiz-attempt and shared-tag systems to show completed practice history and topic progress without creating duplicate records.

This specification covers the learner portions of US-01, US-02, US-04, and US-08. US-05 and US-10 are explicitly deferred until real teacher roles, class membership, and access rules are available.

## 2. Existing context and constraints

- Implementation target: C:/Users/Admin/.codex/worktrees/synapsesync-local-auth/se-sec2-team-06, branch codex/home-local-auth.
- Do not modify D:/Project SE Sce 2/se-sec2-team-06, prototypes, or unrelated worktree changes.
- Do not commit or push unless the user separately asks.
- The API is FastAPI with SQLAlchemy and SQLite for local use. The WebApp already has session authentication, a shared API client, router, navbar, and theme manager.
- Existing QuizAttempt and QuizAnswer data is created on submission and stores scores, submitted time, and reviewed answers. This is the source of truth for quiz history.
- Existing quiz and document features share the tag catalog, including builtin subject tags and user-created topic tags.
- AI settings and the university OpenAI-compatible chat-completions integration are configured on the API side for quiz generation. The browser must never receive the API key.
- Preserve existing quiz grading and retake behavior. Do not add a second quiz-attempt or progress-record table.

## 3. Goals

1. Let an authenticated learner ask a non-empty text question and receive either an explanation or a targeted clarifying question.
2. Preserve conversation context, pending clarification, and retryable questions across navigation or reloads.
3. Organize and find tutoring conversations using the existing subject/topic tags and search patterns.
4. Show completed quiz results and topic-level progress from existing attempt data, including repeated attempts and genuine zero scores.
5. Keep learner data owner-scoped and keep provider credentials server-side.
6. Keep verification focused on a small set of high-value cases; no live AI credentials are needed for tests.

## 4. Out of scope

- Teacher dashboard, teacher accounts/roles, class rosters, group assignment, group analytics, and US-05/US-10. These require real membership data and authorization rules; the UI must not fabricate a class or learner evidence.
- Scored progress from free-form AI conversations. Only submitted quiz attempts count toward quiz progress.
- Image/file attachments to a tutoring question, voice, streaming responses, public sharing, or cross-user conversations.
- A new tag system, a new quiz-attempt store, automatic provider fallback, or changing the existing quiz-generation flow.
- Public deployment, commit, push, or pull request creation.

## 5. Learner experience

### 5.1 AI question support — US-01 and US-02

Add an authenticated “ถามผู้ช่วย” entry in the shared navigation and a tutoring page at /tutor. Add a “ความก้าวหน้า” entry at /progress. A signed-out visitor is sent to login and returned to the requested internal route after authentication.

Starting an exchange requires a non-empty text question. The learner may associate existing subject and topic tags, but tagging is optional so it does not block a quick question. The conversation title is derived from the first question for the initial release. The conversation list can search its titles and message text and filter by its assigned tags.

For each submitted learner message:

1. Save the learner message before calling the provider and show a processing state.
2. Ask the AI for a validated structured result with one of two kinds: answer or clarification. If context is sufficient, answer directly. If context is insufficient, return at least one concise, relevant follow-up question instead of guessing.
3. When the learner answers a clarification, send the relevant earlier turns and the new answer as context. Store the assistant response in the same conversation.
4. If the learner leaves while a clarification is pending, retain the conversation in an awaiting-clarification state. Show it in history with a resume action; do not expire or silently discard it.
5. If the provider is unavailable, retain the learner message, show a retryable error, and let the learner retry. A retry must not create a duplicate conversation or duplicate learner-message record. A provider call may be repeated if the earlier request timed out before its outcome was known.

The UI distinguishes processing, awaiting clarification, answered, and retryable error states. Empty input is rejected locally and by the API; it never calls the AI provider.

### 5.2 Conversation history, tags, and search

The authenticated learner can open prior conversations, continue a pending clarification, search by conversation title or message text, and filter by existing subject/topic tags. The history is scoped to the current account and sorted by most recent activity. No sample conversations are inserted for an empty account.

Tagging uses the shared catalog already used by quizzes and documents. Builtin subjects and user-owned topic tags remain managed by the existing tag feature; this feature only associates tags with a conversation.

### 5.3 Practice history and progress — US-04 and US-08

Use the existing quiz submission flow as the completion boundary. A submitted and server-graded attempt is saved in QuizAttempt and its answers in QuizAnswer. Leaving a quiz before submission does not create a completed attempt and does not appear as a successful result. Existing grading behavior for submitted unanswered questions remains unchanged; such questions are graded by the current quiz grader.

Add an authenticated Progress page that derives its data from completed attempts and the tags on their quizzes. It shows:

- the number of distinct tagged topics with at least one submitted attempt;
- the most recent completed result and practice date/time;
- the submitted date and time for each result. The current quiz flow sets its start time at submission, so elapsed duration is not trustworthy and is not shown in this release;
- topic filters/search using the shared tag hierarchy;
- for a selected topic, its latest result and earlier attempts, newest first, with a link to the existing detailed attempt review.

Every retake remains a separate history entry. A score of zero is a real result and must not be represented as missing data. If there are no completed attempts, show an empty state with a link to start a quiz; do not show fabricated zero-valued results. An attempt without a subject/topic tag may still appear in general recent history but is not assigned to an invented topic.

Topic counts are derived from topics with completed attempts. Filtering by a builtin subject includes its tagged descendant topics. An attempt appears once in the general recent-activity list even if its quiz has multiple tags; topic-specific views include the attempt for each explicitly associated topic.

## 6. API and data design

### 6.1 Tutoring records

Add an owner-scoped tutoring conversation model and message model. A conversation stores its owner, derived title, lifecycle state, provider/model identifiers used for the response, timestamps, and optional tag associations. A message stores conversation, sequence/order, role, message kind, text, timestamp, and request/idempotency identifier where applicable. Store no provider API key in either model.

Conversation lifecycle states reflect the latest turn:

- processing: a learner message is persisted and an AI response is in progress;
- awaiting clarification: the latest assistant turn asked a follow-up question;
- retryable error: the latest learner message is retained, but the AI response failed;
- answered: the latest learner turn has an assistant explanation. A new learner message moves the conversation back to processing.

Commit the learner message and processing state before making the external request; do not hold a database transaction open during the network call. Validate the AI response against a strict schema before saving it. On provider failure, persist the retryable-error state without erasing the learner message or marking the exchange answered.

### 6.2 Proposed tutoring API surface

All routes require the existing authenticated session, enforce same-origin checks on mutations, and scope every query by the current user.

- POST /api/tutor/conversations — create a conversation and submit its first non-empty message.
- GET /api/tutor/conversations — list the current learner’s conversations, with optional text query and tag filter.
- GET /api/tutor/conversations/{conversation_id} — return one owned conversation and its ordered messages.
- POST /api/tutor/conversations/{conversation_id}/messages — add a clarification answer or next learner message and request an AI turn.
- POST /api/tutor/conversations/{conversation_id}/retry — retry the retained failed learner turn without creating another conversation/message.

Return a non-disclosing 404 for a conversation that does not exist or belongs to another user. Return 422 for empty/invalid messages, 429 for an exhausted provider quota when known, and a safe retryable 503 for provider unavailability. Never include secrets or raw provider error bodies in responses.

### 6.3 AI adapter and prompt

Add a tutoring provider contract or a shared lower-level chat-completions adapter without changing the quiz-generation contract. Reuse server-side AISettings, configured default provider/model, timeout, and university API credentials. Do not add a browser-side key field.

The versioned tutoring system prompt must instruct the model to:

- answer in the language used by the learner when enough context exists;
- ask at least one focused clarifying question when the missing context would change the explanation;
- use prior turns when responding after clarification;
- avoid claiming facts or learning mastery unsupported by the conversation;
- return only the required structured result, with bounded message content.

The provider receives only the conversation turns needed for the current exchange and optional selected subject/topic labels. Do not send profile fields, unrelated conversations, quiz answer keys, or unrelated documents. Provider output is untrusted until schema validation succeeds.

### 6.4 Progress API

Add an owner-scoped progress summary and topic-detail API backed by SQL aggregation over the current user’s submitted attempts, owned quizzes, answers, and tag associations. Do not persist redundant summary rows. Ensure every query checks both quiz and attempt ownership. The response distinguishes an empty dataset from a score of zero and includes only submitted attempts.

## 7. Privacy, authorization, and failure handling

- Tutoring conversations and quiz attempts are private to their owner. Frontend hiding is not authorization; every API read and mutation checks ownership.
- Same-origin checks apply to state-changing browser requests, consistent with current routes.
- API keys remain server-only. Provider exceptions are converted to safe, actionable messages.
- Preserve a failed or pending learner message so retry/resume works after reload. Do not silently mark a failed request as answered.
- Do not infer student difficulty or mastery from a free-form question. Progress statements are based only on completed, graded quiz attempts.
- No class/group/teacher data is created or displayed in this release.

## 8. Focused verification plan

Keep the test set small and deterministic:

### API

- Empty question returns validation error and does not call the provider.
- A scripted provider first requests clarification, then answers after the learner reply; both turns persist and the conversation can be resumed.
- Provider failure keeps the user message retryable; retry reuses it and does not create a duplicate conversation/message.
- A learner cannot read or continue another learner’s conversation.
- Progress includes submitted attempts, preserves retakes, distinguishes score zero from no data, and excludes unsubmitted work.

### WebApp

- Tutor processing, clarification/resume, empty-input, and retry states render and invoke the expected API methods.
- Search/tag filters select the right conversation or topic; progress empty and score-zero states differ.
- Run the focused tests and production build for changed areas. A full suite is not required for the first verification pass unless focused checks expose wider regressions.

All AI-related tests use a fake provider and require no network call or real API key.

## 9. Acceptance criteria mapping

- US-01: non-empty question, processing state, empty-input rejection, provider error retention and retry.
- US-02: insufficient-context clarification, use of the learner’s follow-up, pending conversation resume.
- US-04: submitted/graded attempt history by topic and timestamp; abandoned work is not recorded as completed.
- US-08: topic count, latest result/date/time, empty state, and zero-score distinction.
- US-05 and US-10: explicitly deferred; no teacher dashboard or invented group data in this phase.

## 10. Review gate

This is a draft design specification, not implementation authorization. After the user reviews and approves this file, create a separate implementation plan and request approval for that plan before editing application code. Do not commit or push without a separate request.
