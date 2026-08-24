# Lab 06 First Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง FastAPI service ที่ทำงานได้จริง พร้อม production-oriented Dockerfile, Docker documentation, Lab 06 reflection/AI disclosure และ push Git branch ที่ผ่านการตรวจเท่าที่ environment รองรับ

**Architecture:** เพิ่ม `services/api/` เป็นจุดเริ่มต้นของ FastAPI Modular Monolith โดยมี health endpoint สำหรับ container probe Root Dockerfile ใช้ Python slim แบบ multi-stage, virtual environment, non-root user และ port 8000

**Tech Stack:** Python 3.12.13, FastAPI 0.141.1, Uvicorn 0.52.4, pytest 9.1.1, HTTPX 0.28.1, Docker image `python:3.12.13-slim-bookworm`

**Spec:** User-approved Lab 06 scope in the current conversation; continues `docs/superpowers/specs/2026-08-24-lab05-architecture-design.md`

## Global Constraints

- Work on branch `feat/first-container-synapsesync-Thakorn`
- Do not edit paths containing `Chaiwat` or `shuwichada` case-insensitively
- Preserve all existing Lab 02–05 changes
- Do not invent Docker build/run/image-size evidence: Docker CLI is currently unavailable
- Commit and push the Git branch only after available tests and static checks pass
- Docker registry image push remains blocked until Docker and registry credentials are available

---

### Task 1: Health API Contract — TDD Red

**Files:**
- Create: `services/api/tests/test_health.py`
- Create: `services/api/requirements.txt`
- Create: `services/api/requirements-dev.txt`

**Interfaces:**
- Consumes: `GET /health`
- Produces: HTTP 200 JSON contract with `status`, `service`, `architecture`, and `version`

- [x] Create a test using HTTPX `ASGITransport` that expects status 200 and this literal payload:

```json
{
  "status": "healthy",
  "service": "synapsesync-api",
  "architecture": "modular-monolith",
  "version": "0.1.0"
}
```

- [x] Install pinned test dependencies into a temporary dependency directory outside the repository
- [x] Run pytest and verify RED because `app.main` does not exist

### Task 2: Minimal FastAPI Service — TDD Green

**Files:**
- Create: `services/api/app/__init__.py`
- Create: `services/api/app/main.py`
- Create: `services/api/app/routers/__init__.py`
- Create: `services/api/app/routers/health.py`

**Interfaces:**
- Produces: ASGI app `app.main:app`
- Produces: `GET /health` with the Task 1 payload
- Produces: `GET /` with service name, documentation path, and prototype/MVP status

- [x] Implement only enough health behavior to satisfy the failing test
- [x] Run the focused test and verify GREEN
- [x] Add a second failing test for the root discovery response
- [x] Implement the root response and rerun the full API test suite

### Task 3: Container Configuration

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `services/api/requirements.txt` and `services/api/app/`
- Produces: Container command `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Produces: Healthcheck `GET http://127.0.0.1:8000/health`

- [x] Write a multi-stage Dockerfile using pinned `python:3.12.13-slim-bookworm`
- [x] Install dependencies into `/opt/venv` in the builder stage
- [x] Create UID/GID 10001 non-root runtime user, `EXPOSE 8000`, and a Python stdlib `HEALTHCHECK`
- [x] Create `.dockerignore` excluding `.git`, `.env*`, caches, IDE files, node modules, tests, docs assets, and generated output while keeping service requirements/app files
- [x] Run static assertions for stages, pinned base, non-root `USER`, `EXPOSE`, `HEALTHCHECK`, and required COPY paths

### Task 4: Lab 06 Documentation

**Files:**
- Create: `docker/README.md`
- Modify: `reflect.md`
- Modify: `AI_USAGE.md`

**Interfaces:**
- Documents: image `synapsesync-api:v0.1.0`, build/run/curl commands, environment handling, Container vs VM trade-off, and actual verification status

- [x] Document build, run, health check, stop, image inspection, environment variables, troubleshooting, security choices, and ESP §5.4 trade-off
- [x] Record Docker CLI unavailable and leave registry/image-size fields explicitly unverified
- [x] Append Post-quiz 6 reflections for Dockerfile, service decomposition, and REST endpoint without deleting Lab 05 reflection
- [x] Append Lab 06 tools, 2+ prompts, accepted AI content, human decisions, and verification boundaries to `AI_USAGE.md`

### Task 5: Verification, Commit, and Push

**Files:**
- Verify all Lab 02–06 changes in the branch

**Interfaces:**
- Produces: Git commit and remote branch `origin/feat/first-container-synapsesync-Thakorn`

- [x] Run API pytest suite
- [x] Run existing Sprint 1 browser tests
- [x] Start Uvicorn locally and verify `/health` returns HTTP 200
- [x] Run JavaScript syntax checks and `git diff --check`
- [x] Validate local Markdown links and protected-path status
- [x] Confirm no secrets, `.env`, cache, test dependencies, or temporary files are staged
- [ ] Commit all approved Lab 02–06 work with a descriptive message
- [ ] Push the branch to origin
- [ ] Report Docker registry image push as blocked unless Docker becomes available
