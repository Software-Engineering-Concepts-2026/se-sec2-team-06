# Lab 05 — Architecture Artifacts Design

## Goal

ทำให้เอกสารสถาปัตยกรรมของ SynapseSync ใน `se-sec2-team-06-main-new` เป็นชุดเดียวที่สอดคล้องกับ Lab 5 และกับ prototype/requirements ที่ทำไว้แล้ว โดยใช้ Modular Monolith เป็นคำตอบหลักสำหรับ MVP พร้อมเก็บเหตุผล การแลกเปลี่ยน และขอบเขตของระบบให้ตรวจสอบย้อนกลับได้

## Approved scope

งานนี้ได้รับอนุมัติให้แก้เอกสารเดิมทั้งหมดภายใต้ `docs/architecture/` ที่ขัดแย้งกัน ไม่ใช่เพียงเพิ่มไฟล์ใหม่ โดยต้องรักษาเอกสารที่เป็นของสมาชิกนอกขอบเขตไว้ตามเดิม (รวม `docs/team/chaiwat.md`) และไม่รวม Lab 4 prototype ในการแก้ครั้งนี้

แหล่งอ้างอิงหลักคือเอกสารและโครงสร้างที่มีอยู่ใน `D:/Project SE Sce 2/se-sec2-team-06/` ซึ่งใช้แบบอ่านอย่างเดียว แล้วปรับให้ตรงกับ baseline ของ `se-sec2-team-06-main-new`

## Lab 05 deliverables

### งานหลักของ Thakorn — `se-sec2-team-06-main-new`

- `docs/architecture/c4-context.md`: C4 Level 1 แบบ Mermaid แสดงผู้ใช้งาน ระบบ SynapseSync และระบบภายนอกที่จำเป็น
- `docs/architecture/c4-container.md`: C4 Level 2 แบบ Mermaid แสดง Web Application, Backend API แบบ Modular Monolith, PostgreSQL, S3-compatible Object Storage และ LLM Provider ภายนอก พร้อม technology labels และ data flow
- `docs/architecture/tech_stack.md`: อย่างน้อย 5 ชั้นของ technology stack พร้อมเหตุผลตามบริบท ทางเลือกที่พิจารณา และ trade-off
- `docs/architecture/adr/0001-modular-monolith.md`: ADR ตามหัวข้อ Status, Context, Decision, Consequences และ Alternatives Considered โดยตัดสินใจใช้ Modular Monolith สำหรับ MVP
- ปรับ `docs/architecture/README.md`, `Request_ARCH.md`, `uml_models.md`, Mermaid/draw.io supporting artifacts และ ADR เดิมให้ไม่มีข้อความที่สื่อว่าเลือก Microservices หรืออ้างไฟล์ canonical ที่ไม่มีอยู่
- เพิ่ม `AI_USAGE.md` และ `reflect.md` ส่วน Lab 5 โดยแยกสิ่งที่ AI ช่วยร่างออกจากการตัดสินใจของทีม

### งานส่งต่อสมาชิก 1 — `D:/Project SE Sce 2/se-sec2-team-06-lab05-c4`

โฟลเดอร์ handoff ที่ไม่มี `.git` และมีเฉพาะชุด C4 ที่สมาชิกนำไปวาง/ทำงานต่อได้:

```text
se-sec2-team-06-lab05-c4/
└── docs/architecture/
    ├── c4-context.md
    ├── c4-container.md
    └── diagrams/
        ├── c4-level-1-context.mmd
        └── c4-level-2-container.mmd
```

### งานส่งต่อสมาชิก 2 — `D:/Project SE Sce 2/se-sec2-team-06-lab05-adr`

โฟลเดอร์ handoff ที่ไม่มี `.git` และมีเฉพาะ ADR ที่สมาชิกนำไปวาง/ทำงานต่อได้:

```text
se-sec2-team-06-lab05-adr/
└── docs/architecture/adr/
    └── 0001-modular-monolith.md
```

ไม่มีการสร้าง branch หรือ worktree ให้สมาชิกจาก handoff เหล่านี้

## Architecture decisions

- MVP ใช้ Modular Monolith: แยก module ภายใน codebase/backend เดียว (Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context)
- Frontend เป็น React + Vite Web Application ตาม prototype direction
- Backend target เป็น Python + FastAPI พร้อม OpenAPI และ Pydantic
- PostgreSQL เป็น primary relational database; ไฟล์เอกสารอยู่ใน S3-compatible Object Storage
- การเรียก LLM ใช้ abstract provider API; ห้ามใส่ hostname, credential, bucket หรือข้อมูลลับจริง
- ต้องอธิบาย trade-off อย่างน้อยเรื่อง NFR, อายุระบบ, การ reuse, จำนวนผู้ใช้ และ compatibility

## Verification requirements

1. ไฟล์ deliverable หลักมีอยู่จริงและลิงก์ภายใน `docs/architecture/README.md` resolve ได้
2. Mermaid context/container มี fenced diagram ที่ parse ได้ในระดับ syntax และชื่อระบบ/เทคโนโลยีตรงกับข้อความอธิบาย
3. Container มี 3–4 containers ภายในระบบ และแยก external LLM provider อย่างชัดเจน
4. Tech stack มีอย่างน้อย 5 layers และแต่ละ layer มี rationale, alternative และ trade-off
5. ADR มีหัวข้อบังคับครบและไม่กล่าวว่า baseline เลือก Microservices
6. `AI_USAGE.md` และ `reflect.md` มีส่วน Lab 5 ครบ โดยไม่อ้างว่า AI เป็นผู้ตัดสินใจแทนทีม
7. handoff folders ไม่มี `.git`, ไม่มีไฟล์ของสมาชิกอื่น และมีเฉพาะงานตามที่ระบุ
8. ตรวจ `git diff --check`, สถานะไฟล์ที่เปลี่ยน และไม่ stage การลบ/แก้ `docs/team/chaiwat.md` ที่อยู่นอก scope
