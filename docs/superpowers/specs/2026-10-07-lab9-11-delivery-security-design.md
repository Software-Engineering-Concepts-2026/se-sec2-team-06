# Lab 9–11 Delivery and Security Remediation

**Date:** 2026-10-07
**Status:** Draft for user review — implementation has not started
**Target repository:** `se-sec2-team-06-main-new`
**Target branch:** existing `feature/safety-net`

## Goal

Close the code/documentation gaps found while reviewing Labs 9, 10, and 11, using the exact Lab 9 sheet and the Chapter 10/11 material currently provided. Keep the work local for review: do not commit or push, do not publish an image or deploy externally, and do not edit files owned by Chaiwat or Shuwichada.

## Current evidence and constraints

- Lab 9 artifacts already include unit tests, five FizzBuzz cases, three Hypothesis properties, the RED → GREEN → Refactor commit sequence, a pytest/coverage workflow, Saboteur Journal, reflection, and AI usage disclosure. The CI-matching local command passed 39 tests with 100% coverage on the measured Python source.
- README currently has no GitHub Actions status badge. The Saboteur Journal says branch protection and required checks still need GitHub-side configuration; those settings and the latest remote Actions run cannot be verified from this local change.
- Lab 10 currently has a Python test workflow, a Lab 12B lint/test workflow, a GitHub Pages deployment workflow, and a Compose file for only the WebApp and API. There is no app-image publish/deploy target selected.
- The FastAPI app currently exposes only service-discovery and health routes. There is no persistence, authentication, or AI-provider integration to harden.
- The supplied Lab 10 and Lab 11 sources are chapter material, not dedicated lab submission rubrics. Acceptance below is therefore provisional against those chapter exercises.
- A possible XSS sink was observed in a teammate-owned prototype. It is explicitly out of scope for edits in this work; any remediation there requires separate approval/owner handoff.

## Design

### Lab 9 — make the existing status accurate and discoverable

1. Add a README badge linked to `.github/workflows/test.yml`.
2. Keep the existing tests and workflow behavior unchanged.
3. Clarify README status: local suite/coverage is verified; GitHub branch protection, required-check enforcement, and current remote Actions status remain pending manual verification. Do not claim those remote requirements are complete based only on local tests.

### Lab 10 — add a separate CI/build path and local service stack

1. Add a new workflow at `.github/workflows/lab10-devops.yml` rather than changing `.github/workflows/ci.yml`, which currently belongs to Lab 12B.
2. On pull requests to `main` and pushes to `main`, run lint, tests/coverage, and build as independent jobs with dependency caching. Use Ruff for Python lint and the existing ESLint script for JavaScript. Keep the existing 90% Python coverage gate. Build the WebApp and API Docker image; do not publish or deploy it. Add a README badge for this workflow as well as the Lab 9 badge.
3. Extend `compose.webapp.yml` with PostgreSQL and Redis services, health checks, and environment-variable configuration suitable for local development. Add a root `.env.example` containing placeholders only, and ensure real `.env` files remain ignored.
4. Document the DORA metric definitions and a measurement worksheet in `docs/lab10/dora.md`. Do not invent deployment frequency, lead time, change-failure rate, or MTTR values. Explicitly note that the present stack does not yet connect the API to PostgreSQL/Redis.

### Lab 11 — demonstrate server-side validation and secret hygiene

1. Add a small, non-persistent validation route at `POST /api/questions/validate`. Its request body is `{"question": "..."}`; trim surrounding whitespace; accept 1–2,000 characters after trimming; return `{"valid": true, "question": "<trimmed value>"}` for valid input; and use FastAPI's standard 422 response for missing, blank, wrong-type, or oversized input. Use a Pydantic request model. The route must not call an AI provider, store data, or imply that authentication/authorization exists.
2. Add API tests for valid lower/upper boundaries, blank/missing/oversized input, and a hostile-looking string returned as JSON data rather than interpreted as HTML. Document that any future browser UI must render this text with `textContent`, not HTML insertion. Do not use keyword deny-lists as an SQL-injection defense; document that any future database access must use parameterized queries.
3. Add a secret-scanning workflow using Gitleaks for pull requests and pushes, and document environment-variable handling. Do not put real keys or credentials in the repository or workflow. The exact action version will be selected from its official documentation during implementation.
4. Add a short security note in `docs/lab11/security.md` describing tested behavior, secret handling, scan scope, and limitations. Do not edit any file under `prototypes/` in this task.

## Proposed files

- Update: `README.md`, `.gitignore`, `compose.webapp.yml`, `services/api/requirements-dev.txt`
- Add: `.env.example`
- Add: `.github/workflows/lab10-devops.yml`, `.github/workflows/lab11-secret-scan.yml`
- Add: `services/api/app/schemas/question.py`, `services/api/app/routers/questions.py`, `services/api/tests/test_questions.py`
- Add: `docs/lab10/dora.md`, `docs/lab11/security.md`
- Preserve unchanged: existing Lab 9 tests/workflow, `.github/workflows/ci.yml`, all teammate-owned files, all files under `prototypes/`

## Acceptance criteria

1. Existing Lab 9 Python CI command still passes; README badge points to the correct workflow and status wording does not overstate remote verification.
2. The new Lab 10 workflow has separate lint, test, and build jobs with caching; no publish/deploy job runs.
3. Compose config validates and describes WebApp, API, PostgreSQL, and Redis; no credentials are committed, and database/cache non-integration is documented.
4. DORA worksheet defines all four metrics and leaves actual measurements blank until the team supplies a period and source data.
5. Validation endpoint returns appropriate 4xx responses for invalid payloads and safely treats arbitrary question text as data. New tests demonstrate these cases.
6. Secret scan workflow runs on pull requests and pushes without requiring committed secrets; its behavior can be checked locally where the scanner is available.
7. Relevant Python tests, WebApp tests, lint, workflow/config validation, and Docker build are run locally and reported with actual results.
8. No Git commit, Git push, registry publish, external deployment, GitHub settings mutation, or teammate-file edit occurs.

## Explicitly deferred

- GitHub branch protection/required checks: repository-admin setting; provide a checklist, but do not mutate it here.
- Docker Hub/GHCR publishing and cloud deployment: no destination has been selected, and this task is local-only.
- Real authentication, database integration, Redis usage, AI-provider calls, and final personal Post-quiz reflections. If a reflection template is added, leave it clearly marked for the student to complete; do not fabricate first-person experience.
- Any change to the teammate-owned prototype XSS candidate; report it to its owner for separate approval.

## Review note

Please review this scope before implementation. In particular, confirm whether the proposed validation-only API route is acceptable and whether leaving image publication/deployment and GitHub branch protection deferred matches the Lab 10/11 submission expectations. The official Lab 10/11 lab sheets, if available, should replace these provisional chapter-based acceptance criteria.
