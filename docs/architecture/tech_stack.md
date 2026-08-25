# Technology Stack — SynapseSync MVP

> ตารางนี้เป็น **target architecture สำหรับ MVP** ไม่ใช่หลักฐานว่า stack ทุกส่วนถูก implement หรือ deploy แล้ว Prototype ใน `prototypes/sprint1/` ปัจจุบันยังเป็น HTML/CSS/JavaScript แบบ client-side

## Decision Drivers

- ทีมขนาดเล็กและระยะเวลาหนึ่งภาคการศึกษา
- Must-have flow เชื่อม authentication, AI assistance, practice และ progress
- ข้อมูลผู้ใช้ แบบฝึกหัด และผลการฝึกมีความสัมพันธ์และต้องควบคุมสิทธิ์
- LLM latency และ availability อยู่นอกการควบคุมของทีม
- ต้องรองรับ Web UI บนมือถือและตรวจสอบ API contract ได้
- งบประมาณและเวลาสำหรับ operations มีจำกัด

## Stack by Layer

| Layer | Choice | Contextual Rationale | Alternative | Trade-off |
|---|---|---|---|---|
| Frontend | React + Vite | Flow มี state หลายช่วงและ shared UI หลายหน้า React ลดการทำซ้ำเมื่อเปลี่ยน Prototype ไปเป็น MVP ขณะที่ Vite ให้ build pipeline ที่เล็กสำหรับทีมในหนึ่งภาคการศึกษา | Vanilla HTML/CSS/JS; Vue; Next.js | เพิ่ม dependency และต้องออกแบบ component/state ให้เป็นระบบ |
| UI Styling | CSS Modules + shared design tokens | รักษาภาษาภาพของ Prototype และจำกัด style leakage ระหว่าง feature modules โดยไม่เพิ่ม utility framework ขนาดใหญ่ | Global CSS; Tailwind CSS; CSS-in-JS | ต้องกำหนด naming/design tokens เองและไม่มี component library สำเร็จรูป |
| API Contract | REST over HTTPS/JSON + OpenAPI | User flows เป็น request/response ชัดเจน และ FastAPI สร้าง contract ให้ Frontend/Backend ทำงานคู่ขนานได้ | GraphQL; gRPC | บางหน้าต้องเรียกหลาย endpoint และ JSON มี overhead มากกว่า binary protocol |
| Backend | Python 3.11+ + FastAPI Modular Monolith | Python ecosystem รองรับ AI/document processing และ deploy backend เพียงหน่วยเดียว ลด operational overhead โดยยังแบ่ง capability modules เพื่อรักษา `NFR-MNT-01` | Flask monolith; Node.js + Express; Microservices | ทีมต้องเรียน Pydantic/async boundary และต้องควบคุมไม่ให้ module coupling เพิ่มตามเวลา |
| Database | PostgreSQL 15+ | Users, permissions, practice attempts และ progress เป็น relational data ที่ต้องการ constraint/transaction; JSONB รองรับ provider metadata โดยไม่เพิ่มฐานข้อมูลอีกชนิด | MongoDB; SQLite | ต้องดูแล schema migration, index และ connection pooling |
| Document Storage | S3-compatible Object Storage | PDF/DOCX เป็น binary ขนาดใหญ่ ไม่ควรทำให้ database backup โต และ S3 API ทำให้เปลี่ยน managed provider ได้ | เก็บ blob ใน PostgreSQL; local disk | เพิ่ม external infrastructure และต้องจัดการ object lifecycle/metadata consistency |
| AI Integration | Provider adapter over HTTPS/JSON | แยก provider-specific SDK ออกจาก Learning Assistant ทำให้ mock test, timeout, budget limit และการเปลี่ยน provider ไม่กระทบ business module | เรียก SDK โดยตรงจาก endpoint; self-hosted model | Adapter เพิ่ม abstraction และยังคงพึ่ง latency/quality/cost ของ provider |
| Deployment | Docker; Vercel สำหรับ Web; Render สำหรับ API | แยก static web จาก API ที่ต้องใช้ Python runtime และใช้ managed platform เพื่อลดภาระ OS/TLS ในช่วงรายวิชา | Single VPS; Railway/Fly.io; Kubernetes | มีสอง deploy targets จึงต้องจัดการ CORS, environment configuration และ release coordination |
| Testing and Quality | Vitest + Playwright; pytest; GitHub Actions | แยก unit/browser/API checks และผูกหลักฐานกับ `NFR-MNT-01` ก่อน merge โดยเลือกเครื่องมือให้ตรงกับแต่ละ runtime | Manual testing only; Jest; unittest | เพิ่มเวลาตั้งค่า fixtures/CI และต้องดูแล tests เมื่อ contract เปลี่ยน |

## Architectural Pattern

Backend ใช้ **Modular Monolith**: deploy FastAPI หนึ่งหน่วยและใช้ PostgreSQL หนึ่งระบบ แต่แบ่ง Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context เป็น module ที่มี interface ชัดเจน รายละเอียดการตัดสินใจอยู่ใน [ADR-0001 — Modular Monolith](./adr/0001-modular-monolith.md)

## Five Architectural Trade-off Questions

| Question | SynapseSync Context | Effect on Decision |
|---|---|---|
| NFR สำคัญคืออะไร | Security, maintainability, responsive performance และ graceful failure เมื่อ LLM ไม่พร้อม | ใช้ backend authorization จุดเดียว, typed API contract และ provider adapter |
| Product lifetime นานเพียงใด | MVP ต้องส่งภายในหนึ่งภาคการศึกษา แต่อาจพัฒนาต่อโดยสมาชิกใหม่ | เลือก stack แพร่หลายและบันทึก boundary/decision ไว้ใน C4/ADR |
| มีอะไร reuse ได้ | Shared UI, API schemas, database transaction และ AI adapter ใช้ร่วมหลาย feature | ใช้ component model และ Modular Monolith แทน service duplication |
| ผู้ใช้และ scale เท่าใด | เป้าหมายเริ่มต้นไม่เกิน 100 concurrent users ตาม NFR | ยังไม่มีเหตุผลให้รับ operational cost ของ Microservices/Kubernetes |
| ต้องเข้ากับระบบเดิมอะไร | Prototype เป็นเว็บและต้องเรียก LLM ภายนอก; LMS จริงยังไม่มีสิทธิ์ API | ใช้ HTTPS/JSON ที่ browser/provider รองรับ และไม่เพิ่ม LMS dependency ใน MVP |

## NFR Traceability

| NFR | Stack Decision | Verification Planned |
|---|---|---|
| `NFR-PERF-01` | React/Vite static bundle | วัด p95 ของ 100 page loads บน target environment |
| `NFR-PERF-02` | FastAPI + PostgreSQL | Load test endpoint ที่ไม่เรียก LLM เป็นเวลาอย่างน้อย 5 นาที |
| `NFR-SEC-01` | FastAPI validation + password hashing + PostgreSQL constraint | Automated validation test และ credential storage review |
| `NFR-SEC-02` | Backend authorization ทุก protected endpoint | Role/ownership tests ที่คาดหวัง HTTP 401/403 |
| `NFR-ACC-01` | React semantic components + shared styles | WCAG 2.1 AA automated scan และ keyboard walkthrough |
| `NFR-AVL-01` | LLM provider adapter with timeout/error mapping | จำลอง provider timeout และตรวจข้อความ/ข้อมูลผู้ใช้ |
| `NFR-MNT-01` | Capability modules + OpenAPI + automated checks | PR checks ต้องผ่านก่อน merge |

## Current Status

| Area | Current Evidence | Status |
|---|---|---|
| Sprint 1 Web Prototype | `prototypes/sprint1/` ใช้ HTML/CSS/JavaScript และ mock question bank | Implemented as prototype |
| React + Vite Web Application | ยังไม่มี application scaffold | Planned for MVP implementation |
| FastAPI Modular Monolith | ยังไม่มี Backend API ที่ทำงานได้; `services/stats-service/` เป็น placeholder | Planned for MVP implementation |
| PostgreSQL/Object Storage | ยังไม่มี schema, migration หรือ provisioned instance ใน repository | Planned for MVP implementation |
| LLM Provider Integration | Prototype ยังไม่เรียก provider จริง | Planned behind provider adapter |

## Alternatives Deferred, Not Selected

- Microservices จะประเมินใหม่เมื่อมี independent scaling/deployment need ที่วัดผลได้
- University LMS integration จะประเมินเมื่อได้รับสิทธิ์ API อย่างเป็นทางการ
- External Notification Service จะประเมินเมื่อ reminder ถูกยกจาก `Could Have` เข้าสู่ Sprint scope
- Parent-facing features ต้องมี consent design และ stakeholder approval ก่อนเลือก technology เพิ่ม

## Related Artifacts

- [C4 Level 1 — System Context](./c4-context.md)
- [C4 Level 2 — Container](./c4-container.md)
- [ADR-0001 — Modular Monolith](./adr/0001-modular-monolith.md)
- [Project Proposal](../project-proposal.md)
- [Non-Functional Requirements](../requirements/nfr.md)
