# Use Supabase DATABASE_URL for Persistent App Data

> **For agentic workers:** Execute inline with `superpowers:executing-plans`; follow TDD for the task.

**Goal:** Make the deployed API authenticate against the existing Supabase PostgreSQL database so account records survive Render redeploys.

**Architecture:** Keep the explicit `database_url` argument as the highest-priority override, read `DATABASE_URL` from the environment for deployment, and keep the local SQLite fallback when no URL is configured. Normalize PostgreSQL URLs to SQLAlchemy's psycopg 3 driver and add that runtime driver; do not change Supabase schema, rows, secrets, or password hashes.

**Tech Stack:** FastAPI, SQLAlchemy, psycopg 3, pytest, Supabase PostgreSQL.

**Spec:** Current user request and evidence: the Supabase `public.users` table has accounts, Render service has `DATABASE_URL`, and `create_app` currently ignores that environment variable.

## Global Constraints

- Never expose or log the database connection string.
- Do not change the Supabase schema or existing rows.
- Preserve SQLite behavior for local development and explicit test databases.
- Keep explicit `create_app(database_url=...)` overrides ahead of environment configuration.

## Review Focus

- `DATABASE_URL` must take precedence over the local SQLite fallback.
- Explicit database URLs must override `DATABASE_URL`.
- `postgres://` and `postgresql://` must use the installed psycopg driver.
- SQLite URLs must remain unchanged and must not require psycopg.
- Tests must not connect to the user's remote Supabase project.

---

### Task 1: Use the configured persistent database

**Files:**
- Modify: `services/api/app/main.py`
- Modify: `services/api/app/database.py`
- Modify: `services/api/requirements.txt`
- Test: `services/api/tests/test_main.py`
- Test: `services/api/tests/test_database.py`

**Interfaces:**
- `create_app(database_url=...)` remains the explicit override; otherwise use `DATABASE_URL`, falling back to the existing local SQLite path.
- `create_session_factory(database_url)` normalizes PostgreSQL aliases to `postgresql+psycopg` before engine creation.

- [x] Write tests for environment URL selection, explicit override, and PostgreSQL URL normalization.
- [x] Run PostgreSQL URL tests and confirm they fail for the current implementation; run the environment-selection regression separately.
- [x] Implement environment URL precedence and psycopg normalization; add the psycopg runtime dependency.
- [x] Run focused tests, the full API suite, and `git diff --check`.
- [x] Commit and push to `codex/home-local-auth`; verify Render's deployment status without exposing secrets.
