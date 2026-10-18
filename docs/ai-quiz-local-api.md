# Local AI quiz API

This document describes the local backend for generating, saving, and grading quizzes from a user's study file. The browser calls this application's API; the server calls the university's UP AI Connect gateway so the secret key never reaches browser code.

## Provider connection status

The API now has an OpenAI-compatible `/chat/completions` adapter for UP AI Connect. It sends the selected model, system prompt, quiz options, and extracted study text to the gateway, then validates the returned JSON before saving anything. Malformed responses receive at most one repair request. No quiz is saved if the provider call fails or its response cannot be validated.

The endpoint and request format were taken from the supplied UP AI Connect API Platform screenshots:

- Base URL: `https://gen.ai.kku.ac.th/upacth/api/v1`
- Request path: `/chat/completions`
- Authentication: `Authorization: Bearer <API key>`
- Streaming: disabled (`stream: false`)

The API key shown in the screenshot is masked, so this implementation has not made a live provider call. Add the actual key locally to `services/api/.env` before trying live generation. Until then, generation returns `503` with a setup message. Never put the key in `WebApp/.env`, browser code, a profile, a prompt, a screenshot, or a commit. The tracked `services/api/.env.example` intentionally has an empty key; `.gitignore` ignores the real `.env` file.

UP AI Connect provides one gateway key for the listed provider/model catalog. The selected provider/model pair is sent as the model name through that gateway. If the gateway says the selected provider has exhausted quota or rate limits, the API returns `429` naming that provider and asking the user to choose another. It does not switch providers automatically, and the failed quiz is not saved.

For Docker Compose, the API service reads `.env.example` first and the optional local `.env` second. The `webapp` service does not receive AI settings or credentials. Locally, `AISettings` reads `services/api/.env` without overwriting variables already set in the API process.

## Local setup

1. Copy `services/api/.env.example` to `services/api/.env` if it does not already exist. Keep the real key only in this ignored local file; leave it blank until you have copied the key from the UP AI Connect API Platform.
2. Run the API with Python 3.12 and install `services/api/requirements.txt`, or start it through `docker compose -f compose.webapp.yml up --build` from the repository root.
3. The API uses SQLite under `.local/` by default (or under the configured `SYNAPSESYNC_DATA_DIR`). Quiz records and attempts are stored in additive tables and associated with the signed-in user's ID.
4. A valid authenticated session and same-origin request are required for generation and submission. The browser should call this application API; it must never call the AI provider directly.

## Supported files and limits

- `.md`, `.txt`, `.docx`, and text-based `.pdf` are supported.
- Legacy `.doc` and scanned/image-only PDFs are not supported in this version; OCR is deferred.
- Raw upload limit: **20,000,000 bytes (20 MB)**.
- Multipart request ingestion is capped at the upload limit plus **64 KiB** for form boundaries and fields; unauthenticated or cross-origin requests are rejected before the upload body is parsed.
- Normalized text limit sent to a future provider: **20,000 characters**. A file can fit the byte limit and still exceed this text limit; it is rejected rather than silently truncated.
- Question count: **5–20**, default **10**; languages are Thai/English and difficulty is basic/intermediate/advanced.
- Supported question kinds are multiple choice and true/false. Multiple choice has four distinct options.

## Endpoints

All quiz endpoints require the existing authenticated session and scope data to that user.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/quizzes/providers` | Returns the allowed provider/model catalog for the authenticated user. |
| `POST` | `/api/quizzes/generate` | Multipart fields `file`, `question_count`, `language`, `difficulty`, repeated `question_types`, and optional `provider` + `model`. Returns a quiz-taking view with no answer keys. A missing key returns `503`; exhausted quota/rate limit returns `429` with the selected provider name. |
| `GET` | `/api/quizzes?limit=20&offset=0` | Lists the current user's quizzes newest first (`limit` 1–100). |
| `GET` | `/api/quizzes/{quiz_id}` | Returns the owner's quiz without correct answers. Other users' IDs return the same `404` as unknown IDs. |
| `POST` | `/api/quizzes/{quiz_id}/attempts` | Submits objective answers; omitted questions count as incorrect. Returns score, correct answers, explanations, and evidence after submission. |
| `GET` | `/api/quizzes/{quiz_id}/attempts` | Lists the owner's attempt summaries newest first. |

The generation response is strictly validated. Malformed output receives at most one repair attempt; no quiz is saved unless the full response passes validation. Source bytes and full extracted text are not stored in this app's database. With a configured key, the extracted text is sent to UP AI Connect for generation, so do not upload sensitive material unless you are permitted to share it with that service.

## Configuration reference

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | Adapter/gateway name. Use `university` for UP AI Connect. |
| `AI_BASE_URL` | Gateway base URL. The current value is `https://gen.ai.kku.ac.th/upacth/api/v1`. |
| `AI_MODEL` | Default model for requests that do not specify a model. Defaults to `gemini-2.5-flash-lite`. |
| `AI_API_KEY` | Server-only UP AI Connect credential. Blank in the template; add the real key only to the ignored local `.env`. |
| `AI_TIMEOUT_SECONDS` | Request timeout in seconds (default `30`). |
| `AI_MAX_INPUT_TOKENS` | Optional provider-specific token budget. The local source-text guard is 20,000 characters. |

## Local behavior and limitations

- Provider/model options are a server-side allowlist based on the supplied portal screenshot; generation rejects unknown or mismatched pairs.
- Provider and model are selected per generation request and saved as quiz metadata when a quiz is successfully created.
- The error response never includes the raw provider response, uploaded study text, or API key.
- Quota handling is based on the gateway's error response. The current screenshots show daily token quotas but not an authenticated quota-query endpoint, so the API cannot display a reliable remaining-token count yet.
- The API has not been live-tested because no unmasked key was provided. Use the mock-based provider tests to verify request construction and quota failure handling until a local key is configured.
- Public deployment still requires a separate review of secrets, data handling, and the university service's deployment terms.
