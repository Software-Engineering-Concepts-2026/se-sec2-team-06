# Lab 04 — Sprint 1 Interactive Prototype

> **SynapseSync** เปลี่ยนจุดที่ผู้เรียนยังไม่เข้าใจให้เป็นการฝึกที่ทำต่อได้ทันที ผ่าน flow ทดลองตั้งแต่สมัครสมาชิก เลือกเครื่องมือ สร้างแบบทดสอบ ตอบคำถาม และดูผลลัพธ์

## Sprint Goal

สร้าง Interactive Prototype สำหรับตรวจสอบ User Story **US-03 — สร้างแบบฝึกหัดที่สัมพันธ์กับหัวข้อ** โดยให้ Persona หลัก **ปันปัน — Student Learner** เริ่มต้นใช้งาน ค้นหาเครื่องมือช่วยเรียน และทดลองทำแบบทดสอบจากเอกสารได้โดยไม่สับสน โดยยังไม่เชื่อมต่อฐานข้อมูล ระบบยืนยันตัวตน หรือบริการ AI จริง

Prototype นี้ใช้ตรวจสอบแนวคิดจาก [Project Proposal](../../docs/project-proposal.md), [Main Scenario](../../docs/requirements/main_scenario.md) และ [Persona Overview](../../docs/requirements/personas.md)

## Prototype Entry Point

เปิด [`index.html`](./index.html) เพื่อเริ่มต้นที่หน้าสมัครสมาชิก จากนั้นทดลองตาม flow หลักได้ทันที

```text
index.html
    ↓
Register ──→ Home ──→ AI Quiz Generator ──→ Quiz ──→ Result
    │          ↑
    └─ Login ──┘
```

Home ยังเชื่อมต่อไปยัง Document Library ของ Chaiwat และ Deadline Planner ของ shuwichada เพื่อสาธิตภาพรวม Sprint 1 ของทีม

การสมัครและเข้าสู่ระบบเป็น simulation ใน browser เท่านั้น ข้อมูลในฟอร์มไม่ถูกส่งหรือบันทึกไว้

## Visual Direction — Home Learning Workspace

Thakorn และ Chaiwat ใช้ visual system เดียวกับ Home เพื่อให้ผู้ใช้รู้สึกว่าอยู่ในผลิตภัณฑ์เดียวกัน:

- พื้นฐานเป็น **Home palette**: `#F3F3F0`, `#FFFFFF`, charcoal gradient `#171718 → #282831 → #1F2030`
- ใช้ **ม่วงอ่อน `#B9B9FF`**, **cyan `#7DD8DA`** และ action purple `#5959D6` เป็นสีร่วมกับ Home
- Navbar ของทุกหน้าคงสีเดียวกับ Home: พื้นขาวโปร่ง โลโก้/ปุ่มสีเข้ม และ accent จุดในโลโก้เป็นม่วงอ่อน
- Thakorn ยังคงภาษาภาพแบบ Quiz Generator Studio: dropzone แบบ grid, progress และ result card แต่เปลี่ยนเป็น light surface แบบ Home
- Chaiwat ยังคง Resource Vault: upload station, document cards, subject chips และ viewer/AI panel โดยใช้ token ชุดเดียวกัน
- เปลี่ยนเฉพาะ presentation layer; flow, selectors และข้อจำกัดเรื่องไม่เก็บข้อมูลยังคงเดิมเพื่อให้ทดสอบต่อได้

## User Flow ที่ทดสอบ

| ขั้น | ผู้ใช้ทำอะไร | Prototype แสดงอะไร | สิ่งที่ต้องการเรียนรู้ |
|---|---|---|---|
| 1 | เปิด Prototype | หน้า Register พร้อมคำอธิบาย privacy | ผู้ใช้เข้าใจหรือไม่ว่าไม่มีการสร้างบัญชีจริง |
| 2 | กรอกข้อมูลสมัครหรือเข้าสู่ระบบ | Validation และสถานะสำเร็จ | ข้อความผิดพลาดช่วยแก้ข้อมูลได้หรือไม่ |
| 3 | เปิด Home | รายการเครื่องมือช่วยเรียนของทีม | ผู้ใช้ค้นหาเครื่องมือที่ต้องการได้หรือไม่ |
| 4 | เลือก AI Quiz Generator | หน้าอัปโหลดและตั้งค่าแบบทดสอบ | ผู้ใช้เข้าใจขั้นตอนเตรียมแบบทดสอบหรือไม่ |
| 5 | เลือกไฟล์และจำนวนข้อ | คำถามตัวอย่างแบบสุ่ม | Flow การตอบและ feedback เข้าใจง่ายหรือไม่ |
| 6 | ตอบคำถามจนจบ | คะแนนและปุ่มเริ่มใหม่ | ผู้ใช้รู้ผลและทำรอบใหม่ได้หรือไม่ |

## Prototype Modules

| Module | Owner/Folder | จุดประสงค์ | สถานะการเชื่อมต่อ |
|---|---|---|---|
| Registration, Login และ Home | [`webtest/`](./webtest/) | ทางเข้า Prototype, validation และ feature hub | เชื่อมกับ main flow |
| AI Quiz Generator | [`Thakorn/`](./Thakorn/) | อัปโหลดไฟล์ ตั้งค่า ตอบคำถาม และดูคะแนน | เชื่อมกับ main flow |
| Document Library | [`Chaiwat/`](./Chaiwat/) | อัปโหลด จัดหมวด กรอง เปิดดู และลบเอกสารใน memory | เชื่อมจาก Home และใช้ SynapseSync theme เดียวกัน |
| Deadline Planner | [`shuwichada/`](./shuwichada/) | เพิ่มงาน กำหนดวันส่ง ทำเครื่องหมายเสร็จ และกรองรายการ | เชื่อมจาก Home และใช้ SynapseSync theme เดียวกัน |

## วิธีเปิดใช้งาน

### เปิดจากไฟล์โดยตรง

1. เปิดโฟลเดอร์ `prototypes/sprint1/`
2. เปิด `index.html` ด้วย browser สมัยใหม่
3. กรอกข้อมูลตัวอย่างในหน้า Register หรือเลือก Login จาก Logo
4. เลือก AI Quiz Generator จากหน้า Home

### เปิดผ่าน Local Server

จาก repository root:

```bash
python -m http.server 8000
```

จากนั้นเปิด `http://localhost:8000/prototypes/sprint1/`

## Shared UI Architecture

Navbar เป็น component กลางเพื่อป้องกัน HTML/CSS ซ้ำและทำให้ทุกหน้ามีตำแหน่งเดียวกัน

| ไฟล์ | หน้าที่ |
|---|---|
| [`webtest/navbar.js`](./webtest/navbar.js) | สร้าง Logo, ชื่อผลิตภัณฑ์, Sprint status และลิงก์ Login/Register |
| [`webtest/navbar.css`](./webtest/navbar.css) | กำหนดขนาด ตำแหน่ง และ responsive behavior ของ Navbar |
| [`webtest/shared.css`](./webtest/shared.css) | Design tokens, page shell, typography และ stable scrollbar gutter |

แต่ละหน้าระบุเพียง placeholder เช่น `<div data-navbar-root data-page="home"></div>` แล้วโหลด component กลางชุดเดียวกัน

## Responsive และ Accessibility

- ตรวจสอบ Desktop ที่ `1280 × 900` และ Mobile ที่ `390 × 844`
- Navbar มีขนาด ตำแหน่ง ฟอนต์ และ scrollbar gutter ตรงกันใน Register, Login, Home, Thakorn, Chaiwat และ shuwichada
- ใช้ semantic heading, label, button และ status region ตามหน้าที่
- มี skip link สำหรับข้ามไปยังเนื้อหาหลัก
- Validation ระบุ `aria-invalid` และย้าย focus ไปยังช่องที่ต้องแก้
- รองรับ `prefers-reduced-motion`
- ไม่พบ horizontal overflow ใน viewport ที่ตรวจสอบ

## Test Evidence

Automated browser tests อยู่ใน [`tests/navbar.test.cjs`](./tests/navbar.test.cjs) และ [`tests/prototype.test.cjs`](./tests/prototype.test.cjs)

```bash
node --test prototypes/sprint1/tests/*.test.cjs
```

ผลตรวจล่าสุด: ตรวจ Navbar ทุกหน้า, Quiz flow, Library handoff และ Deadline flow โดยไม่ใช้ browser storage

รายละเอียด test cases และ test report อยู่ใน [`webtest/readme.md`](./webtest/readme.md)

## Prototype Boundaries

- ไม่มี database, account creation, authentication หรือ session จริง
- ไม่ใช้ cookie, `localStorage` หรือ `sessionStorage` ในทุก module
- ไฟล์ที่เลือกใช้เฉพาะชื่อไฟล์เพื่อสาธิต flow และไม่ถูกอัปโหลดไปยัง server
- AI Quiz Generator ยังไม่อ่านเนื้อหาเอกสาร คำถามมาจาก question bank ตัวอย่างและถูกสุ่มใน browser
- Document Library ส่งต่อเฉพาะ metadata ผ่าน query string ภายใน prototype และไม่เก็บไฟล์หรือข้อมูลถาวร
- Deadline Planner ใช้รายการตัวอย่างและรายการที่ผู้ใช้เพิ่มใน memory เท่านั้น การแจ้งเตือนจริงยังไม่ได้เชื่อมต่อ
- คะแนนและคำตอบจะหายเมื่อ refresh หรือออกจากหน้า
- Module ของสมาชิกยังแยกความรับผิดชอบกัน แต่ใช้ shared Navbar, tokens และ page shell เดียวกัน
- ไม่ควรใช้ผลลัพธ์ Prototype เป็นการประเมินผลการเรียนจริง

## Lab 04 Completion Checklist

- [x] Main interactive entry point
- [x] Registration/Login simulation โดยไม่จัดเก็บข้อมูล
- [x] Home สำหรับเชื่อม Prototype ของทีม
- [x] Interactive flow ของ AI Quiz Generator
- [x] Interactive document library ของ Chaiwat
- [x] Interactive deadline planner ของ shuwichada
- [x] Shared responsive Navbar
- [x] Visual refinement ของ Thakorn ให้เข้ากับ shared theme
- [x] Automated browser test และ test report
- [x] Prototype README
- [x] AI usage disclosure ใน [`../../AI_USAGE.md`](../../AI_USAGE.md)
- [x] Post-quiz reflection ใน [`../../reflect.md`](../../reflect.md)

## Related Artifacts

- [Project README](../../README.md)
- [Project Proposal](../../docs/project-proposal.md)
- [Personas](../../docs/requirements/personas.md)
- [Main Scenario และ User Stories](../../docs/requirements/main_scenario.md)
- [Software Requirements Specification](../../docs/requirements/srs.md)
- [AI Usage Disclosure](../../AI_USAGE.md)
- [Post-quiz 4 Reflection](../../reflect.md)
