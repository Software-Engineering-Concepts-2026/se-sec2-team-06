# SynapseSync Architecture

โฟลเดอร์นี้เก็บ Architectural Artifacts ของ SynapseSync สำหรับ Lab 05 โดยอธิบาย **target architecture ของ MVP** แยกจาก Sprint 1 Prototype ซึ่งปัจจุบันยังทำงานแบบ client-side และไม่มี backend/database จริง

## Architecture at a Glance

SynapseSync ใช้ **Modular Monolith** เพื่อให้ทีมขนาดเล็กส่งมอบ core learning flow ได้ภายในหนึ่งภาคการศึกษา โดยแบ่ง responsibility ชัดเจนแต่ไม่เพิ่ม operational overhead ของ Microservices

```text
Student / Teacher
        │ HTTPS
        ▼
React + Vite Web Application
        │ REST over HTTPS/JSON
        ▼
FastAPI Modular Monolith ──HTTPS/JSON──> LLM Provider API
        │
        ├──SQL/TCP──────────> PostgreSQL
        └──S3 API/HTTPS─────> Object Storage
```

Backend deploy เป็นหน่วยเดียวและแบ่ง capability modules ได้แก่ Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context

## Lab 05 Deliverables

| Artifact | Purpose | Status |
|---|---|---|
| [C4 Level 1 — System Context](./c4-context.md) | แสดง Student, Teacher, SynapseSync และ LLM Provider | Complete |
| [C4 Level 2 — Container](./c4-container.md) | แสดง Web, API, Database และ Object Storage พร้อม technology/protocol | Complete |
| [Technology Stack](./tech_stack.md) | Stack 9 layers พร้อม contextual rationale, alternatives และ trade-offs | Complete |
| [ADR-0001 — Modular Monolith](./adr/0001-tech-stack-selection.md) | บันทึกการเลือก Modular Monolith แทน Microservices | Accepted |
| [ADR-0002 — REST API Communication](./adr/0002-rest-api-communication.md) | บันทึก Web-to-API protocol และ OpenAPI contract | Accepted |

## Scope Status

### Current Prototype

- HTML/CSS/JavaScript ใน `prototypes/sprint1/`
- Register/Login simulation โดยไม่จัดเก็บข้อมูล
- AI Quiz Generator ใช้ mock question bank ใน browser
- ไม่มี React application, FastAPI backend, PostgreSQL, Object Storage หรือ LLM integration จริง

### MVP Target Architecture

- React + Vite Web Application
- Python + FastAPI Modular Monolith
- PostgreSQL 15+
- S3-compatible Object Storage
- LLM Provider ผ่าน provider adapter
- Docker-based Backend deployment

## C4 Views

### Level 1 — System Context

[เปิด Mermaid diagram และคำอธิบาย](./c4-context.md)

แสดง SynapseSync เป็น Software System หนึ่งก้อน ผู้ใช้ติดต่อผ่าน HTTPS และระบบเรียก LLM Provider เป็น external dependency เพียงรายการเดียวใน MVP

### Level 2 — Container

[เปิด Mermaid diagram และคำอธิบาย](./c4-container.md)

แสดง 4 containers ภายใน system boundary:

1. Web Application — React + Vite
2. Backend API — Python + FastAPI Modular Monolith
3. Primary Database — PostgreSQL
4. Document Store — S3-compatible Object Storage

## Backend Module Boundaries

| Module | Owns | Collaborates With |
|---|---|---|
| Authentication | Identity, credentials และ authorization checks | ทุก module ผ่าน authenticated principal |
| Learning Assistant | Learning sessions, clarification และ LLM adapter | Practice/Quiz, Document Context |
| Practice/Quiz | Practice sets, questions และ attempts | Learning Assistant, Progress |
| Progress | Progress aggregation และ authorized teacher view | Practice/Quiz, Authentication |
| Document Context | Document metadata, object key และ extraction state | Learning Assistant, Object Storage |

Boundary เหล่านี้เป็น in-process interfaces ไม่ใช่ network services ดู decision criteria และ extraction triggers ใน [ADR-0001](./adr/0001-tech-stack-selection.md)

## Architecture Decisions

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](./adr/0001-tech-stack-selection.md) | Adopt a Modular Monolith for the MVP | Accepted |
| [ADR-0002](./adr/0002-rest-api-communication.md) | Use REST and OpenAPI between Web and Backend | Accepted |

ADR ที่ Accepted จะไม่ถูกแก้เพื่อเปลี่ยนความหมายย้อนหลัง หากทีมเปลี่ยน decision ต้องสร้าง ADR ใหม่และระบุว่า supersede ฉบับใด

## Diagram Source Policy

- ไฟล์ `c4-context.md` และ `c4-container.md` เป็น canonical Lab 05 submission artifacts เพราะเก็บ Mermaid source และคำอธิบายในไฟล์เดียวที่ GitHub render ได้
- ไฟล์ `.mmd`, draw.io XML และ PNG ใน [`diagrams/`](./diagrams/) เป็น supporting historical artifacts จาก draft ก่อนหน้า ไม่ใช่ source of truth ของ architecture ปัจจุบัน
- เมื่อ architecture เปลี่ยน ให้อัปเดต canonical Markdown, ADR ที่เกี่ยวข้อง และ requirement traceability ในการเปลี่ยนแปลงชุดเดียวกัน

## Future Options — Not Current Dependencies

- University LMS API: พิจารณาเมื่อมหาวิทยาลัยอนุมัติ API access; MVP ใช้ manual course metadata
- External Notification Service: พิจารณาเมื่อ reminder ถูกยกจาก `Could Have` เข้าสู่ Sprint scope
- Parent-facing summary: ต้องมี consent/authorization design ที่ทีมและ stakeholder อนุมัติก่อน
- Microservices: พิจารณาเมื่อมี independent scale/deployment need และ operations readiness ที่วัดผลได้

## Security and Governance

- Diagram และ ADR ใช้ชื่อเชิงนามธรรม ไม่บันทึก hostname, IP, bucket name, account identifier หรือ secret จริง
- Secret อยู่ใน environment variables/deployment secret manager และไม่ถูกส่งไป Web Application
- Backend เป็นจุดตรวจ authentication, authorization, validation และ provider data minimization
- เอกสารอัปโหลดต้องตรวจชนิด/ขนาด ใช้ generated object key และไม่เปิดเผย storage credential แก่ browser
- Architecture documents ต้องผ่าน review พร้อม requirements/NFR ที่เกี่ยวข้องก่อน merge

## Directory Map

```text
docs/architecture/
├── README.md
├── c4-context.md
├── c4-container.md
├── tech_stack.md
├── adr/
│   ├── 0001-tech-stack-selection.md
│   └── 0002-rest-api-communication.md
└── diagrams/                  # supporting historical sources/exports
```

## Related Project Artifacts

- [Project Proposal](../project-proposal.md)
- [Main Scenario and User Stories](../requirements/main_scenario.md)
- [Software Requirements Specification](../requirements/srs.md)
- [Non-Functional Requirements](../requirements/nfr.md)
- [Sprint 1 Prototype README](../../prototypes/sprint1/README.md)
- [AI Usage Disclosure](../../AI_USAGE.md)
- [Lab 05 Reflection](../../reflect.md)
