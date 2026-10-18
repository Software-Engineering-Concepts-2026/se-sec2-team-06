# Tutor Chat Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/tutor` into the dark, full-height chat workspace shown in the user's reference while preserving current Tutor capabilities and API behavior.

**Architecture:** Scope the app-shell styling to the Tutor route and build its rails, history drawer, compact conversation toolbar, and anchored composer from the existing Tutor page. Replace the visible native provider/model selects with provider-first dialog choices while retaining the existing selected IDs and request pipeline.

**Tech Stack:** Vanilla JavaScript DOM components, CSS, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-16-tutor-chat-workspace-design.md`

## Global Constraints

- Do not add frontend dependencies.
- Keep provider and model options data-driven from the existing AI catalog.
- Preserve current API request payloads and image-model compatibility behavior.
- Scope visual changes to `/tutor`; other routes and the shared theme remain unchanged.
- Do not merge, push, or deploy.

## Review Focus

- Narrow viewport: rail, history drawer, dialog, and composer must not overlap or clip; cover with a responsive-layout regression test.
- Provider catalog empty or provider with no models: keep controls disabled and render a clear empty state; cover in the picker test.
- Model switching with attached images: maintain existing image-support validation; cover in the provider/model behavior test.
- Dialog/drawer accessibility: `aria-expanded`, labels, Escape dismissal, and focus return; cover in interaction tests.
- Route isolation: shared navigation is hidden only when `/tutor` is active; cover the route-shell class toggle.

---

### Task 1: Tutor workspace shell and navigation

**Files:**
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/router.js`
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/tutor-page.test.js`
- Test: `WebApp/tests/router.test.js`

**Interfaces:**
- `main.js` marks the app root as Tutor-only while the resolved route is Tutor; route changes remove that marker for every other route.
- `router.js` exports `applyTutorAppMode(root, isTutor)` so the route marker behavior can be tested independently of `main.js` boot side effects.
- `TutorPage.js` exposes accessible icon controls for new chat and history, a dismissible history drawer, a compact conversation toolbar, and a collapsible learning-context rail.

- [x] **Step 1: Add failing tests** for the Tutor route shell marker, compact header/left rail, history drawer open/close and selection, and context rail state.
- [x] **Step 2: Run `npm test -- --run tests/tutor-page.test.js tests/router.test.js`** and confirm the new assertions fail for missing shell/drawer behavior.
- [x] **Step 3: Implement `applyTutorAppMode(root, isTutor)`** in `router.js` and call it from `main.js`; implement the Tutor DOM and state changes while keeping history loading, search, tag filtering, and conversation selection.
- [x] **Step 4: Add scoped dark-workspace CSS** in `styles.css` for the full-height three-rail layout and responsive history drawer.
- [x] **Step 5: Re-run the focused tests** and confirm they pass without changing tests to match implementation.

### Task 2: Provider-first model dialog and composer

**Files:**
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/tutor-page.test.js`

**Interfaces:**
- Provider choice updates `selectedProviderId`; model choice updates `selectedModelId`; both continue through `currentSelectionPayload()`.
- The provider trigger exposes dialog state and selected provider/model label; model rows come from the active provider's existing catalog.

- [x] **Step 1: Add failing tests** for provider-first choices, available models, empty providers/models, selected labels, image compatibility, close/Escape, and focus restoration.
- [x] **Step 2: Run the focused tests** and confirm the new assertions fail because the visible interaction is still two native selects.
- [x] **Step 3: Implement the provider tabs and model list** using the loaded catalog; retain disabled states and update the existing selection variables.
- [x] **Step 4: Style the dialog and composer** to match the dark reference, including keyboard focus, overlay, narrow viewport bounds, and sticky/anchored placement.
- [x] **Step 5: Re-run focused tests** and confirm all model selection and submission behavior remains correct.

### Task 3: Responsive and route-isolation verification

**Files:**
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/tutor-page.test.js`

- [x] **Step 1: Confirm route cleanup** with `tests/router.test.js`; verify responsive layout in a real browser at 1920×1080, 1280×720, and 390×844 because jsdom does not apply viewport media queries.
- [x] **Step 2: Run focused tests** and confirm the route assertions and existing mobile-picker regression pass.
- [x] **Step 3: Refine breakpoints** so the history drawer, right rail, model dialog, and composer remain visible and operable without horizontal scrolling.
- [x] **Step 4: Run `npm test -- --run`** from `WebApp` and confirm the full WebApp suite passes.
- [x] **Step 5: Run `npm run build`** from `WebApp` and confirm the production bundle builds successfully.
