# ADR-0002: ใช้ REST และ OpenAPI ระหว่าง Web กับ Backend

**Status:** Accepted
**Date:** 2026-08-26
**Deciders:** ทีมพัฒนา SynapseSync

## Context

SynapseSync มี React + Vite Web Application เป็น client และ FastAPI Modular Monolith เป็น backend ที่ต้องทำงานคู่ขนานกันในทีมเดียวกัน ผู้ใช้เรียก flow authentication, learning assistant, practice และ progress ผ่าน request/response ที่ตรวจสอบได้ ขณะเดียวกัน backend ต้องเรียก LLM Provider และ object storage ผ่าน adapter ของตนเอง

ทีมต้องการ contract ที่ frontend review ได้ง่าย มี validation และเอกสาร endpoint อัตโนมัติ โดยไม่ตีความว่า module ภายใน monolith เป็น network service แยกกัน

## Decision

ใช้ **REST over HTTPS/JSON** เป็น protocol ระหว่าง Web Application กับ Backend API และใช้ OpenAPI เป็น contract ที่ generate จาก FastAPI/Pydantic:

- Browser ติดต่อ Backend ผ่าน HTTPS เท่านั้น
- Request/response schema, error shape และ authorization requirement ต้องอยู่ใน OpenAPI
- การเรียก PostgreSQL, Object Storage และ LLM Provider ทำจาก backend adapter ไม่ให้ browser เรียกโดยตรง
- Module ภายใน FastAPI ใช้ in-process interface; ไม่สร้าง REST hop ระหว่าง module เพียงเพื่อเลียนแบบ Microservices
- Versioning และ breaking-change policy ต้องบันทึกใน API contract/PR ก่อนเปลี่ยน consumer

## Consequences

### Positive

- Frontend และ backend ใช้ schema ที่ตรวจสอบได้และสร้าง client/test fixture ได้
- HTTP/JSON ใช้ได้กับ browser, proxy และ debugging tools ที่ทีมคุ้นเคย
- FastAPI สร้าง interactive OpenAPI docs ให้ review contract ได้เร็ว
- แยก external provider failure จาก core web flow ผ่าน backend adapter

### Negative

- JSON มี payload overhead มากกว่า binary protocol และบางหน้าต้องเรียกหลาย endpoint
- ต้องออกแบบ pagination, idempotency, error mapping และ authentication header อย่างสม่ำเสมอ
- หาก deploy Web กับ API คนละ origin ต้องจัดการ CORS และ environment configuration

## Alternatives Considered

### gRPC

ให้ typed binary contract และเหมาะกับ service-to-service ที่มี latency สูง แต่เพิ่มความซับซ้อนของ browser integration และไม่จำเป็นสำหรับ client-to-monolith MVP

### GraphQL

ยืดหยุ่นสำหรับหน้าที่ต้องรวมข้อมูลหลาย resource แต่เพิ่ม schema/resolver governance และไม่จำเป็นเมื่อ core flow มี resource boundary ชัดเจน

### Direct provider calls from Web

ปฏิเสธเพื่อไม่ให้ credential, prompt policy และข้อมูลผู้ใช้รั่วไปยัง browser และเพื่อให้ backend ควบคุม timeout/data minimization ได้

## Related Decisions

สอดคล้องกับ [ADR-0001 — Modular Monolith](./0001-modular-monolith.md) และ container relationship ใน [C4 Level 2](../c4-container.md)
