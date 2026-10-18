# Lab 10 DevOps Workflow Plan

For the implementer: execute inline with superpowers:executing-plans. Do not delegate unless the user explicitly requests delegation.

**Goal:** Add a separate Lab 10 quality-and-build workflow without changing Lab 09 or Lab 12B workflow ownership.
**Architecture:** Three independent CI jobs: lint, test/coverage, and local image build. Build images only; never log in, publish, or deploy.
**Tech stack:** GitHub Actions, Python 3.12, pinned Ruff, ESLint, npm, Docker BuildKit.
**Spec:** ../specs/2026-10-07-lab9-11-delivery-security-design.md
**Related plan:** Run after 2026-10-07-lab9-readme-status.md because both plans update README.md.

## Constraints

- Create .github/workflows/lab10-devops.yml; preserve .github/workflows/test.yml and .github/workflows/ci.yml.
- No edits under prototypes/, no teammate file edits, no image push, no deployment, no commit or push.
- Trigger on pull requests targeting main and pushes to main, matching the approved spec.
- Use supported GitHub Action majors verified against official documentation at implementation; use dependency caches for Python and npm.
- Pin Ruff to 0.16.10, the current stable release verified from the official Ruff releases page on 2026-10-07; re-check before implementation if the work is delayed.

## Review focus

- Lint covers the API Python source/tests and WebApp source/tests, not just the Lab 12B CommonJS test folder.
- Python coverage keeps the existing 90% gate and PYTHONPATH=services/api.
- Test job runs the existing Python suite and WebApp test:all.
- Build job successfully builds both root API Dockerfile and WebApp/Dockerfile but contains no registry login, push, or deployment step.
- README status badge is distinct from the Lab 09 badge and does not imply the workflow has run remotely.

## Steps

1. Inspect WebApp/eslint.config.cjs, WebApp/package.json, services/api/requirements-dev.txt, Dockerfile, WebApp/Dockerfile, and the current workflow triggers. Confirm no existing Lab 10 workflow exists.
2. Add Ruff as a pinned development dependency in services/api/requirements-dev.txt. Configure the workflow command to lint services/api/app and services/api/tests with Ruff's explicit E, F, and I rule families.
3. Extend WebApp/eslint.config.cjs with an ES-module config for WebApp/src/**/*.js and WebApp/tests/**/*.js, while retaining the existing CommonJS Lab 12B test config. Set the npm lint script to cover src and tests. Keep the two suites' language modes separate.
4. Add .github/workflows/lab10-devops.yml with separate lint, test, and build jobs. Cache pip/npm; run Ruff and ESLint in lint; run the current pytest/coverage command and npm test:all in test; build API and WebApp images locally in build. Use read-only repository permissions. Do not upload images or artifacts.
5. Add a Lab 10 status badge and a concise Testing & CI entry to README.md after the Lab 09 plan has been applied. Label the hosted workflow state as pending until a remote run can be observed.
6. Validate locally: install/update API development dependencies; run Ruff, npm ci --prefix WebApp, npm --prefix WebApp run lint, npm --prefix WebApp run test:all, npm --prefix WebApp run build, the existing Python pytest coverage command, docker build -t synapsesync-api:ci ., and docker build -t synapsesync-webapp:ci ./WebApp. Parse/review the workflow, run git diff --check, and inspect the exact changed paths. No commit or push.

**Deliverable:** A locally validated, non-publishing Lab 10 workflow and accurate README badge with existing Lab 09 and Lab 12B workflows preserved.

**Version reference:** [Official Ruff 0.16.10 release](https://github.com/astral-sh/ruff/releases/tag/0.16.10).
