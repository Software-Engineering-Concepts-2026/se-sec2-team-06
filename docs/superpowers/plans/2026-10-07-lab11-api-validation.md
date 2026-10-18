# Lab 11 API Validation Plan

For the implementer: execute inline with superpowers:executing-plans. Do not delegate unless the user explicitly requests delegation.

**Goal:** Demonstrate server-side request validation with a small, deterministic API route and tests.
**Architecture:** A Pydantic request model validates and trims a question before a stateless handler returns JSON. No model, database, authentication, or browser rendering is involved.
**Tech stack:** Existing FastAPI, Pydantic, httpx ASGI tests, pytest.
**Spec:** ../specs/2026-10-07-lab9-11-delivery-security-design.md
**Related plan:** Run before the Lab 11 secret-scanning plan, which appends scanner details to docs/lab11/security.md.

## Constraints

- Create services/api/app/schemas/question.py, services/api/app/routers/questions.py, services/api/tests/test_questions.py, and docs/lab11/security.md; update services/api/app/main.py and README.md only for route registration/documentation links.
- Preserve existing root and health response contracts.
- Do not edit prototypes/, any teammate-owned files, or add persistence/auth/AI integration.
- Do not commit or push.

## Review focus

- POST /api/questions/validate accepts a JSON object with question text, trims surrounding whitespace, and accepts 1 through 2,000 characters after trimming.
- Valid response is exactly valid=true and the normalized question. Missing, blank, wrong-type, and oversized input returns FastAPI 422.
- A hostile-looking string remains ordinary JSON data and is not interpreted as markup.
- Notes accurately state this route is unauthenticated, non-persistent, and not connected to an AI provider. Future SQL access must use parameters; future browser rendering must use textContent.

## Steps

1. Add services/api/tests/test_questions.py first. Reuse the async httpx.ASGITransport pattern from test_health.py. Cover one-character lower bound, whitespace trimming, exactly 2,000 characters after trimming, 2,001-character rejection, blank text, missing field, wrong JSON type, and a hostile-looking input returned unchanged as JSON data.
2. Run the focused test file and confirm the new-route cases fail because the route/model do not exist yet; retain the existing health tests as a compatibility baseline.
3. Implement a Pydantic request schema that trims before applying length validation. Keep the route handler deterministic and return only the agreed response fields.
4. Register the question router under /api in services/api/app/main.py without changing the legacy health/root router registration. Re-run focused tests, then all API tests and the existing repository pytest/coverage gate.
5. Create docs/lab11/security.md to describe the validation boundary, test cases, non-goals, parameterized-query guidance, and safe future browser rendering. Add a README link and label the route as a demonstration rather than production authentication or AI integration.
6. Review OpenAPI route visibility and verify representative success and 422 payloads through tests. Run git diff --check and confirm prototypes/ and teammate paths are untouched. No commit or push.

**Deliverable:** A tested, stateless validation endpoint with explicit limitations and accurate documentation.
