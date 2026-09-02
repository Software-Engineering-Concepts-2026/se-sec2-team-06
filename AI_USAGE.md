# AI Usage — Lab 01

## Tools used

- GitHub Copilot
- ChatGPT / Codex Generative AI assistant

AI ถูกใช้เป็นผู้ช่วยระหว่างการทำงาน ไม่ได้เป็นผู้ตัดสินใจหรือผู้เขียนประสบการณ์ส่วนตัวแทนผู้จัดทำ

## Prompts used

# Codex Task — Analyze Current Work, Find Problems, and Improve Existing Implementation

Repository:

```text
Software-Engineering-Concepts-2026/se-sec2-team-06
```

โปรเจกต์นี้เป็นงานกลุ่มในรายวิชา **Software Engineering Concepts 2026**

ให้ถือว่าไฟล์และโครงสร้างที่มีอยู่ใน repository ปัจจุบันคือ **source of truth หลัก** และงานของสมาชิกคนอื่นอาจอยู่ใน repository เดียวกัน

> ห้ามรื้อหรือเขียนโปรเจกต์ใหม่โดยไม่จำเป็น
> ห้ามเดาว่า Assignment ต้องการอะไรจากชื่อไฟล์เพียงอย่างเดียว
> ต้องอ่านเอกสารและ implementation ปัจจุบันก่อนทุกครั้ง

---

# เป้าหมายหลัก

ต้องการให้ช่วยตรวจสอบ **งานที่ทีมกำลังทำอยู่ใน repository ตอนนี้** ว่า:

1. ตอนนี้ทีมกำลังทำหัวข้อหรือ Assignment อะไร
2. Requirement ของงานคืออะไร
3. งานที่ทำอยู่ตรงกับ Requirement มากน้อยแค่ไหน
4. ส่วนใดทำเสร็จแล้ว
5. ส่วนใดยังไม่สมบูรณ์
6. ส่วนใดผิดหลัก Software Engineering
7. ส่วนใดควรแก้
8. ควรแก้อย่างไรโดยกระทบงานเดิมให้น้อยที่สุด

จากนั้นเสนอแนวทางปรับปรุงที่สามารถนำไปทำต่อได้จริง

---

# STEP 1 — ตรวจสอบสถานะ Repository ก่อน

ก่อนแก้ไขไฟล์ใด ๆ ให้ตรวจ:

```bash
git status
git branch --show-current
git log --oneline -10
```

ตรวจว่ามี:

* modified files
* untracked files
* staged files
* งานที่ยังไม่ได้ commit
* branch ที่กำลังทำงานอยู่

หรือไม่

ถ้ามีไฟล์ที่ถูกแก้ไว้ก่อนเริ่มงานนี้:

**ห้าม overwrite หรือ revert การเปลี่ยนแปลงเดิม**

ให้ถือว่าอาจเป็นงานของสมาชิกในทีม

---

# STEP 2 — สำรวจโครงสร้าง Repository

อ่าน repository ทั้งหมดก่อน

ให้สำรวจอย่างน้อย:

* `README.md`
* Markdown (`*.md`)
* source code
* documentation
* assignment files
* requirement files
* diagrams
* frontend
* backend
* database
* test
* configuration
* `.gitignore`
* dependency files
* GitHub workflow
* screenshots / images ที่เกี่ยวกับงาน
* folder งานของแต่ละ Chapter / Week / Assignment ถ้ามี

แสดงโครงสร้างสำคัญในรูปแบบประมาณ:

```text
se-sec2-team-06/
│
├── README.md
├── ...
├── docs/
│   ├── ...
│
├── src/
│   ├── ...
│
└── ...
```

พร้อมอธิบายสั้น ๆ ว่าแต่ละส่วนใช้ทำอะไร

ไม่จำเป็นต้องแสดง dependency หรือ generated files จำนวนมาก

---

# STEP 3 — หาให้ได้ว่าตอนนี้กำลังทำงานอะไร

จากไฟล์ทั้งหมด ให้ตรวจว่า **งานล่าสุด / งานปัจจุบันของทีมคืออะไร**

ใช้ข้อมูลจาก:

* README
* Assignment
* Markdown
* commit ล่าสุด
* branch ปัจจุบัน
* TODO
* source code
* diagram
* documentation

อย่าใช้ `git log` เพียงอย่างเดียว

ต้องตรวจ implementation จริงร่วมด้วย

สรุป:

```text
Current Task:
Current Chapter / Assignment:
Objective:
Expected Deliverables:
Current Progress:
```

ถ้ามีหลายงาน ให้แยกออกจากกัน

---

# STEP 4 — อ่าน Requirement ของงานปัจจุบัน

หา Requirement หรือโจทย์ที่เกี่ยวข้องกับงานที่ทีมกำลังทำ

เช่น:

* Assignment requirement
* User Story
* Use Case
* Functional Requirement
* Non-functional Requirement
* Acceptance Criteria
* README
* instructor instructions
* specification
* diagram

จากนั้นสรุป Requirement ที่ต้องทำจริง

ห้ามสร้าง Requirement เพิ่มเองถ้าไม่มีหลักฐานใน repository

ถ้ามีสิ่งที่อนุมานจาก context ให้ระบุว่า:

```text
Inferred requirement
```

ไม่ใช่ Requirement ที่ยืนยันแล้ว

---

# STEP 5 — เปรียบเทียบ Requirement กับงานปัจจุบัน

สร้างตาราง:

| Requirement | Current Implementation | Status   | Problem |
| ----------- | ---------------------- | -------- | ------- |
| ...         | ...                    | Complete | -       |
| ...         | ...                    | Partial  | ...     |
| ...         | ไม่มี                  | Missing  | ...     |

Status ใช้:

* `Complete`
* `Partial`
* `Missing`
* `Incorrect`
* `Needs Verification`

อย่าถือว่า Feature Complete เพียงเพราะมีไฟล์หรือ function อยู่

ต้องตรวจว่า implementation ทำงานตรง Requirement จริง

---

# STEP 6 — วิเคราะห์งานที่ทีมทำอยู่

ตรวจงานปัจจุบันในหลายด้าน

## 6.1 Correctness

ตรวจ:

* logic
* condition
* workflow
* data flow
* function
* API
* component interaction
* result

ว่าทำงานถูกต้องหรือไม่

---

## 6.2 Software Engineering

ตรวจหลัก:

* Separation of Concerns
* Modularity
* Cohesion
* Coupling
* Maintainability
* Reusability
* DRY
* Naming Convention
* Code readability
* Error Handling
* Input Validation

แต่ไม่ต้อง Refactor เพียงเพื่อให้ดู "สวย"

ให้แก้เฉพาะจุดที่มีเหตุผลต่อ Assignment หรือคุณภาพของระบบ

---

## 6.3 Requirement Quality

หากงานปัจจุบันเป็นงานเกี่ยวกับ Requirement ให้ตรวจ:

* Requirement ชัดหรือไม่
* Testable หรือไม่
* Ambiguous หรือไม่
* Consistent หรือไม่
* Complete หรือไม่
* Traceable หรือไม่

ตัวอย่าง Requirement ที่ควรหลีกเลี่ยง:

```text
ระบบควรใช้งานง่าย
```

เพราะวัดผลยาก

ควรเสนอวิธีเขียนที่สามารถตรวจสอบได้มากขึ้น

---

## 6.4 User Story

ถ้ามี User Story ตรวจรูปแบบ:

```text
As a [user]
I want [goal]
So that [benefit]
```

และตรวจว่าแต่ละ Story มี:

* Actor
* Goal
* Business value
* Acceptance Criteria

หรือไม่

---

## 6.5 Use Case

ถ้ามี Use Case ตรวจ:

* Actor
* Preconditions
* Trigger
* Main Flow
* Alternative Flow
* Exception Flow
* Postconditions

รวมถึงความสอดคล้องระหว่าง:

```text
User Story
↓
Use Case
↓
Requirement
↓
Implementation
```

---

## 6.6 Diagram

ถ้ามี diagram เช่น:

* Use Case Diagram
* Activity Diagram
* Sequence Diagram
* Class Diagram
* Architecture Diagram

ให้ตรวจทั้ง:

### Syntax

และ

### ความสอดคล้องกับระบบจริง

ตัวอย่างเช่น:

ถ้า Sequence Diagram เรียก API:

```text
POST /login
```

แต่ backend ไม่มี API ดังกล่าว

ให้รายงานว่า diagram กับ implementation ไม่ตรงกัน

---

## 6.7 Documentation

ตรวจ README และ Markdown ว่า:

* ข้อมูลยังเป็นปัจจุบันหรือไม่
* สอดคล้องกับ source code หรือไม่
* วิธี Run ถูกต้องหรือไม่
* ชื่อ Feature ตรงกันหรือไม่
* link เสียหรือไม่
* มีข้อความ placeholder หรือไม่
* มีข้อความซ้ำหรือไม่

---

# STEP 7 — หา Problem จริง

ค้นหา:

```text
TODO
FIXME
HACK
XXX
Not implemented
Coming soon
placeholder
mock
dummy
```

รวมถึงตรวจ:

* function ว่าง
* hard-coded data
* duplicated code
* unreachable code
* unused file
* unused function
* dead route
* inconsistent naming
* missing validation
* missing error handling
* broken links
* incorrect documentation

แต่:

**อย่าลบของที่ดูเหมือนไม่ใช้ทันที**

ให้ตรวจ reference ก่อน

---

# STEP 8 — เสนอแนวทางแก้ไข

ก่อนแก้ ให้สร้าง:

# Proposed Improvements

แบ่งเป็น:

## Critical

สิ่งที่:

* ทำให้งานผิด Requirement
* ทำให้ระบบใช้ไม่ได้
* ทำให้ Assignment ไม่ครบ
* เป็น bug สำคัญ

## High

สิ่งที่ควรแก้ก่อนส่งงาน

## Medium

สิ่งที่ช่วยเพิ่มคุณภาพ

## Low

สิ่งที่ปรับภายหลังได้

แต่ละข้อให้บอก:

```text
Problem:
Evidence:
Impact:
Suggested Fix:
Files involved:
Risk:
```

ตัวอย่าง:

```text
Problem:
User Story ระบุว่าสามารถแก้ไขข้อมูลได้ แต่ UI มีเพียง Create และ Delete

Evidence:
docs/user-story.md
src/...

Impact:
Requirement ยังไม่ Complete

Suggested Fix:
เพิ่ม Edit workflow โดย reuse form component เดิม

Files involved:
src/components/...
src/services/...

Risk:
Medium
```

---

# STEP 9 — ให้ความสำคัญกับ Minimal Change

ถ้ามีหลายวิธีแก้ ให้เลือกวิธีที่:

1. ใช้ architecture เดิม
2. ใช้ dependency เดิม
3. แก้ไฟล์น้อย
4. ลด regression
5. สมาชิกทีมเข้าใจต่อได้ง่าย

หลีกเลี่ยง:

```text
rewrite everything
```

หรือ

```text
เปลี่ยน framework
```

เว้นแต่ของเดิมใช้งานต่อไม่ได้จริงและมีหลักฐานชัดเจน

---

# STEP 10 — ตรวจความสัมพันธ์ของงาน

ตรวจ Traceability:

```text
Requirement
   ↓
User Story
   ↓
Use Case
   ↓
Design
   ↓
Implementation
   ↓
Test
```

รายงานกรณีเช่น:

```text
User Story มี แต่ไม่มี Implementation

Implementation มี แต่ไม่มี Requirement

Requirement มี แต่ไม่มี Acceptance Criteria

Feature มี แต่ Documentation ไม่ได้อัปเดต

Diagram ไม่ตรงกับ implementation
```

---

# STEP 11 — ตรวจ Git History เพื่อเข้าใจงานล่าสุด

ตรวจ commit ล่าสุดเพื่อช่วยระบุงานที่กำลังพัฒนา

เช่น:

```bash
git log --oneline --decorate -20
```

ถ้าจำเป็น:

```bash
git show <commit>
```

แต่:

**ห้ามแก้ implementation โดยอิง commit message อย่างเดียว**

ต้องตรวจ source code จริง

---

# STEP 12 — วิเคราะห์ก่อนแก้

ก่อนทำการแก้ไข ให้รายงาน:

# Current Work Analysis

## 1. Current Assignment

งานที่กำลังทำคืออะไร

## 2. Current Status

ทำอะไรไปแล้ว

## 3. Correct Parts

ส่วนใดทำได้ดีและไม่ควรแก้

## 4. Problems Found

ปัญหาที่พบ

## 5. Missing Requirements

สิ่งที่ยังขาด

## 6. Proposed Fix

แนวทางแก้ที่แนะนำ

## 7. Files That Need Changes

เช่น:

```text
README.md
docs/...
src/...
```

## 8. Expected Result

หลังแก้ควรได้อะไร

---

# STEP 13 — หลังจากวิเคราะห์ ให้ดำเนินการแก้จุดที่เหมาะสม

หากมีปัญหาที่:

* Requirement ชัดเจน
* Root cause ชัด
* แนวทางแก้ไม่ทำลาย Architecture
* สามารถตรวจสอบผลได้

สามารถดำเนินการแก้ได้

ใช้หลัก:

```text
Problem
↓
Root Cause
↓
Minimal Fix
↓
Verification
```

---

# กฎสำคัญในการแก้ไฟล์

ก่อนแก้ไฟล์ใด:

อ่านไฟล์ทั้งหมดที่เกี่ยวข้องก่อน

เช่น ถ้าจะแก้:

```text
service
```

ต้องตรวจ:

```text
component
controller
route
model
test
```

ที่เรียก service นั้นด้วย

---

# ห้ามทำสิ่งต่อไปนี้

ห้าม:

* `git reset --hard`
* `git clean -fd`
* force push
* delete branch
* overwrite uncommitted work
* เปลี่ยน framework
* rewrite project ทั้งหมด
* ลบโค้ดสมาชิกคนอื่นโดยไม่มีเหตุผล
* เปลี่ยน directory structure จำนวนมาก
* เปลี่ยน dependency version แบบสุ่ม
* commit secret
* hard-code password
* hard-code token
* hard-code API key

---

# อย่า Over-engineer

นี่เป็นโปรเจกต์รายวิชา Software Engineering

ไม่จำเป็นต้องเพิ่ม:

* Microservices
* Kubernetes
* Docker
* Redis
* Message Queue
* Complex Design Pattern

ถ้า Assignment ไม่ได้ต้องการ

ให้เลือกวิธีที่ง่าย เข้าใจได้ และอธิบายต่ออาจารย์ได้

---

# STEP 14 — ทดสอบหลังแก้

หา command จาก project configuration ก่อน

ถ้ามีให้ run:

```bash
lint
test
build
```

รวมถึงตรวจ feature ที่แก้

หาก command ไม่สามารถรันได้:

รายงานสาเหตุ

ห้ามรายงานว่า:

```text
Tests passed
```

ถ้าไม่ได้ run จริง

---

# STEP 15 — ตรวจ Diff

หลังแก้:

```bash
git diff
git status
```

ตรวจว่าไม่มีการแก้ไฟล์ที่ไม่เกี่ยวข้อง

ถ้ามี accidental changes ให้ revert เฉพาะการเปลี่ยนแปลงที่เกิดจากงานนี้

ห้าม revert งานเดิมของผู้ใช้

---

# Final Report

หลังทำงานเสร็จ ให้ตอบในรูปแบบ:

# Current Assignment

อธิบายว่างานปัจจุบันคืออะไร

---

# Current Progress

สิ่งที่ทีมทำแล้ว

---

# Problems Found

| Priority | Problem | Evidence | Impact |
| -------- | ------- | -------- | ------ |
| Critical | ...     | ...      | ...    |
| High     | ...     | ...      | ...    |
| Medium   | ...     | ...      | ...    |
| Low      | ...     | ...      | ...    |

---

# Recommended Improvements

อธิบายแนวทางแก้พร้อมเหตุผล

---

# Changes Made

| File | Change | Reason |
| ---- | ------ | ------ |
| ...  | ...    | ...    |

ถ้ายังไม่ได้แก้ไฟล์:

```text
No source files modified.
```

---

# Requirement Coverage

| Requirement | Status   |
| ----------- | -------- |
| ...         | Complete |
| ...         | Partial  |
| ...         | Missing  |

---

# Verification

ระบุ command ที่ run จริงและผลลัพธ์

เช่น:

```text
npm test      PASS
npm run lint  PASS
npm run build PASS
```

หรือ Stack อื่นตามที่ repository ใช้จริง

---

# Remaining Work

สิ่งที่ยังควรทำต่อก่อนส่ง Assignment

---

# Recommended Next Task

เลือก **งานถัดไปที่ควรทำที่สุด 1 งาน**

พร้อมอธิบายว่า:

```text
Why this should be next:
Files involved:
Expected result:
```

---

# หลักสำคัญที่สุด

**Repository ปัจจุบันคือข้อมูลหลัก**

อย่าคิดระบบใหม่จากศูนย์

ให้ทำ:

```text
Read
↓
Understand
↓
Compare with Requirement
↓
Find Evidence
↓
Identify Problem
↓
Propose Fix
↓
Apply Minimal Fix
↓
Verify
```

เป้าหมายคือทำให้งานของ `se-sec2-team-06` **ถูกต้องขึ้น ครบ Requirement ขึ้น และพร้อมส่งมากขึ้น** โดยรักษางานเดิมของทีมไว้ให้มากที่สุด


## Direct AI-generated content

งานส่วนใหญ่ใน submission นี้จัดทำและตัดสินใจโดย Thakorn โดยใช้ AI เป็นผู้ช่วยในด้านต่อไปนี้:

- ตรวจความเข้าใจโจทย์และ checklist ของ Lab 01
- เสนอแนวทางจัดลำดับหัวข้อและรูปแบบ Markdown
- ช่วยตรวจภาษา การสะกด และความสอดคล้องของเอกสาร
- ช่วยตรวจ branch, file path, commit message และขั้นตอน Pull Request

เนื้อหา Identification, Pragmatic Promise, เหตุผลที่อยากเรียน SE และ Broken Window เป็นข้อมูลของ Thakorn ซึ่งผู้จัดทำเป็นผู้เลือก ตรวจสอบ และรับผิดชอบก่อนส่งงาน AI ไม่ได้สร้างประสบการณ์ส่วนตัวหรือการตัดสินใจแทนผู้จัดทำ

## Lab 1 — First Pragmatic Commit Usage

### Tools and tasks

- อ่านและทำความเข้าใจใบงานด้วยตนเอง แล้วใช้ ChatGPT/Codex ช่วยตรวจว่ารายการส่งงานไม่ตกหล่น
- ใช้ข้อมูลทีมและข้อมูลส่วนตัวที่มีอยู่จริงมาเขียน 
- ใช้ AI ช่วยตรวจความครบถ้วนของ Identification, Pragmatic Promise, เหตุผลที่อยากเรียน SE และ Broken Window
- ใช้ AI ช่วยตรวจจำนวนคำและรูปแบบ headings หลังจากเขียนเนื้อหาหลักแล้ว
- ผู้จัดทำเป็นผู้เลือกว่าจะรับหรือแก้คำแนะนำของ AI ทุกจุด

### Team verification and responsibility

- Pragmatic Promise ต้องสะท้อนพฤติกรรมที่ Thakorn ตั้งใจทำจริง ไม่ใช่ข้อความที่ AI แต่งขึ้นเพื่อส่งแทน
- ทีมเป็นผู้ตรวจเนื้อหา ความถูกต้องของ README, branch, commit message, Pull Request และ reviewer ก่อน merge
- ไม่มีการนำเนื้อหาจากไฟล์หรือโฟลเดอร์ที่เป็นงานของ Chaiwat และ shuwichada มาใช้หรือแก้ไข
- ไม่ส่งรหัสผ่าน ข้อมูลบัญชี secret หรือข้อมูลส่วนบุคคลของสมาชิกคนอื่นเข้าไปใน prompt

### Verification status

- Branch งานปัจจุบัน: `se-sec2-team-06-lab02-proposal-Thakorn` โดยต่อยอดจาก worktree ที่เริ่มจาก `origin/main`
- `team/.md` มี 4 sections และความยาวอยู่ในช่วง 200–500 คำ
- README มีคำอธิบายโปรเจกต์ รายชื่อสมาชิก และ Theme แล้ว
- ก่อนส่งงานยังต้อง commit ด้วย Conventional Commits, push branch, เปิด Pull Request, tag reviewer, ผ่าน review, merge เข้า `main` และย้าย Project Board ไป `Done`

## Lab 2 — Sprint Zero Usage

### Tools and tasks

- ใช้ ChatGPT/Codex ช่วยตรวจ checklist ของ Lab 02 และโครงสร้าง Project Proposal
- ใช้ AI ช่วยจัดหมวด Theme, Persona, Value Proposition, MoSCoW priorities และ Risks จากข้อมูลโครงการเดิม
- ใช้ AI ช่วยตรวจว่า Proposal มี 6 sections และมีลิงก์ไปยัง Definition of Done
- ใช้ AI ช่วยร่าง acceptance criteria และรูปแบบ Issue ได้ แต่การสร้าง Issue, label, milestone และการจัดลำดับ backlog ต้องให้ทีมตัดสินใจเอง

### Human review and decisions

- ทีมเป็นผู้ยืนยัน Theme `Tools for Modern Learners`, ชื่อ SynapseSync และ Persona หลักก่อน merge
- ทีมเป็นผู้ตัดสินใจ MoSCoW priorities, risks, assumptions, Definition of Done และ Sprint ที่จะนำ Issue ไปทำ
- เนื้อหาที่นำมาจาก workspace เดิมถูกอ่านและปรับให้ตรงกับ repository ปัจจุบันก่อนนำมาใช้
- ห้ามใช้ AI ตัดสินใจแทนทีม และห้ามสร้าง Issue หรือ Pull Request โดยที่สมาชิกทีมยังไม่ได้อ่านตรวจ

## Lab 3 — Requirements Documents Usage

### Tools and tasks

- ใช้ ChatGPT/Codex ช่วยตรวจ rubric ของ Lab 3 และแยก Main Scenario เดิมออกเป็น `scenarios.md` กับ `user-stories.md`
- ใช้ AI ช่วยตรวจว่า Persona แต่ละคนมี Personalization, Job, Education, Relevance และ Frequency of use ครบ
- ใช้ AI ช่วยปรับ narrative scenarios ให้ครอบคลุม happy path และ edge cases โดยยึดบริบท SynapseSync จากเอกสารเดิม
- ใช้ AI ช่วยจัดรูปแบบ User Stories เป็น As a / I want / So that และตรวจ Acceptance Criteria แบบ Given/When/Then
- ใช้ AI ช่วยตรวจ NFR ให้มี metric และวิธีทดสอบ เช่น p95 response time, timeout, uptime, concurrent users และ usability success rate

### Human review and decisions

- ทีมเป็นผู้ยืนยัน Persona หลัก 3 คน ขอบเขต MVP และความสอดคล้องกับ Project Proposal ของ Lab 2
- Priority (MoSCoW), Estimate (S/M/L), quality bar และการเลือก User Stories ที่จะนำเข้า Sprint เป็น product decisions ของทีม ไม่ใช่การตัดสินใจของ AI
- เนื้อหาใน `se-sec2-team-06-lab03` ถูกดึงจาก Requirements เดิมแล้วปรับโครงสร้างและลิงก์ให้ตรงกับ repository ปัจจุบัน
- ทีมต้องอ่าน ตรวจ และแก้เอกสารก่อนสร้าง GitHub Issues หรือเปิด Pull Request ของ Lab 3
- ไม่ส่งรหัสนิสิต ข้อมูลบัญชี secret หรือข้อมูลส่วนบุคคลจริงของผู้ใช้เข้าไปใน prompt

---

## Lab 4 — Rapid Prototyping with AI

### Tools used

- VS Code และ browser สำหรับเขียน/ตรวจ prototype ด้วยตนเอง
- OpenAI Codex / ChatGPT ใช้เป็น co-pilot เพื่ออ่าน rubric, เสนอแนวทาง UI, ช่วยตรวจ selector และช่วยไล่ปัญหา JavaScript
- Node.js built-in test runner และ Playwright/Chrome สำหรับตรวจ flow จริงใน browser

### Prompts used and purposes

1. “ช่วยอ่านเกณฑ์ Lab 4 แล้วสรุปไฟล์ที่ต้องมี พร้อมแยก Tracer Bullet กับ Prototype ให้ชัดเจน”
2. “ช่วยเสนอ design tokens และ layout ที่ทำให้ Register, Home, Quiz, Document Library และ Deadline Planner ใช้ theme เดียวกัน โดยไม่ใช้ framework”
3. “ช่วยตรวจ interactive flow ของฟอร์มกำหนดส่งงาน: เพิ่มรายการ, ทำเครื่องหมายเสร็จ, filter และ weekly planner โดยข้อมูลต้องอยู่ใน memory เท่านั้น”
4. “ช่วยตรวจ test failure จาก Navbar และ browser flow แล้วอธิบายสาเหตุโดยไม่แก้ requirement แทนทีม”
5. “ช่วยปรับ visual direction ของ Thakorn และ Chaiwat ให้ใช้สีและ Navbar เหมือน Home แต่ยังคง layout และ flow ที่ทดสอบไว้”

### AI-assisted content accepted after review

- โครงร่าง shared Navbar, design tokens และ responsive CSS ที่นำมาปรับให้เข้ากับ SynapseSync
- แนวทางจัดโครงสร้าง HTML ของ Thakorn, Chaiwat และ shuwichada
- การ mapping Home palette (`#F3F3F0`, `#B9B9FF`, `#7DD8DA`, `#5959D6`) ถูกใช้เป็น starting point เท่านั้น ผู้จัดทำเป็นผู้เลือกสี layout และรายละเอียด visual เอง
- ข้อเสนอแนะเรื่อง in-memory state, query-string metadata handoff และ browser test cases
- ร่าง wording ใน `prototypes/sprint1/README.md`, `webtest/readme.md` และส่วน Lab 4 ของเอกสารนี้

### Human review and decisions

- ผู้จัดทำเป็นผู้เลือก User Story หลัก `US-03`, ตัดสินใจใช้ Prototype แทน Tracer Bullet และกำหนดขอบเขตว่าไม่มี backend/AI service จริง
- ผู้จัดทำเป็นผู้ตรวจ แก้ และทดสอบ HTML/CSS/JavaScript ก่อนรับคำแนะนำจาก AI เข้า repository โดยต้องเขียน/ปรับ code เองอย่างน้อย 50% ตาม rubric
- คำขอล่าสุดอนุญาตให้ปรับเฉพาะ prototype ใน `prototypes/sprint1/Chaiwat/` และ `prototypes/sprint1/shuwichada/` เพื่อให้เข้าธีมทีมเดียวกัน ไม่ได้เปลี่ยนเอกสารทีมของสมาชิก
- ไม่มีการใส่รหัสนิสิต ข้อมูลบัญชี ไฟล์ส่วนตัว หรือ secret ใน prompt

### Verification status

- Branch: `feature/lab4-prototype-synapsesync`
- ตรวจ shared Navbar ทั้ง 7 route/page ใน desktop/mobile viewport
- ตรวจ visual system ใหม่ของ Thakorn, Chaiwat Library และ Chaiwat Viewer ว่าใช้ token ชุดเดียวกันและไม่มี horizontal overflow
- ตรวจ Quiz flow ตั้งแต่ upload simulation ถึงผลคะแนน
- ตรวจ Library upload/filter/viewer handoff โดยไม่ใช้ browser storage
- ตรวจ Deadline Planner เพิ่มงาน/ทำเสร็จ/filter/planner
- ตรวจ JavaScript syntax และ browser tests ก่อนสรุปผล

### Prototype boundaries

- ข้อมูลทั้งหมดเป็น mock หรือ in-memory state และจะหายเมื่อ refresh
- ไม่มีการสร้างบัญชีจริง ไม่มีการอ่านเนื้อหาไฟล์จริง ไม่มีการส่งข้อมูลไป server และไม่มีการแจ้งเตือนจริง
- ผลการทดสอบนี้ยืนยัน technical flow เท่านั้น ยังไม่ใช่ผล usability test กับ Persona จริง

---

## Lab 5 — Architectural Artifacts Usage

### Tools and tasks

- ผมอ่านใบงาน Lab 5 และ chapter note ก่อน แล้วใช้ ChatGPT/Codex เป็นผู้ช่วยจัด checklist ของ C4 Level 1, C4 Level 2, Technology Stack และ ADR
- ใช้ AI ช่วยเปรียบเทียบ Modular Monolith, layered monolith และการแยก service โดยยึดขนาดทีม, เวลาในหนึ่งภาคการศึกษา, จำนวนผู้ใช้เริ่มต้น และ NFR ของ SynapseSync
- ใช้ AI ช่วยจัดโครงสร้างคำอธิบายและตรวจความสอดคล้องระหว่าง `c4-context.md`, `c4-container.md`, `tech_stack.md`, ADR และ diagram source
- ใช้ AI ช่วยร่าง wording ของ trade-offs, alternatives, review triggers และคำตอบสำหรับ `Request_ARCH.md`
- ใช้ Mermaid CLI ช่วย render diagram เพื่อตรวจ syntax และดูว่าชื่อ actor, container และ protocol อ่านได้จริง

### Example prompts

1. “ช่วยตรวจว่า C4 Level 1 แสดงผู้ใช้ ระบบหลัก และ external system โดยไม่ลงรายละเอียด container เกินขอบเขตหรือไม่”
2. “ช่วยเปรียบเทียบ Modular Monolith กับ Microservices สำหรับทีมเล็กที่มี MVP หนึ่งภาคการศึกษา โดยให้ระบุ NFR, operational cost และเงื่อนไขที่ควรทบทวน ADR”
3. “ช่วยตรวจว่า C4 Level 2 มี internal containers 3–4 ตัว เทคโนโลยีและ protocol ตรงกับ technology stack หรือไม่”
4. “ช่วยตรวจ ADR ให้มี Status, Context, Decision, Consequences และ Alternatives Considered ครบ โดยไม่อ้างว่า AI เป็นผู้ตัดสินใจแทนทีม”

### AI-assisted content accepted after review

- โครงร่างตาราง technology stack, C4 element descriptions, requirement traceability และ ADR headings
- ข้อเสนอแนะเรื่องการแยก module ภายใน FastAPI ได้แก่ Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context
- ร่างคำอธิบาย trade-off ของ PostgreSQL, S3-compatible Object Storage, REST/OpenAPI และ provider adapter
- ร่างคำตอบใน `docs/architecture/Request_ARCH.md` และ reflection ของ Lab 5

### Human review and decisions

- ผมเป็นผู้ตัดสินใจเลือก **Modular Monolith** สำหรับ MVP และกำหนดว่า backend deploy เป็นหน่วยเดียว แต่แบ่ง capability modules ด้วย in-process interfaces
- ทีมเป็นผู้ยืนยันจำนวน internal containers, technology labels, NFR priorities, scope ของ LMS/Notification และเงื่อนไขที่จะทบทวน decision ในอนาคต
- ผมตรวจและแก้ทุกไฟล์ให้ตรงกับ requirements/prototype ที่มีจริง แยก target architecture ออกจาก current prototype และตรวจว่าเอกสารเก่าที่ขัดแย้งกันไม่มีข้อความ Microservices เป็น baseline
- AI ไม่ได้สร้าง credential, secret, hostname, account identifier หรือข้อมูลส่วนบุคคล และไม่มีการส่งข้อมูลลับเข้า prompt

### Verification status

- สร้าง canonical artifacts: `docs/architecture/c4-context.md`, `c4-container.md`, `tech_stack.md` และ ADR-0001/0002
- ปรับ `README.md`, `Request_ARCH.md`, `uml_models.md`, Mermaid/draw.io sources และ legacy ADR pointers ให้ชี้ไปยังชุด canonical เดียวกัน
- Render Mermaid C4 diagrams สำเร็จเป็น PNG และตรวจจำนวน internal containers/ชื่อ technology กับตาราง stack
- เตรียม handoff folders แยก C4 และ ADR สำหรับสมาชิก โดยไม่มี `.git` หรือไฟล์งานอื่นปะปน
- การ review/merge/push เป็นขั้นตอนของทีมหลังตรวจ diff และหลักฐานครบ ไม่ใช่การตัดสินใจโดย AI

---

## Lab 6 — First Container Usage

### Tools and tasks

- ผมอ่าน chapter 6 และ rubric Lab 6 ก่อน แล้วใช้ ChatGPT/Codex เป็นผู้ช่วยแตก deliverables เป็น Dockerfile, `.dockerignore`, API health contract, Docker guide, registry note และ reflection
- ใช้ Python virtual environment, pytest และ httpx ตรวจ contract ของ FastAPI ก่อนเขียน application code ตามแนวทาง test-first
- ใช้ AI ช่วยเสนอ skeleton ของ multi-stage Dockerfile, การจัด dependency layer, non-root user, `EXPOSE` และ `HEALTHCHECK`
- ใช้ AI ช่วยตรวจ wording ของ Container เทียบกับ Virtual Machine ตาม ESP §5.4 และตรวจว่า container แรกไม่ถูกอธิบายเกินจริงว่าเป็น Microservices

### Example prompts

1. “ช่วยออกแบบ health contract ขั้นต่ำสำหรับ FastAPI Modular Monolith ที่จะใช้เป็น container แรก โดยกำหนด response ของ `/` และ `/health` ให้ตรวจสอบได้”
2. “ช่วยร่าง multi-stage Dockerfile สำหรับ Python 3.12 slim ที่ pin version, ใช้ non-root user, เปิด port 8000 และมี healthcheck โดยไม่ copy dev dependencies”
3. “ช่วยตรวจ `.dockerignore` ว่าตัด `.env`, `node_modules`, Git metadata, IDE files, tests และ cache แต่ยังคง requirements กับ application source ที่จำเป็นไว้”
4. “ช่วยอธิบายความต่างระหว่าง image, container, registry และ Virtual Machine ตาม ESP §5.4 พร้อม trade-off ของการใช้ slim image กับ Alpine”

### AI-assisted content accepted after review

- โครงร่าง `services/api/` และตัวอย่าง test สำหรับ `/` กับ `/health` ซึ่งผมปรับชื่อ field และ response ให้ตรงกับ architecture contract ของทีม
- โครงสร้าง root `Dockerfile` แบบ builder/runtime, `.dockerignore` และคำสั่ง build/run ใน `docker/README.md`
- ร่างตาราง Container vs VM, security checklist, registry tag และ Post-quiz 6 ซึ่งผมแก้ภาษาและขอบเขตให้ตรงกับเครื่องมือที่ตรวจได้จริง

### Human review and decisions

- ผมเป็นผู้ตัดสินใจใช้ FastAPI Modular Monolith เป็น container แรก ไม่แยก Microservices และไม่เพิ่ม database/LLM integration ใน Lab 6
- ผมเลือก Python slim ที่ pin version, production/dev requirements แยกกัน, non-root `appuser`, port `8000` และ `/health` เป็น operational contract
- ผมเขียนและปรับ code, tests และเอกสารให้เข้ากับ repository เอง ตรวจ diff และตรวจว่าการแก้ไม่ปะปนกับไฟล์ Lab 2 หรือไฟล์ของสมาชิก
- ไม่มีการส่ง credential, secret, token, hostname จริง หรือข้อมูลส่วนบุคคลเข้า prompt และไม่มีการอ้างว่า image build สำเร็จใน environment ที่ไม่มี Docker CLI

### Verification status

- Contract tests ของ `/` และ `/health` ผ่านด้วย `pytest` จำนวน 2 tests และ ASGI smoke check ได้ HTTP 200 พร้อม `status=healthy`
- ตรวจ static Dockerfile/.dockerignore และ `git diff --check` ในเครื่องพัฒนาแล้ว
- หลังติดตั้ง Docker Desktop แล้ว `docker build -t synapsesync-api:v0.1.0 .` สำเร็จ และ image มีขนาด `52,513,980` bytes (ประมาณ 50.1 MiB) ต่ำกว่าเป้าหมาย 500 MB
- ทดสอบ `docker run` และ `GET /health` ได้ HTTP 200 พร้อม `status=healthy`; `docker inspect` ยืนยัน runtime user เป็น `appuser:appgroup` และ health status เป็น `healthy`
- ยังไม่ได้ push image ไป registry เพราะยังไม่มีการยืนยัน namespace/credentials; คำสั่งและหลักฐานที่ต้องแนบใน PR ระบุไว้ใน `docker/README.md`

---

## Lab 7 — Refactoring Milestone 1 Usage

### Tools and tasks

- ผมอ่าน chapter 7 และ rubric Lab 7 ก่อน แล้วใช้ ChatGPT/Codex เป็นผู้ช่วยแยก deliverables, ตรวจ code smell และวางขอบเขต refactor ที่ไม่ปะปนกับ feature ใหม่
- ใช้ Node.js built-in test runner ตรวจ pure view model และใช้ Playwright/Chrome ตรวจ browser flow ของ prototype จริง
- ใช้ AI ช่วยเสนอวิธีแยก Long Method ใน `renderQuestion()` เป็น view model กับ DOM rendering helpers โดยคง behavior เดิม
- ใช้ AI ช่วยตรวจ wording ของ `docs/refactoring-journal.md` และ Post-quiz 7 หลังจากผมตรวจ diff และผล test เอง

### Prompts used and purposes

1. “อ่าน `prototypes/sprint1/Thakorn/thakorn_quizgenerator_script.js` แล้วระบุ code smell ที่ชัดเจน 5 จุด พร้อม file/line/reason โดยไม่เสนอ feature ใหม่”
2. “ช่วยเสนอ refactor ของ `renderQuestion()` แบบ behavior-preserving โดยแยก logic ข้อมูลคำถามออกจาก DOM และบอกความเสี่ยงที่ต้องทดสอบ”
3. “ช่วยออกแบบ test fixture แบบ test-first สำหรับ feedback ของคำตอบ, class ของ choice และสถานะปุ่ม navigation โดย expected value ต้องกำหนดจาก fixture เอง”
4. “ช่วยตรวจ journal/reflection ให้สื่อว่า AI เป็นผู้ช่วย แต่ทีมเป็นผู้ตัดสินใจและผู้ตรวจโค้ดจริง”

### AI-assisted content accepted after review

- แนวคิดแยก `buildQuestionViewModel()` ออกจาก `renderQuestion()` และรายชื่อ helper ที่ใช้จัด DOM
- โครงร่าง test fixture และ wording ของ smell, before/after และ lesson learned
- คำแนะนำด้าน naming และการตรวจ regression ของ upload, generate, answer selection และ result flow

### Human review and responsibility

- ผมเป็นผู้เลือก smell **Long Method**, กำหนด branch `feature/lab7-refactor-render-question` และกำหนดว่า refactor ต้องอยู่ในงานของ Thakorn เท่านั้น
- ผมเขียน/ปรับ test ก่อน implementation, ตรวจ failure รอบ RED, แก้ source รอบ GREEN และรัน browser tests หลัง refactor ด้วยตัวเอง
- ผมตรวจว่า label, feedback, selected/correct/incorrect classes และ navigation เหมือนเดิม และไม่ได้แก้ไฟล์งานของ Chaiwat หรือ shuwichada
- ไม่ส่ง credential, token, ข้อมูลส่วนบุคคล หรือไฟล์ลับเข้า prompt

### Verification status

- Focused unit test ของ view model ผ่าน 1 test
- Prototype/navbar browser suite ผ่าน 14 tests เพิ่มเติม รวม 15 tests ผ่านและไม่มี failure
- Refactor แยก pure view model และ DOM rendering helpers โดยไม่มี feature ใหม่หรือการเปลี่ยน persistence/backend
