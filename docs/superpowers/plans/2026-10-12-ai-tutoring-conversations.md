# AI Tutoring Conversations Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for Native execution or superpowers:subagent-driven-development if the user explicitly chooses delegated execution. Complete one task and its checks before moving to the next.

**Goal:** Add authenticated, resumable AI question conversations with clarification, retry, shared tags, and search.

**Architecture:** Keep tutoring messages in new owner-scoped records and call the configured AI service only from the API. Reuse the existing tag catalog and WebApp session/API patterns; keep the quiz-generation provider contract unchanged.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Pydantic, httpx, SQLite, JavaScript ES modules, Vite, Vitest, DOMPurify/marked only if needed for safe answer rendering.

**Spec:** docs/superpowers/specs/2026-10-12-student-ai-tutoring-and-progress-design.md, sections 5.1–5.2, 6.1–6.3, and 7–8.

## Global Constraints

- Implementation target: C:/Users/Admin/.codex/worktrees/synapsesync-local-auth/se-sec2-team-06, branch codex/home-local-auth.
- Do not modify D:/Project SE Sce 2/se-sec2-team-06, prototypes, or unrelated worktree changes.
- Do not commit or push unless the user separately asks.
- The API is FastAPI with SQLAlchemy and SQLite for local use.
- The WebApp already has session authentication, a shared API client, router, navbar, and theme manager.
- Existing quiz and document features share the tag catalog, including builtin subject tags and user-created topic tags.
- AI settings and the university OpenAI-compatible chat-completions integration are configured on the API side for quiz generation. The browser must never receive the API key.
- Preserve existing quiz grading and retake behavior. Do not add a second quiz-attempt or progress-record table.
- Teacher dashboard, teacher accounts/roles, class rosters, group assignment, and US-05/US-10 are deferred.
- Image/file attachments to a tutoring question, voice, streaming responses, public sharing, and cross-user conversations are out of scope.
- AI-related tests use a fake provider and require no network call or real API key.

## Review Focus

- Whitespace-only or missing question text must return 422 without calling the provider; pin this in Task 3.
- Clarification followed by a learner reply must reuse the same conversation and relevant prior turns; pin this in Task 3.
- Timeout, quota, or malformed provider output must preserve the user message, expose a safe retryable error, and not leak provider details; pin this in Tasks 1 and 3.
- Repeating a request identifier after a lost response must not add a duplicate learner message; pin this in Task 3.
- A different account or a tag not owned by the learner must not be readable/assignable; pin this in Tasks 2 and 3.

---

### Task 1: Tutoring AI contract and provider adapter

**Files:**
- Create: services/api/app/ai/tutor.py
- Create: services/api/app/ai/prompts/tutor_v1.md
- Modify: services/api/app/main.py
- Test: services/api/tests/test_tutor_ai.py

**Interfaces:**
- Produces TutorTurn(role: Literal["user", "assistant"], content: str), TutorRequest(turns: list[TutorTurn], tag_labels: list[str]), TutorReply(kind: Literal["answer", "clarification"], message: str), and TutorProvider.respond(request: TutorRequest) -> TutorReply.
- Produces create_app(tutor_provider: TutorProvider | None = None, tutor_provider_factory: Callable[[], TutorProvider] | None = None) injection while preserving existing quiz-provider arguments and behavior.
- The concrete provider uses the existing server-side AISettings and configured default provider/model; it never accepts a browser-supplied API key.

- [x] **Step 1: Write focused failing provider tests**

Test names: test_provider_returns_valid_answer, test_provider_returns_clarification, test_provider_rejects_malformed_result, and test_provider_maps_quota_and_network_failure_to_safe_errors. Use httpx.MockTransport and a fake in-memory key.

- [x] **Step 2: Run the new provider tests and confirm the expected failures**

Run: python -m pytest services/api/tests/test_tutor_ai.py -q
Expected: FAIL because the tutoring contract and adapter do not exist.

- [x] **Step 3: Implement the structured tutoring contract, prompt, adapter, and app injection**

Use a strict discriminated result schema. The prompt asks for a concise explanation when context is enough, otherwise one focused clarification; it uses the learner’s language and returns only the required structured result. Reuse safe provider error types/HTTP handling where practical, without changing QuizProvider.generate_quiz.

- [x] **Step 4: Run provider tests and confirm they pass**

Run: python -m pytest services/api/tests/test_tutor_ai.py -q
Expected: PASS with no network access.

### Task 2: Owner-scoped conversation records, messages, and tag associations

**Files:**
- Create: services/api/app/models/tutor.py
- Create: services/api/app/schemas/tutor.py
- Create: services/api/app/services/tutor_conversations.py
- Modify: services/api/app/models/__init__.py
- Modify: services/api/app/models/tag.py
- Test: services/api/tests/test_tutor_conversations.py

**Interfaces:**
- Produces TutorConversation with user_id, title, status, provider/model identifiers, timestamps, create_request_id, and optional tags. The create_request_id is unique per user so replaying the first request finds the original conversation.
- Produces TutorMessage with conversation_id, ordered sequence, role, kind, content, created_at, and request_id unique within that conversation.
- Produces create_conversation(session, user_id, message, tag_ids, request_id) and get_owned_conversation(session, user_id, conversation_id); tag IDs must be builtin or owned by user_id.

- [x] **Step 1: Write failing model/service tests**

Test names: test_conversation_persists_ordered_messages, test_replayed_create_request_returns_same_conversation, test_message_request_id_is_unique_within_conversation, test_conversation_tags_accept_builtin_or_owned_tags, and test_conversation_rejects_another_users_tag.

- [x] **Step 2: Run the new model/service tests and confirm the expected failures**

Run: python -m pytest services/api/tests/test_tutor_conversations.py -q
Expected: FAIL because tutoring models and service functions do not exist.

- [x] **Step 3: Implement additive SQLAlchemy records and owner-validated tag association**

Register the models with Base.metadata and add the conversation/tag association to the existing Tag relationship. Keep tag creation in the existing tag feature; do not duplicate tag-catalog rules.

- [x] **Step 4: Run model/service tests and confirm they pass**

Run: python -m pytest services/api/tests/test_tutor_conversations.py -q
Expected: PASS against the local test database.

### Task 3: Authenticated conversation API, clarification, resume, and retry

**Files:**
- Create: services/api/app/routers/tutor.py
- Modify: services/api/app/main.py
- Modify: services/api/app/services/tutor_conversations.py
- Test: services/api/tests/test_tutor_api.py

**Interfaces:**
- POST /api/tutor/conversations accepts {message, tag_ids?, request_id} and creates the first turn; the request_id is the conversation’s create_request_id.
- GET /api/tutor/conversations accepts optional q and tag_id; GET /api/tutor/conversations/{conversation_id} returns the owner’s ordered messages.
- POST /api/tutor/conversations/{conversation_id}/messages accepts {message, request_id}; POST /api/tutor/conversations/{conversation_id}/retry retries the retained failed turn.
- Provider failures return safe detail including a conversation_id when one has already been persisted, so the browser can show Retry. Reusing request_id returns/reuses the same learner message instead of inserting another.

- [x] **Step 1: Write failing API tests**

Test names: test_empty_message_returns_422_without_provider_call, test_clarification_reply_uses_same_conversation, test_pending_clarification_survives_reload, test_provider_failure_persists_retryable_message, test_retry_does_not_duplicate_message, test_conversation_search_and_tag_filter_are_owner_scoped, and test_foreign_conversation_returns_404.

- [x] **Step 2: Run the new API tests and confirm the expected failures**

Run: python -m pytest services/api/tests/test_tutor_api.py -q
Expected: FAIL because the tutor routes are not registered.

- [x] **Step 3: Implement the routes and conversation lifecycle**

Require get_current_user and require_same_origin on mutations. Commit the learner message and processing state before the network call. Save only schema-validated assistant turns; set awaiting_clarification, answered, or retryable_error appropriately. Never hold a DB transaction open during the AI request.

- [x] **Step 4: Run the new API tests and confirm they pass**

Run: python -m pytest services/api/tests/test_tutor_api.py -q
Expected: PASS, including provider failure and ownership cases.

### Task 4: Tutor page, history/search, tag reuse, and navigation

**Files:**
- Create: WebApp/src/pages/TutorPage.js
- Modify: WebApp/src/api/client.js
- Modify: WebApp/src/router.js
- Modify: WebApp/src/main.js
- Modify: WebApp/src/components/Navbar.js
- Modify: WebApp/src/styles.css
- Test: WebApp/tests/tutor-page.test.js
- Test: WebApp/tests/api-client.test.js
- Test: WebApp/tests/router.test.js

**Interfaces:**
- Produces listTutorConversations({q, tagId}), getTutorConversation(id), createTutorConversation(payload), sendTutorMessage(id, payload), and retryTutorMessage(id).
- Produces renderTutorPage({loadConversations, loadConversation, createConversation, sendMessage, retryMessage, loadTags, navigate}).
- The authenticated /tutor page shows a new-question entry, conversation history, search/tag filters, current messages, processing/clarification/answered/error states, and resume/retry actions.

- [x] **Step 1: Write failing page, API-client, and route tests**

Test names: test_blank_question_is_not_submitted, test_processing_and_clarification_states_render, test_pending_conversation_can_be_resumed, test_retry_preserves_question_and_request_id, test_tutor_history_filters_by_search_and_tag, and test_tutor_route_requires_login_and_preserves_return_path.

- [x] **Step 2: Run focused WebApp tests and confirm the expected failures**

Run: npm --prefix WebApp test -- tests/tutor-page.test.js tests/api-client.test.js tests/router.test.js
Expected: FAIL because tutor APIs, route, page, and navigation link are not present.

- [x] **Step 3: Implement the page and connect existing shared components**

Use the shared tag catalog/picker and existing theme. Keep the current request ID through retries. Render provider text as text by default; if Markdown is enabled, sanitize rendered output. Add the authenticated navigation link and safe login return target for /tutor.

- [x] **Step 4: Run focused WebApp tests and build**

Run: npm --prefix WebApp test -- tests/tutor-page.test.js tests/api-client.test.js tests/router.test.js
Expected: PASS.

Run: npm --prefix WebApp run build
Expected: production build succeeds.

## Completion checks

- Run: python -m pytest services/api/tests/test_tutor_ai.py services/api/tests/test_tutor_conversations.py services/api/tests/test_tutor_api.py -q
- Run: npm --prefix WebApp test -- tests/tutor-page.test.js tests/api-client.test.js tests/router.test.js
- Run: npm --prefix WebApp run build
- Confirm no files outside the approved worktree changed. Do not commit or push.
