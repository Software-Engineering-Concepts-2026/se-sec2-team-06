# Document Library and Reader Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the document library compact and scannable, and make the reader centered and easier to read while retaining all existing viewing controls.

**Architecture:** Keep the existing paged API and PDF/Markdown viewer modules. Adjust the responsive grid and page size together so each wide-screen page contains at most six rows; improve the reader’s layout without adding nested scrolling.

**Tech Stack:** Vanilla JavaScript DOM modules, CSS custom properties, pdfjs-dist, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-tag-library-and-quiz-polish-design.md`

## Global Constraints

- Use a compact responsive card grid: four cards per row on wide screens, two on medium screens, and one on narrow screens.
- Show at most six desktop rows (24 documents) per page, then paginate.
- Center the reader in the available content area and enlarge the readable page/content.
- Retain the existing fullscreen and zoom controls.
- Preserve loading, unsupported-preview, empty-library, and error states; do not create fake document cards.
- Use the shared tag assignment behavior from `2026-10-12-shared-flat-tags.md` before integrating its flat catalog.
- Do not edit `D:\Project SE Sce 2\se-sec2-team-06`; do not commit or push.

## Review Focus

- A resize during a pending list request must use the latest viewport size: `test_resize_during_pending_request_uses_latest_page_size` in `WebApp/tests/documents-page.test.js`.
- Search/tag filters must survive page changes and resize: `test_pagination_and_resize_preserve_active_filters` in `WebApp/tests/documents-page.test.js`.
- PDF thumbnails must be created only for visible cards and released on page change: `test_pdf_preview_mounts_visible_page_and_cleans_up_after_navigation` in `WebApp/tests/documents-page.test.js`.
- Fullscreen must preserve one scroll region and reach every PDF page: `test_fullscreen_reader_keeps_all_pages_in_single_scroll_area` in `WebApp/tests/document-reader-page.test.js`.
- Unsupported or scanned files must never display invented text: `test_preview_fallback_does_not_invent_document_content` in `WebApp/tests/documents-page.test.js` and `WebApp/tests/document-reader-page.test.js`.

---

### Task 1: Align library card columns and six-row pagination

**Files:**
- Modify: `WebApp/src/pages/DocumentsPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/documents-page.test.js`

**Interfaces:**
- `getDocumentPageSize(width)` returns 6 at `width <= 480`, 12 at `481..1079`, and 24 at `width >= 1080`, matching one, two, and four columns times six rows.
- Existing `renderDocumentsPage(...)` pagination remains limit/offset based and continues to request one extra row to determine whether a next page exists.

- [ ] **Step 1: Add/adjust failing tests** named `test_document_grid_uses_four_two_one_columns`, `test_document_page_size_matches_six_rows_at_480_481_1079_1080`, and `test_desktop_library_paginates_after_24_documents`; assert page-size results `[6,12,12,24]` at widths `[480,481,1079,1080]`.
- [ ] **Step 2: Run the document page tests and verify failure**: `npm test -- tests/documents-page.test.js` (run from `WebApp`).
- [ ] **Step 3: Update the CSS grid breakpoints and `getDocumentPageSize`** so visible rows never exceed six at the matching viewport widths.
- [ ] **Step 4: Run `npm test -- tests/documents-page.test.js`** and verify the existing search, tag filtering, preview scheduling, and resize behavior remain intact.

### Task 2: Improve card previews and compact metadata

**Files:**
- Modify: `WebApp/src/pages/DocumentsPage.js`
- Modify: `WebApp/src/documents/pdf-viewer.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/documents-page.test.js`
- Test: `WebApp/tests/document-viewers.test.js`

**Interfaces:**
- Keep `mountPdfPreview({ container, blob, pdfjs })` as the thumbnail renderer for visible PDF cards.
- Keep the extracted-text preview for Markdown, TXT, and DOCX; use the file-type fallback only when a preview genuinely cannot be produced.

- [ ] **Step 1: Add failing tests** named `test_pdf_card_uses_first_page_thumbnail`, `test_text_document_card_shows_extracted_excerpt`, and `test_unsupported_or_scanned_document_shows_truthful_fallback`; assert no fallback contains synthetic document text.
- [ ] **Step 2: Run `npm test -- tests/documents-page.test.js tests/document-viewers.test.js`** and verify the new expectations fail where the preview is missing.
- [ ] **Step 3: Refine preview/card CSS** to fit the four-column layout and keep title, type, size, tag, open, edit, and delete actions readable without enlarging cards unnecessarily.
- [ ] **Step 4: Run the same tests** and confirm lazy preview creation remains limited to the visible page.

### Task 3: Center and enlarge the document reader

**Files:**
- Modify: `WebApp/src/pages/DocumentReaderPage.js`
- Modify: `WebApp/src/documents/pdf-viewer.js`
- Modify: `WebApp/src/documents/markdown-reader.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/document-reader-page.test.js`

**Interfaces:**
- Keep the current reader page API and save-reading-progress behavior.
- PDF page width is fitted to the reader viewport at initial load; zoom and fullscreen remain explicit user controls.
- Markdown and extracted text use a centered readable column with larger body text and preserved headings/lists/code blocks.

- [ ] **Step 1: Add failing tests** named `test_reader_content_is_centered_and_readable`, `test_pdf_initial_zoom_fits_reader_width`, `test_pdf_reader_keeps_all_pages_scrollable`, `test_fullscreen_reader_keeps_single_scroll_area`, and `test_reader_restores_saved_position`; assert existing progress-save calls still run on navigation.
- [ ] **Step 2: Run `npm test -- tests/document-reader-page.test.js tests/document-viewers.test.js`** and verify the new layout assertions fail.
- [ ] **Step 3: Update reader and viewer layout styles** to avoid outer-plus-inner scrollbars where possible while preserving page navigation and zoom.
- [ ] **Step 4: Run the focused reader/viewer tests** and verify progress still flushes on navigation and fullscreen retains one scroll area.

### Task 4: Validate the document subsystem

**Files:**
- Test: `WebApp/tests/documents-page.test.js`
- Test: `WebApp/tests/document-reader-page.test.js`
- Test: `WebApp/tests/document-viewers.test.js`

- [ ] **Step 1: Run the full document UI test set**: `npm test -- tests/documents-page.test.js tests/document-reader-page.test.js tests/document-viewers.test.js` from `WebApp`.
- [ ] **Step 2: Run the production build**: `npm run build` from `WebApp`.
- [ ] **Step 3: Manually inspect** one wide layout, one phone layout, PDF fullscreen, and a Markdown document in dark, light, and purple themes.
