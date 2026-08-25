# ADR-0001: เลือก Modular Monolith สำหรับ SynapseSync MVP

**Status:** Accepted
**Date:** 2026-08-26
**Deciders:** ทีมพัฒนา SynapseSync

## Context

SynapseSync เป็น All-in-One Learning Platform ที่รวม authentication, การถาม–อธิบายด้วย AI, การสร้างแบบฝึกหัด, การติดตาม progress และ document context ไว้ใน product เดียว ทีมต้องส่งมอบ MVP ภายในหนึ่งภาคการศึกษา ขณะที่ prototype ปัจจุบันยังเป็น HTML/CSS/JavaScript แบบ client-side และมีสมาชิกจำนวนจำกัด

ความต้องการด้านความปลอดภัยและความถูกต้องของข้อมูลทำให้ authentication, authorization, practice attempts และ progress ต้องใช้ transaction และ relational constraints ร่วมกัน ส่วน LLM และ object storage เป็น dependency ที่มี latency/availability และ lifecycle แยกจาก core data flow

ทีมพิจารณา Microservices แต่ยังไม่มีหลักฐานว่าต้อง scale หรือ deploy module แยกกัน จำนวนผู้ใช้เริ่มต้นคาดว่าไม่เกิน 100 concurrent users และทีมยังไม่มี operational capacity สำหรับ service discovery, distributed tracing, independent deployment และหลายฐานข้อมูล

## Decision

เราจะใช้ **Modular Monolith** เป็นสถาปัตยกรรม MVP:

- Frontend เป็น React + Vite Web Application
- Backend เป็น Python + FastAPI deploy เป็นหน่วยเดียว พร้อม OpenAPI/Pydantic contract
- Backend แบ่ง module ตาม capability ได้แก่ Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context
- Module ติดต่อกันผ่าน in-process service interface และห้ามเข้าถึง storage implementation ของ module อื่นโดยตรง
- PostgreSQL เป็น primary database และ S3-compatible Object Storage เป็นที่เก็บ binary document
- LLM ถูกเรียกผ่าน provider adapter ที่มี timeout, error mapping และ data minimization
- การแยก module เป็น service ภายหลังทำได้เมื่อมีหลักฐานเรื่อง independent scaling/deployment, owner, monitoring และ data boundary ที่ชัดเจน

การตัดสินใจนี้สอดคล้องกับ [C4 Level 1](../c4-context.md), [C4 Level 2](../c4-container.md) และ [Technology Stack](../tech_stack.md)

## Consequences

### Positive

- ลด operational overhead และจำนวน deployment units ในช่วง MVP
- ใช้ transaction และ authorization boundary ร่วมกันได้ง่าย เหมาะกับข้อมูล relational ของการเรียน
- ทีมแบ่งงานตาม module ได้โดยไม่ต้องดูแล network protocol ภายในหลาย service
- FastAPI/OpenAPI ทำให้ frontend กับ backend ทำงานคู่ขนานผ่าน contract เดียว
- มี extraction seam สำหรับย้าย module ที่มีเหตุผลเพียงพอในอนาคต

### Negative

- การ deploy backend ร่วมกันทำให้ module ที่เปลี่ยนเล็กน้อยต้องผ่าน release ของ monolith ทั้งชุด
- ความผิดพลาดด้าน dependency หรือ shared database อาจทำให้ coupling เพิ่มขึ้นถ้าไม่ review boundary
- การ scale จะเป็นระดับทั้ง backend ก่อน จึงไม่เหมาะกับ module ที่มี workload แตกต่างกันมาก
- ทีมต้องลงทุนกับ module interface, dependency rule และ automated tests เพื่อป้องกัน monolith ที่ไร้โครงสร้าง

### Operational safeguards

- ทุก endpoint ตรวจ authentication/authorization ที่ backend และไม่ให้ browser เข้าถึง database/object storage โดยตรง
- ใช้ OpenAPI contract, module-level tests และ dependency review ใน pull request
- บันทึก provider timeout/error และไม่ทำให้การบันทึกข้อมูล core สูญหายเมื่อ LLM ไม่พร้อม
- ทบทวน ADR นี้เมื่อมีข้อมูลจริงเรื่อง concurrent users, deployment bottleneck หรือ owner ที่แยกชัดเจน

## Alternatives Considered

### Microservices

ปฏิเสธสำหรับ MVP เพราะเพิ่ม service discovery, network failure, distributed observability, deployment coordination และ data consistency โดยยังไม่มี scale/ownership requirement ที่พิสูจน์ได้

### Layered monolith แบบไม่มี module boundary

ปฏิเสธ เพราะโครงสร้างชั้นอย่างเดียวไม่ป้องกันการเรียกข้าม feature โดยตรง และไม่ช่วยวาง extraction seam สำหรับ capability ที่อาจแยกในอนาคต

### Serverless/full-stack framework เดียว

ปฏิเสธเป็น baseline เพราะ AI/document processing ใช้ Python ecosystem และงานที่ใช้เวลานานอาจชนข้อจำกัด runtime ของ serverless; ทีมต้องการ API contract ที่ชัดเจนระหว่าง Web และ Backend

### Backend แยกตาม persona หรือ feature ตั้งแต่แรก

ปฏิเสธ เพราะทำให้ authentication, authorization และ progress data ซ้ำซ้อน ขณะที่ผู้ใช้ยังอยู่ใน product และ deployment เดียวกัน

## Review Triggers

เขียน ADR ใหม่ที่ระบุว่า supersede ฉบับนี้เมื่อพบอย่างน้อยหนึ่งเงื่อนไข: module ใดต้อง scale/deploy แยกอย่างวัดผลได้, มีทีม owner และ on-call แยก, data boundary ไม่เหมาะกับ shared transaction แล้ว, หรือ NFR ด้าน availability/latency ของ module นั้นไม่สามารถตอบด้วย monolith ได้
