# ADR-0001 legacy filename — Technology Stack Selection

**Status:** Superseded by [`0001-modular-monolith.md`](./0001-modular-monolith.md)

ไฟล์นี้เป็นชื่อเดิมของ ADR-001 ที่เคยรวมการเลือก technology stack และ pattern หลายรายการไว้ด้วยกัน เพื่อป้องกันลิงก์เก่าขาดจึงเก็บเป็น compatibility pointer เท่านั้น

เอกสารที่เป็น source of truth ปัจจุบันคือ:

- [ADR-0001 — Modular Monolith](./0001-modular-monolith.md) — เหตุผลของ architecture pattern และ extraction criteria
- [ADR-0002 — REST API Communication](./0002-rest-api-communication.md) — protocol ระหว่าง Web กับ Backend
- [Technology Stack](../tech_stack.md) — ตาราง stack, alternatives, trade-offs และ NFR traceability

หากมีการเปลี่ยน architecture decision ให้สร้าง ADR เลขใหม่ที่ระบุ `Supersedes`/`Superseded by` อย่างชัดเจน แทนการแก้ความหมายของเอกสารที่ Accepted แล้ว
