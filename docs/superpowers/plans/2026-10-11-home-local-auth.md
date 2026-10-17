# SynapseSync Local Accounts and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing WebApp scaffold into a local-first app with a shared navbar, minimal Home, working registration/login/logout, and a protected editable profile with an optional avatar.

**Architecture:** Keep the existing Vite + vanilla JavaScript frontend and FastAPI backend. The browser calls same-origin `/api/*`; FastAPI validates inputs, stores account/session records in SQLite, and stores validated avatar files locally. Vite proxies API requests during local development, while the existing Nginx proxy serves the same API boundary in Compose.

**Tech Stack:** Existing Vite 7, vanilla JavaScript, Vitest, FastAPI, pytest, and Docker Compose; add SQLAlchemy 2 for SQLite, `pwdlib[argon2]` for Argon2id password hashing, `email-validator` for email validation, `python-multipart` for uploads, and Pillow for image-content validation.

**Spec:** `docs/superpowers/specs/2026-10-11-home-local-auth-design.md`

## Global Constraints

- Do not edit, move, delete, or import runtime code from `prototypes/`; verify `git diff -- prototypes` is empty.
- Do not commit, stage, or push any changes as part of this implementation.
- Preserve existing Lab work and unrelated modified/untracked files; do not reformat unrelated README or documentation.
- On implementation, isolate the app work from the active Lab 12B branch; prepare a separate worktree from a verified base before editing.
- Put developer SQLite data and uploaded avatars only under the Git-ignored `.local/`; tests must use pytest temporary directories and never touch `.local/`.
- Never return password hashes or session tokens, and never store plain-text passwords or raw session tokens in SQLite.
- Keep university API, AI provider, external deployment, and study-management features out of scope.
- Keep API errors safe and user-facing; do not expose stack traces, local paths, or submitted file names.

## Review Focus

1. **Weak password or inconsistent validation:** backend tests reject passwords below 8 characters or missing a letter/digit; frontend unit tests cover the same policy and feedback.
2. **Account enumeration or secret leakage:** auth tests assert unknown-email and wrong-password responses are identical and that responses/database rows contain no raw password or session token.
3. **Session reuse after logout/expiry:** auth tests assert logout revokes a session, expired sessions cannot access `/me`, and the cookie is HttpOnly with the expected SameSite/expiry attributes.
4. **Avatar content spoofing and resource abuse:** profile tests reject MIME/content mismatches, SVG, and files over 5 MB, while accepting a valid JPEG/PNG/WebP and serving it back.
5. **Cross-account profile access (IDOR):** profile tests create two users and verify each can only read or modify the account identified by their own authenticated session.

---

## Task 1: Add SQLite, password, and session foundations

**Files:** `services/api/requirements.txt`, `services/api/app/database.py`, `services/api/app/models/__init__.py`, `services/api/app/models/user.py`, `services/api/app/models/auth_session.py`, `services/api/app/security.py`, `services/api/tests/test_database.py`, `services/api/tests/test_security.py`.

**Interfaces:** `create_session_factory(database_url) -> sessionmaker`; SQLAlchemy `Base`, `User`, and `AuthSession` models; `validate_password(password) -> None` (raises `ValueError` for policy failure); `hash_password(password) -> str`; `verify_password(password, encoded_hash) -> bool`; `new_session_token() -> str` returning only a random raw token; `hash_session_token(raw_token) -> str` returning its SHA-256 digest for database storage.

- [x] Write tests first for password length/letter/digit boundaries, Argon2id hash verification, distinct random session tokens, digest-only storage, SQLite user email uniqueness, and session-to-user foreign key.
- [x] Run `python -m pytest -q tests/test_security.py tests/test_database.py` from `services/api/` and confirm the new tests fail because the interfaces are not implemented.
- [x] Add the smallest implementation and dependencies; create the SQLite parent directory when opening the database, but do not create `.local/` during tests.
- [x] Re-run the targeted pytest command and confirm all new foundation tests pass.

## Task 2: Implement registration, login, current-session, and logout APIs

**Files:** `services/api/app/main.py`, `services/api/app/schemas/auth.py`, `services/api/app/routers/auth.py`, `services/api/tests/conftest.py`, `services/api/tests/test_auth.py`.

**Interfaces:** `create_app(database_url=None, image_storage_dir=None, cookie_secure=None) -> FastAPI`; `POST /api/auth/register` creates an account and session and returns only safe user fields; `POST /api/auth/login` verifies credentials and sets the opaque session cookie; `GET /api/auth/me` returns the current safe user; `POST /api/auth/logout` revokes the current session and clears the cookie. Normalize email with trim + case-fold and enforce uniqueness in SQLite. Use the same generic `401` response for unknown email and incorrect password. Require a matching request `Origin` for state-changing auth routes.

- [x] Write API tests first for successful registration, invalid email/password, duplicate email after normalization, safe response fields, matching generic login failures, successful login, `/me` with and without a session, logout revocation, expired sessions, cookie flags, and rejected foreign Origin.
- [x] Run `python -m pytest -q tests/test_auth.py` from `services/api/` and confirm expected failures before implementing routes.
- [x] Implement request/response schemas, app-scoped temporary test configuration, database initialization, auth dependency, Argon2id verification, hashed opaque sessions, cookie set/clear, and origin validation.
- [x] Re-run `python -m pytest -q tests/test_security.py tests/test_database.py tests/test_auth.py` from `services/api/`; confirm the prior health tests still pass with `python -m pytest -q`.

## Task 3: Add protected profile editing and safe avatar storage

**Files:** `services/api/requirements.txt`, `services/api/app/routers/profile.py`, `services/api/app/storage/__init__.py`, `services/api/app/storage/profile_images.py`, `services/api/app/main.py`, `services/api/tests/test_profile.py`.

**Interfaces:** `GET /api/profile` and `PATCH /api/profile` operate only on the authenticated user; `PUT /api/profile/avatar` accepts multipart field `file` up to 5 MB; `GET /api/profile/avatar` serves that user's stored avatar. `validate_and_store_avatar(upload, storage_dir) -> str` returns a random storage key only after Pillow verifies decoded JPEG/PNG/WebP content; it must ignore the original filename and reject SVG or mismatched content.

- [x] Write tests first for unauthenticated `401`, profile update persistence, two-user isolation, valid image upload/retrieval, spoofed MIME or invalid bytes, SVG rejection, and a 5 MB + 1 byte upload returning `413`.
- [x] Run `python -m pytest -q tests/test_profile.py` from `services/api/` and confirm expected failures.
- [x] Implement protected profile routes and bounded upload reads; store image files only in the configured local image directory and expose no filesystem path.
- [x] Re-run all API tests with `python -m pytest -q` from `services/api/`; verify tests use only `tmp_path` storage.

## Task 4: Build frontend API, password, session, and route boundaries

**Files:** `WebApp/src/api/client.js`, `WebApp/src/auth/password-policy.js`, `WebApp/src/auth/session.js`, `WebApp/src/router.js`, `WebApp/tests/api-client.test.js`, `WebApp/tests/password-policy.test.js`, `WebApp/tests/session.test.js`, `WebApp/tests/router.test.js`.

**Interfaces:** API client exports `register`, `login`, `getCurrentUser`, `logout`, `getProfile`, `updateProfile`, and `uploadAvatar`; all use same-origin `/api`, safe `ApiError`s, and browser same-origin cookies. `getPasswordPolicyErrors(password) -> string[]`; session module exports `loadSession()` and `getSessionUser()`; `resolveRoute(pathname, user) -> { path, page }` maps `/`, `/login`, `/register`, `/profile` and redirects signed-out users away from `/profile`.

- [x] Add failing Vitest cases for password policy boundaries, request paths/methods/body and multipart upload, safe API failures, session restoration/clearing, and route guard behavior.
- [x] Run `npm test -- tests/password-policy.test.js tests/router.test.js tests/api-client.test.js` from `WebApp/` and confirm tests fail before implementation.
- [x] Implement those pure boundaries without storing credentials or session tokens in browser storage; rely only on the HttpOnly cookie.
- [x] Re-run the targeted Vitest command and the existing `npm test` suite from `WebApp/`.

## Task 5: Add Home, shared navigation, login/register, and profile UI

**Files:** `WebApp/src/main.js`, `WebApp/src/components/Navbar.js`, `WebApp/src/pages/HomePage.js`, `WebApp/src/pages/LoginPage.js`, `WebApp/src/pages/RegisterPage.js`, `WebApp/src/pages/ProfilePage.js`, `WebApp/src/styles.css`, `WebApp/tests/pages.test.js`, `WebApp/package.json`, `WebApp/package-lock.json`.

**Interfaces:** `renderHomePage({ user, onNavigate })`, `renderLoginPage({ onLogin })`, `renderRegisterPage({ onRegister })`, and `renderProfilePage({ user, onUpdate, onAvatarUpload })` return DOM elements; `renderNavbar(user, { navigate, onLogout }) -> HTMLElement` renders shared signed-out or signed-in links. `main.js` initializes the session, handles History API navigation and `popstate`, calls the route guard, and mounts each page in `#app`. Forms call the API client and show field-level validation or safe errors without discarding user input.

- [x] Add `jsdom` as a WebApp dev dependency and failing DOM tests for Home copy and calls to action, shared navbar links in both auth states, labeled login/register/profile controls, password confirmation feedback, avatar preview, and safe display of user-entered text.
- [x] Run the targeted page tests and confirm they fail before adding page renderers.
- [x] Implement the four routes and responsive light visual system using the approved colors and Thai sans-serif stack; include visible keyboard focus, semantic headings, labels, and `aria-live` form feedback.
- [x] Re-run all Vitest tests; confirm registration signs in, refresh restores the session through `/me`, logout returns to signed-out navigation, and profile edits/avatar display use the API only.

## Task 6: Wire local development and Compose persistence; document acceptance

**Files:** `WebApp/vite.config.js`, `WebApp/tests/runtime-config.test.js`, `WebApp/nginx.conf`, `compose.webapp.yml`, `.gitignore`, `WebApp/README.md`.

**Interfaces:** `createViteConfig(proxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000')` configures the `/api` proxy; local API storage defaults to the repository's `.local/`, while Compose sets `SYNAPSESYNC_DATA_DIR=/data` and bind-mounts `./.local:/data`; `.local/` is Git-ignored. Document local API/frontend startup and the Compose URL.

- [x] Write failing Vitest tests for `createViteConfig()` and the Nginx host/port forwarding contract; observe the expected failures before adding the configurations.
- [x] Configure the API to initialize SQLite at the configured data directory; update Compose and ignore rules without adding generated database/image files to Git. Preserve the browser Host including port through Nginx so same-origin validation works under Compose.
- [x] Update `WebApp/README.md` with PowerShell-friendly local startup steps, `http://localhost:5173`, Compose startup at `http://localhost:8080`, and data persistence location.
- [x] Run `npm test` and `npm run build` from `WebApp/`; run `python -m pytest -q` from `services/api/`; run `docker compose -f compose.webapp.yml config -q`. This branch's current package scripts do not include Lab-only `test:all` or `lint` scripts.
- [ ] Build the Compose services and verify persistence after container recreation; Docker Desktop was not running, so the daemon and persistence test remain unavailable.
- [x] Smoke-check Home, Login, and Register in the browser without creating a real account; API integration tests cover registration, session restoration, logout, login, profile edits, and avatar behavior. Verify `.local/` is ignored, no generated database/images or secrets are tracked, and `git diff -- prototypes` is empty.
- [x] Stop without staging, committing, or pushing; report the remaining Docker/browser acceptance check.
