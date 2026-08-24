# ADR-0001: Adopt a Modular Monolith for the MVP

**Date:** 2026-08-24<br>
**Deciders:** SynapseSync team

## Status

Accepted

## Context

SynapseSync ต้องส่งมอบ Must-have flow ภายในหนึ่งภาคการศึกษา ได้แก่ authentication, การถามและรับคำอธิบายจาก AI, การสร้างแบบฝึกหัด และการบันทึกความก้าวหน้า ทีมมีขนาดเล็ก ต้องแบ่งงานระหว่าง Web และ Backend และยังไม่มี infrastructure สำหรับ service discovery, distributed tracing, centralized logging หรือ independent deployment หลาย service

ข้อมูลหลักมีความสัมพันธ์กันสูง: ผู้ใช้หนึ่งคนมี learning sessions, practice sets, attempts และ progress records การบันทึกผลการฝึกต้องรักษาความสอดคล้องของข้อมูล และ endpoint ที่เกี่ยวกับผู้เรียนต้องตรวจ authorization ตาม `NFR-SEC-02`

Prototype ปัจจุบันเป็น HTML/CSS/JavaScript แบบ client-side และยังไม่มี backend/database ที่ทำงานได้ ดังนั้น architecture ของ MVP ต้องลด learning/operations cost แต่ยังมี boundary ชัดเจนพอให้ทีมพัฒนาคู่ขนานและแยก service ภายหลังได้เมื่อมีหลักฐานรองรับ

ตัวเลือกหลักที่ทีมพิจารณาคือ:

1. Modular Monolith — Backend deploy หนึ่งหน่วย แบ่ง module ภายใน
2. Microservices — แยก Auth, Learning Assistant, Practice และ Progress เป็น deployable services
3. Full-stack server-rendered monolith — รวม Web UI และ Backend ใน application เดียว

## Decision

ทีมเลือก **Modular Monolith** สำหรับ SynapseSync MVP

- Web Application ใช้ React + Vite และเรียก Backend ผ่าน REST over HTTPS/JSON
- Backend ใช้ Python + FastAPI และ deploy เป็นหน่วยเดียว
- Backend แบ่งตาม business capability เป็น `Authentication`, `Learning Assistant`, `Practice/Quiz`, `Progress` และ `Document Context`
- แต่ละ module เปิด service interface ภายใน process และไม่อ่าน storage implementation ของ module อื่นโดยตรง
- PostgreSQL เป็น Primary Database ร่วม โดยแต่ละ moduleเป็นเจ้าของตาราง/ชุดข้อมูลตาม capability
- S3-compatible Object Storage เก็บเอกสาร; Document Context module เป็นผู้ประสาน object key และ metadata
- LLM Provider ถูกเรียกผ่าน provider adapter ใน Learning Assistant เพื่อรวม timeout, error mapping และ provider-specific code ไว้จุดเดียว
- University LMS และ External Notification Service ไม่เป็น dependency ของ MVP

การตัดสินใจนี้เป็น target architecture ไม่ได้หมายความว่า Prototype ปัจจุบันถูกย้ายไป React/FastAPI แล้ว

### Module Interaction Rules

1. Web Application ติดต่อเฉพาะ Backend API ไม่ติดต่อ Database, Object Storage หรือ LLM Provider โดยตรง
2. Cross-module operation เรียก service interface ภายใน Backend process
3. การเปลี่ยนข้อมูลที่เกี่ยวข้องกันใช้ PostgreSQL transaction เมื่อทำได้
4. External provider failures ต้องถูกแปลงเป็น domain error และไม่เปิดเผย secret/internal detail
5. API contract ถูกเผยแพร่ผ่าน OpenAPI และถือเป็น interface ระหว่าง Web กับ Backend

### Extraction Triggers

ทีมจะพิจารณาแยก module เป็น service เฉพาะเมื่อครบเงื่อนไขต่อไปนี้:

- มีหลักฐานว่าต้อง scale หรือ deploy module นั้นแยกจาก Backend ส่วนอื่น
- Boundary และ data ownership ชัดเจนจนไม่ต้องทำ distributed transaction ใน core flow
- มี owner ดูแล service และ on-call/incident responsibility ที่ชัดเจน
- มี CI/CD, centralized logging, metrics, tracing และ secret management รองรับหลาย service
- ประโยชน์ที่วัดได้สูงกว่า network latency, failure modes และ operations cost ที่เพิ่มขึ้น

## Consequences

### Positive

- Deploy Backend เพียงหน่วยเดียว ลด config drift และลดเวลา setup สำหรับสมาชิกใหม่
- Transaction ของ practice attempt และ progress อยู่ใน PostgreSQL เดียว จึงรักษาความสอดคล้องได้ง่าย
- Capability modules ทำให้แบ่ง ownership และทดสอบ business logic แยกกันได้โดยไม่เพิ่ม network boundary
- REST/OpenAPI ทำให้ Web และ Backend ทำงานคู่ขนานผ่าน contract ที่ตรวจสอบได้
- Provider adapter จำกัดผลกระทบจาก LLM timeout, SDK change และการเปลี่ยน provider
- สามารถค่อย ๆ extract module ได้ภายหลังโดยใช้ interface เดิมเป็นจุดเริ่มต้น

### Negative

- Backend ทุก module release พร้อมกัน และความผิดพลาดระดับ process อาจกระทบหลาย capability
- PostgreSQL เป็น shared infrastructure จึงต้องบังคับ module ownership ด้วย convention/review ไม่ใช่ network isolation
- หาก codebase โตโดยไม่มี boundary test อาจกลายเป็น tightly coupled monolith
- React Web และ FastAPI Backend ยังเป็นสอง deploy targets จึงต้องจัดการ CORS, version compatibility และ environment configuration
- LLM และ Object Storage ยังคงเป็น external failure points แม้ business modules จะอยู่ใน process เดียว

### Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Module coupling เพิ่มขึ้น | ใช้ service interface, ownership table และ architecture review ใน PR |
| Slow endpoint กระทบ process | กำหนด timeout, จำกัด payload และแยก long-running work เมื่อมี use case จริง |
| Shared database ถูกเข้าถึงข้าม module | แยก repository layer และตรวจ dependency direction ด้วย tests/lint ในระยะ implementation |
| LLM provider ไม่พร้อม | Provider adapter, timeout, retry เฉพาะที่ปลอดภัย และเก็บข้อความผู้ใช้ |
| Deploy Web/API ไม่เข้าคู่กัน | Version API contract และรัน contract/browser tests ก่อน release |

## Alternatives Considered

### Microservices

ข้อดีคือแยก deployment/scale และ failure boundary ได้ชัด แต่ถูกปฏิเสธสำหรับ MVP เพราะทีมยังไม่มี workload ที่พิสูจน์ว่าต้อง scale อิสระ และยังไม่มี operations stack สำหรับ service discovery, tracing, retry, contract compatibility และหลาย datastore ค่าใช้จ่ายดังกล่าวจะลดเวลาสำหรับ Must-have user flow

### Full-stack Server-rendered Monolith

ข้อดีคือมี deploy target เดียวและลด CORS แต่ถูกปฏิเสธเพราะ Prototype และแผน UI ต้องการ interaction/state หลายช่วง ทีมต้องการ Web Application ที่พัฒนาแยกผ่าน API contract และ Python ecosystem สำหรับ AI/document processing การรวม UI ไว้ใน server-rendered application จะทำให้ต้องเปลี่ยนแนวทาง Frontend มากเกินความจำเป็น

### Continue with Multi-page Vanilla JavaScript

ข้อดีคือ reuse Prototype ได้มากที่สุดและไม่มี framework migration แต่ถูกปฏิเสธเป็น target MVP เพราะ shared navigation/form state และ flow หลายหน้าจะเพิ่ม duplication และ regression risk เมื่อ feature เติบโต Prototype ปัจจุบันยังคงใช้สำหรับ usability/interaction validation ก่อน migration

## Related Artifacts

- [C4 Level 1 — System Context](../c4-context.md)
- [C4 Level 2 — Container](../c4-container.md)
- [Technology Stack](../tech_stack.md)
- [ADR-0002 — REST API Communication](./0002-rest-api-communication.md)
- [Non-Functional Requirements](../../requirements/nfr.md)
