# AI Quiz Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated local API that accepts `.md`, `.txt`, `.docx`, or text-based `.pdf` learning material, generates a validated quiz through a provider interface, and stores quizzes and attempts for their owner.

**Architecture:** Extend the existing FastAPI/SQLAlchemy API with document extractors, quiz models, strict Pydantic schemas, a provider protocol, and authenticated quiz routes. Keep the provider key in the API process only; use a fake provider for tests, and leave the university-specific network adapter disabled until its API contract is supplied. Keep browser UI and all `prototypes/` files out of this plan.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic, SQLite, pytest/httpx, `python-docx`, `pypdf`, `python-dotenv`, Docker Compose v2.24+ (optional `env_file`).

**Spec:** `docs/superpowers/specs/2026-10-11-ai-quiz-generation-design.md`

**Target:** `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06` on branch `codex/home-local-auth`.

## Global Constraints

- Accept `.md`, `.txt`, `.docx`, and text-based `.pdf`; defer `.doc` and OCR for scanned PDFs.
- Maximum raw upload is **20 MB (20,000,000 bytes)**; maximum normalized provider input is **20,000 characters**; reject over-limit content without truncating it.
- Preserve all pre-existing uncommitted work in the local-auth worktree; compare the initial and final Git status rather than treating pre-existing changes as part of this feature.
- Generate **5–20** questions, default **10**; support multiple choice and true/false; each multiple-choice question has exactly four distinct options and one answer.
- Save quiz data and attempts in rows owned by the authenticated `user_id`; do not expand the `users` row for quiz history.
- Do not persist source bytes/full extracted text; do not log source text, prompts, answer keys, or credentials.
- Do not return answer keys until the user submits an attempt; grade objective answers on the server.
- Keep `AI_API_KEY` server-side only; do not assume or implement a university endpoint until its API contract is supplied.
- Tests must use temporary databases and fake providers; no live key or network is required.
- Do not modify `prototypes/`, commit, or push as part of this plan.
- Build the backend first; browser UI is a separate follow-up plan after API acceptance.

## Review Focus

- A raw file may be within 20 MB yet extract to over 20,000 characters: reject before provider invocation without silent truncation. (Task 1 extractor and Task 4 route tests.)
- Markdown normalization could accidentally discard meaningful headings, tables, or code: preserve semantic structure while removing only comments and redundant whitespace. (Task 1 extractor tests.)
- Provider output or source text may contain malformed JSON or prompt-injection instructions: treat source as data and strictly validate all returned fields. (Task 3 schema/provider tests and Task 4 generation tests.)
- A valid quiz ID may belong to another account: every list, read, submit, and history query must enforce `user_id`. (Tasks 5–6 ownership tests.)
- Missing credentials or provider outages must not break sign-up/profile flows or expose answer keys/secret details. (Tasks 3–4 and Task 7 configuration tests.)

---

### Task 1: Document extraction and size limits

**Files:**
- Create: `services/api/app/services/document_extractor.py`
- Create: `services/api/app/services/extractors/__init__.py`
- Create: `services/api/app/services/extractors/markdown.py`
- Create: `services/api/app/services/extractors/plain_text.py`
- Create: `services/api/app/services/extractors/docx.py`
- Create: `services/api/app/services/extractors/pdf.py`
- Create: `services/api/tests/test_document_extractors.py`
- Create: `services/api/tests/fixtures/tiny-text.pdf`
- Modify: `services/api/requirements.txt`

**Interfaces:**
- Produces: `TextLocator(label: str, start: int, end: int)` and `ExtractedDocument(source_type: Literal["md", "txt", "docx", "pdf"], text: str, locators: list[TextLocator])` in `document_extractor.py`.
- Produces: `extract_document(filename: str, content: bytes, content_type: str | None = None) -> ExtractedDocument`.
- Produces: `MAX_UPLOAD_BYTES = 20_000_000` and `MAX_SOURCE_CHARS = 20_000`.
- Produces: `UploadTooLargeError`, `UnsupportedDocumentError`, `InvalidDocumentError`, `EmptyDocumentError`, and `SourceTextTooLongError` so routes can map extractor failures without parsing message strings.
- Consumes: none.

- [x] **Step 1: Write extractor tests** named `test_markdown_decodes_bom_and_normalizes_newlines`, `test_markdown_preserves_headings_tables_lists_and_code_fences`, `test_markdown_removes_html_comments_and_redundant_blank_lines`, `test_markdown_preserves_comment_like_text_inside_code_fence`, `test_txt_decodes_utf8_bom`, `test_docx_extracts_paragraphs_and_table_cells`, `test_pdf_extracts_text_with_page_locator`, `test_rejects_unsupported_doc_extension`, `test_rejects_empty_or_scanned_pdf`, `test_rejects_file_over_20mb_before_parsing`, and `test_rejects_text_over_20000_chars_without_truncation`.
- [x] **Step 2: Run the new tests and confirm they fail** from `services/api/`: `python -m pytest -q tests/test_document_extractors.py`.
- [x] **Step 3: Add bounded parser dependencies** `python-docx>=1.1,<2` and `pypdf>=5,<7` to `services/api/requirements.txt`; implement the exact output types and dispatch by extension. Decode Markdown/TXT as UTF-8 with optional BOM, normalize CRLF, preserve meaningful Markdown structures, remove HTML comments/redundant blank lines, extract DOCX paragraphs and table cells, and return PDF text with page locators. Raise typed extraction errors for unsupported, invalid, empty, oversized, or over-limit input.
- [x] **Step 4: Run `python -m pytest -q tests/test_document_extractors.py`** from `services/api/`; expect all extractor tests to pass, including the 20,000,001-byte and 20,001-character boundary cases.

### Task 2: Quiz database models and response schemas

**Files:**
- Create: `services/api/app/models/quiz.py`
- Create: `services/api/app/schemas/quiz.py`
- Create: `services/api/tests/test_quiz_database.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/main.py`

**Interfaces:**
- Produces: SQLAlchemy `Quiz`, `QuizQuestion`, `QuizAttempt`, and `QuizAnswer` models. `Quiz` stores `user_id`, `title`, `source_filename`, `source_type`, `language`, `difficulty`, `question_count`, `provider`, `model`, `prompt_version`, optional token counts, and `created_at`. `QuizQuestion` stores `quiz_id`, `position`, `kind`, `prompt`, JSON `choices`, server-side `correct_answer`, `explanation`, `evidence`, and optional `source_locator`. `QuizAttempt` stores `quiz_id`, `user_id`, timestamps, `score`, and `total_questions`; `QuizAnswer` stores `attempt_id`, `question_id`, nullable JSON `submitted_answer`, and `is_correct`. Use foreign keys and UTC timestamps.
- Produces: `QuizOptions(question_count: int, language: Literal["th", "en"], difficulty: Literal["basic", "intermediate", "advanced"], question_types: list[Literal["multiple_choice", "true_false"]])`, validating count 5–20 and requiring at least one unique type.
- Produces: Pydantic `QuizQuestionInProgress`, `QuizInProgress`, `QuizQuestionResult`, `QuizAttemptResult`, and `QuizAttemptSummary` schemas. `QuizInProgress` must not contain `correct_answer`.
- Consumes: existing `Base`, `User`, and SQLite session setup.

- [x] **Step 1: Write database/schema tests** named `test_create_app_creates_quiz_tables_without_changing_users`, `test_quiz_and_attempt_rows_reference_user`, and `test_quiz_in_progress_serialization_omits_answer_key`.
- [x] **Step 2: Run `python -m pytest -q tests/test_quiz_database.py`** from `services/api/`; confirm failures identify missing models/schema registration.
- [x] **Step 3: Implement the four additive tables and schemas** with question position unique per quiz and cascaded child-row deletion. Register models in `models/__init__.py` and import them before `Base.metadata.create_all()` in `main.py`; do not add quiz JSON/columns to `User`.
- [x] **Step 4: Re-run `python -m pytest -q tests/test_quiz_database.py tests/test_database.py`** from `services/api/`; expect additive schema and existing database tests to pass.

### Task 3: Provider boundary, AI settings, and versioned prompt

**Files:**
- Create: `services/api/app/ai/__init__.py`
- Create: `services/api/app/ai/config.py`
- Create: `services/api/app/ai/provider.py`
- Create: `services/api/app/ai/prompts/quiz_generation_v1.md`
- Create: `services/api/tests/test_quiz_provider.py`
- Modify: `services/api/requirements.txt`

**Interfaces:**
- Produces: immutable `AISettings(provider: str, base_url: str | None, model: str | None, api_key: str | None, timeout_seconds: float = 30, input_token_budget: int | None = None)` and `AISettings.from_environment(api_dir: Path) -> AISettings`; load `services/api/.env` only when present and never override already-set process environment variables.
- Produces: strict Pydantic `MultipleChoiceQuestion` (`kind: Literal["multiple_choice"]`, four unique `choices`, `correct_answer: StrictInt`) and `TrueFalseQuestion` (`kind: Literal["true_false"]`, `correct_answer: StrictBool`) variants; `GeneratedQuestion = Annotated[MultipleChoiceQuestion | TrueFalseQuestion, Field(discriminator="kind")]`; `GeneratedQuiz(title: str, questions: list[GeneratedQuestion])`; `InsufficientMaterial(status: Literal["insufficient_material"], message: str)`; and `ProviderResponse = GeneratedQuiz | InsufficientMaterial`. All models use `extra="forbid"`.
- Produces: `ProviderRequest(system_prompt: str, source_text: str, source_type: str, options: QuizOptions, prompt_version: str, max_input_tokens: int | None, repair_errors: tuple[str, ...] = ())` and `QuizProvider` protocol with `async generate_quiz(request: ProviderRequest) -> str` returning raw JSON text.
- Produces: `parse_provider_response(raw_json: str) -> ProviderResponse` using strict Pydantic validation.
- Produces: `build_prompt(source: ExtractedDocument, options: QuizOptions, *, max_input_tokens: int | None = None) -> ProviderRequest` and `UnavailableQuizProvider.generate_quiz(...)`, which raises `ProviderNotConfigured` without network access.
- Produces: `build_provider(settings: AISettings) -> QuizProvider`; return `UnavailableQuizProvider` until a supported provider adapter is implemented, even if a key is present.
- Consumes: Task 1 `ExtractedDocument` and Task 2 `QuizOptions`.

- [x] **Step 1: Write tests** named `test_settings_read_api_env_without_overriding_process_values`, `test_missing_key_keeps_provider_unconfigured`, `test_provider_stays_disabled_until_adapter_exists`, `test_prompt_marks_uploaded_text_as_untrusted_data`, `test_prompt_requests_exact_count_and_json_only`, `test_prompt_carries_optional_input_token_budget`, `test_generated_quiz_rejects_extra_fields`, `test_generated_quiz_requires_four_unique_choices`, `test_generated_quiz_rejects_invalid_answer_index`, and `test_insufficient_material_has_structured_response`.
- [x] **Step 2: Run `python -m pytest -q tests/test_quiz_provider.py`** from `services/api/`; confirm expected failures.
- [x] **Step 3: Add `python-dotenv`** and implement settings, provider protocol, strict raw-JSON parsing, and the concise versioned prompt. The prompt must request only source-grounded questions, evidence, explanation, selected language/difficulty, exact question count, and either the quiz JSON shape or `{"status":"insufficient_material","message":"..."}`; source text must never be treated as instructions. Do not add a live university adapter until its request/auth/response contract is provided.
- [x] **Step 4: Run `python -m pytest -q tests/test_quiz_provider.py`** from `services/api/`; expect all schema and configuration tests to pass with no key or network.

### Task 4: Generate-and-save API flow

**Files:**
- Create: `services/api/app/services/quiz_generator.py`
- Create: `services/api/app/routers/quizzes.py`
- Create: `services/api/tests/test_quiz_generation.py`
- Modify: `services/api/app/main.py`

**Interfaces:**
- Produces: `async generate_and_save_quiz(session: Session, user: User, source: ExtractedDocument, options: QuizOptions, provider: QuizProvider, *, input_token_budget: int | None = None) -> Quiz`.
- Produces: `POST /api/quizzes/generate` using multipart fields `file`, `question_count`, `language`, `difficulty`, and repeated `question_types`.
- Produces: `async read_upload_limited(upload: UploadFile, max_bytes: int = MAX_UPLOAD_BYTES) -> bytes`, reading bounded chunks and raising `UploadTooLargeError` immediately when the cumulative byte count exceeds the limit; a pre-routing ASGI guard authenticates and validates origin before multipart parsing and caps the streamed request at the file limit plus a bounded multipart allowance.
- Produces: `create_app(..., quiz_provider: QuizProvider | None = None, ai_settings: AISettings | None = None)`; save settings/provider at `app.state.ai_settings` and `app.state.quiz_provider`. If the caller injects no provider, build one from settings, which is unconfigured in v1.
- Consumes: Tasks 1–3 and existing `get_db`, `get_current_user`, and `require_same_origin` dependencies.

- [x] **Step 1: Write route tests** named `test_generate_requires_authenticated_same_origin_request`, `test_generate_validates_options_and_supported_file`, `test_generate_uses_normalized_markdown_and_selected_options`, `test_generate_saves_quiz_and_questions_for_current_user`, `test_generate_response_never_contains_answer_key`, `test_generate_rejects_extracted_text_over_limit_without_provider_call`, `test_generate_stops_reading_after_20mb_plus_one_byte`, `test_generate_returns_503_when_provider_is_unconfigured`, `test_insufficient_material_returns_422_without_saving`, `test_malformed_provider_json_retries_once_then_fails_without_saving`, `test_provider_failure_saves_no_partial_quiz`, and `test_provider_error_response_is_sanitized`.
- [x] **Step 2: Run `python -m pytest -q tests/test_quiz_generation.py`** from `services/api/`; confirm failures before implementation.
- [x] **Step 3: Implement the generator and authenticated endpoint.** Reject cross-origin and unauthenticated requests before multipart parsing, and cap streamed request bytes at the file limit plus bounded multipart overhead. Then read `UploadFile` in bounded chunks and stop as soon as the file size exceeds `MAX_UPLOAD_BYTES`; validate extension and content plausibility rather than trusting the filename/MIME header; extract, build the prompt with `app.state.ai_settings.input_token_budget`, call the provider, and parse the returned JSON. On one parse/schema failure only, retry once with the validation messages in `ProviderRequest.repair_errors`; never retry provider timeouts or file-validation failures. Before saving, require exact question count and only requested kinds. Save quiz/questions in one transaction only after a valid `GeneratedQuiz`. Map `InsufficientMaterial` to `422`; map other errors to the spec’s `401`, `413`, `415`, `422`, `503`, and sanitized `502` responses.
- [x] **Step 4: Run `python -m pytest -q tests/test_quiz_generation.py tests/test_auth.py tests/test_profile.py`** from `services/api/`; expect generation, authentication, and profile tests to pass.

### Task 5: Owner-scoped quiz library

**Files:**
- Modify: `services/api/app/routers/quizzes.py`
- Modify: `services/api/app/schemas/quiz.py`
- Create: `services/api/tests/test_quiz_library.py`

**Interfaces:**
- Produces: `QuizSummary(id: int, title: str, source_type: str, language: str, difficulty: str, question_count: int, created_at: datetime)` and `GET /api/quizzes?limit=20&offset=0 -> list[QuizSummary]` for the current owner, newest first; validate `1 <= limit <= 100` and `offset >= 0`.
- Produces: `GET /api/quizzes/{quiz_id} -> QuizInProgress` for the owner; no correct answers.
- Consumes: Task 2 schemas/models and Task 4 router/auth setup.

- [x] **Step 1: Write tests** named `test_list_returns_only_current_users_quizzes`, `test_list_orders_newest_first`, `test_read_returns_owner_quiz_without_answer_key`, `test_read_other_users_quiz_is_not_found`, and `test_read_unknown_quiz_is_not_found`.
- [x] **Step 2: Run `python -m pytest -q tests/test_quiz_library.py`** from `services/api/`; confirm failures.
- [x] **Step 3: Implement the two owner-scoped read endpoints** with all DB queries filtered by the authenticated `user.id`; use the same non-disclosing `404` for missing and non-owned quiz IDs.
- [x] **Step 4: Run `python -m pytest -q tests/test_quiz_library.py tests/test_quiz_generation.py`** from `services/api/`; expect both endpoint groups to pass.

### Task 6: Objective grading and attempt history

**Files:**
- Create: `services/api/app/services/quiz_grader.py`
- Modify: `services/api/app/routers/quizzes.py`
- Modify: `services/api/app/schemas/quiz.py`
- Create: `services/api/tests/test_quiz_grading.py`
- Create: `services/api/tests/test_quiz_attempts.py`

**Interfaces:**
- Produces: `SubmittedAnswer(question_id: int, selected_choice_index: StrictInt | None = None, selected_boolean: StrictBool | None = None)` with validation that exactly one answer value is present.
- Produces: `QuestionGrade(question_id: int, is_correct: bool, correct_answer: int | bool, explanation: str, evidence: str)` and `GradingResult(score: int, total_questions: int, questions: list[QuestionGrade])`.
- Produces: `grade_answers(questions: Sequence[QuizQuestion], submitted: Sequence[SubmittedAnswer]) -> GradingResult`; reject duplicate/unknown IDs, treat omitted answers as unanswered and incorrect, and persist one answer row per question.
- Produces: `POST /api/quizzes/{quiz_id}/attempts -> QuizAttemptResult` and `GET /api/quizzes/{quiz_id}/attempts -> list[QuizAttemptSummary]`.
- Consumes: Task 2 models/schemas and Task 5 owner-scoped lookup behavior.

- [x] **Step 1: Write grader tests** named `test_grade_multiple_choice_by_option_index`, `test_grade_true_false_by_boolean`, `test_reject_wrong_answer_value_type`, `test_reject_duplicate_or_foreign_question_ids`, `test_unanswered_questions_are_marked_incorrect`, and `test_score_is_count_of_correct_answers`.
- [x] **Step 2: Write route tests** named `test_submit_saves_attempt_for_owner_and_reveals_results`, `test_submit_other_users_quiz_is_not_found`, `test_attempt_history_is_owner_scoped_and_newest_first`, and `test_invalid_submission_saves_no_attempt`.
- [x] **Step 3: Run `python -m pytest -q tests/test_quiz_grading.py tests/test_quiz_attempts.py`** from `services/api/`; confirm failures.
- [x] **Step 4: Implement deterministic grading and the two attempt endpoints.** Validate the submitted question set and answer type against stored question kinds, reject malformed/duplicate/foreign IDs, save the attempt and all answers atomically, and reveal answer/explanation/evidence only in the submitted result.
- [x] **Step 5: Run `python -m pytest -q tests/test_quiz_grading.py tests/test_quiz_attempts.py tests/test_quiz_library.py`** from `services/api/`; expect grading, result reveal, and ownership tests to pass.

### Task 7: Local secret configuration and final backend verification

**Files:**
- Create: `services/api/.env.example`
- Create: `docs/ai-quiz-local-api.md`
- Modify: `compose.webapp.yml`
- Verify: `.gitignore` ignores `services/api/.env`; change only if its existing pattern does not.

**Interfaces:**
- Produces: documented local API settings `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`; `.env.example` contains placeholders only.
- Produces: Docker Compose passes AI settings to the `api` service only; the `webapp` receives no key.
- Consumes: Task 3 `AISettings` and Task 4 provider injection/default behavior.

- [x] **Step 1: Add `.env.example` with empty/placeholding values for `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`, `AI_TIMEOUT_SECONDS=30`, and optional `AI_MAX_INPUT_TOKENS`.** Configure Compose to load the tracked `services/api/.env.example` first and optional ignored `services/api/.env` second into the API container only, with the latter overriding placeholders. The 20,000-character limit remains the v1 enforcement available before a provider-specific token estimator exists. Do not copy secrets into Docker build layers, frontend env, or client code. Document local setup, expected provider-unconfigured behavior, endpoints, supported formats/limits, and that the university adapter is pending its API documentation. Verify `git check-ignore services/api/.env` from repository root.
- [x] **Step 2: Validate Compose configuration** from repository root with `docker compose -f compose.webapp.yml config -q`; expect exit code `0`. Inspect `docker compose -f compose.webapp.yml config` to confirm AI settings appear only under `api`, never `webapp`.
- [x] **Step 3: Run all API tests** from `services/api/`: `python -m pytest -q`; expect existing health/auth/profile tests and all quiz tests to pass without a real key or network.
- [x] **Step 4: Review final scope** with `git status --short`; compare against the initial status, preserve all pre-existing changes, confirm only this plan's new changes are within the listed backend/config/docs paths, and confirm there are no new changes under `prototypes/`. Do not commit or push.

## Deferred after this plan

- Implement the concrete university AI adapter after the endpoint, authentication, quotas, and response schema are provided.
- Connect browser pages to the new API in a separate UI plan after the backend tests and local API behavior are accepted.
- Add large-document chunking only if the 20,000-character source cap proves insufficient; the 20 MB upload limit alone does not authorize sending the whole file to AI.
