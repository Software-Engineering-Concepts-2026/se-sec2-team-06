# Vision-Inspired Home Dashboard Polish — Implementation Plan

> **For agentic workers:** presentation-only plan; execute test-first and preserve all existing dashboard data contracts.

**Goal:** Refine authenticated Home into a compact, theme-aware dashboard inspired by Vision UI Dashboard, and correct navbar portrait alignment.

**Architecture:** Retain the existing Home dashboard models, API calls, SVG/chart behavior, guest atom, routes, and bottom navigation. Rework Home markup only when needed for clear layout semantics; use the shared CSS theme variables for cards, gradients, spacing, and responsive states.

**Tech Stack:** Vanilla JavaScript DOM, existing chart renderer, shared CSS/theme tokens, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-vision-dashboard-polish-design.md`

## Global constraints

- Do not add analytics endpoints, fake data, charts, chart libraries, React, or a new theme.
- Preserve current all-theme support, guest/login atom, and bottom navigation.
- Profile portrait stays intentionally overlapping the account control but becomes vertically centered; remove only the accidental downward translation.
- Respect reduced motion and keyboard focus. Avoid hover-only content.
- Do not change unrelated pages or user profile data.

## Review focus

- All four charts and other dashboard sections still display their existing real data and correct empty states.
- Desktop hierarchy is clear without excessive whitespace; mobile panels stack without horizontal overflow.
- Existing themes keep adequate contrast for labels, chart colors, chips, focus, and actions.
- Guest Home/Login issue no authenticated data requests and keep the atom.
- Navbar portrait image/fallback initials, label, click target, and profile interactions still work.

---

### Task 1: Capture current Home and navbar behavior with regression tests

**Files:**
- Test: `WebApp/tests/home-dashboard.test.js`
- Test: `WebApp/tests/pages.test.js`
- Modify: `WebApp/tests/*` only where an existing test is the natural owner

- [ ] **Step 1: Add or strengthen tests** asserting all current dashboard sections/charts/feature shortcuts render from supplied real data, empty data is not fabricated, guest mode retains atom/no private requests, and the profile control includes portrait/name.
- [ ] **Step 2: Run** `npm test -- tests/home-dashboard.test.js tests/pages.test.js` and verify any newly introduced assertions fail for the intended gaps only.
- [ ] **Step 3: Record existing selectors/semantics** to avoid breaking feature links or bottom navigation during styling.

### Task 2: Correct navbar profile portrait alignment

**Files:**
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/pages.test.js` or the existing navbar test file

- [ ] **Step 1: Add a regression assertion** that the portrait is centered by its account control rather than offset downwards.
- [ ] **Step 2: Remove the `translateY(1rem)` offset** from `.nav-account__portrait` and its hover transform; keep overlap, circular framing, sizing, image/fallback behavior, and hover scale.
- [ ] **Step 3: Run** the focused navbar/page tests.

### Task 3: Apply responsive Vision-inspired dashboard styling

**Files:**
- Modify: `WebApp/src/pages/HomePage.js` only if semantic grouping/order is needed
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/home-dashboard.test.js`
- Test: `WebApp/tests/pages.test.js`

- [ ] **Step 1: Add failing structure assertions** for ordered welcome/summary, primary dashboard charts, and secondary deadline/recent/shortcut panels without removing existing content.
- [ ] **Step 2: Rework the signed-in Home grid** into a clear responsive hierarchy, using existing theme variables for glass/surface layers, gradients, border, radius, and accent.
- [ ] **Step 3: Tune chart card sizing, spacing, headings, loading/empty states, and action alignment**; no empty card should become a large blank canvas.
- [ ] **Step 4: Add mobile/tablet breakpoints** and motion/reduced-motion rules; preserve chart readability and keyboard-focus indicators.
- [ ] **Step 5: Avoid style changes to the guest atom except shared layout compatibility**; do not redesign Login in this pass.
- [ ] **Step 6: Run** `npm test -- tests/home-dashboard.test.js tests/pages.test.js`.

### Task 4: Cross-theme and responsive verification

- [ ] Run relevant frontend suite: `npm test -- tests/home-dashboard.test.js tests/pages.test.js` from `WebApp`.
- [ ] Run `npm run build` from `WebApp`.
- [ ] Manually inspect authenticated Home in every existing theme at desktop/tablet/mobile widths, including populated and empty states.
- [ ] Verify profile portrait remains centered with both a real image and initials fallback; inspect hover/focus states.
- [ ] Verify bottom navigation, feature links, guest Home/Login atom, and reduced-motion mode.
- [ ] Check `git diff --check`; confirm no dashboard API/data behavior changed.
