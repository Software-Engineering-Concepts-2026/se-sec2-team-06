# Global Theme, Motion, and Dropdown Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply consistent, accessible dropdown styling and restrained page-entry animation throughout the app while keeping all three themes visually coherent.

**Architecture:** Use the existing root theme tokens and shared stylesheet instead of page-specific colors. Add one route-page entrance class in the existing render lifecycle, use native select semantics, and share the atom visual between guest Home and Login.

**Tech Stack:** Vanilla JavaScript DOM modules, CSS custom properties, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-tag-library-and-quiz-polish-design.md`

## Global Constraints

- Use one shared layout and theme tokens across the existing dark, light, and purple themes.
- Subject, provider, and model dropdowns remain keyboard and screen-reader operable.
- Respect `prefers-reduced-motion`; do not make interaction state depend on animation.
- Use the supplied rounded-card dashboard visual direction without replacing existing feature workflows.
- Do not edit `D:\Project SE Sce 2\se-sec2-team-06`; do not commit or push.

## Review Focus

- Every native select must preserve its accessible label, selected value, and keyboard focus across themes: assert selected value and shared class in page tests and semantic-token contrast in `WebApp/tests/theme-manager.test.js`.
- Reduced motion must remove animation and transform transitions: `test_page_entry_animation_respects_reduced_motion` in `WebApp/tests/theme-manager.test.js`.
- Route changes must animate only the active route once: `test_route_page_gets_one_entry_marker` in `WebApp/tests/router.test.js`.
- The atom must be decorative and reused in guest Home and Login: `test_guest_home_and_login_share_decorative_atom` in `WebApp/tests/pages.test.js`.
- Success, error, score, and destructive colors must remain readable in every theme: `test_semantic_status_tokens_meet_small_text_contrast` in `WebApp/tests/theme-manager.test.js`.

---

### Task 1: Establish shared theme tokens for cards, chart colors, and controls

**Files:**
- Modify: `WebApp/src/theme/theme-config.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/theme-manager.test.js`

- [ ] **Step 1: Add failing tests** named `test_all_themes_define_chart_and_control_tokens` and `test_semantic_status_tokens_meet_small_text_contrast`; assert dark, light, and purple each define readable success/error/chart/select-focus tokens.
- [ ] **Step 2: Run `npm test -- tests/theme-manager.test.js`** from `WebApp` and verify the new expectations fail.
- [ ] **Step 3: Add shared semantic tokens and CSS rules** for card surfaces, selected/focus dropdown states, chart colors, success green, and destructive red without hard-coding page-specific theme colors.
- [ ] **Step 4: Run the theme-manager tests** and verify the existing WCAG AA small-text checks remain valid.

### Task 2: Polish native subject/provider/model dropdowns

**Files:**
- Modify: `WebApp/src/styles.css`
- Modify: `WebApp/src/pages/QuizCreatePage.js`
- Modify: `WebApp/src/pages/TutorPage.js`
- Modify: `WebApp/src/pages/DeadlinesPage.js`
- Modify: `WebApp/src/pages/ProgressPage.js`
- Modify: `WebApp/src/tags/tag-components.js`
- Modify: `WebApp/src/components/Navbar.js`
- Test: `WebApp/tests/quiz-create-page.test.js`
- Test: `WebApp/tests/tutor-page.test.js`
- Test: `WebApp/tests/deadlines-page.test.js`
- Test: `WebApp/tests/progress-page.test.js`

**Interfaces:**
- Keep native `<select>` elements and existing values. Apply the shared `.themed-select` class to subject, provider, model, language, difficulty, priority, tag-filter, and theme selects; preserve each current `aria-label`/`<label>` relationship.

- [ ] **Step 1: Add failing tests** named `test_quiz_create_selects_keep_labels_and_selected_values`, `test_tutor_provider_model_and_language_selects_keep_labels`, `test_deadline_subject_and_priority_selects_keep_labels`, `test_progress_tag_filter_keeps_native_label`, and `test_theme_select_keeps_native_keyboard_semantics`; assert each select remains an HTML `<select>` with a non-empty accessible name.
- [ ] **Step 2: Run the affected page tests** from `WebApp` and confirm the missing class/state assertions fail.
- [ ] **Step 3: Apply common select, option, focus, disabled, and error styles** to `.themed-select` using theme tokens; do not replace native controls with inaccessible custom menus.
- [ ] **Step 4: Run quiz-create, Tutor, deadline, progress, and theme tests** and verify selection behavior is unchanged.

### Task 3: Add shared page-entry motion and reusable atom visual

**Files:**
- Create: `WebApp/src/components/AtomVisual.js`
- Modify: `WebApp/src/pages/HomePage.js`
- Modify: `WebApp/src/pages/LoginPage.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/pages.test.js`
- Test: `WebApp/tests/router.test.js`

**Interfaces:**
- `createAtomVisual() -> HTMLElement` supplies the same `aria-hidden="true"` decorative visual to guest Home and Login.
- `main.js` marks the current routed page once with `.page-enter`; a route change starts one short animation and does not alter route or data state.

- [ ] **Step 1: Add failing tests** named `test_guest_home_and_login_share_decorative_atom` and `test_route_page_gets_one_entry_marker`; assert exactly one active page marker after each route render.
- [ ] **Step 2: Add `test_page_entry_animation_respects_reduced_motion`**; assert the page marker stays in the DOM while the reduced-motion media query sets animation and transition duration to zero.
- [ ] **Step 3: Run `npm test -- tests/pages.test.js tests/router.test.js`** from `WebApp` and verify failure.
- [ ] **Step 4: Extract the atom component and add shared page-entry CSS** with a restrained fade/translate effect plus a reduced-motion override.
- [ ] **Step 5: Run the focused tests and `npm run build`** from `WebApp`.

### Task 4: Cross-theme visual verification

- [ ] **Step 1: Run `npm test`** from `WebApp`.
- [ ] **Step 2: Run `npm run build`** from `WebApp`.
- [ ] **Step 3: Manually inspect** subject/provider/model, tag-filter, and theme dropdowns plus page-entry motion in dark, light, and purple themes, including reduced-motion mode.
