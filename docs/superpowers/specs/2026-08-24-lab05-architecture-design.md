# Lab 05 Architectural Artifacts — Design Specification

**Date:** 2026-08-24<br>
**Status:** Approved by the user<br>
**Decision owner:** SynapseSync team<br>
**Scope:** Lab 05 documentation only

## 1. Goal

จัดทำ Architectural Artifacts ของ SynapseSync ให้ครบตาม Lab 05 และสอดคล้องกับ Project Proposal, Requirements และ Sprint 1 Prototype โดยใช้สถาปัตยกรรมแบบ **Modular Monolith** ที่เหมาะกับทีมขนาดเล็กและระยะเวลาหนึ่งภาคการศึกษา

## 2. Architectural Decision

SynapseSync จะใช้ React + Vite เป็น Web Application, FastAPI เป็น Backend API แบบ Modular Monolith, PostgreSQL เป็น Primary Database และ S3-compatible Object Storage สำหรับเอกสาร โดยเรียก LLM Provider ผ่าน adapter ใน Backend

Backend จะ deploy เป็นหน่วยเดียว แต่แบ่ง module ตาม business capability ได้แก่ Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context แต่ละ module มี boundary ชัดเจนและไม่ถูก deploy แยกเป็น microservice ในระยะ MVP

### เหตุผลหลัก

- ทีมและเวลาไม่เพียงพอสำหรับ operational overhead ของ Microservices
- Must-have flow ต้องการ transaction และข้อมูลที่สัมพันธ์กันระหว่างผู้ใช้ คำถาม แบบฝึกหัด และผลการฝึก
- FastAPI รองรับ API contract และ Python ecosystem สำหรับ AI/document processing
- PostgreSQL รองรับ relational data และ metadata แบบ JSONB โดยไม่ต้องดูแลหลายฐานข้อมูล
- สามารถแยก service ภายหลังได้เมื่อมีข้อมูลจริงว่าขอบเขตใดต้อง scale หรือ deploy อิสระ

## 3. Scope Alignment

### Included in MVP Architecture

- สมัครสมาชิก เข้าสู่ระบบ และ authorization
- ส่งคำถามและรับคำอธิบายจาก AI
- สร้างแบบฝึกหัด ตรวจคำตอบ และบันทึกผล
- แสดงประวัติ/ความก้าวหน้าของผู้เรียน
- มุมมองสรุปสำหรับผู้สอนที่มีสิทธิ์
- อัปโหลดเอกสารเป็น optional context ผ่าน Object Storage

### Excluded from Current Diagram

- University LMS integration เพราะ Project Proposal ระบุว่าเป็น `Won't Have This Term` หากยังไม่ได้รับสิทธิ์ API
- External Notification Service เพราะ reminder เป็น `Could Have` และยังไม่ใช่ core flow
- Parent-facing data sharing จนกว่าจะมี consent flow ที่ทีมอนุมัติ
- Microservices, message broker, Kubernetes และ multi-region deployment

## 4. C4 Model

### Level 1 — System Context

Actors ในขอบเขตปัจจุบัน:

- Student Learner — ถามคำถาม ทำแบบฝึกหัด และติดตามความก้าวหน้า
- Teacher Mentor — ดูข้อมูลสรุปของผู้เรียนที่ตนมีสิทธิ์ดูแล

External system:

- LLM Provider API — สร้างคำอธิบายและแบบฝึกหัด ระบบต้องรองรับ timeout และผลลัพธ์ที่ไม่ถูกต้อง

Student และ Teacher ติดต่อ SynapseSync ผ่าน HTTPS เท่านั้น ไม่มี actor ใดเข้าถึง Backend หรือ Database โดยตรง

### Level 2 — Containers

| Container | Technology | Responsibility |
|---|---|---|
| Web Application | React + Vite | Responsive UI, form validation, navigation และ accessibility |
| Backend API | Python + FastAPI | Modular business logic, authorization, AI orchestration และ API contract |
| Primary Database | PostgreSQL | Users, questions, practice sets, attempts และ progress records |
| Document Store | S3-compatible object storage | ไฟล์เอกสารและ extracted artifact โดยเก็บ metadata ใน PostgreSQL |

External LLM Provider ไม่ถือเป็น container ภายใน system boundary

## 5. Data Flow

1. ผู้ใช้ส่งคำขอผ่าน Web Application ด้วย HTTPS/JSON
2. Backend ตรวจ authentication, authorization และ input schema
3. Backend อ่าน/เขียนข้อมูลที่มีโครงสร้างใน PostgreSQL
4. สำหรับเอกสาร Backend ออกคำสั่งเก็บ/อ่านไฟล์จาก Object Storage และเก็บเพียง object key กับ metadata ใน PostgreSQL
5. สำหรับ AI flow Backend สร้าง prompt จากข้อมูลที่จำเป็นเท่านั้น เรียก LLM Provider ผ่าน HTTPS/JSON และตรวจ response ก่อนส่งกลับ
6. ผลการฝึกถูกบันทึกผ่าน Backend ก่อนแสดง progress ใน Web Application

## 6. Error and Security Handling

- Web Application ต้องเก็บข้อความผู้ใช้ไว้เมื่อ LLM Provider timeout
- Backend ต้องกำหนด timeout และแปลง provider error เป็นข้อความที่ไม่เปิดเผย secret หรือ internal detail
- Endpoint ข้อมูลผู้เรียนต้องคืน HTTP 401/403 เมื่อไม่มีสิทธิ์
- Password ต้อง hash ด้วย Argon2id หรือ bcrypt และไม่เก็บ plaintext
- เอกสารอัปโหลดต้องจำกัดชนิด/ขนาด ตรวจชื่อไฟล์ และใช้ generated object key
- Secret ทุกชนิดอยู่ใน environment variables หรือ deployment secret manager
- หาก Object Storage ไม่พร้อม ระบบต้องไม่สร้าง database record ที่อ้างถึงไฟล์ซึ่งยังบันทึกไม่สำเร็จ

## 7. Technology Layers

`tech_stack.md` จะบันทึกอย่างน้อย 8 layers ได้แก่ Frontend, Styling/UI, API, Backend, Database, Object Storage, AI Integration และ Deployment/Testing ทุก layer ต้องมี Choice, Contextual Rationale, Alternative และ Trade-off

## 8. ADR Strategy

- ADR-0001 จะบันทึกการเลือก Modular Monolith แทน Microservices ด้วย 5 sections: Status, Context, Decision, Consequences และ Alternatives
- ADR เดิมที่พูดรวมหลาย technology decisions จะถูกย่อและย้าย rationale ที่ยังใช้ได้ไป `tech_stack.md`
- ADR เรื่อง REST communication จะใช้หมายเลข 0002 และแก้บริบทไม่ให้กล่าวว่าระบบเป็น Microservices

## 9. Documentation Changes

### Create

- `docs/architecture/c4-context.md`
- `docs/architecture/c4-container.md`
- `docs/architecture/tech_stack.md`
- `docs/architecture/adr/0002-rest-api-communication.md`
- `reflect.md`

### Modify

- `docs/architecture/README.md`
- `docs/architecture/adr/0001-tech-stack-selection.md`
- `AI_USAGE.md`

### Remove after content migration

- `docs/architecture/adr/001-use-restful-api-internal-commu.md`

### Intentionally Unchanged

- ทุก path ที่มีชื่อ `Chaiwat` หรือ `shuwichada` แบบไม่สนตัวพิมพ์เล็ก-ใหญ่
- `docs/architecture/Request_ARCH.md`
- `docs/architecture/uml_models.md`
- ไฟล์ draw.io, PNG และ `.mmd` เดิมใน `docs/architecture/diagrams/`
- Prototype และ implementation

## 10. Mermaid Presentation

ไฟล์ C4 ทั้งสองจะใช้ Mermaid `flowchart` ภายใน Markdown เพื่อให้ GitHub render ได้เสถียร พร้อมระบุ Person, Software System, Container, External System, system boundary, technology label และ protocol ของทุก edge ตาม semantics ของ C4

## 11. Verification

- ตรวจว่ามี deliverables ตามชื่อที่ Lab 05 กำหนดครบ
- ตรวจ Mermaid code blocks ด้วย Mermaid renderer/parser ที่หาได้ใน environment
- ตรวจจำนวน container เท่ากับ 4 และทุก container มี technology label
- ตรวจ ADR-0001 มี Status, Context, Decision, Consequences และ Alternatives
- ตรวจ Tech Stack มีอย่างน้อย 5 layers พร้อม rationale และ alternative
- ตรวจ local Markdown links
- ตรวจข้อความขัดแย้งเกี่ยวกับ Microservices, LMS และ Notification ในไฟล์ที่แก้
- รัน `git diff --check`
- ตรวจ `git status` เฉพาะ protected paths ต้องไม่มีการเปลี่ยนแปลง

## 12. Delivery Constraints

- ไม่สร้างหรือสลับ branch
- ไม่ commit, push, merge หรือเปิด Pull Request
- ผลการ render บน GitHub PR preview และ screenshot ใน PR description ต้องทำเมื่อทีมอนุมัติขั้นตอน Git ภายหลัง
