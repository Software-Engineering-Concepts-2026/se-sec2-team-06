# SynapseSync Home and Local Accounts — Design

**Status:** Approved for implementation  
**Scope:** Local-first Home, registration, login, and editable profile for the existing WebApp.

## Goal

Extend the existing Vite + Vanilla JavaScript WebApp and FastAPI service so a person can open a minimal Home page, create a local account, sign in and out, and edit a profile including an optional picture. The first version runs locally. The university-provided API is intentionally deferred.

## Constraints

- Keep all existing Lab and prototype files intact. In particular, `prototypes/` is read-only and must have no diff.
- Build on `WebApp/` and `services/api/`; do not create another application root or switch frontend framework.
- Use SQLite for local persistence. Keep the database and uploaded pictures in a Git-ignored `.local/` directory.
- Do not store plain-text passwords, session secrets, or credentials in frontend code, tracked files, or API responses.
- No commit or push is part of this implementation request.

## User experience

- Public routes: `/` (Home), `/login`, and `/register`.
- Authenticated route: `/profile`; unauthenticated access returns to Login.
- A shared navbar appears on every page. When signed out it links to Home, Login, and Register; when signed in it links to Home and Profile and offers Logout.
- Home is intentionally small: product name, a short explanation, and a call to action to sign up or sign in. No study features are added in this phase.
- Registration collects display name, email, password, and password confirmation. The profile editor can add an optional bio and upload/replace an optional profile picture.
- Sign-in uses email and password. Email is normalized and unique.
- Registration password policy: at least 8 Unicode code points, at least one Unicode letter (`L`), and at least one Unicode number (`N`). These are the only complexity rules shown to the user and enforced for registration in both the browser and backend. The existing API request limit of 128 characters remains a technical input-size cap, not a composition requirement. Do not apply the registration policy to login, so existing local accounts remain usable.
- The registration password field shows a live checklist, marks unmet rules red after the user starts typing and met rules green, and includes a strength meter that is advisory rather than a separate acceptance rule. Password visibility can be toggled with an accessible button.
- Visual direction: modern minimal light theme inspired by `prototypes/sprint1/webtest/`: warm neutral background, charcoal text, muted purple accent (`#5959D6`), restrained red/green feedback, two-column auth intro and form card on desktop, stacked on narrow screens. Keep Home intentionally minimal, use the Thai-friendly sans-serif stack `Noto Sans Thai`, `Leelawadee UI`, `Tahoma`, sans-serif, and maintain visible keyboard focus and labels for form controls.

## Architecture and data flow

```text
Browser (Vite WebApp)
  ├─ pages + shared navbar
  └─ WebApp/src/api/client.js
       └─ same-origin /api/* (Vite dev proxy or Nginx in Compose)
            └─ FastAPI
                 ├─ SQLite: users and auth sessions
                 └─ .local/profile-images/: validated image files
```

The browser never connects directly to SQLite or a future university/AI provider. The API client remains the frontend boundary. In local development, Vite proxies `/api` to FastAPI; in Compose, the existing Nginx proxy continues to route `/api` to the API container.

SQLite is stored at `.local/synapsesync.db`; profile pictures are stored under `.local/profile-images/`. Docker Compose mounts `.local/` into the API container so data survives container recreation. `.local/` is excluded from Git.

## Authentication and profile API

- `POST /api/auth/register` — validate and create a user; never return `password_hash`.
- `POST /api/auth/login` — verify the password and set an opaque session cookie.
- `GET /api/auth/me` — return the current user's safe profile fields or an unauthenticated response.
- `POST /api/auth/logout` — revoke the session and clear the cookie.
- `GET /api/profile` — return the signed-in user's profile.
- `PATCH /api/profile` — update display name and optional bio for the signed-in user only.
- `PUT /api/profile/avatar` and `GET /api/profile/avatar` — upload and retrieve the signed-in user's profile picture.

Passwords are stored as Argon2id hashes. Sessions use a cryptographically random opaque token; only its hash is stored in SQLite. The cookie is `HttpOnly`, `SameSite=Lax`, has an expiry, and is `Secure` when served over HTTPS. State-changing requests validate the request origin. Logout revokes the server-side session.

Profile images are limited to JPEG, PNG, and WebP, with a 5 MB maximum. The backend validates the actual image content, generates a random storage name, and does not trust the original filename. SVG and arbitrary file uploads are not accepted. Image bytes are not stored in the users table; the table stores a storage identifier/path.

## Proposed files

```text
WebApp/
├─ vite.config.js                       # new: local /api proxy
└─ src/
   ├─ main.js                            # update: initialize router and auth state
   ├─ router.js                          # new: History API routes and guards
   ├─ styles.css                         # update: shared minimal theme and page styles
   ├─ api/client.js                      # update: auth/profile calls and safe errors
   ├─ auth/
   │  ├─ session.js                      # new: load current-user state via API
   │  └─ password-policy.js              # new: reusable client-side password feedback
   ├─ components/Navbar.js               # new: shared signed-in/signed-out navigation
   └─ pages/
      ├─ HomePage.js                     # new
      ├─ LoginPage.js                    # new
      ├─ RegisterPage.js                 # new
      └─ ProfilePage.js                  # new
WebApp/tests/
└─ password-policy.test.js               # new: password-policy unit tests
services/api/
├─ requirements.txt                      # update: SQLite ORM, password hash, upload support
├─ app/main.py                            # update: include auth/profile routers and storage config
├─ app/database.py                        # new: SQLite engine/session and tables
├─ app/models/user.py                    # new: user record
├─ app/models/auth_session.py             # new: revocable session record
├─ app/schemas/auth.py                    # new: input/output validation
├─ app/security.py                        # new: password hashing, session token handling
├─ app/routers/auth.py                    # new: register/login/me/logout
├─ app/routers/profile.py                 # new: profile and avatar endpoints
├─ app/storage/profile_images.py          # new: validate and store images
└─ tests/
   ├─ test_auth.py                        # new: signup, login, logout, and authorization cases
   └─ test_profile.py                     # new: profile updates and image validation
WebApp/nginx.conf                        # update: preserve browser Host and port to FastAPI
compose.webapp.yml                        # update: persistent .local data mount
.gitignore                                # update: ignore .local database and images
```

The existing `index.html`, `package.json`, Dockerfile, Nginx configuration, health route, and unrelated Lab documentation remain unless implementation tests show a narrowly necessary change. `prototypes/` is never edited or imported at runtime.

## Data model

`users`: `id`, normalized unique `email`, `display_name`, `password_hash`, optional `bio`, optional `avatar_key`, `created_at`, `updated_at`.  
`auth_sessions`: `id`, `user_id`, unique `token_hash`, `expires_at`, `created_at`.

Only display name, email, bio, and avatar URL may be returned to the browser. The initial optional profile field is `bio`; additional profile fields should be added when their purpose is specified, rather than accepting arbitrary database fields.

## Error handling

- Return clear field-level validation messages for invalid email, password policy, duplicate account, and mismatched password confirmation.
- Return a generic login failure for unknown email or incorrect password.
- Return `401` for missing/expired sessions and `413`/`415` for oversized or unsupported images.
- Do not expose stack traces, password hashes, session tokens, local filesystem paths, or raw provider errors.
- If the database or image storage is unavailable, show a safe error and preserve form input where practical.

## Tests and acceptance criteria

- Frontend: navigation for signed-in/signed-out states, password feedback, API client success/error states, and production build.
- Backend: registration success, password policy rejection, duplicate/normalized email, correct and incorrect login, session persistence/revocation, protected profile access, profile update isolation, valid image upload, and invalid/oversized image rejection.
- Backend tests use an isolated temporary SQLite file and temporary image directory; they must not read, overwrite, or delete `.local/` developer data.
- Local acceptance: a user can register, remain signed in after reload, log out, log in again, edit profile details, and view their uploaded image.
- Data acceptance: account/session data is in SQLite and profile images are local files; recreating the Compose containers preserves both through the `.local/` mount.
- Security acceptance: responses contain no password hash or session token; passwords are hashed; invalid upload content is rejected.
- Scope acceptance: `git diff -- prototypes` is empty; university API and AI calls remain unimplemented; no secret is committed; no commit or push is performed.

## Non-goals

- University API, AI provider integration, email verification, password reset email, external hosting, or study-management features.
- Production identity-provider integration or multi-factor authentication.
- Reusing or modifying any file in `prototypes/`.

## Future university API integration

The API client and FastAPI route boundary are kept explicit so a later university-provided service can be integrated without putting credentials in the browser. The local SQLite account store is a development implementation; it is not assumed to be the university's identity system. Any migration or replacement of account identity will be a separately reviewed change.
