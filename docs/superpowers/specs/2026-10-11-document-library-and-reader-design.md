# Document Library and Reader Design

## Status

Draft for user review. The product scope and design sections below were approved in conversation on 2026-10-11. This file documents the approved design; implementation has not started.

## Goal

Build a private, usable document library for learners to upload, organize, search, reopen, and read their own study documents. Follow the Chaiwat library and document-viewer prototypes while using SynapseSync's shared theme and existing tag system.

## Product scope

### Included in the first release

- An authenticated `/documents` library page and `/documents/{document_id}` reader page.
- Upload one or multiple documents using a file picker or drag and drop.
- Supported file formats: PDF, DOCX, Markdown (`.md`), and plain text (`.txt`). Each file is limited to 20 MB.
- Store original files persistently in the API's local application data directory and store document metadata in SQLite.
- Assign a built-in subject tag and optional user-created topic tags from the existing tag catalog. Reuse the existing tag colors and tag creation/selection behavior; do not create a separate document-tag taxonomy.
- Search by document title, original filename, and extractable document text. Filter by a subject or topic tag.
- Rename a document, edit its tags, open it for reading, and delete it after confirmation.
- Read PDF pages with zoom and page navigation. Read Markdown, TXT, and DOCX content in an accessible, readable text view.
- Automatically save reading position and resume at the saved position when reopening a document.
- Use the shared theme manager and theme tokens on both pages; do not add a page-specific palette.
- Provide loading, upload/error, empty-library, no-search-results, and delete-confirmation states.

### Excluded from the first release

- AI summary, explanation, document chat, or quiz generation from the reader.
- Text highlights, annotations, sharing, and collaboration.
- OCR. Scanned/image-only PDFs may be opened and viewed, but their embedded text cannot be searched.
- Legacy `.doc`, PowerPoint (`.ppt`/`.pptx`), and image uploads as library items.
- Cloud/object storage or cross-user/public access.

## User experience

### Library

- Add a “คลังเอกสาร” navigation link visible to authenticated users.
- Present the library in the Chaiwat prototype's resource-library style, adapted to the current shared SynapseSync theme.
- Provide an upload button and drop zone. Multiple selected files are processed as separate documents, with validation feedback for each file.
- After a file is accepted, let the user assign a built-in subject and optional topic tags using the existing tag picker. Selecting a tag persists the change immediately; no separate tag-save button is required.
- Show each document as a card with its editable title, original filename/file type, date, and selected tags.
- Provide a search field and subject/topic tag chips. A selected chip filters the library immediately; search and tag filter can be applied together. Search matching is case-insensitive and treats user input literally.
- Selecting a card opens its reader route. Rename and delete actions are available from the card and/or reader action menu. Deletion requires confirmation.
- Empty and no-match states explain what happened and provide a useful next action.

### Reader

- Follow the Chaiwat viewer layout: a header with a back-to-library action, document title, tags, and document actions; a focused reading area; and reader controls.
- PDF files are rendered as actual pages using an in-app PDF viewer so page navigation, zoom, and reading progress can work together. The viewer shows the current page and total pages.
- Markdown is rendered with headings, lists, and code blocks using a safe renderer. TXT and DOCX are presented as readable text with paragraph breaks; untrusted document contents must never be inserted as unsanitized HTML.
- Provide zoom controls for the reading area and page navigation for PDFs. Text documents use scroll position rather than artificial page numbers.
- Show reading progress and automatically persist the current PDF page or text scroll position for the current owner/document. Resume from that position on the next visit.
- Keep title, tag, and delete actions available in the reader. AI, annotation, and highlight controls are not shown in this release.
- For image-only/scanned PDFs, render the PDF normally but indicate that text search is unavailable because OCR is not included.

## Data and storage

- Add a `Document` entity with at least: ID, owner user ID, display title, original filename, validated file type, byte size, opaque storage key, extracted searchable text, created/updated timestamps, and reading-position fields.
- Add a many-to-many document/tag association. It references the existing `Tag` records and enforces the same ownership and built-in-subject/topic rules used for quiz tags.
- Keep file bytes outside the public web root, in a dedicated documents directory under the API's configured local data directory. Store an opaque generated storage key rather than a user-supplied path.
- Keep documents private to their owner. All list, metadata, content, progress, tag, and delete operations must scope by the authenticated user's ID.
- Store original bytes so a document remains available for reading after restart. Store extracted text separately for content search and text reading; do not reuse the quiz-generation token-size limit as the document-library reading limit.
- On deletion, remove the database metadata, tag associations, reading position, and stored file without affecting another document. Handle filesystem/database failures so a failed deletion does not silently leave a misleading library record.

## API and application behavior

Provide authenticated API operations for:

- Uploading a document.
- Listing documents with pagination, text search, and an optional subject/topic tag filter.
- Reading document metadata and retrieving its original content or extracted reading text.
- Updating the display title and replacing its assigned tags.
- Saving reading position.
- Deleting a document.

Use the current session-cookie authentication and same-origin protections for state-changing requests. Return only safe metadata to the browser; never expose local filesystem paths or storage keys as usable paths.

## Validation and security

- Enforce the 20 MB maximum while streaming the upload, before writing the complete file to storage.
- Validate extensions and actual file signatures/content; do not trust browser MIME headers.
- Reject unsupported, corrupt, empty, or unsafe files with a user-readable error. Never use the supplied filename as a filesystem path.
- Keep extracted-text processing bounded to avoid resource-exhaustion from crafted files; report if a document can be opened but only partially indexed for search.
- Serve PDFs only after owner authorization, with an appropriate content type and safe inline response headers. Do not allow an upload to be interpreted as executable HTML or script.
- Escape search input for literal matching and keep all database queries owner-scoped.
- Render Markdown and document text safely to prevent stored cross-site scripting.

## Acceptance criteria

1. A signed-in user can upload supported PDF, DOCX, MD, and TXT files, including multiple files, and the files and metadata remain available after an API restart.
2. An unsupported or malformed file and a file over 20 MB are rejected without leaving a partial document record or orphaned visible card.
3. The user can assign existing subject/topic tags; those tags appear on cards and are immediately persisted.
4. Searching by title, original filename, or extracted text returns only matching documents belonging to the signed-in user.
5. Filtering by a built-in subject or a user-owned topic tag returns the matching documents and can be combined with text search.
6. Opening a PDF displays its actual pages with working zoom and page navigation. Opening MD/TXT/DOCX displays readable content without executing document-supplied markup or scripts.
7. Reading progress is saved for each document and user and is restored on the next open.
8. A user cannot list, read, update, tag, or delete another user's document, even when guessing its ID.
9. Rename, tag changes, and confirmed deletion persist. Cancelling deletion leaves the document and file intact.
10. The pages work with each shared theme and provide accessible labels, keyboard-operable controls, and clear loading/empty/error states.
11. AI, OCR, highlights, annotation, share, `.doc`, PPT/PPTX, and image-library behavior are absent from this release and are not represented as working features.

## Implementation notes

- Existing quiz uploads are intentionally transient and have a 20,000-character limit for AI input. The document library must store the original file and use a reading/search extraction path that is separate from quiz generation.
- The API currently initializes SQLAlchemy tables with `create_all`; add the new document tables through model registration and startup initialization without modifying existing user data.
- The existing tag catalog is shared across features and includes built-in subjects plus user-owned child tags with palette colors. Document association must not allow a user to attach another user's custom tag.
- The chosen PDF viewer dependency and Markdown rendering/sanitization approach should be selected and locked during implementation planning; user-visible behavior is defined above.
- Work must continue only in the existing isolated worktree. Do not modify the protected `D:\Project SE Sce 2\se-sec2-team-06` folder. Do not commit or push unless the user explicitly asks.
