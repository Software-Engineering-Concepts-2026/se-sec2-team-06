# Lab 06 — First Container Implementation Plan

> **สำหรับผู้ดำเนินงาน:** แผนนี้จะทำใน branch `feature/lab6-dockerfile-Thakorn` ของ `se-sec2-team-06-main-new` หลังจาก design spec ได้รับอนุมัติแล้ว โดยทำทีละ task และตรวจผลก่อนขยับไป task ถัดไป

**Goal:** ทำให้ SynapseSync มี FastAPI Modular Monolith container แรกที่ build/run ได้จาก root repository, มี health contract ที่ทดสอบได้, และมีเอกสาร Lab 6 ครบโดยไม่แตะงานของสมาชิกคนอื่น

**Architecture:** ใช้ API container เดียวเป็น deployment unit แรกของ Modular Monolith ภายใน image มีแอป FastAPI และ production dependencies เท่านั้น ส่วน `services/stats-service/` ยังคงเป็น placeholder และไม่ถูกนำมาเป็น service หลัก

**Tech Stack:** Python 3.12.13 slim-bookworm, FastAPI, Uvicorn, pytest/httpx สำหรับ dev test, Docker multi-stage build, Markdown และ Mermaid ตามเอกสาร Lab 5

**Spec:** `docs/superpowers/specs/2026-08-26-lab6-first-container-design.md`

## Global Constraints

- ทำงานเฉพาะ `D:\Project SE Sce 2\se-sec2-team-06-main-new`; อ่าน `D:\Project SE Sce 2\se-sec2-team-06` ได้เฉพาะเป็น reference แบบ read-only
- ใช้ branch `feature/lab6-dockerfile-Thakorn` จาก `ff33ec9 docs(lab5): align architecture artifacts`
- ห้าม stage, restore หรือลบ `docs/team/chaiwat.md` และไฟล์ Lab 2 ที่มีอยู่ก่อนแล้วใน working tree
- ไม่แก้ไฟล์ในงานของ Chaiwat/Shuwichada และไม่สร้าง branch/worktree ให้สมาชิก
- ห้ามใช้ `latest`, secret, credential, hostname จริง หรือข้อมูลส่วนบุคคลใน Dockerfile/เอกสาร
- ห้ามแยก service เป็น Microservices, เพิ่ม database/LLM integration, Compose หรือ orchestration ใน Lab นี้
- ไม่ push image ไป registry จนกว่าจะได้รับ registry/namespace/สิทธิ์จากผู้ใช้ชัดเจน
- ทุก task ต้องตรวจด้วยคำสั่งที่ระบุ และต้องผ่าน `git diff --check` ก่อน commit

---

### Task 1: ตรวจ baseline และล็อกขอบเขตไฟล์

**Files/paths:**

- Branch/repo: `D:\Project SE Sce 2\se-sec2-team-06-main-new`
- Read-only reference: `D:\Project SE Sce 2\se-sec2-team-06`
- Approved scope: root Docker files, `services/api/`, `docker/README.md`, root `README.md`, `AI_USAGE.md`, `reflect.md`

**Interfaces:**

- Consumes: branch HEAD และ Lab 6 spec ที่อนุมัติแล้ว
- Produces: inventory ของไฟล์เดิม, รายการไฟล์ที่จะเปลี่ยน และ guard ว่าการแก้ไม่ปนงานเดิม

- [ ] **Step 1: Verify branch and baseline commit**

  ```powershell
  git branch --show-current
  git log -1 --oneline
  ```

  Expected: `feature/lab6-dockerfile-Thakorn` และ commit `ff33ec9` หรือ commit spec ล่าสุดบน branch นี้

- [ ] **Step 2: Inspect existing Docker/API placeholders and reference implementation**

  ```powershell
  rg --files services . | rg "(Dockerfile|dockerignore|requirements|app|tests|README)"
  Get-Content services/stats-service/app.py
  Get-Content services/stats-service/Dockerfile
  ```

  Record that the stats-service files are placeholders and that the target API will be created under `services/api/`.

- [ ] **Step 3: Freeze unrelated changes**

  ```powershell
  git status --short --untracked-files=all
  git diff -- docs/team/chaiwat.md
  ```

  Do not add or restore the pre-existing deletion/untracked Lab 2 files in later commits.

---

### Task 2: Write the API contract tests first

**Files:**

- Create: `services/api/tests/test_health.py`
- Create: `services/api/requirements-dev.txt`
- Create: `services/api/requirements.txt`

**Interfaces:**

- Tests define the exact public contract for `/` and `/health`
- Production requirements contain only FastAPI/Uvicorn; dev requirements add pytest/httpx

- [ ] **Step 1: Add pinned dependencies**

  Pin the approved reference versions in the spec (`fastapi==0.141.1`, `uvicorn==0.52.4`, `httpx==0.28.1`, `pytest==9.1.1`) and keep dev requirements layered on production requirements.

- [ ] **Step 2: Add failing contract tests**

  Test HTTP 200 and exact JSON for:

  - `GET /health`: `status`, `service`, `architecture`, `version`
  - `GET /`: service discovery with `/health` and `/docs`

  Keep tests independent of Docker; they exercise the same ASGI app that the image will start.

- [ ] **Step 3: Run the tests before implementation**

  ```powershell
  & "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m pytest services/api/tests -q
  ```

  Expected at this checkpoint: collection/import failure is acceptable because `app/` has not been implemented yet; record the failing reason rather than hiding it.

---

### Task 3: Implement the minimal FastAPI application

**Files:**

- Create: `services/api/app/__init__.py`
- Create: `services/api/app/main.py`
- Create: `services/api/app/routers/__init__.py`
- Create: `services/api/app/routers/health.py`

**Interfaces:**

- `app.main:app` is the Uvicorn import target
- `create_app()` returns a FastAPI instance with the health router included
- Endpoint payloads stay compatible with the tests and Lab 5 architecture docs

- [ ] **Step 1: Define package version**

  Set `__version__ = "0.1.0"` in one package location so `/health` and image documentation cannot drift.

- [ ] **Step 2: Implement the router and app factory**

  Add `/` and `/health` routes, title/description/version metadata, and disable ReDoc only if the reference behavior requires it. Do not add persistence, authentication, or business logic.

- [ ] **Step 3: Run the contract tests again**

  ```powershell
  & "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m pytest services/api/tests -q
  ```

  Expected: all tests pass.

- [ ] **Step 4: Run an ASGI smoke check**

  Start Uvicorn locally with the bundled Python runtime, request `/health`, then stop it. If a process cannot be started in the environment, use the passing `TestClient` contract and record the limitation.

---

### Task 4: Add the production multi-stage Docker image

**Files:**

- Create: root `Dockerfile`
- Modify: root `.dockerignore`

**Interfaces:**

- Build context is repository root (`.`)
- Image command imports `app.main:app` from `/app`
- Runtime listens on container port 8000 and runs as non-root

- [ ] **Step 1: Implement the builder stage**

  Use `python:3.12.13-slim-bookworm`, create `/opt/venv`, install only `services/api/requirements.txt`, and avoid pip cache. Keep dependency copy before source copy for cache reuse.

- [ ] **Step 2: Implement the runtime stage**

  Copy only `/opt/venv` and `services/api/app`, create `appuser` UID/GID 10001, set `WORKDIR /app`, `USER appuser`, `EXPOSE 8000`, a `/health` `HEALTHCHECK`, and the Uvicorn command.

- [ ] **Step 3: Complete `.dockerignore`**

  Retain Git/venv/IDE/cache exclusions and add explicit exclusions for `node_modules`, `.env`, `.env.*`, tests, dev requirements, docs, prototypes, logs, and the unused stats-service. Do not exclude `services/api/requirements.txt` or `services/api/app/`.

- [ ] **Step 4: Run static Dockerfile checks**

  ```powershell
  git diff --check
  docker build --check -t synapsesync-api:check .
  ```

  If `docker` is unavailable (known current environment limitation), run the Git check and inspect every Dockerfile instruction manually; do not claim an image build passed.

---

### Task 5: Write the Lab 6 Docker documentation

**Files:**

- Create: `docker/README.md`
- Modify: root `README.md`

**Interfaces:**

- `docker/README.md` is the authoritative Lab 6 build/run guide
- Root README links to it and no longer advertises the unrelated placeholder stats-service command

- [ ] **Step 1: Document image and local commands**

  Include image name/version (`synapsesync-api:v0.1.0`), root-context build, `docker run --rm -p 8000:8000`, `/health` verification, `/docs`, stop/cleanup, and expected response.

- [ ] **Step 2: Document configuration and security**

  State that no secret is required for this health-only prototype, list non-root runtime, pinned base/dependencies, `.dockerignore`, `EXPOSE`, healthcheck, and the slim-vs-Alpine trade-off.

- [ ] **Step 3: Document Container vs VM using ESP §5.4**

  Explain isolation, startup/resource differences, image/container/registry roles, and why the first container does not imply a Microservices architecture.

- [ ] **Step 4: Document registry tagging without performing a push**

  Show the example GHCR tag and commands, clearly label them as pending team registry/credential approval, and specify the screenshot/log evidence required in the PR.

- [ ] **Step 5: Repair root README Docker instructions**

  Replace `services/stats-service` build/run commands with root-context commands and link readers to `docker/README.md`.

---

### Task 6: Record AI usage and reflection without overstating AI ownership

**Files:**

- Modify: `AI_USAGE.md`
- Modify: `reflect.md`

**Interfaces:**

- `AI_USAGE.md` remains chronological and preserves earlier Lab sections
- `reflect.md` adds Post-quiz 6 while preserving existing reflections

- [ ] **Step 1: Add Lab 6 AI usage**

  Record at least four representative prompts (FastAPI first container, multi-stage Dockerfile, `.dockerignore`/security, Container vs VM) and identify which wording/files AI assisted with.

- [ ] **Step 2: State human verification and decisions**

  Explicitly say the team chose FastAPI Modular Monolith, pinned slim base, non-root execution, health contract, no secrets, and no registry push without authorization. Do not claim unavailable Docker commands were run.

- [ ] **Step 3: Add three Post-quiz 6 reflections**

  Cover Dockerfile layers/security/cache, the distinction between container and service decomposition, and REST/HTTP health as an operational contract. Each reflection should include a concrete lesson or next action.

---

### Task 7: Verify the full Lab 6 deliverable and commit only approved files

**Files:** all approved Lab 6 paths from Tasks 2–6; never unrelated paths

- [ ] **Step 1: Run application tests and source checks**

  ```powershell
  & "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m pytest services/api/tests -q
  git diff --check
  ```

- [ ] **Step 2: Run structural checks**

  Confirm `Dockerfile`, `.dockerignore`, `docker/README.md`, `services/api/app/main.py`, requirements, AI usage Lab 6, and Post-quiz 6 all exist. Check the `.dockerignore` includes the required exclusions without excluding production inputs.

- [ ] **Step 3: Run Docker checks when available**

  ```powershell
  docker build -t synapsesync-api:v0.1.0 .
  docker image inspect synapsesync-api:v0.1.0
  docker run -d --name synapsesync-api-check -p 8000:8000 synapsesync-api:v0.1.0
  Invoke-RestMethod http://127.0.0.1:8000/health
  docker inspect --format '{{.Config.User}}' synapsesync-api-check
  docker rm -f synapsesync-api-check
  ```

  Record image size, health result, exposed port, and non-root user. If Docker is unavailable, record that exact limitation and retain the non-Docker evidence.

- [ ] **Step 4: Review the staged file boundary**

  ```powershell
  git status --short --untracked-files=all
  git diff --stat -- Dockerfile .dockerignore docker README.md AI_USAGE.md reflect.md services/api
  git diff --name-only --cached
  ```

  Stage only Lab 6 paths; leave the pre-existing Lab 2 files and Chaiwat deletion untouched.

- [ ] **Step 5: Commit locally for review**

  ```powershell
  git add -- Dockerfile .dockerignore docker README.md AI_USAGE.md reflect.md services/api
  git diff --cached --check
  git commit -m "feat(lab6): add first FastAPI container"
  ```

  Do not push the branch or image until the user explicitly requests it after reviewing the verification evidence.
