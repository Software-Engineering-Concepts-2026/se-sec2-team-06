# Shared Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep each change scoped, test-first, and reviewable.

**Goal:** Add three reusable, browser-persisted themes (dark, light, and deep purple) that users can switch from the shared navbar on every WebApp page.

**Architecture:** Keep theme IDs, labels, color-scheme values, and semantic CSS tokens in `WebApp/src/theme/theme-config.js`. A small manager validates the saved choice, applies the palette to the document root, and safely reads/writes local storage. Page CSS consumes semantic custom properties; the existing dark palette remains the pre-JavaScript fallback. The navbar exposes an accessible selector in both signed-in and signed-out states. No server or database involvement.

**Tech Stack:** Existing vanilla JavaScript modules, CSS custom properties, Vitest, jsdom, Vite. No added dependencies.

**Approved design:** `docs/superpowers/specs/2026-10-11-theme-system-design.md`

**Global constraints:** Preserve all existing unrelated/dirty worktree changes. Do not modify `prototypes/`, the API, or database. Do not commit or push. Keep the atom illustration's violet/teal orbital glow as a consistent brand element. Do not redesign layouts or change typography.

## Task 1 — Add the shared theme definitions and manager

**Files:** Create `WebApp/src/theme/theme-config.js`, `WebApp/src/theme/theme-manager.js`, and `WebApp/tests/theme-manager.test.js`.

1. Write failing tests first for:
   - Exactly three selectable IDs (`dark`, `light`, `purple`) with user-facing Thai labels and complete semantic token maps.
   - First visit and missing/unknown saved IDs resolving to `dark`.
   - Applying a valid theme setting `data-theme`, `color-scheme`, and all configured root CSS properties.
   - Choosing a theme persisting its ID and applying it immediately.
   - `localStorage` access/read/write failures not throwing and still allowing an in-memory theme to be applied.
2. Implement the smallest config and manager API that satisfies the tests:
   - `getTheme(themeId)` returns a theme definition or the dark fallback.
   - `initializeTheme({ storage, root } = {})` reads a valid stored ID (safely) and applies it.
   - `setTheme(themeId, { storage, root } = {})` validates, applies, attempts persistence, and returns the effective ID.
   - Resolve browser storage inside guarded code so even accessing `window.localStorage` can fail safely; permit injected storage/root in tests.
3. Use a semantic token set covering page/background, text/muted text, navbar/surfaces/raised cards/inputs, borders, accent/hover/focus, success/error/warning feedback, glass and shadow. Keep the theme definitions as the only palette source used when switching themes.
4. Run from `WebApp/`: `npm test -- tests/theme-manager.test.js` and confirm it passes.

**Boundary:** This task owns palette data, validation, root application, and persistence only. It does not change navbar or page rendering.

## Task 2 — Make page styling consume theme tokens

**Files:** Update `WebApp/src/styles.css`; adjust `WebApp/tests/theme-manager.test.js` only if a token-contract assertion needs to be added.

1. Add a failing token-contract assertion if any shared page token needed by the stylesheet is missing from one of the three themes; make it pass by completing the palette definitions before migrating styles.
2. Replace theme-sensitive fixed colors in the page background, navbar, cards, forms, text, borders, buttons, focus rings, feedback, and shared avatar-crop dialog with semantic variables. Keep the existing dark values as the pre-script fallback so initial paint remains styled.
3. Leave illustration-only orbit/core glow colors intact to preserve the agreed violet/teal brand identity; use semantic tokens for its surrounding card/text surfaces.
4. Check dark, light, and purple palettes for readable text/control contrast and visible focus/error/success states. Ensure theme-specific values are not duplicated in page components.
5. Run from `WebApp/`: `npm test` and `npm run build`.

**Boundary:** This task changes styling only; it must not change page structure, layout, font, or behavior.

## Task 3 — Add the shared navbar selector and wire app state

**Files:** Update `WebApp/src/components/Navbar.js`, `WebApp/src/main.js`, and `WebApp/tests/pages.test.js` (or a focused navbar test file if that is clearer).

1. Add failing navbar tests that render both signed-out and signed-in variants and verify:
   - A keyboard-accessible selector labeled `ธีม` is present in both states.
   - It offers all three labels and reflects the currently selected theme.
   - A selection calls the supplied change handler with the selected ID.
2. Add a compact selector that fits the existing navbar and remains operable with keyboard and assistive technology; avoid relying on color alone to identify a selected theme.
3. Initialize the saved theme before the first page render in `main.js`; keep the effective theme ID in app state and pass it, plus an `onThemeChange` callback, to each navbar render.
4. On selection, call the manager to apply/persist the theme immediately without a reload. Keep app state synchronized so later route changes and navbar re-renders preserve the selection.
5. Run from `WebApp/`: `npm test -- tests/pages.test.js` (or the focused navbar test) and then `npm test`.

**Boundary:** The navbar is the sole control for selecting a theme. Theme choice remains browser-local and is never added to API requests or profile data.

## Task 4 — Verify the complete theme experience

**Files:** No new files expected; make only focused fixes in the files above if verification reveals a defect.

1. Run from `WebApp/`: `npm test` and `npm run build`.
2. Start the local app and visually inspect Home, Login, Register, Profile, and the shared avatar-crop dialog in all three themes at desktop and narrow/mobile widths.
3. Verify first-visit dark default, persistence after refresh and route navigation, immediate switching without reload, keyboard selection, legibility, visible focus/status states, and no navbar overflow.
4. If storage is unavailable or contains an unknown value, verify the app still renders in dark fallback and theme changes remain usable for the current session.
5. Review `git diff` to ensure only theme-related files changed and pre-existing user work remains untouched. Do not commit or push.

**Boundary:** This is validation and narrowly scoped correction only; it does not expand theme scope.

## Review focus

1. First visit, missing key, and unknown stored value all select the dark fallback without a flash of broken/unreadable styling.
2. If local storage access throws on read or write, the page still renders and an in-session selection still applies.
3. Selecting light or purple updates every shared page/dialog immediately and survives route rendering and browser refresh.
4. Navbar selector is accessible and usable for both signed-in and signed-out users, including keyboard-only operation.
5. At narrow widths, the selector does not overflow; all three palettes keep text, controls, focus rings, and feedback states legible.
