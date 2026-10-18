# Centered, Selectable PDF Reader — Implementation Plan

> **For agentic workers:** execute test-first. This plan is sequenced after storage implementation and does not change the deferred reader exit/back behavior.

**Goal:** Center the existing PDF.js reader, make PDF text selectable, keep controls visible during scroll, and let the owner download the original PDF.

**Architecture:** Continue using the existing authenticated inline-content API and PDF.js. Render PDF.js canvas and text layers together. Add a separate authenticated attachment/download endpoint that returns the unchanged original bytes from the configured storage provider.

**Tech Stack:** FastAPI, existing storage provider, `pdfjs-dist` 4.x, vanilla JavaScript, CSS, pytest, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-pdf-reader-experience-design.md`

## Global constraints

- Depends on completion of `2026-10-15-post-deploy-file-persistence.md`.
- Do not modify reader close/back/exit behavior; user explicitly deferred that issue.
- Do not rasterize/convert/store PDF pages as image files. Canvas is only the browser rendering surface; text selection comes from PDF.js text-layer DOM.
- Keep API authentication/ownership; never return a public Supabase URL.
- Preserve zoom/fullscreen/page navigation/reading progress and all current non-PDF formats.
- Test with locally generated/fixed fixtures; no external network.

## Review focus

- Canvas and text layer use the exact same viewport transform for each zoom/resize.
- Text layer is cleared/replaced on rerender; no old selectable text remains on another page.
- Toolbar is sticky within the reader, does not overlap page text, and behaves in fullscreen.
- Download response is the original bytes and uses a safe filename; unauthorized requests do not reach storage.
- Avoid adding another nested vertical scroll region or a fit-width horizontal scrollbar.

---

### Task 1: Add an owner-scoped PDF download endpoint

**Files:**
- Modify: `services/api/app/routers/documents.py`
- Modify: `WebApp/src/api/client.js`
- Test: `services/api/tests/test_documents_api.py`
- Test: `WebApp/tests/api-client.test.js`

**Interface:**
- `GET /api/documents/{document_id}/download` (route prefix consistent with existing API) requires current session, loads the `Document` with both ID and owner ID, and returns the original bytes as `application/pdf` with safe `Content-Disposition: attachment` filename.
- Client method returns a same-origin URL or performs a blob download without exposing storage keys/provider URLs.

- [ ] **Step 1: Add failing backend tests** for owner download, exact byte equality, non-PDF rejection/behavior, safe non-ASCII filename encoding, and another-user/anonymous denial.
- [ ] **Step 2: Run** `python -m pytest tests/test_documents_api.py -q` from `services/api` and verify the route cases fail.
- [ ] **Step 3: Implement the endpoint** with owner authorization before provider read; set safe response headers and no-store/private cache behavior as appropriate.
- [ ] **Step 4: Add a failing API-client test** for the same-origin download route, then implement the client helper.
- [ ] **Step 5: Run** `python -m pytest tests/test_documents_api.py -q` and `npm test -- tests/api-client.test.js` from `WebApp`.

### Task 2: Add synchronized PDF.js text layers

**Files:**
- Modify: `WebApp/src/documents/pdf-viewer.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/document-viewers.test.js`

- [ ] **Step 1: Add failing tests** for page text-layer creation, layer cleanup on rerender/destroy, page text content, and matching viewport/scale on zoom where the test environment allows.
- [ ] **Step 2: Run** `npm test -- tests/document-viewers.test.js` and confirm the new assertions fail.
- [ ] **Step 3: Use the installed PDF.js v4 `TextLayer` API** to render selectable text above each rendered canvas. Keep page transforms shared; do not add extracted-text-only fake pages.
- [ ] **Step 4: Add text-layer CSS** for absolute positioning, transparent text glyphs, selection highlight, and safe pointer behavior without blocking viewer controls.
- [ ] **Step 5: Re-run** `npm test -- tests/document-viewers.test.js` and check disposal prevents stale layers after zoom/page re-render.

### Task 3: Center reader, keep controls sticky, add download action

**Files:**
- Modify: `WebApp/src/pages/DocumentReaderPage.js`
- Modify: `WebApp/src/documents/pdf-viewer.js` as needed for layout events
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/document-reader-page.test.js`
- Test: `WebApp/tests/document-viewers.test.js`

- [ ] **Step 1: Add failing page tests** for PDF download button/label, original filename, and unchanged route exit controls; add layout-class assertions for sticky toolbar/centered viewer when testable.
- [ ] **Step 2: Run** `npm test -- tests/document-reader-page.test.js tests/document-viewers.test.js` and verify failures.
- [ ] **Step 3: Add an owner-authenticated download control** for PDFs that invokes the new endpoint; hide or adapt it for non-PDF content.
- [ ] **Step 4: Update reader layout** to center pages, fit width responsively, keep one main vertical scroll surface, make toolbar sticky below header, and prevent collisions with bottom navigation/fullscreen.
- [ ] **Step 5: Keep responsive behavior and reduced-motion preferences**; do not change the reader close/back mechanics.
- [ ] **Step 6: Re-run** focused reader tests.

### Task 4: Verify end-to-end PDF behavior

- [ ] Run `python -m pytest tests/test_documents_api.py -q` from `services/api`.
- [ ] Run `npm test -- tests/document-reader-page.test.js tests/document-viewers.test.js tests/api-client.test.js` from `WebApp`.
- [ ] Run `npm run build` from `WebApp`.
- [ ] Manually verify a text PDF: copy selectable text, zoom in/out, use page controls, scroll all pages, resize viewport, enter/exit fullscreen, download original, and reopen at saved position.
- [ ] Verify a scanned/image-only PDF still renders without a false OCR promise; verify a corrupt PDF has a recoverable error.
- [ ] Verify an unauthorized/other-owner download is denied by backend tests. Do not claim Render behavior before authorized deployment/configuration.
