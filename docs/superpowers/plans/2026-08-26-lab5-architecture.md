# Lab 05 — Architecture Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับเอกสารสถาปัตยกรรมเดิมทั้งหมดของ SynapseSync ใน `se-sec2-team-06-main-new` ให้ครบ Lab 5, ใช้ Modular Monolith เป็นสถาปัตยกรรม MVP, และจัดทำ handoff C4/ADR สำหรับสมาชิกสองชุดโดยไม่สร้าง branch/worktree ให้สมาชิก

**Architecture:** ใช้ C4 Level 1–2 เป็น source of truth แบบ Markdown + Mermaid; ใช้ ADR เป็น audit trail ของการเลือก Modular Monolith; เก็บ draw.io/PNG/UML เป็น supporting artifacts ที่ต้องสอดคล้องกับ canonical docs; เอกสารใน main-new เป็นชุดรวม ส่วน handoff folders เป็นชุดไฟล์แยกสำหรับคัดลอก

**Tech Stack:** Markdown, Mermaid, draw.io source/PNG ที่มีอยู่, React + Vite (frontend target), FastAPI + Pydantic + OpenAPI (backend target), PostgreSQL, S3-compatible Object Storage และ abstract LLM Provider API

**Spec:** `docs/superpowers/specs/2026-08-26-lab5-architecture-design.md`

## Global Constraints

- ทำงานหลักใน `D:\Project SE Sce 2\se-sec2-team-06-main-new` เท่านั้น; อ่าน `D:\Project SE Sce 2\se-sec2-team-06` เป็น reference แบบ read-only
- สร้าง branch `feature/lab5-architecture-Thakorn` จาก HEAD ปัจจุบันของ main-new เพื่อไม่ทำให้ Lab 4 ที่ push แล้วหายไป และยังไม่ push จนกว่าจะตรวจงานครบ/ผู้ใช้สั่ง
- แก้เฉพาะ architecture deliverables และ documentation ที่ระบุใน spec; ห้าม stage หรือ restore `docs/team/chaiwat.md` และไฟล์ Lab 2 ที่มีอยู่ก่อนแล้ว
- ห้ามทิ้งข้อความที่สื่อว่า SynapseSync เลือก Microservices เป็น baseline; ถ้ากล่าวถึง Microservices ต้องอยู่ใน alternatives/trade-offs เท่านั้น
- C4 Level 2 ต้องนับเฉพาะ containers ภายในระบบ 3–4 ตัว; LLM Provider เป็น external system ไม่ใช่ internal container
- ไม่ใส่ secret, API key, hostname จริง, IP, bucket name หรือข้อมูลส่วนบุคคล
- handoff folders ต้องไม่มี `.git` และต้องมีเฉพาะไฟล์ตาม spec
- ทุก task ต้องผ่าน verification ที่ระบุไว้ก่อนเริ่ม task ถัดไป

---

### Task 1: Create the Lab 5 branch and inventory the architecture baseline

**Files/paths:**

- Branch: `D:\Project SE Sce 2\se-sec2-team-06-main-new\.git\HEAD`
- Target inventory: `D:\Project SE Sce 2\se-sec2-team-06-main-new\docs\architecture\`
- Read-only reference: `D:\Project SE Sce 2\se-sec2-team-06\docs\architecture\`

**Interfaces:**

- Consumes: current main-new HEAD (including pushed Lab 4 baseline) and old repository architecture docs
- Produces: isolated Lab 5 branch and a recorded list of canonical, supporting, stale, and missing architecture files

- [ ] **Step 1: Create and verify the feature branch**

  ```powershell
  git -C 'D:\Project SE Sce 2\se-sec2-team-06-main-new' switch -c feature/lab5-architecture-Thakorn
  git -C 'D:\Project SE Sce 2\se-sec2-team-06-main-new' branch --show-current
  ```

  Expected branch: `feature/lab5-architecture-Thakorn`.

- [ ] **Step 2: Compare architecture file lists without changing files**

  ```powershell
  $source = 'D:\Project SE Sce 2\se-sec2-team-06\docs\architecture'
  $target = 'D:\Project SE Sce 2\se-sec2-team-06-main-new\docs\architecture'
  rg --files $source | ForEach-Object { $_.Substring($source.Length + 1) } | Sort-Object
  rg --files $target | ForEach-Object { $_.Substring($target.Length + 1) } | Sort-Object
  ```

  Record missing canonical files (`c4-context.md`, `c4-container.md`, `tech_stack.md`) and stale ADR/file references before editing.

- [ ] **Step 3: Verify protected unrelated changes**

  ```powershell
  git -C 'D:\Project SE Sce 2\se-sec2-team-06-main-new' status --short
  git -C 'D:\Project SE Sce 2\se-sec2-team-06-main-new' diff -- docs/team/chaiwat.md
  ```

  Expected: pre-existing `docs/team/chaiwat.md` deletion and Lab 2 untracked files remain outside the Lab 5 change set.

---

### Task 2: Rebuild the canonical C4 and technology-stack documents

**Files:**

- Create: `docs/architecture/c4-context.md`
- Create: `docs/architecture/c4-container.md`
- Create: `docs/architecture/tech_stack.md`
- Read/reference: matching files under `D:\Project SE Sce 2\se-sec2-team-06\docs\architecture\`

**Interfaces:**

- Context doc names the people/system boundary and external provider relationships
- Container doc names the 3–4 internal containers and technology labels that the stack doc justifies
- Stack doc names the technologies used in the container diagram and records alternatives/trade-offs

- [ ] **Step 1: Write C4 Level 1**

  Use a Mermaid fenced diagram with Student Learner and Teacher Mentor as users, SynapseSync as the system, and LLM Provider API as an external system. Add a short narrative, scope, assumptions, and traceability links to requirements without inventing unsupported integrations.

- [ ] **Step 2: Write C4 Level 2**

  Use a Mermaid fenced diagram with exactly four internal containers: React + Vite Web Application, FastAPI Modular Monolith Backend API, PostgreSQL Database, and S3-compatible Object Storage. Show LLM Provider API outside the boundary and label protocols/data flows (HTTPS/JSON, SQL, S3 API, provider API). Explain module boundaries inside the backend rather than presenting them as microservices.

- [ ] **Step 3: Write the technology stack**

  Cover at least nine useful layers (presentation, frontend runtime, API/application, module boundaries, validation/contracts, persistence, object storage, AI integration, delivery/observability). For each layer include selected technology, context-specific rationale, at least one considered alternative, and a trade-off. Distinguish target MVP architecture from the current prototype where needed.

- [ ] **Step 4: Verify canonical cross-references**

  ```powershell
  rg -n "c4-context|c4-container|tech_stack|FastAPI|Modular Monolith|Microservices" docs/architecture/c4-context.md docs/architecture/c4-container.md docs/architecture/tech_stack.md
  ```

  Expected: all names and technology labels agree; `Microservices` appears only in alternatives/trade-off discussion.

---

### Task 3: Align every existing architecture artifact with the canonical decision

**Files:**

- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/Request_ARCH.md`
- Modify: `docs/architecture/uml_models.md`
- Modify or regenerate: `docs/architecture/diagrams/c4-level-1-context.mmd`, `c4-level-2-container.mmd`, and matching draw.io/PNG supporting artifacts when they contradict the canonical docs
- Modify: `docs/architecture/adr/0001-tech-stack-selection.md`
- Create: `docs/architecture/adr/0002-rest-api-communication.md` when the REST decision is retained as a separate ADR
- Modify: `docs/architecture/adr/001-use-restful-api-internal-commu.md` into a consistent compatibility note or redirect to ADR-0002; do not leave its old Microservices claim intact

**Interfaces:**

- `README.md` is the navigation/index and links to the three canonical docs and ADRs
- `Request_ARCH.md` explains the same decisions for oral review; it must not contradict the source-of-truth documents
- supporting diagrams/UML are explicitly labeled as supporting artifacts and use the same actor/container names
- ADRs use stable numbering and preserve decision history without silently changing an accepted decision

- [ ] **Step 1: Update the architecture index**

  Link `c4-context.md`, `c4-container.md`, `tech_stack.md`, ADR-0001, and ADR-0002. State that Modular Monolith is the MVP decision, that canonical Markdown is authoritative, and that draw.io/PNG files are exports/supporting artifacts.

- [ ] **Step 2: Reconcile the Q&A and UML notes**

  Correct stale claims about Microservices, the number of personas, external systems, and diagram levels. Keep useful rationale, but mark future integrations as target/optional and point to the canonical docs.

- [ ] **Step 3: Align Mermaid/draw.io/UML artifacts**

  Update source diagrams to match the canonical C4 nodes and relationships. If a binary export cannot be regenerated in the local environment, mark it as an older export in the README and ensure the `.mmd` source is authoritative rather than silently claiming that the PNG is current.

- [ ] **Step 4: Normalize ADRs**

  Ensure ADR-0001 is a Modular Monolith decision with Status, Context, Decision, Consequences, and Alternatives Considered. Keep the REST/OpenAPI decision as ADR-0002 only if it describes the monolith's external API/module boundary, not internal Microservices. Convert the stale `001-use-restful-api-internal-commu.md` into a short superseded/compatibility pointer so no contradictory decision remains.

---

### Task 4: Update Lab 5 usage and reflection records

**Files:**

- Modify: `AI_USAGE.md`
- Modify: `reflect.md`

**Interfaces:**

- `AI_USAGE.md` records tools, representative prompts, AI-assisted text, and human verification
- `reflect.md` adds Post-quiz 5 reflections on ADR, C4, and technology-stack trade-offs while preserving earlier lab reflections

- [ ] **Step 1: Add the Lab 5 AI usage section**

  Record that AI helped organize C4/ADR wording, compare alternatives, and check consistency; state that the team chose Modular Monolith, boundaries, NFR priorities, and accepted trade-offs.

- [ ] **Step 2: Add three Post-quiz 5 reflections**

  Cover one reflection each for (a) why ADR captures rejected alternatives, (b) how C4 separates context from containers, and (c) how stack choices follow NFR/constraints. Include one concrete lesson and one next action per reflection.

- [ ] **Step 3: Verify chronology and attribution**

  ```powershell
  rg -n "Lab 5|Lab05|Post-quiz 5|Modular Monolith|AI" AI_USAGE.md reflect.md
  ```

  Expected: Lab 5 is additive, does not erase Lab 2–4 notes, and does not claim that AI made team decisions.

---

### Task 5: Prepare the two member handoff folders

**Files/paths:**

- Create/replace only: `D:\Project SE Sce 2\se-sec2-team-06-lab05-c4\docs\architecture\{c4-context.md,c4-container.md,diagrams\*.mmd}`
- Create/replace only: `D:\Project SE Sce 2\se-sec2-team-06-lab05-adr\docs\architecture\adr\0001-modular-monolith.md`

**Interfaces:**

- C4 handoff must be copy-ready and contain no Git metadata or unrelated team files
- ADR handoff must be copy-ready and contain only the single Lab 5 ADR file

- [ ] **Step 1: Recreate the C4 handoff from canonical main-new docs**

  Copy/adapt the final canonical C4 Markdown and Mermaid sources; do not copy the entire repository, `.git`, old Lab 4 files, or member documents.

- [ ] **Step 2: Recreate the ADR handoff**

  Copy the final Modular Monolith ADR into `0001-modular-monolith.md`; preserve all five required headings and alternatives.

- [ ] **Step 3: Verify handoff boundaries**

  ```powershell
  Test-Path 'D:\Project SE Sce 2\se-sec2-team-06-lab05-c4\.git'
  Test-Path 'D:\Project SE Sce 2\se-sec2-team-06-lab05-adr\.git'
  rg --files 'D:\Project SE Sce 2\se-sec2-team-06-lab05-c4'
  rg --files 'D:\Project SE Sce 2\se-sec2-team-06-lab05-adr'
  ```

  Expected: both `.git` checks are False and file lists contain only the approved handoff files.

---

### Task 6: Run Lab 5 verification and prepare the local branch for review

**Files:** all changed Lab 5 paths from Tasks 2–5; no unrelated files

- [ ] **Step 1: Check deliverables and structural constraints**

  Verify the three canonical files, ADR, usage/reflection sections, C4 diagram counts, and handoff contents with `Test-Path`, `rg`, and a small heading/count check.

- [ ] **Step 2: Check links and syntax**

  Check relative Markdown links under `docs/architecture/`, balanced Mermaid fences, ADR headings, and any available Markdown/Mermaid validator. If no renderer is installed, report the exact offline limitation and still validate source fences/identifiers.

- [ ] **Step 3: Check diff hygiene**

  ```powershell
  git diff --check
  git status --short
  git diff --stat -- docs/architecture AI_USAGE.md reflect.md
  ```

  Confirm only approved Lab 5 paths are staged/committed; leave unrelated Lab 2 untracked files and the pre-existing `docs/team/chaiwat.md` deletion untouched.

- [ ] **Step 4: Summarize review/push state**

  Report branch name, local verification results, handoff paths, and any remaining need for user review. Do not push until the user explicitly requests it.
