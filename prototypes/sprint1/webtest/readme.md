# Lab 04 — Prototype Test Report

เอกสารนี้บันทึก Test Cases และผลตรวจของ Registration, Login, Home, Shared Navbar และ AI Quiz Generator ใน Sprint 1

## Test Scope

- Entry flow จาก Register/Login ไป Home
- Navbar กลางใน Register, Login, Home และ Thakorn
- Responsive layout บน Desktop และ Mobile
- เส้นทาง Logo ไป Login และปุ่ม `เริ่มใหม่` ไป Register
- Quiz flow ตั้งแต่เลือกไฟล์จนถึงหน้าผลคะแนน
- ขอบเขตด้าน privacy: ไม่มีการสร้างบัญชีหรือเก็บข้อมูลใน browser storage

## Test Environment

| รายการ | ค่า |
|---|---|
| Browser engine | Chromium/Google Chrome |
| Desktop viewport | `1280 × 900` |
| Mobile viewport | `390 × 844` |
| Test runner | Node.js built-in test runner + Playwright |
| Entry point | [`../index.html`](../index.html) |
| Automated test | [`../tests/navbar.test.cjs`](../tests/navbar.test.cjs) |

## Automated Test Cases

| ID | Scenario | Expected Result | Result |
|---|---|---|---|
| L04-TC-01 | เปิดหน้า Register | แสดง Navbar กลางเพียงชุดเดียวและ active content โหลดได้ | Pass |
| L04-TC-02 | เปิดหน้า Login | แสดง Navbar กลางชุดเดียวกับ Register | Pass |
| L04-TC-03 | เปิดหน้า Home | แสดง Navbar กลางและ feature cards | Pass |
| L04-TC-04 | เปิดหน้า Thakorn | แสดง Navbar กลางโดยไม่มี Header เก่าซ้อน | Pass |
| L04-TC-05 | กด Logo/ชื่อ SynapseSync | ลิงก์ไป `login.html` จากทุกหน้า | Pass |
| L04-TC-06 | กดปุ่มเริ่มใหม่ | ลิงก์ไป `register.html` จากทุกหน้า | Pass |
| L04-TC-07 | เปรียบเทียบ Navbar บน Mobile | ขนาด ตำแหน่ง ฟอนต์ และ gutter ตรงกันทุกหน้า | Pass |
| L04-TC-08 | เปรียบเทียบ Navbar บน Desktop | ขนาดและตำแหน่งตรงกันทุกหน้า | Pass |
| L04-TC-09 | ทำ Quiz หนึ่งข้อจนจบ | เปลี่ยน Upload → Quiz → Result และเหลือ site header เพียงชุดเดียว | Pass |
| L04-TC-10 | ตรวจ horizontal overflow | ทุกหน้าพอดีกับ viewport ที่กำหนด | Pass |

Automated suite รวม assertion ที่เกี่ยวข้องไว้เป็น 7 tests เพื่อไม่สร้าง browser ซ้ำโดยไม่จำเป็น ผลล่าสุดคือ **7 passed, 0 failed**

## Form Validation Checks

### Registration

| Input/Action | Expected Result |
|---|---|
| เว้นช่องใดช่องหนึ่ง | แจ้งให้กรอกข้อมูลครบและ focus ช่องแรกที่ผิด |
| รูปแบบอีเมลไม่ถูกต้อง | แจ้งข้อผิดพลาดที่ช่องอีเมล |
| รหัสผ่านสั้นกว่า 8 ตัวอักษร | แจ้งเกณฑ์ความยาวขั้นต่ำ |
| ยืนยันรหัสผ่านไม่ตรงกัน | ทำเครื่องหมายทั้งสองช่องและไม่เปลี่ยนหน้า |
| ข้อมูลตัวอย่างผ่าน validation | ล้างฟอร์มและไป Home โดยไม่บันทึกข้อมูล |

### Login

| Input/Action | Expected Result |
|---|---|
| ไม่กรอกอีเมลหรือรหัสผ่าน | แจ้งให้กรอกข้อมูลครบ |
| รูปแบบอีเมลไม่ถูกต้อง | แจ้งข้อผิดพลาดที่ช่องอีเมล |
| ข้อมูลตัวอย่างผ่าน validation | ไป Home โดยไม่สร้าง session จริง |

## Quiz Flow Checks

1. ไม่เลือกไฟล์แล้วกดสร้างแบบทดสอบ → แสดงข้อความให้เลือกไฟล์
2. เลือกไฟล์ตัวอย่าง → แสดงชื่อไฟล์โดยไม่อ่านหรืออัปโหลดเนื้อหา
3. กำหนดจำนวนข้อ → จำกัดจำนวนตาม question bank ที่มี
4. เลือกคำตอบ → แสดงผลถูก/ผิดและเปิดคำอธิบายได้
5. ทำข้อสุดท้าย → แสดงคะแนนและเปอร์เซ็นต์
6. กดทำแบบทดสอบใหม่ → กลับหน้า Upload และล้าง state ใน memory

## Runtime Audit

- Desktop และ Mobile มี Navbar เพียงหนึ่งชุดต่อหน้า
- Register, Login, Home และ Thakorn ใช้ตำแหน่ง Navbar เดียวกัน
- ใช้ `scrollbar-gutter: stable` จึงไม่ขยับเมื่อบางหน้ามี scrollbar
- ไม่พบ horizontal overflow
- ไม่พบ JavaScript runtime error ระหว่างการตรวจ
- Syntax check ของ JavaScript ผ่าน

## Known Limitations

- Test นี้ตรวจ Prototype แบบ client-side ไม่ใช่ production security test
- ไม่มี backend, database, real authentication หรือ AI provider
- Question bank เป็น mock data และผลการสุ่มอาจต่างกันในแต่ละรอบ
- ยังไม่มี user testing กับ Persona จริง ผลในเอกสารนี้เป็น technical verification เท่านั้น

## Re-run Automated Tests

เมื่อ environment มี Node.js, Google Chrome และ Playwright:

```bash
node --test prototypes/sprint1/tests/navbar.test.cjs
```

กลับไปที่ [Sprint 1 README](../README.md)
