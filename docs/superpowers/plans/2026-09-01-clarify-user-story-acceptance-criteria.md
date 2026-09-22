# Clarify User Story Acceptance Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ User Stories canonical 10 รายการอ่านง่ายและตรวจสอบได้ โดยย้ายข้อมูล Priority/Estimate ไปอยู่ที่ GitHub labels/Project fields เท่านั้น

**Architecture:** ปรับเอกสาร requirements ใน `docs/requirements/user-stories.md` ให้เป็นแหล่งอ้างอิงเดียวของข้อความและ Acceptance Criteria จากนั้นใช้ข้อความชุดเดียวกันปรับ body ของ GitHub issues #43, #60, #44, #45, #46, #61, #62, #63, #64 และ #65 โดยไม่แก้ label, milestone หรือ Project field

**Tech Stack:** Markdown, GitHub Issues/Projects, Git diff checks

**Spec:** `docs/requirements/user-stories.md` และ User Story issues บน repository `Software-Engineering-Concepts-2026/se-sec2-team-06`

## Global Constraints

- คง User Stories canonical ไว้ 10 รายการ (US-01 ถึง US-10)
- ไม่แก้ไฟล์หรือโฟลเดอร์ของ Chaiwat และ Shuwichada
- ไม่แก้ Priority, Size/Estimate, label, milestone หรือสถานะ Project ที่ตั้งไว้แล้ว
- ลบเฉพาะข้อความ Priority/Estimate และ Requirements metadata ที่ซ้ำจาก issue body
- Acceptance Criteria ต้องเป็นภาษาไทยที่สั้น ชัดเจน และมีผลลัพธ์ที่ตรวจสอบได้

---

### Task 1: ปรับเอกสาร User Stories ให้เป็นข้อความอ่านง่าย

**Files:**
- Modify: `docs/requirements/user-stories.md`

- [ ] **Step 1: เก็บค่า Priority/Estimate ไว้ในส่วนวางแผนของเอกสารเท่านั้น**

คงค่า MoSCoW และ S/M/L ในเอกสาร requirements เพื่อการวางแผน แต่ไม่คัดลอกสองบรรทัดนี้เข้า GitHub issue body

- [ ] **Step 2: เขียน Acceptance Criteria ของ US-01 ถึง US-10 ใหม่**

ใช้ประโยคหนึ่งบรรทัดต่อหนึ่งเกณฑ์ โดยระบุเงื่อนไข การกระทำ และผลลัพธ์ ไม่รวมหลายเงื่อนไขไว้ในประโยคเดียว

- [ ] **Step 3: ตรวจจำนวนและ traceability**

ตรวจให้มีหัวข้อ `## US-01` ถึง `## US-10` ครบ 10 หัวข้อ และลิงก์ใน `main_scenario.md` ยังชี้ไปยัง Issue เดิม

### Task 2: เตรียม body ของ GitHub Issues ให้ตรงกับเอกสาร

**Files:**
- Modify through GitHub UI: Issues `#43, #60, #44, #45, #46, #61, #62, #63, #64, #65`

- [ ] **Step 1: คงส่วน User Story และ Source links**

คง `As a`, `I want`, `So that`, `Source scenario` และ `Source user story` ของแต่ละ issue

- [ ] **Step 2: แทนที่ Acceptance Criteria ด้วยรายการที่อ่านง่าย**

ใช้ checkbox ที่มีเงื่อนไขและผลลัพธ์ชัดเจนตาม `user-stories.md`

- [ ] **Step 3: เอาข้อมูลซ้ำออกจาก body**

ลบ `Priority`, `Estimate` และ `Requirements metadata` ออกจาก issue body เท่านั้น เพราะข้อมูลเหล่านี้ดูได้จาก GitHub labels, Project Priority/Status และ Milestone

### Task 3: ตรวจสอบผลลัพธ์

**Files:**
- Inspect: `docs/requirements/user-stories.md`, `docs/requirements/main_scenario.md`
- Inspect: GitHub issues listed in Task 2

- [ ] **Step 1: ตรวจ Markdown และ diff**

รัน `git diff --check` และตรวจว่าไม่มีบรรทัด Priority/Estimate ใน issue body ที่แก้แล้ว

- [ ] **Step 2: ตรวจจำนวน User Stories บน Project**

ยืนยันว่า Project ยังมี canonical User Stories 10 ใบ ไม่มี `No Status` และไม่มี issue เก่ากลับเข้ามา

- [ ] **Step 3: ตรวจ metadata ใน GitHub**

ยืนยันว่า labels, Project Priority, milestone และสถานะ Backlog/Todo เดิมยังไม่เปลี่ยน
