# PDF Scroll, Fullscreen, and Document Grid Plan

> **For agentic workers:** Implement inline using test-first steps. Do not commit or push.

**Goal:** Make every PDF page readable in one continuous scrollable view with fullscreen controls, and display library files in a responsive multi-column card grid.

**Architecture:** Extend the existing PDF.js viewer with one scroll viewport containing page canvases, lazy rendering for visible pages, page-aware progress/navigation, and browser fullscreen with a CSS fallback. Keep the current document-card markup and change only its shared-theme layout to a responsive grid.

**Tech Stack:** Vanilla JavaScript ES modules, PDF.js, CSS, Vitest, jsdom, Vite.

**Spec:** `docs/superpowers/specs/2026-10-11-document-library-and-reader-design.md` plus the approved follow-up: continuous PDF scrolling, fullscreen expansion, and a multi-column document library.

## Global Constraints

- Preserve document upload, search, tags, rename/delete, theme tokens, and per-document reading progress.
- Keep PDF canvas memory bounded by existing pixel/dimension limits; render pages lazily when possible.
- Keep the layout responsive and use the existing theme variables.
- Work only in the existing isolated worktree; do not touch `D:\Project SE Sce 2\se-sec2-team-06`.
- Do not commit or push.

## Review Focus

- Restored page and progress callbacks remain correct when the visible page changes by scrolling, not only toolbar buttons.
- Fullscreen state stays in sync on browser entry/exit, including Escape and the unsupported-API fallback.
- Lazy-rendered pages remain reachable by scrolling and can be rerendered after zoom changes without concurrent canvas renders.
- Narrow screens keep a single readable column and do not create horizontal overflow.
- Existing tag/search/card actions remain available in the new grid.

## Task 1: Continuous PDF Reader and Fullscreen

**Files:**
- Modify: `WebApp/src/documents/pdf-viewer.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/document-viewers.test.js`
- Test: `WebApp/tests/document-reader-page.test.js` if reader-level wiring needs coverage.

- [x] Add a test proving all PDF pages have reader sections in one scroll viewport, scrolling a page into view updates the page status and saved progress callback, and toolbar navigation targets the adjacent section.
- [x] Run the focused viewer test and confirm it fails because the existing viewer only creates one canvas/page.
- [x] Add fullscreen enter/exit tests, including Escape fallback when Fullscreen API is unavailable; confirm they fail before implementation.
- [x] Implement page-stack rendering with visibility-driven lazy page rendering, page-aware toolbar navigation/status/progress, zoom across rendered pages, and fullscreen controls with accessible labels and fallback.
- [x] Release canvases for pages outside the viewport and current page; keep their page sections so scrolling back re-renders the page and aggregate canvas memory does not grow with document length.
- [x] Restore the saved PDF page into the scroll viewport and re-render newly visible pages when fullscreen or viewport size changes.
- [x] Pin fullscreen notices and the page frame to explicit grid rows; move CSS fallback fullscreen outside transformed/overflow-clipping ancestors and restore its original location on exit.
- [x] Refresh visible pages after regular viewport resize and remove listeners/resources if initial rendering fails.
- [x] Add fullscreen and continuous-scroll layout rules using existing theme variables.
- [x] Run `npm test -- --run tests/document-viewers.test.js tests/document-reader-page.test.js` and confirm all focused tests pass.

## Task 2: Responsive Document Library Grid

**Files:**
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/documents-page.test.js`

- [x] Add a test that mounts the real library styles and verifies the document list uses grid layout while retaining multiple document cards and their actions.
- [x] Run the focused library test and confirm it fails because the current list has a single unconstrained column.
- [x] Set a responsive auto-filling card grid with a minimum readable card width; keep the existing card content and shared theme styles.
- [x] Run `npm test -- --run tests/documents-page.test.js` and confirm all library tests pass.

## Final Verification

- [x] Run the full WebApp suite: `npm test -- --run`.
- [x] Run the production build: `npm run build`.
- [x] Inspect the changed reader/library files; leave all changes uncommitted and unpushed.
