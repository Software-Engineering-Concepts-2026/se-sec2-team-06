# Password Strength and Auth UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user-requested simple registration password policy consistently in the browser and API, and give Home/Login/Register a polished, responsive visual treatment inspired by the existing prototypes.

**Architecture:** Keep the Vite + vanilla JavaScript frontend and FastAPI API. The browser presents the policy and advisory strength meter from reusable password helpers; FastAPI independently enforces the same registration policy. Auth pages use the prototype-inspired two-column intro/card pattern while preserving the real API and SPA navigation.

**Tech Stack:** Existing Vite, vanilla JavaScript, Vitest/jsdom, FastAPI, Pydantic, pytest, and CSS.

**Spec:** `docs/superpowers/specs/2026-10-11-home-local-auth-design.md` (updated with this approved refinement).

## Global Constraints

- Do not edit, move, delete, or import runtime code from `prototypes/`; use it only as a visual reference.
- Keep all account creation and password validation connected to the real FastAPI API; do not copy the prototype's mock-only script.
- Registration passwords must be at least 8 Unicode code points and contain at least one Unicode letter (`L`) and one number (`N`). No uppercase, lowercase, or symbol requirement is imposed. The existing API maximum of 128 characters remains a technical input-size cap, not a password-composition rule.
- Login must continue accepting existing accounts without applying the new registration-only composition policy.
- Password feedback uses icons and text as well as color; no unmet rule is red before the user starts typing.
- Do not stage, commit, or push. Preserve unrelated changes already present in the worktree and the separate original checkout.
- Implement only in the approved isolated worktree `C:\Users\Admin\.codex\worktrees\synapsesync-local-auth\se-sec2-team-06`.

## Review Focus

1. Unicode and length parity: astral characters count as one code point in both browser and API; verify the 8-character boundary and Unicode letter/number categories.
2. Required content: reject only a password that is too short, has no letter, or has no number; uppercase and symbols are optional.
3. Input size: registration keeps the existing 128-character API limit, while login behavior remains unchanged.
4. Live feedback: an untouched empty field is neutral; after typing, each unsatisfied rule is visibly and accessibly marked unmet, and satisfied rules are marked met.
5. Visibility and responsive layout: the password toggle changes only the input type and accessible label; the form remains usable on narrow screens and with keyboard focus.

---

### Task 1: Align password policy across frontend and API

**Files:**
- Modify: `WebApp/src/auth/password-policy.js`
- Test: `WebApp/tests/password-policy.test.js`
- Modify: `services/api/app/security.py`
- Modify: `services/api/app/schemas/auth.py`
- Test: `services/api/tests/test_security.py`
- Modify: `services/api/tests/conftest.py`
- Test: `services/api/tests/test_auth.py`
- Modify: `WebApp/README.md`
- Modify: `docs/superpowers/specs/2026-10-11-home-local-auth-design.md`

**Interfaces:**
- Produces `getPasswordRequirements(password) -> Array<{id, label, valid}>`, `getPasswordPolicyErrors(password) -> string[]`, and `getPasswordStrength(password) -> {score, maxScore: 6, label, tone}` in `WebApp/src/auth/password-policy.js`. Strength awards one point each for 8 characters, 12 characters, uppercase, lowercase, number, and symbol; labels are neutral at 0, weak at 1–2, fair at 3–4, good at 5, and strong at 6.
- `validate_password(password) -> None` in `services/api/app/security.py` raises `ValueError` unless the registration policy passes.
- Registration and login API request schemas retain a 128-character input limit; the registration policy itself has no separate maximum-length or character-composition requirement.

- [x] **Step 1: Write frontend tests** for simple valid `abcdefg1`, rejection of short/letterless/numberless values, Unicode categories, the live requirement list, and advisory strength scores.
- [x] **Step 2: Run frontend policy tests**

Run from `WebApp/`: `npm test -- tests/password-policy.test.js`

Expected: policy assertions fail against the superseded strict helper, confirming the requested simpler checklist is not implemented yet.

- [x] **Step 3: Write failing API tests** for a valid simple 8-character password, rejection only when short/letterless/numberless, preservation of the existing 128-character request cap, and login without registration-policy validation.
- [x] **Step 4: Run API policy/auth tests**

Run from `services/api/`: `\.venv\Scripts\python.exe -m pytest -q tests/test_security.py tests/test_auth.py`

Expected: FAIL on the stricter composition rules, not on imports or test setup.

- [x] **Step 5: Implement the matching JavaScript and Python rules** using Unicode categories (`L`, `N`) and Unicode code-point length. Keep login verification unchanged, update the registration fixture to a valid password, and document the exact policy in `WebApp/README.md`.
- [x] **Step 6: Verify the targeted frontend and API tests**

Run: `npm test -- tests/password-policy.test.js` from `WebApp/` and `\.venv\Scripts\python.exe -m pytest -q tests/test_security.py tests/test_auth.py` from `services/api/`.

Expected: all targeted tests pass; API rejects the same invalid registration inputs as the browser helper, and existing login remains compatible. Final full suites passed: WebApp 33/33 and API 36/36.

### Task 2: Build the prototype-inspired auth experience and live password control

**Files:**
- Modify: `WebApp/src/pages/RegisterPage.js`
- Modify: `WebApp/src/pages/LoginPage.js`
- Modify: `WebApp/src/pages/HomePage.js`
- Modify: `WebApp/src/components/Navbar.js`
- Modify: `WebApp/src/main.js`
- Modify: `WebApp/src/styles.css`
- Test: `WebApp/tests/pages.test.js`

**Interfaces:**
- `renderRegisterPage({onRegister, onNavigate})` and `renderLoginPage({onLogin, onNavigate})` render real forms and SPA links.
- The registration form displays live statuses for all policy requirements, an advisory meter with accessible value text, and an accessible show/hide control. Weak passwords never reach `onRegister`.
- Home stays intentionally minimal but shares the same visual language. Login/Register use a desktop intro + form card and stack on narrow screens.

- [x] **Step 1: Add DOM tests** for neutral initial checklist state, red unmet/green met states after input, meter updates, show/hide behavior and labels, policy-based submission blocking, valid registration callback, SPA cross-links, and the auth/home structural classes and accessible headings.
- [ ] **Step 2: Run the targeted page tests**

Run from `WebApp/`: `npm test -- tests/pages.test.js`

The DOM tests now pass against the completed registration feedback UI.

- [x] **Step 3: Implement the real registration feedback component and accessible password toggles** without changing the API request shape or storing password text outside the current input/form submission.
- [x] **Step 4: Apply the prototype-inspired UI** to Home/Login/Register and shared navigation: warm light background, muted purple accent, two-column auth layout, responsive stacked layout, visible focus styles, Thai-friendly type, and reduced-motion-safe transitions. Keep Home content minimal and leave `prototypes/` unchanged.
- [x] **Step 5: Verify targeted DOM tests and production build**

Run from `WebApp/`: `npm test -- tests/pages.test.js` and `npm run build`.

Result: page tests pass and Vite production build succeeds. Automated visual browser inspection was not completed because browser focus changed during the attempted preview check.

### Task 3: Full regression and scope verification

**Files:** No new files; verify all implementation changes.

- [x] **Step 1: Run the full frontend suite** with `npm test` and `npm run build` from `WebApp/`.
- [x] **Step 2: Run the full API suite** with `\.venv\Scripts\python.exe -m pytest -q` from `services/api/`.
- [x] **Step 3: Review the diff** to confirm password rules are aligned, login is unchanged, `git diff -- prototypes` is empty, no existing unrelated edits were overwritten, and no commit/push occurred.
- [ ] **Step 4: Inspect the rendered Home/Register pages at desktop and mobile widths** if the local browser is available; otherwise report the visual check as not performed.
