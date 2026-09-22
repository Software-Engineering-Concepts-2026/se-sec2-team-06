# Lab 04 — SynapseSync Prototype Design

## Goal

ปรับ `prototypes/sprint1/` ใน `se-sec2-team-06-main-new` ให้เป็น Interactive Prototype ที่เปิดจาก browser ได้จริง มี visual language เดียวกันทั้งทีม และสาธิตอย่างน้อยหนึ่ง user flow ของ Lab 3 โดยใช้ client-side state เท่านั้น

## Lab 4 alignment

- Main flow ที่ใช้เป็นหลักคือ **US-03 — สร้างแบบฝึกหัดที่สัมพันธ์กับหัวข้อ** (Must, Estimate M)
- `prototypes/sprint1/index.html` เป็น entry point และนำผู้ใช้ไปหน้า Register ก่อนเข้า Home
- `prototypes/sprint1/README.md` ระบุชื่อ feature, user story, Tracer vs Prototype, สิ่งที่ทำได้, สิ่งที่ไม่ได้ทำ และ next step
- `AI_USAGE.md` ที่ root ของ repository ระบุเครื่องมือ prompt และส่วนที่รับจาก AI พร้อม human review
- `reflect.md` ที่ root ของ repository บันทึก Post-quiz 4 และบทเรียนจากการใช้ AI ในการทำ prototype
- ไม่ใช้ React, Vue, Bootstrap หรือ framework ภายนอก
- ไม่มี database, account จริง, server upload, cookie, `localStorage` หรือ `sessionStorage`

## Architecture

ใช้โครงสร้าง static multi-page prototype โดยแบ่งความรับผิดชอบดังนี้:

```text
prototypes/sprint1/index.html
        |
        v
webtest/register.html -> webtest/home.html
        |                       |
        |                       +--> Thakorn/ (quiz generator)
        |                       +--> Chaiwat/ (document library)
        |                       +--> shuwichada/ (deadline planner)
        |
        +--> webtest/navbar.js + navbar.css + shared.css
```

`webtest/shared.css`, `webtest/navbar.css` และ `webtest/navbar.js` เป็น source of truth ของ page shell, design tokens, typography, spacing, brand mark และ navigation bar ทุกหน้าที่เชื่อมจาก Home

## Shared visual language

- พื้นหลังอ่อนแบบ warm-gray พร้อม accent violet/indigo ของ SynapseSync
- surface สีขาว, border สีเทาอ่อน, radius 10–24px และ shadow ระดับเบา
- Navbar สูงประมาณ 80px บน desktop และลดลงบน mobile โดยตำแหน่ง brand/status/action ตรงกันทุกหน้า
- ใช้ semantic HTML, visible focus state, `aria-label`, `aria-live` และ `prefers-reduced-motion`
- ระยะขอบและความกว้างใช้ `.page-shell` เดียวกัน เพื่อไม่ให้หน้าใดขยับจากหน้าอื่น

## Module contracts

### Thakorn — Quiz Generator

- คง flow อัปโหลดไฟล์จำลอง → ตั้งค่าจำนวน/ประเภท/ระดับ → สร้างข้อสอบตัวอย่าง → ตอบ → ดูคำอธิบาย → ดูผลคะแนน
- ไฟล์อัปโหลดใช้เพียงชื่อไฟล์ใน memory และ question bank เป็น mock data
- ปรับ presentation ให้ใช้ shared tokens, Navbar และ responsive layout เดียวกับ Home

### Chaiwat — Document Library

- คงฟังก์ชันเลือก/ลากไฟล์, เลือกวิชา, แสดงรายการ, กรองตามวิชา, เปิด preview และลบรายการ
- เพิ่ม shared Navbar และ page shell
- เปลี่ยนโทนสีเขียวเดิมเป็น SynapseSync palette โดยไม่เปลี่ยน business flow หลัก
- state อยู่ใน memory; refresh แล้วเริ่มจาก empty state

### shuwichada — Deadline Planner

- เปลี่ยน wireframe แบบ static เป็น form ที่มี input ชื่องาน, วิชา, วันส่ง, เวลา, ความสำคัญ และการเตือนล่วงหน้า
- submit แล้วเพิ่มงานลงรายการใน memory พร้อมข้อความสถานะ
- ทำเครื่องหมายงานเสร็จ/ยกเลิกได้ และมี filter งานที่ยังไม่เสร็จ/เสร็จแล้ว
- แสดงรายการเรียงตามวันส่งและจุดบน weekly planner จากข้อมูลในรายการ
- เพิ่ม shared Navbar, semantic controls และ responsive layout

## Scope boundaries

ทำเฉพาะไฟล์ภายใต้ `prototypes/sprint1/` และเอกสาร Lab 4 ที่เกี่ยวข้องใน `AI_USAGE.md`, `README.md`, `reflect.md` และ test/report ที่จำเป็น ไม่เชื่อม backend หรือบริการ AI จริง

คำขอล่าสุดอนุญาตให้ปรับ prototype ภายใต้ `prototypes/sprint1/Chaiwat/` และ `prototypes/sprint1/shuwichada/` เพื่อให้ทั้งทีมเข้า theme เดียวกัน การอนุญาตนี้ไม่ครอบคลุมเอกสารทีม ไฟล์บุคคล หรือข้อมูลส่วนตัวนอกขอบเขต prototype

## Verification requirements

1. ตรวจว่า `index.html` เปิด Register และทุกลิงก์จาก Home ทำงานได้
2. เปิดอย่างน้อย 4 module pages ใน browser และไม่พบ JavaScript runtime error
3. ตรวจ interactive flow ของ Thakorn, Chaiwat และ shuwichada ด้วยข้อมูลตัวอย่าง
4. ตรวจ desktop `1280 × 900` และ mobile `390 × 844` ว่าไม่มี horizontal overflow
5. ตรวจ JavaScript syntax, link paths, `git diff --check` และ Lab 4 deliverable checklist
6. ตรวจว่า `AI_USAGE.md` และ `reflect.md` มีหัวข้อ Lab 4 ครบและไม่อ้างว่า prototype เป็น production system
7. สร้าง handoff folder `se-sec2-team-06-lab04` ที่มีเฉพาะไฟล์ Lab 4 และไม่มี `.git`
