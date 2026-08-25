# Lab 04 — Prototype Test Report

เอกสารนี้บันทึกการตรวจ technical behavior ของ Prototype แบบ client-side ใน `prototypes/sprint1/`

## Test command

```bash
node --test prototypes/sprint1/tests/*.test.cjs
```

ชุดทดสอบใช้ Node.js built-in test runner และ Playwright/Google Chrome โดยกำหนด viewport ดังนี้:

| Viewport | ใช้ตรวจ |
|---|---|
| `1280 × 900` | ขนาดและตำแหน่ง Navbar, layout desktop |
| `390 × 844` | responsive layout และ horizontal overflow |

## Covered flows

| ID | Flow | Expected result |
|---|---|---|
| L04-TC-01 | Register/Login/Home | มี Navbar กลางชุดเดียวและ navigation ทำงาน |
| L04-TC-02 | Shared Navbar | Logo ไป Login และ `เริ่มใหม่` ไป Register จากทุก module |
| L04-TC-03 | Thakorn Quiz | เลือกไฟล์จำลอง → สร้างข้อสอบ → ตอบ → ดูผลคะแนน |
| L04-TC-04 | Chaiwat Library | อัปโหลด → เลือกวิชา → เปิด viewer → ส่ง metadata ผ่าน query string → ไม่ใช้ storage |
| L04-TC-05 | shuwichada Deadline | เพิ่มงาน → ทำเครื่องหมายเสร็จ → กรองงานที่เสร็จแล้ว → อัปเดต planner |
| L04-TC-06 | Mobile layout | ทุกหน้าพอดีกับ viewport และไม่มี horizontal overflow |

## Accessibility and boundary checks

- ทุก module มี skip link และ semantic heading/label/button
- Interactive controls มี focus ring และใช้ `aria-live` หรือ `aria-pressed` ตามหน้าที่
- ไม่ใช้ database, network request, cookie, `localStorage` หรือ `sessionStorage`
- ไฟล์อัปโหลดใช้เฉพาะข้อมูลใน memory และไม่ส่งออกนอก browser
- ผลการตรวจเป็น technical prototype evidence ไม่ใช่ usability result จาก Persona จริง

## Source files

- [`../tests/navbar.test.cjs`](../tests/navbar.test.cjs) — shared Navbar และ responsive metrics
- [`../tests/prototype.test.cjs`](../tests/prototype.test.cjs) — Thakorn, Chaiwat และ shuwichada behavior
- [`../README.md`](../README.md) — scope, Tracer vs Prototype และข้อจำกัด
