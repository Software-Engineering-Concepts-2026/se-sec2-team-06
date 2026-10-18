# Centered, Selectable PDF Reader

## Status

Draft for user review. This workstream follows the persistent-file workstream; no application code has changed.

## Goal

Make the document reader feel like a practical PDF reader: centered pages, readable sizing, selectable/copyable text when the PDF contains text, dependable scrolling through every page, and a direct way to download the original PDF.

## Approved decisions

- Keep the original PDF bytes in the configured document storage provider. Render in the browser with the existing PDF.js dependency; do not convert or save the PDF as page-image files.
- Render each visible PDF page using the current PDF.js canvas renderer plus PDF.js text-layer spans aligned over the page. Text selection/copy is available where the source PDF contains an extractable text layer; scanned pages are not promised OCR.
- Center the reading surface in the available content column and make page width responsive. Preserve zoom, page navigation, all-pages scrolling, fullscreen, and reading progress.
- Keep one primary vertical scroll surface for the document. Avoid an iframe/nested PDF scrollbar and avoid horizontal overflow at fit width.
- Keep reader controls visible while reading using a sticky toolbar positioned below the app header. The toolbar must not cover the active page content or conflict with the floating bottom navigation.
- Add an explicit **Download PDF** action that downloads the original bytes with the original filename through an authenticated owner-scoped API endpoint.
- Preserve theme tokens and keyboard/accessibility behavior.
- The user explicitly deferred the separate “scroll back up to exit/close the reader” issue. Do not change close/back behavior or the reader’s route/exit affordance in this workstream.

## Reader behavior

- The first page is centered on initial load. At fit width, the page should not be left-offset, clipped, or wider than the available reader surface.
- Scrolling reaches every page. Page controls update the displayed current page and can move to previous/next pages without disabling ordinary scrolling.
- Zoom scales the canvas and text layer together. Text-selection bounds and rendered glyphs remain aligned after zoom, resize, page changes, and fullscreen transitions.
- A loading or per-page rendering state is shown without replacing the whole document with a blank area. PDF parse/render failures produce a recoverable error state.
- The PDF’s actual text remains selectable using native browser selection. Do not rasterize the source into stored thumbnails/pages or show selectable text as an unrelated extracted-text panel.
- The download action is available without requiring the user to scroll to a particular page. The server validates the active session and document ownership before streaming the original PDF, sets a safe attachment filename, and does not send a permanent Storage URL to the browser.
- Toolbar sticky behavior is bounded to the reader page and works in both normal and fullscreen layouts; scrolling the surrounding page remains natural.

## Implementation boundaries

- Reuse existing `pdfjs-dist` and the existing `getDocumentContent` route for inline display. Add a separate authenticated download route/action rather than using a public Storage URL.
- Keep PDF.js worker setup/version aligned with the installed package. Load/render pages lazily as today, but create/destroy the corresponding text layer with each page render to prevent stale text or memory leaks.
- Add clear CSS layering and pointer behavior: canvas is visual-only, text layer sits above it, selection highlights are visible, and controls stay interactive.
- The content endpoint and download endpoint remain owner-scoped. The download response uses `Content-Disposition: attachment` with a sanitized/encoded filename, `application/pdf`, and appropriate cache/security headers.
- Keep a useful fallback for documents that are not PDF; this spec does not redesign Markdown/DOCX/TXT readers.

## Acceptance criteria

1. An uploaded PDF is still the original file; no persisted page-image derivative is produced.
2. On text-based PDFs, the user can select and copy visible page text. Selection stays aligned after zoom and viewport resizing.
3. The reading surface is horizontally centered at desktop and mobile widths, and default fit-width has no unnecessary horizontal scrollbar.
4. Every page is reachable by normal scrolling; previous/next and page count remain correct.
5. Zoom, fullscreen, and reading-position behavior remain functional.
6. The toolbar remains available while scrolling and does not obscure the page or become trapped beneath the app navigation.
7. Download saves the original PDF with a safe original filename; it is not a screenshot or transformed image.
8. Unauthenticated users and other learners cannot use inline or download routes to access the document.
9. Corrupt PDFs and scanned/image-only pages fail gracefully or render normally without an OCR claim.
10. The deliberately deferred close/back scrolling issue is unchanged.

## Out of scope

- OCR, annotation, highlights, collaborative reading, replacing PDF.js with an iframe/browser plugin, full-screen app exit redesign, or changes to non-PDF reader layouts.

## Dependency

Requires the profile/document storage abstraction from `2026-10-15-post-deploy-file-persistence-design.md` so inline viewing and download retrieve the exact same private original bytes in both local and deployed modes.
