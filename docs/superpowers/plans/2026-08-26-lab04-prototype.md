# Lab 04 — Integrated Interactive Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** นำ baseline prototype จาก se-sec2-team-06 มาปรับใน se-sec2-team-06-main-new ให้ทุก module ใช้ SynapseSync theme เดียวกัน และมี interactive flow ที่ตรงกับ Lab 4

**Architecture:** ใช้ static multi-page prototype ที่มี webtest/shared.css, webtest/navbar.css และ webtest/navbar.js เป็น shared UI source of truth แล้วให้ Thakorn, Chaiwat และ shuwichada เป็น feature modules ที่ทำงานด้วย client-side in-memory state แยกจาก backend

**Tech Stack:** Semantic HTML, CSS, vanilla JavaScript, Node node:test, Playwright/Chrome สำหรับ browser verification; ไม่ใช้ React, Vue, Bootstrap หรือ persistent storage

**Spec:** docs/superpowers/specs/2026-08-26-lab04-prototype-design.md

## Global Constraints

- ทำงานใน D:\Project SE Sce 2\se-sec2-team-06-main-new เท่านั้น; ต้นฉบับ se-sec2-team-06 ใช้อ่านและคัดลอกแบบ read-only
- ใช้ branch feature/lab4-prototype-synapsesync และยังไม่ push จนกว่าจะตรวจครบ
- Main flow ต้องอ้างอิง US-03 — สร้างแบบฝึกหัดที่สัมพันธ์กับหัวข้อ จาก Lab 3
- Prototype เป็น client-side simulation; ห้ามใช้ database, network request, cookie, localStorage หรือ sessionStorage
- ห้ามเพิ่ม external framework; ใช้ HTML/CSS/vanilla JavaScript เท่านั้น
- prototypes/sprint1/Chaiwat/ และ prototypes/sprint1/shuwichada/ ปรับได้เฉพาะ prototype ตามคำขอล่าสุด; ไม่แตะเอกสารทีม/ไฟล์บุคคลนอกขอบเขตนี้
- ทุกหน้า module ต้องมี shared Navbar, skip link, keyboard-visible focus และไม่เกิด horizontal overflow ที่ 1280 × 900 หรือ 390 × 844
- ทุก task ต้องจบด้วยการตรวจที่ระบุไว้ก่อนเริ่ม task ถัดไป

**Verification requirements from spec:** ตรวจ entry point และ route, ตรวจ interactive flow ของทั้งสาม module, ตรวจ desktop/mobile layout, ตรวจ syntax/link/documentation และสร้าง handoff folder ที่ไม่มี .git

---

### Task 1: Create the Lab 4 branch and sync the approved baseline

**Files:**
- Source (read-only): D:/Project SE Sce 2/se-sec2-team-06/prototypes/sprint1/**
- Target: D:/Project SE Sce 2/se-sec2-team-06-main-new/prototypes/sprint1/**
- Verify: D:/Project SE Sce 2/se-sec2-team-06-main-new/.git/HEAD

**Interfaces:**
- Consumes: existing Lab 4 baseline in the old repository
- Produces: target prototypes/sprint1/ containing index.html, README.md, webtest/, Thakorn/, Chaiwat/, shuwichada/ and tests/

- [ ] **Step 1: Create the local feature branch**

Run from PowerShell:

~~~powershell
git -C 'D:\Project SE Sce 2\se-sec2-team-06-main-new' switch -c feature/lab4-prototype-synapsesync
~~~

Expected: git branch --show-current prints feature/lab4-prototype-synapsesync.

- [ ] **Step 2: Compare source and target prototype file lists**

~~~powershell
$source = 'D:\Project SE Sce 2\se-sec2-team-06\prototypes\sprint1'
$target = 'D:\Project SE Sce 2\se-sec2-team-06-main-new\prototypes\sprint1'
Compare-Object (rg --files $source | ForEach-Object { $_.Substring($source.Length + 1) } | Sort-Object) (rg --files $target | ForEach-Object { $_.Substring($target.Length + 1) } | Sort-Object)
~~~

Expected: differences are limited to the known older target baseline; no file outside prototypes/sprint1 is copied in this task.

- [ ] **Step 3: Copy the old Lab 4 baseline into main-new**

~~~powershell
Copy-Item -LiteralPath 'D:\Project SE Sce 2\se-sec2-team-06\prototypes\sprint1\*' -Destination 'D:\Project SE Sce 2\se-sec2-team-06-main-new\prototypes\sprint1' -Recurse -Force
~~~

- [ ] **Step 4: Verify the baseline entry point and protected scope**

~~~powershell
Test-Path 'D:\Project SE Sce 2\se-sec2-team-06-main-new\prototypes\sprint1\index.html'
Test-Path 'D:\Project SE Sce 2\se-sec2-team-06-main-new\prototypes\sprint1\webtest\navbar.js'
git -C 'D:\Project SE Sce 2\se-sec2-team-06-main-new' status --short -- prototypes/sprint1
~~~

Expected: both paths return True; status lists only prototype changes.

---

### Task 2: Make the shared shell work for every module

**Files:**
- Modify: prototypes/sprint1/webtest/navbar.js
- Modify: prototypes/sprint1/Chaiwat/chaiwat_library_prototypes.html
- Modify: prototypes/sprint1/Chaiwat/chaiwat_View_Document_prototypes.html
- Modify: prototypes/sprint1/shuwichada/shuwichada_set_prototypes.html
- Modify: matching Chaiwat/shuwichada CSS files for page-shell spacing
- Modify: prototypes/sprint1/tests/navbar.test.cjs

**Interfaces:**
- Consumes: .site-bar, .site-brand, .site-bar__status, .site-bar__action from webtest/navbar.css
- Produces: all six pages (register, login, home, quiz, library, deadlines) render one shared Navbar and route brand/action links to webtest/login.html and webtest/register.html

- [ ] **Step 1: Extend Navbar route mapping**

In navbar.js, derive isSubpage from ['quiz', 'library', 'deadlines'].includes(navbarRoot.dataset.page) and use ../webtest/login.html / ../webtest/register.html for subpages; use login.html / register.html for pages inside webtest.

- [ ] **Step 2: Add the shared shell to Chaiwat pages**

Each Chaiwat HTML page must include:

~~~html
<link rel="stylesheet" href="../webtest/shared.css?v=lab4">
<link rel="stylesheet" href="../webtest/navbar.css?v=lab4">
<script src="../webtest/navbar.js?v=lab4" defer></script>
~~~

Immediately inside body, add the skip link and <div data-navbar-root data-page="library"></div>. Wrap the existing page content in <main class="page-shell feature-shell" id="main-content"> and close the main element before scripts.

- [ ] **Step 3: Add the shared shell to shuwichada**

Add the same shared links, a skip link, and <div data-navbar-root data-page="deadlines"></div>. Use main#main-content as the page-shell root and keep all form controls inside it.

- [ ] **Step 4: Update the Navbar regression page list**

Add these entries to tests/navbar.test.cjs:

~~~js
{ file: path.join(sprintRoot, 'Chaiwat', 'chaiwat_library_prototypes.html'), page: 'library' },
{ file: path.join(sprintRoot, 'Chaiwat', 'chaiwat_View_Document_prototypes.html'), page: 'library' },
{ file: path.join(sprintRoot, 'shuwichada', 'shuwichada_set_prototypes.html'), page: 'deadlines' },
~~~

The test must assert exactly one .site-bar, a working brand link, and a working เริ่มใหม่ link for every page.

- [ ] **Step 5: Run the shared-shell test**

Run:

~~~powershell
node --test prototypes/sprint1/tests/navbar.test.cjs
~~~

Expected: all existing and newly added Navbar tests pass before feature-specific styling begins.

---

### Task 3: Refine the Thakorn quiz module to the shared theme

**Files:**
- Modify: prototypes/sprint1/Thakorn/thakorn_quizgenerator_prototype.html
- Modify: prototypes/sprint1/Thakorn/thakorn_quizgenerator_style.css
- Verify only (do not rewrite unless a test exposes a defect): prototypes/sprint1/Thakorn/thakorn_quizgenerator_script.js

**Interfaces:**
- Consumes: data-page="quiz", shared.css, navbar.css, and the existing question-bank state machine
- Produces: a cohesive quiz page with upload, quiz, explanation, score and restart states

- [ ] **Step 1: Preserve the existing functional selectors**

Keep these IDs unchanged so the flow and browser tests remain stable: file-input, generate-btn, upload-screen, quiz-screen, result-screen, choice-list, next-btn, restart-btn.

- [ ] **Step 2: Apply the SynapseSync presentation tokens**

Use the shared --accent, --accent-soft, --surface, --line, --shadow-* and --radius-* variables for the dropzone, options, question box, choice buttons, feedback state and result card. Add visible :focus-visible styles and keep the existing reduced-motion behavior from shared.css.

- [ ] **Step 3: Keep the module boundary explicit**

Retain the prototype note that file contents are not read, questions come from a mock question bank, and results disappear after refresh. Do not add storage or network requests.

- [ ] **Step 4: Run the quiz flow test**

Use Playwright to open the file, set one question, click สร้างแบบทดสอบ, choose an answer, click ดูผลคะแนน, and assert that ผลคะแนน is visible. The test must also assert that only one visible <header> exists on each screen.

---

### Task 4: Re-theme and connect the Chaiwat document library

**Files:**
- Modify: prototypes/sprint1/Chaiwat/chaiwat_library_prototypes.css
- Modify: prototypes/sprint1/Chaiwat/chaiwat_library_prototypes.html
- Modify: prototypes/sprint1/Chaiwat/chaiwat_View_Document_prototypes.css
- Modify: prototypes/sprint1/Chaiwat/chaiwat_View_Document_prototypes.html
- Verify: prototypes/sprint1/Chaiwat/chaiwat_library_prototypes.js and the inline viewer script

**Interfaces:**
- Consumes: current library upload queue, subject assignment modal, filter, preview handoff and delete behavior
- Produces: the same library behavior with SynapseSync colors, Navbar, page width and accessible control states

- [ ] **Step 1: Replace the green-only design tokens with shared tokens**

Map the library surface/background/border/text/accent variables to --page-bg, --surface, --surface-soft, --line, --ink, --muted, --accent, --accent-soft, --danger and the shared radius/shadow values. Keep document-card and modal selectors intact so the existing JavaScript continues to work.

- [ ] **Step 2: Normalize layout and typography**

Use font-family: inherit, min-height: 100vh, .page-shell width, consistent page padding, and responsive grid columns. Keep the upload button, subject chips, document cards, modal and viewer within the shared visual rhythm.

- [ ] **Step 3: Preserve in-memory behavior**

Confirm the current library code never writes to browser storage or sends a request. When a file is selected, it may create an object URL for local preview only; the page must reset on refresh.

- [ ] **Step 4: Run the library interaction check**

With Playwright, upload a generated text/image fixture, assign a subject, assert one card and one subject filter, switch the filter, open the card/viewer, and delete the card through the confirmation modal. Assert no console error and one shared Navbar.

---

### Task 5: Turn shuwichada’s wireframe into an interactive deadline prototype

**Files:**
- Modify: prototypes/sprint1/shuwichada/shuwichada_set_prototypes.html
- Replace: prototypes/sprint1/shuwichada/shuwichada_set_prototypes.css
- Create: prototypes/sprint1/shuwichada/shuwichada_set_prototypes.js
- Modify: prototypes/sprint1/tests/prototype.test.cjs

**Interfaces:**
- Consumes: shared Navbar and page shell from Task 2
- Produces: DOM behavior driven by deadline-form, task-list, filter-buttons, planner, and deadline-status

- [ ] **Step 1: Replace static fields with a semantic form**

Use these stable selectors:

~~~html
<form id="deadline-form">
  <input id="task-title" name="title" required>
  <select id="task-subject" name="subject" required>
  <input id="task-date" name="date" type="date" required>
  <input id="task-time" name="time" type="time" required>
  <fieldset id="task-priority">...</fieldset>
  <select id="task-reminder" name="reminder">...</select>
  <button type="submit">บันทึกกำหนดส่ง</button>
</form>
<p id="deadline-status" role="status" aria-live="polite"></p>
<div id="filter-buttons" role="group" aria-label="ตัวกรองงาน"></div>
<div id="task-list"></div>
<div id="planner"></div>
~~~

- [ ] **Step 2: Implement in-memory task state**

Represent each task as { id, title, subject, dueAt, priority, reminderDays, completed }. Seed two clearly labelled sample tasks for the initial prototype view, keep all user-created tasks in the array, and never persist it. On form submit, validate required fields, append the task, reset the form, render the list, and announce success.

- [ ] **Step 3: Render and interact with task cards**

Render cards sorted by dueAt, show subject, formatted date/time, priority and reminder, and expose buttons with data-action="toggle" and data-action="delete". Event delegation must toggle completion, remove a task after a local confirmation UI, and re-render without a page reload.

- [ ] **Step 4: Add filters and weekly planner**

Provide all, pending, and completed filters. The active filter button must use aria-pressed="true". Weekly planner dots derive from the current tasks’ due dates; completed tasks use the success style and pending tasks use the accent style.

- [ ] **Step 5: Apply responsive shared styling**

Use SynapseSync tokens, card surfaces, focus rings, priority badges and a two-column desktop layout that collapses to one column below 760px. Keep the content inside the shared page shell and avoid fixed phone-only width.

- [ ] **Step 6: Test the deadline flow**

Add a Playwright test that loads the page, submits a valid task, asserts its title appears, toggles it complete, filters to completed, and checks the planner renders. Add a validation assertion for an empty title and a mobile overflow assertion at 390 × 844.

---

### Task 6: Update Lab 4 documentation and evidence

**Files:**
- Modify: prototypes/sprint1/README.md
- Modify: prototypes/sprint1/webtest/readme.md
- Modify: AI_USAGE.md
- Create or modify: reflect.md

**Interfaces:**
- Consumes: final module names, test commands and actual prototype boundaries from Tasks 1–5
- Produces: documentation that a reviewer can use without opening source code

- [ ] **Step 1: Update the Sprint README**

Document US-03, the flow index → Register → Home → Quiz, the three linked modules, Tracer vs Prototype decision (Prototype because the flow is for learning/validation and uses mock state), what works, what is deliberately not implemented, and the Sprint 2 next step.

- [ ] **Step 2: Record test evidence**

In webtest/readme.md, list the exact command node --test prototypes/sprint1/tests/*.test.cjs, the page/viewport matrix, and the observed interactive flows. Do not claim a test passed until the command is run in Task 7.

- [ ] **Step 3: Append the Lab 4 AI usage disclosure**

Add tools, at least two concrete prompts, AI-assisted portions, human decisions, and verification. State that AI suggested skeletons/styles and explanations while the team selected scope, edited the code, tested flows, and kept the implementation client-side. Do not claim real AI generation, database, authentication or storage exists.

- [ ] **Step 4: Write the Post-quiz 4 reflection**

Create reflect.md with three short sections: Prompt Critique (weak prompt versus Five S’s prompt), AI in real life (co-pilot with review), and AI Strategy (human owns requirements/tests, AI assists bounded implementation). Include one concrete lesson from the SynapseSync prototype.

---

### Task 7: Verify, package the handoff folder, and review the diff

**Files:**
- Create/replace: D:/Project SE Sce 2/se-sec2-team-06-lab04/**
- Verify: se-sec2-team-06-main-new/prototypes/sprint1/**, AI_USAGE.md, reflect.md

**Interfaces:**
- Consumes: final files from Tasks 1–6
- Produces: verified main-new worktree and a .git-free Lab 4 handoff package

- [ ] **Step 1: Run static checks**

~~~powershell
node --check prototypes/sprint1/webtest/navbar.js
node --check prototypes/sprint1/webtest/login_script.js
node --check prototypes/sprint1/webtest/register_script.js
node --check prototypes/sprint1/Thakorn/thakorn_quizgenerator_script.js
node --check prototypes/sprint1/Chaiwat/chaiwat_library_prototypes.js
node --check prototypes/sprint1/shuwichada/shuwichada_set_prototypes.js
~~~

Expected: every command exits with code 0.

- [ ] **Step 2: Run all browser tests**

~~~powershell
node --test prototypes/sprint1/tests/*.test.cjs
~~~

Expected: zero failures, with coverage for shared Navbar, Thakorn quiz, Chaiwat library and shuwichada deadlines.

- [ ] **Step 3: Run documentation and link checks**

~~~powershell
git diff --check
rg -n "prototypes/sprint1/(webtest|Thakorn|Chaiwat|shuwichada)|US-03|Tracer|Prototype|AI_USAGE|reflect" prototypes/sprint1/README.md prototypes/sprint1/webtest/readme.md AI_USAGE.md reflect.md
~~~

Expected: no whitespace errors and every required Lab 4 term is present.

- [ ] **Step 4: Verify the local browser manually**

Serve prototypes/sprint1 with python -m http.server 4173 --directory prototypes/sprint1, then check:

1. /index.html redirects to /webtest/register.html.
2. Register and Login simulation reach Home without storing data.
3. Home opens all three modules.
4. Quiz, library and deadline flows complete without opening the console.
5. At 390 × 844, every page has no horizontal scrollbar and the Navbar remains aligned.

- [ ] **Step 5: Build the handoff package without Git metadata**

~~~powershell
$handoff = 'D:\Project SE Sce 2\se-sec2-team-06-lab04'
if (Test-Path -LiteralPath $handoff) { Remove-Item -LiteralPath $handoff -Recurse -Force }
New-Item -ItemType Directory -Path $handoff | Out-Null
Copy-Item -LiteralPath 'prototypes' -Destination $handoff -Recurse -Force
Copy-Item -LiteralPath 'AI_USAGE.md' -Destination $handoff -Force
Copy-Item -LiteralPath 'reflect.md' -Destination $handoff -Force
if (Test-Path -LiteralPath (Join-Path $handoff '.git')) { throw 'Handoff must not contain .git' }
~~~

The handoff root must contain only prototypes/, AI_USAGE.md and reflect.md; it must not contain services, team files, credentials or repository metadata.

- [ ] **Step 6: Inspect the final scoped diff**

~~~powershell
git status --short -- prototypes/sprint1 AI_USAGE.md reflect.md docs/superpowers/specs docs/superpowers/plans
git diff --stat -- prototypes/sprint1 AI_USAGE.md reflect.md docs/superpowers/specs docs/superpowers/plans
~~~

Expected: all changes are within the approved Lab 4 scope. Do not commit or push until the user asks for integration.
