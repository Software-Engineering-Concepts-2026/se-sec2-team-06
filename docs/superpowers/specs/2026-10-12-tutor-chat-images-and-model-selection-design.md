# Tutor Chat Model Selection, Response Language and Image Attachments — Design Specification

**Status:** Approved for implementation.
**Date:** 2026-10-12
**Scope:** Extend the existing authenticated learner Tutor with per-message provider/model and response-language selection, plus image attachments.

## 1. Purpose

Make Tutor feel like a familiar AI chat: learners can choose the provider, model, and answer language for each message, ask about an image, scroll through conversation history, and return to uploaded images later. Thai is the default answer language, with English available. The feature must preserve the current Tutor's clarification, retry, tagging, and conversation-history behavior.

This is an additive extension to `2026-10-12-student-ai-tutoring-and-progress-design.md`. It supersedes that document's earlier exclusion of image attachments for this Tutor experience only. It does not change quiz generation, quiz attempts, or Progress.

## 2. Existing context and constraints

- Implementation target: `C:/Users/Admin/.codex/worktrees/synapsesync-local-auth/se-sec2-team-06`, branch `codex/home-local-auth`.
- Do not modify `D:/Project SE Sce 2/se-sec2-team-06`, prototypes, or unrelated worktree changes.
- Do not commit or push without a separate user request.
- The app uses FastAPI, SQLAlchemy, SQLite for local use, an authenticated WebApp, and an OpenAI-compatible UP AI Connect endpoint.
- The quiz feature already exposes a shared provider/model catalog. Tutor currently uses a server-configured default model and persists text-only turns.
- Provider names in this feature identify models routed through the same UP AI Connect endpoint and server-side API key; they do not require separate browser keys or provider credentials.
- Preserve all existing conversation history and owner checks. No live provider key is required for automated tests.

## 3. Goals

1. Provide a familiar, responsive Tutor chat with a scrollable message history and a composer fixed at the bottom of the conversation area.
2. Let the learner select a provider/model for each user message and show which model produced each answer.
3. Let the learner choose Thai or English for the next answer, default to Thai, and keep the choice with each message and answer.
4. Let the learner attach images to a message, preview/remove them before sending, and view them later in the conversation history.
5. Forward only images explicitly attached or re-selected from history for the current message, avoiding silent repeated image-token use on every follow-up.
6. Preserve a learner message and its attachments when the provider fails, and allow retry with the same or a manually selected different provider/model/language.
7. Keep provider credentials server-side and attachment reads owner-scoped.

## 4. Out of scope

- Teacher roles, classes, teacher dashboards, and group-level analytics.
- Changes to quiz generation, quiz grading, quiz attempts, or Progress.
- Automatically switching provider/model when quota is full or a call fails.
- Separate API credentials for each provider, exposing keys in the browser, or adding provider billing.
- Voice, video, public sharing, cloud/object storage, streaming answers, or arbitrary document uploads to Tutor.
- Repeatedly sending every historical image with each follow-up.

## 5. Learner experience

### 5.1 Chat layout and controls

- Keep the shared navbar, current theme, Tutor route, and conversation history/search/tag behavior.
- On desktop, show the conversation list in a side panel and the selected chat in the main panel. On narrow screens, allow the history panel to collapse so the chat remains usable.
- Keep messages in a vertically scrollable conversation area. Keep the composer anchored to the bottom of that area; it must not create a second page-level horizontal scrollbar.
- Place provider, model, and response-language selectors next to the composer. Changing a selector applies to the next user message, not earlier turns. Restore the last used selection when reopening an existing conversation; for a new conversation, use the server-configured provider/model and Thai as the response-language default.
- Response language options are Thai (default) and English. Apply the selected language to answers and clarification questions regardless of the language used in the learner's message. Store it on the learner and assistant messages; a retry keeps the stored language unless the learner changes it.
- Allow the text composer to grow to a bounded height, support Enter to send and Shift+Enter for a newline, and show a clear sending/processing state.
- Provide an attach-image control, image thumbnails, filename or accessible description, and a remove control before sending. New images and images re-selected from the current conversation are attached to the next message.
- Show each assistant answer's provider/model label. Keep the prior answers and their labels unchanged when the selection changes.
- When viewing an older message, do not force-scroll the reader to the bottom. After a new send/answer, scroll to the new turn if the learner was already at the bottom.

### 5.2 Image constraints and context

- Accept JPEG, PNG, and WebP images only.
- Allow at most 3 images per user message, 5 MiB per image, and 15 MiB total for the message's image payload.
- Show a clear validation message for unsupported type, too many files, or size limits; do not send invalid files.
- Store an uploaded image in the conversation history. A later follow-up includes no old image by default. To ask a follow-up about an old image, the learner explicitly selects/references that image from the history; the existing file is reused rather than uploaded a second time.
- Explain near the attachment control that an attached/referenced image is sent to UP AI Connect for analysis.
- When the current message has images, only offer models explicitly marked image-capable by the server's shared model catalog. Do not infer image capability from a model name. Unknown models are treated as not image-capable until verified against UP AI Connect documentation or a controlled provider check.
- If no confirmed image-capable model is available, keep the selected image and text in the composer/history as applicable, explain the limitation, and do not silently send it to a text-only model.

### 5.3 Provider quota and errors

- If the selected provider is quota-limited, identify that provider and ask the learner to choose another provider/model or retry later. Never switch automatically.
- If the provider is unavailable, image processing is rejected, or an unexpected response occurs, retain the user message and its attachments with a retryable state. Preserve the learner's text and files across navigation/reload.
- Retry must not create a duplicate user message. The learner may retry with the same selection or change provider/model first.
- Keep safe actionable errors in Thai; never expose API keys, raw provider error bodies, or internal paths.

## 6. API and data design

### 6.1 Shared model catalog

- Keep one server-side catalog as the source of truth for quiz and Tutor provider/model options.
- Add an authenticated shared catalog route, e.g. `GET /api/ai/providers`, with provider ID/name and model ID/name plus a boolean image-capability field.
- Keep the existing quiz catalog route compatible by delegating to the same catalog/service; do not change quiz-generation behavior.
- Populate image-capability metadata only for models confirmed to accept the image payload format through UP AI Connect. The server validates provider/model pairs and image capability even if the browser sends a forged selection.
- Use the configured UP AI Connect base URL, API key, timeout, and token settings from server environment. No browser key field or provider-specific secret is added.

### 6.2 Tutor message selection and provider request

- Extend new-conversation, send-message, and retry operations with `provider_id` and `model_id`. Existing saved configuration is the default when the learner has not chosen a pair.
- Accept `response_language` (`th` or `en`) on each new user turn; default missing values to Thai. Use it in the Tutor system prompt so answers and clarifying questions follow the selected language even when the learner writes in another language.
- Validate each provider/model pair against the shared catalog before storing or calling the provider.
- Store the selected pair and response language on the learner turn and the actual pair plus language used on the resulting assistant turn. The conversation-level provider/model fields may continue to represent the most recently selected/used pair; message-level values are authoritative for historical answers.
- Keep text-only request compatibility. Image-bearing requests carry upload data or authorized attachment IDs through the authenticated Tutor API; do not accept untrusted public URLs or client-supplied data URLs as stored attachments.
- Adapt the Tutor provider contract to create the OpenAI-compatible multimodal message shape for the selected model. Text turns remain in conversation context; image bytes are included only for image attachments explicitly associated with the current learner turn.
- Validate structured Tutor answers as before. A provider response that fails validation is treated as retryable and must not overwrite the original user turn.

### 6.3 Attachment storage and access

- Store image bytes under a dedicated private local directory such as `.local/tutor-attachments/`, using random server-generated storage keys. Do not store image bytes in SQLite or expose the directory through static web hosting.
- Add attachment metadata tied to the owning user and Tutor conversation: opaque ID/storage key, original filename, validated MIME type, byte size, and creation time. Use a message-to-attachment association so a previously stored image can be explicitly referenced by a later user turn without duplicating the file.
- Serve image previews through an authenticated API route that checks the current user's ownership of both conversation and attachment. A guessed attachment ID must not reveal another user's image; return a non-disclosing 404 on missing or unowned records.
- Validate file count, total request size, file size, extension, declared content type, and actual file signature on the server. Generate storage names rather than using the user filename as a path. Reject invalid files before they reach the provider.
- Link a previously stored attachment to a later user turn only after verifying that it belongs to the same user and conversation.
- Any existing or future conversation cleanup path must remove associated attachment metadata and files. Handle partial writes/provider failures without leaving untracked files; orphan cleanup must be deterministic and testable.

### 6.4 Persistence and migration

- Add a non-destructive SQLite migration for message-level provider/model and response-language metadata plus attachment metadata/relationships. Existing messages receive Thai as the response-language default; preserve existing conversations and messages.
- Existing messages without model metadata remain readable and display without a model label; do not invent historical provider/model values.
- Persist the learner turn and uploaded attachment metadata/file before making the external provider call. Mark the turn/conversation processing, then release the database transaction before network I/O.
- On success, persist the validated assistant reply and actual provider/model. On failure, persist retryable state and safe error classification while retaining the same user turn and attachments.
- Ensure retries claim one failed turn at a time, do not duplicate turns, and preserve idempotency behavior.

## 7. Privacy and authorization

- Tutor text and images are private to the authenticated owner. Every attachment upload, reference, read, and retry is authenticated, same-origin checked for mutations, and owner-scoped on the server.
- Images are stored locally in the application's private data directory, but an attached/referenced image leaves the local app when it is sent to UP AI Connect. Make this clear in the UI.
- API keys, filesystem paths, raw provider exceptions, and other users' attachment metadata are never returned to the browser.
- Do not send unrelated profile fields, conversations, quiz answer keys, or historical images that were not explicitly re-selected for the current message.

## 8. Focused verification plan

### API

- Shared catalog returns provider/model pairs and capability flags; existing quiz catalog remains unchanged in shape/behavior.
- Invalid provider/model pairs are rejected before the provider call. An image sent to a non-image-capable model is rejected safely.
- Valid image input is signature/type/size/count checked, stored privately, linked to a user turn, and converted into the expected multimodal provider request.
- An owner can view their image; another account cannot read, reference, or retry with it.
- Quota-full/provider failure retains one user turn and its image; retrying with an alternate selection reuses the same turn without duplicate messages or file records.
- Existing text-only Tutor conversation, clarification, search/tag, and retry tests continue to pass after migration.
- Thai is the default response language; English selection is applied to provider prompts, persisted with both messages, restored on reopen, and preserved or explicitly changed on retry.
- Migration preserves older conversations and leaves legacy model metadata absent.

### WebApp

- Provider selection updates the model options; selection is used on the next message and the answer displays its model label.
- Image attach, preview, remove, count/size/type validation, and history image reference work without sending historical images implicitly.
- The chat scroll area and bottom composer behave correctly at desktop and narrow widths; older-message browsing is not interrupted by auto-scroll.
- Quota, unavailable-provider, and unsupported-image-model states preserve text/images and offer a manual retry/model change.
- Run focused API and Tutor UI tests plus the production build for changed areas. Use fake providers and synthetic image fixtures; no real key or live AI request is required.

## 9. Acceptance criteria

1. An authenticated learner can choose a provider/model for each new message; the answer records and displays the model actually used.
2. A learner can attach up to 3 valid images (JPEG/PNG/WebP, 5 MiB each), preview and remove them, then send the remaining selection with a text question.
3. The image and associated message remain in the conversation history after success, provider error, reload, and retry.
4. The learner can explicitly reference a prior image in the same conversation; historical images are not forwarded automatically.
5. Only confirmed image-capable models can receive image turns; unavailable/unknown capability produces a clear recoverable UI state.
6. Provider quota errors identify the selected provider and never trigger automatic fallback.
7. Attachment reads are private and owner-scoped, and legacy text-only Tutor data remains intact after migration.
8. The chat is usable on desktop and mobile, keeps the composer reachable, and avoids introducing extra horizontal page scrolling.
9. The learner can choose Thai (default) or English; answers, clarifications, history, and retry use the selected language for that turn.

## 10. Review gate

This document records the approved conversational design. A separate implementation plan is maintained alongside it. Do not commit or push unless separately requested.
