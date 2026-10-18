# Document Library and Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, persistent document library with reusable tags, search, and a reader that resumes where the owner stopped.

**Architecture:** The FastAPI service stores document metadata, extracted reading text, a separately bounded search index, tags, and reading progress in SQLite, while original bytes live in a private local data directory under opaque generated keys. Authenticated API operations enforce owner scope and reuse the existing subject/topic tag catalog. The vanilla-JavaScript WebApp adds authenticated library and reader routes, uses the shared theme tokens, renders PDFs in-app, and displays stored extracted text for Markdown, TXT, and DOCX.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, SQLite, pytest/httpx; JavaScript ES modules, Vite, Vitest; PDF.js for PDF viewing; `marked` plus DOMPurify for safe Markdown rendering.

**Spec:** `docs/superpowers/specs/2026-10-11-document-library-and-reader-design.md`

## Global Constraints

- Supported file formats: PDF, DOCX, Markdown (`.md`), and plain text (`.txt`). Each file is limited to 20 MB.
- Store original files persistently in the API's local application data directory and store document metadata in SQLite.
- Keep documents private to their owner. All list, metadata, content, progress, tag, and delete operations must scope by the authenticated user's ID.
- Reuse the existing tag catalog; do not create a separate document-tag taxonomy.
- Use the shared theme manager and theme tokens on both pages; do not add a page-specific palette.
- Scanned/image-only PDFs may be opened and viewed, but their embedded text cannot be searched; OCR is excluded.
- AI, highlights, annotations, sharing, collaboration, legacy `.doc`, PowerPoint (`.ppt`/`.pptx`), and image uploads are excluded.
- Do not modify `D:\Project SE Sce 2\se-sec2-team-06`; work only in the existing isolated worktree.
- Do not commit or push; the user has not authorized either action.

## Review Focus

- A malicious filename, mismatched MIME type, or active-content upload must never become a filesystem path or execute in the reader. Test with traversal names, mismatched signatures, and HTML payloads in Task 1.
- Crafted compressed DOCX/PDF input must not cause unbounded extraction work. Enforce parser-level output/page/expanded-content limits, clean staged bytes on failure, and test a DOCX expansion-limit case in Task 1.
- An oversized upload must be rejected while streaming, with no partial metadata row or orphaned file. Test the exact 20 MB boundary and one byte over in Task 2.
- A second signed-in user must not discover a document, content, progress, or custom tag by guessing its ID. Exercise each operation as another owner in Task 2.
- A corrupt file must fail cleanly, while an image-only PDF remains viewable and reports unavailable text search. Cover both cases in Task 1 and the reader API in Task 2.
- A stale or malformed reading position must not break the viewer or move it outside the document. Test invalid page/scroll values in Task 2 and restore behavior in Task 5.

---

## File Map

### API

- Create `services/api/app/models/document.py` for the document entity, document/tag association, and reading-position fields.
- Modify `services/api/app/models/tag.py` to expose the reverse document relationship without changing existing quiz-tag behavior.
- Modify `services/api/app/models/__init__.py` and `services/api/app/main.py` to register document tables, configure the private document storage directory, and include the router.
- Create `services/api/app/storage/documents.py` for bounded streaming into private staging files, opaque-key promotion, safe reads, cleanup, and deletion.
- Create `services/api/app/services/document_library.py` for document-text extraction/indexing that is separate from quiz generation's 20,000-character limit.
- Create `services/api/app/schemas/document.py` for list/detail/tag/progress request and response schemas.
- Modify `services/api/app/tags/service.py` to validate document-tag assignments against the same built-in-subject and owner-owned-topic rules as quiz tags.
- Create `services/api/app/routers/documents.py` for authenticated upload, list/search, metadata/content, tag/title update, reading-progress, and delete operations.
- Create `services/api/tests/test_document_storage.py`, `test_document_service.py`, and `test_documents_api.py` for validation, extraction, persistence, authorization, and API behavior.

### WebApp

- Modify `WebApp/src/api/client.js` with typed-by-convention document API helpers matching the endpoints in Task 2.
- Modify `WebApp/src/router.js` and `WebApp/src/main.js` to resolve authenticated library/reader routes and render the corresponding pages.
- Modify `WebApp/src/components/Navbar.js` to show “คลังเอกสาร” for signed-in users.
- Create `WebApp/src/pages/DocumentsPage.js` for upload, tag assignment, search/filter, cards, rename, and delete.
- Create `WebApp/src/pages/DocumentReaderPage.js` for the reader shell, document actions, progress persistence, and format-specific content.
- Create `WebApp/src/documents/markdown-reader.js` for safe Markdown rendering.
- Create `WebApp/src/documents/pdf-viewer.js` for page rendering/navigation/zoom with PDF.js and restore/progress callbacks.
- Modify `WebApp/src/styles.css` to style both pages using only shared theme tokens and responsive/accessibility states.
- Modify `WebApp/package.json` and `package-lock.json` for `pdfjs-dist`, `marked`, and `dompurify`.
- Create `WebApp/tests/documents-page.test.js`, `document-reader-page.test.js`, `document-viewers.test.js`, and extend `router.test.js` and `api-client.test.js`.

## Task 1: Document Model, Safe Storage, and Extraction

**Files:**
- Create: `services/api/app/models/document.py`
- Modify: `services/api/app/models/tag.py`
- Modify: `services/api/app/models/__init__.py`
- Modify: `services/api/app/main.py`
- Create: `services/api/app/storage/documents.py`
- Create: `services/api/app/services/document_library.py`
- Test: `services/api/tests/test_document_storage.py`
- Test: `services/api/tests/test_document_service.py`

**Interfaces:**
- Produces `Document` with `id`, `user_id`, `title`, `original_filename`, `file_type`, `size_bytes`, `storage_key`, `extracted_text`, `extracted_text_truncated`, `search_text`, `search_text_truncated`, `created_at`, `updated_at`, `last_page`, and `scroll_ratio` fields; `tags` relates to the existing `Tag` model.
- Produces `stage_document(chunks: Iterable[bytes], filename: str, staging_dir: Path, max_bytes: int = 20_000_000) -> StagedDocument`, `promote_document(staged: StagedDocument, storage_dir: Path) -> str`, `discard_staged_document(staged: StagedDocument) -> None`, `read_document(storage_key: str, storage_dir: Path) -> bytes`, and `delete_document_file(storage_key: str, storage_dir: Path) -> None`. Staging must use generated temporary names, enforce the byte limit as chunks arrive, and clean up on every failure.
- Produces `extract_library_text(filename: str, content: bytes) -> LibraryExtraction`, where `LibraryExtraction` contains the supported `file_type`, extracted reading text (bounded at 2,000,000 characters with an explicit truncation flag), a separate search index (bounded at 500,000 characters, flagged truncated when either limit truncates it), and whether a PDF has no extractable text. Enforce limits during parsing where possible, not only after constructing an unbounded string. Keep this extraction path independent of the quiz-generation 20,000-character token limit. A valid image-only PDF is accepted for viewing even when extracted text is empty; reject zero-byte files and files with no readable text except image-only PDFs.

- [ ] **Step 1: Write failing storage and extraction tests.** Test all four supported extensions, signature validation for PDF/DOCX, text decoding, zero-byte/malformed files, unsupported `.doc`/PPT/image formats, traversal-like names, opaque generated keys, safe deletion, streamed exact-20-MB acceptance and one-byte-over cleanup, separate reader/search text, reader-text truncation at 2,000,000 characters, search-index truncation at 500,000 characters, and image-only PDF acceptance with search unavailable.
- [ ] **Step 2: Run the focused tests and confirm they fail for missing document-library functions/models.**

Run from `services/api`: `python -m pytest tests/test_document_storage.py tests/test_document_service.py -q`

Expected: FAIL because document storage, extraction, and model interfaces do not exist yet.

- [ ] **Step 3: Implement the document model, model registration, private staging/storage directory wiring, upload validation, opaque-key file operations, and bounded text extraction.** Reuse low-level parsers already present for PDF/DOCX/Markdown/TXT, but do not call the quiz upload function that rejects text over 20,000 characters.
- [ ] **Step 4: Run the focused tests and confirm all storage/extraction tests pass.**

Run from `services/api`: `python -m pytest tests/test_document_storage.py tests/test_document_service.py -q`

Expected: PASS, including the 500,000-character index boundary and scan-only PDF behavior.

## Task 2: Authenticated Document API, Tags, and Persistence

**Files:**
- Create: `services/api/app/schemas/document.py`
- Modify: `services/api/app/tags/service.py`
- Create: `services/api/app/routers/documents.py`
- Modify: `services/api/app/main.py`
- Test: `services/api/tests/test_documents_api.py`

**Interfaces:**
- `GET /api/documents?limit=20&offset=0&q=&tag_id=` returns owner-scoped summaries with tags and reading progress. `limit` is 1–100; `offset` is nonnegative.
- `POST /api/documents` accepts one multipart file and an optional display title; it initially creates an untagged record. The WebApp uploads each selected file separately, displays per-file outcomes, then lets the user assign a subject and optional topic tags with immediate persistence.
- `GET /api/documents/{document_id}` returns safe metadata and tag summaries.
- `GET /api/documents/{document_id}/content` returns authorized original bytes with a safe inline content type for PDF.js. `getDocumentContent(documentId)` returns a `Blob`, not JSON.
- `GET /api/documents/{document_id}/text` returns `{ text, text_truncated, search_text_truncated, search_available }` from stored extraction for the authorized owner. PDFs continue to render original bytes; a scan-only PDF returns `search_available: false`.
- `PATCH /api/documents/{document_id}` updates only the display title; `PUT /api/documents/{document_id}/tags` replaces tags; `PUT /api/documents/{document_id}/progress` accepts either a positive PDF `page` or text `scroll_ratio` from 0 through 1.
- `DELETE /api/documents/{document_id}` removes the owner-scoped database record and stored file safely.
- `replace_document_tags(session: Session, user_id: int, document_id: int, tag_ids: list[int]) -> Document` allows an initially untagged record or exactly one built-in root subject with zero or more current-user topic tags beneath that same root. It rejects multiple roots, topics without their root, and another user's topic tags.

- [ ] **Step 1: Write failing API tests.** Cover unauthenticated rejection; upload accepted file; reject a file one byte over 20 MB and unsupported/invalid files without a database row or stored file; allow an initially untagged record, assign one subject plus child topics, reject invalid combinations; root-subject filtering including its child tags; search by title, original filename, and extracted text; literal `%`/`_` search; paging; rename and tag replacement; progress bounds; persisted file and extracted text after app restart; unknown/foreign IDs returning 404 for metadata/content/text/progress/tag/delete; safe `nosniff`/inline-PDF headers; and confirmed deletion removing both record and bytes.
- [ ] **Step 2: Run the focused API test and confirm it fails because `/api/documents` is not registered.**

Run from `services/api`: `python -m pytest tests/test_documents_api.py -q`

Expected: FAIL with missing document routes.

- [ ] **Step 3: Implement document schemas, owner-scoped service/query operations, document-tag assignment validation, upload and read endpoints, title/tag/progress updates, and safe file deletion.** Apply same-origin validation to state-changing requests; stream into a private staging file in bounded chunks before promotion; remove both staged/final bytes and roll back metadata on validation or database failure; never expose a storage key or local path.
- [ ] **Step 4: Run focused API tests and confirm ownership, persistence, cleanup, search, tags, and progress pass.**

Run from `services/api`: `python -m pytest tests/test_document_storage.py tests/test_document_service.py tests/test_documents_api.py -q`

Expected: PASS with no test accessing another user's metadata or bytes.

## Task 3: Authenticated Web Routes and API Client

**Files:**
- Modify: `WebApp/src/api/client.js`
- Modify: `WebApp/src/router.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/components/Navbar.js`
- Test: `WebApp/tests/api-client.test.js`
- Test: `WebApp/tests/router.test.js`

**Interfaces:**
- Add API helpers `listDocuments({ limit, offset, q, tagId })`, `uploadDocument(formData)`, `getDocument(documentId)`, `getDocumentContent(documentId)`, `getDocumentText(documentId)`, `renameDocument(documentId, payload)`, `replaceDocumentTags(documentId, payload)`, `saveDocumentProgress(documentId, payload)`, and `deleteDocument(documentId)`.
- Route `/documents` to `documents-library`; route `/documents/{positive_integer}` to `document-reader` with `{ documentId }`. Both require a signed-in user and preserve the local return destination through login.
- Render `DocumentsPage` with the API helpers and shared `navigate`; render `DocumentReaderPage` with `documentId`, reader API helpers, and shared `navigate`.

- [ ] **Step 1: Write failing client/router tests.** Assert URL encoding of search and tag filters, credentials and multipart handling, authenticated route resolution, positive numeric document IDs, and safe `next` handling for `/documents` and valid document reader routes.
- [ ] **Step 2: Run `npm test -- --run tests/api-client.test.js tests/router.test.js` from `WebApp` and confirm the new cases fail.**
- [ ] **Step 3: Add the API helpers, authenticated route matching/redirects, page render wiring, and signed-in navbar link.** Do not expose the library link to signed-out users.
- [ ] **Step 4: Run `npm test -- --run tests/api-client.test.js tests/router.test.js` from `WebApp` and confirm all client/router tests pass.**

## Task 4: Document Library UI

**Files:**
- Create: `WebApp/src/pages/DocumentsPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/documents-page.test.js`
- Consume: `listDocuments`, `uploadDocument`, `listTags`, `createTag`, `renameDocument`, `replaceDocumentTags`, and `deleteDocument` from Task 3.

- [ ] **Step 1: Write failing library-page tests.** Cover initial loading, multi-file upload flow with a per-file result, an initially untagged accepted file, assignment of exactly one built-in subject plus optional child topic tags, immediate tag persistence, search-index truncation notice, case-insensitive title/filename/content search, combined text/tag filtering, root subject matching its children, rename, delete confirmation/cancel, empty/no-result/error states, and theme-token-based class structure.
- [ ] **Step 2: Run `npm test -- --run tests/documents-page.test.js` from `WebApp` and confirm it fails because the page is not implemented.**
- [ ] **Step 3: Implement the Chaiwat-style library page using the existing tag-chip colors, tag creation flow, and queued immediate-save pattern.** Adapt selection so a document has at most one built-in subject and topic tags only under that subject. Keep the UI compact and responsive, use the shared theme manager's CSS variables, and submit each selected file as a separate authenticated request.
- [ ] **Step 4: Run the page tests and confirm upload, filters, tag persistence, and document actions pass.**

Run from `WebApp`: `npm test -- --run tests/documents-page.test.js`

Expected: PASS with no page-specific color palette or fake document records.

## Task 5: Secure Format Readers and Reading Progress

**Files:**
- Create: `WebApp/src/pages/DocumentReaderPage.js`
- Create: `WebApp/src/documents/markdown-reader.js`
- Create: `WebApp/src/documents/pdf-viewer.js`
- Modify: `WebApp/package.json`
- Modify: `WebApp/package-lock.json`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/document-reader-page.test.js`
- Test: `WebApp/tests/document-viewers.test.js`
- Consume: document metadata/content/text/progress/title/tag/delete APIs from Tasks 2–3.

- [ ] **Step 1: Add failing reader tests.** Cover loading and 404 states, back-to-library navigation, document actions, safe Markdown rendering of headings/lists/code and escaping of raw script/HTML, stored TXT/DOCX paragraph rendering, extracted-text truncation notice, PDF page count/page navigation/zoom, scan-only PDF warning, debounced progress saves, and restoring/clamping malformed or stale progress.
- [ ] **Step 2: Install the planned viewer/render dependencies and run `npm test -- --run tests/document-reader-page.test.js tests/document-viewers.test.js` from `WebApp`; confirm the behavior tests fail before implementation.**
- [ ] **Step 3: Implement the reader shell and format views.** Use PDF.js to render original PDF pages and track visible/current page; use `marked` with DOMPurify for Markdown; render stored TXT/DOCX text as text nodes/paragraphs; show when extracted text was bounded; save page or scroll-ratio progress after meaningful changes and restore it on open.
- [ ] **Step 4: Run the focused reader tests and confirm all format, safety, and progress cases pass.**

Run from `WebApp`: `npm test -- --run tests/document-reader-page.test.js tests/document-viewers.test.js`

Expected: PASS; an HTML/script payload in Markdown is displayed as inert content and never executes.

## Task 6: Integration, Regression, and Final Review

**Files:**
- Modify as needed: files created/changed in Tasks 1–5 only.
- Test: all API and WebApp test suites.

- [ ] **Step 1: Add/adjust an integration test for upload → tagged library result → open reader → progress resume → delete, including a second user who cannot access the first user's document.**
- [ ] **Step 2: Run the complete API test suite.**

Run from `services/api`: `python -m pytest -q`

Expected: PASS with no regressions to authentication, quiz generation/library, attempts, or tag behavior.

- [ ] **Step 3: Run the complete WebApp test suite and production build.**

Run from `WebApp`: `npm test -- --run` and `npm run build`

Expected: both commands exit successfully; build bundles the PDF.js worker and reader assets.

- [ ] **Step 4: Review the final diff for protected-folder changes, unrelated edits, hardcoded theme colors, unsanitized HTML, public file paths, and any commit/push.** Keep the work uncommitted and unpushed.
