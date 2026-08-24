# Software Requirements Specification — SynapseSync

## 1. Purpose and Scope

SynapseSync เป็นเว็บแอปพลิเคชันช่วยให้ผู้เรียนถามคำถาม รับคำอธิบาย ฝึกโจทย์ที่เกี่ยวข้อง และติดตามความเข้าใจของตนเอง ขอบเขต MVP เน้นผู้เรียนเป็นหลักและให้ผู้สอนดูข้อมูลสรุปที่จำเป็น โดยไม่ใช้ AI ตัดสินผลการเรียนอย่างเป็นทางการ

แหล่งที่มาของ requirements:

- [`personas.md`](./personas.md) — Persona หลักและบริบทการใช้งาน
- [`main_scenario.md`](./main_scenario.md) — Scenario และ User Stories ที่สกัดจาก scenario
- [`../project-proposal.md`](../project-proposal.md) — Value proposition และ MoSCoW scope

## 2. Functional Requirements

| ID | Requirement | Source | Verification |
|---|---|---|---|
| FR-AUTH-01 | ผู้ใช้ต้องสามารถสมัครสมาชิกด้วยข้อมูลที่จำเป็นและรหัสผ่านที่ผ่านนโยบายความปลอดภัยได้ | Project Proposal — Must Have | ทดสอบข้อมูลครบ, ข้อมูลขาด และรหัสผ่านไม่ผ่านเกณฑ์ |
| FR-AUTH-02 | ผู้ใช้ต้องสามารถเข้าสู่ระบบและออกจากระบบได้ | Project Proposal — Must Have | ทดสอบ credential ถูก/ผิด และการเข้าถึงหน้าที่ต้องยืนยันตัวตนหลัง logout |
| FR-ASK-01 | ผู้เรียนต้องสามารถส่งคำถามหรือเนื้อหาที่ไม่เข้าใจให้ผู้ช่วย AI ได้ | Main Scenario — Story 1 | ทดสอบคำถามปกติ, คำถามว่าง และ provider ไม่พร้อม |
| FR-ASK-02 | ระบบต้องสามารถถามกลับเพื่อระบุจุดที่ผู้เรียนไม่เข้าใจก่อนให้คำอธิบาย เมื่อข้อมูลตั้งต้นไม่เพียงพอ | Main Scenario — Story 2 | ทดสอบคำถามกำกวมและตรวจว่าระบบขอข้อมูลเพิ่มก่อนอธิบาย |
| FR-PRAC-01 | ระบบต้องสามารถสร้างโจทย์ฝึกที่สัมพันธ์กับหัวข้อที่ผู้เรียนเพิ่งศึกษาได้ | Main Scenario — Story 3 | ตรวจหัวข้อของโจทย์และจำนวนโจทย์ตามคำขอ |
| FR-PROG-01 | ระบบต้องบันทึกผลการทำโจทย์และสถานะความเข้าใจของผู้เรียนได้ | Main Scenario — Story 4 | ทำโจทย์แล้วเปิดประวัติใหม่เพื่อตรวจว่าผลถูกบันทึก |
| FR-DASH-01 | ผู้สอนที่ได้รับสิทธิ์ต้องสามารถดูสรุปหัวข้อที่ผู้เรียนติดขัดและสถานะการฝึกได้ | Main Scenario — Stories 5–6 | ทดสอบข้อมูลสรุปและยืนยันว่าผู้ใช้ที่ไม่มีสิทธิ์เข้าถึงไม่ได้ |
| FR-REM-01 | ผู้เรียนต้องสามารถรับการเตือนให้กลับมาทบทวนตามการตั้งค่าที่อนุญาตได้ | Main Scenario — Story 7; Project Proposal — Could Have | ทดสอบเปิด/ปิดการเตือนและเวลาที่กำหนด |
| FR-PROG-02 | ผู้เรียนต้องสามารถดูภาพรวมความก้าวหน้าของตนเองได้ | Main Scenario — Story 8; Project Proposal — Should Have | เปรียบเทียบสรุปกับข้อมูลผลการฝึกที่บันทึกไว้ |

## 3. Non-Functional Requirements

ข้อกำหนดที่วัดผลได้อยู่ใน [`nfr.md`](./nfr.md) ครอบคลุม Performance, Security, Usability, Accessibility, Availability และ Maintainability

## 4. Out of Scope for the Current MVP

- การตัดสินคะแนนหรือผลการเรียนอย่างเป็นทางการโดย AI
- การเชื่อมต่อ LMS จริงก่อนทีมได้รับสิทธิ์ API
- การเปิดเผยข้อมูลผู้เรียนให้บุคคลอื่นโดยไม่มี consent และ authorization ที่ตรวจสอบได้
- Feature ที่อยู่ใน `Could Have` จะไม่ถูกดึงเข้ามาแทน `Must Have` โดยไม่มีการตัดสินใจจากทีม

## 5. Requirements Requiring Team Confirmation

- ค่า MoSCoW และ Estimate ระดับ User Story ยังต้องได้รับการยืนยันจากทีมใน backlog
- เกณฑ์ที่ถือว่า “เข้าใจหัวข้อแล้ว” ต้องกำหนดร่วมกับผู้สอนหรือ stakeholder ก่อน implement
- รูปแบบและเงื่อนไข consent สำหรับการเชื่อมข้อมูลผู้เรียนกับบุคคลอื่นยังต้องผ่านการตัดสินใจของทีม
