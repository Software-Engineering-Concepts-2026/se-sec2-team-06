# ADR-0002: Use REST and OpenAPI Between the Web Application and Backend API

**Date:** 2026-08-24<br>
**Deciders:** SynapseSync team

## Status

Accepted

## Context

SynapseSync แยก Web Application ออกจาก Backend API เพื่อให้ UI และ business logic พัฒนาและ deploy ตาม runtime ที่เหมาะสม ทั้งสองส่วนต้องมี interface ที่สมาชิกทีมเข้าใจ ทดสอบได้ และใช้ตรวจ compatibility ก่อน release

Core user flows เป็น request/response เช่น login, ส่งคำถาม, ขอแบบฝึกหัด, ส่งคำตอบ และอ่าน progress ทีมยังไม่มี use case ที่ต้อง stream ข้อมูลปริมาณสูงหรือเรียก service ภายในหลายภาษา และ architecture ปัจจุบันเป็น Modular Monolith ไม่ใช่ Microservices

## Decision

Web Application และ Backend API จะสื่อสารด้วย **REST over HTTPS/JSON** และ Backend จะเผยแพร่ **OpenAPI specification** เป็น contract

- Resource/operation ใช้ HTTP method และ status code ที่สอดคล้องกับความหมาย
- Request/response schema ถูกกำหนดด้วย FastAPI/Pydantic และรวมใน OpenAPI
- Error response ใช้โครงสร้างคงที่ที่มี machine-readable code และข้อความสำหรับผู้ใช้โดยไม่เปิดเผย internal detail
- Protected endpoint ตรวจ authentication/authorization ที่ Backend ทุกครั้ง
- API version จะเพิ่มเมื่อมี breaking contract change ที่ไม่สามารถ migrate แบบ backward-compatible ได้
- LLM Provider และ Object Storage ใช้ adapter ของ Backend และไม่เป็น API ที่ Web Application เรียกโดยตรง

## Consequences

### Positive

- Browser, FastAPI และเครื่องมือทดสอบรองรับ HTTPS/JSON โดยตรง
- OpenAPI ลดความคลาดเคลื่อนของ field/type ระหว่าง Frontend และ Backend
- Debug ผ่าน browser network tools หรือ HTTP client ได้ง่าย
- Contract tests และ generated client สามารถเพิ่มได้โดยไม่เปลี่ยน protocol
- สอดคล้องกับ synchronous user flows ของ MVP

### Negative

- JSON มี payload overhead และไม่มี compile-time type sharing โดยอัตโนมัติ
- บางหน้าที่ต้องใช้ข้อมูลหลายชนิดอาจเกิดหลาย request หากออกแบบ resource ไม่เหมาะสม
- Web/API แยก origin ต้องกำหนด CORS และ credential policy อย่างระมัดระวัง
- การเปลี่ยน schema ต้องรักษา backward compatibility หรือประสาน release ของสอง deploy targets

## Alternatives Considered

### GraphQL

ช่วยให้ client เลือก field และรวมข้อมูลหลายชนิดใน request เดียว แต่เพิ่ม schema/resolver/caching complexity ที่ยังไม่จำเป็นสำหรับ user flows และทีมขนาดปัจจุบัน

### gRPC

มี strong contract และ binary transport ที่มีประสิทธิภาพ แต่ browser ใช้โดยตรงได้ไม่สะดวกและมักต้องมี gRPC-Web/proxy เพิ่ม เหมาะกับ service-to-service communication มากกว่าขอบเขต Web-to-API ของ MVP

### Direct Provider Calls from the Browser

ลดงาน Backend บางส่วน แต่จะเปิดเผย API credential ทำให้ authorization, rate limit, data minimization และ audit ควบคุมไม่ได้ จึงไม่ยอมรับ

## Related Artifacts

- [ADR-0001 — Modular Monolith](./0001-tech-stack-selection.md)
- [C4 Level 2 — Container](../c4-container.md)
- [Technology Stack](../tech_stack.md)
- [Software Requirements Specification](../../requirements/srs.md)
