# Non-Functional Requirements — SynapseSync

ทุกข้อระบุเป้าหมายที่วัดได้ วิธีตรวจสอบ และบริบทของการทดสอบ เพื่อไม่ใช้คำกำกวม เช่น “เร็ว” หรือ “ปลอดภัย” โดยไม่มีเกณฑ์

| ID | ประเภท | Requirement | วิธีตรวจสอบ |
|---|---|---|---|
| NFR-PERF-01 | Performance | หน้าเว็บหลักต้องแสดงเนื้อหาที่ใช้งานได้ภายใน **2 วินาทีที่ p95** เมื่อทดสอบด้วยเครือข่าย broadband และมีผู้ใช้พร้อมกันไม่เกิน 100 คน | ทดสอบอย่างน้อย 100 page loads และรายงานค่า p95 |
| NFR-PERF-02 | Performance | API ที่ไม่เรียก LLM ต้องตอบกลับภายใน **500 ms ที่ p95** สำหรับข้อมูลทดสอบไม่เกิน 10,000 records และผู้ใช้พร้อมกัน 100 คน | รัน load test อย่างน้อย 5 นาทีและบันทึก p95/error rate |
| NFR-SEC-01 | Security | รหัสผ่านต้องยาวอย่างน้อย **8 ตัวอักษร** และจัดเก็บด้วย password hashing algorithm เช่น Argon2id หรือ bcrypt; ห้ามเก็บ plaintext | ตรวจ validation test, database fixture และ code review authentication module |
| NFR-SEC-02 | Security | Session หรือ access token ต้องหมดอายุภายใน **30 นาที** หลังไม่มีการใช้งาน และ endpoint ที่มีข้อมูลผู้เรียนต้องปฏิเสธผู้ใช้ที่ไม่มีสิทธิ์ด้วย HTTP 401/403 | ทดสอบ token expiry และ authorization ของแต่ละ role |
| NFR-USE-01 | Usability | ผู้ใช้ใหม่อย่างน้อย **80%** ในกลุ่มทดสอบไม่น้อยกว่า 5 คน ต้องทำ flow “เข้าสู่ระบบ → ส่งคำถาม → เปิดคำอธิบาย” สำเร็จภายใน **3 นาที** โดยไม่รับคำแนะนำ | ทำ moderated usability test และบันทึกเวลา/อัตราสำเร็จ |
| NFR-ACC-01 | Accessibility | หน้าหลักและ form สำคัญต้องผ่าน automated WCAG 2.1 AA scan โดยไม่มี **critical violation** และทุก form control ต้องมี accessible label | ตรวจด้วย accessibility scanner และ keyboard-only walkthrough |
| NFR-AVL-01 | Availability | ในช่วง demo ที่ประกาศ ระบบหลักต้องพร้อมใช้งานอย่างน้อย **99%** และเมื่อ LLM provider ไม่พร้อม ต้องแสดงข้อความผิดพลาดภายใน **10 วินาที** โดยไม่ทำให้หน้าจอค้าง | ตรวจ uptime log และจำลอง provider timeout |
| NFR-MNT-01 | Maintainability | Pull Request ที่แก้ business logic ต้องมี automated test สำหรับพฤติกรรมใหม่หรือเหตุผลที่ reviewer ยอมรับ และ checks ที่กำหนดต้องผ่าน **100%** ก่อน merge | ตรวจ PR checklist และผล CI |

## Coverage Check

เอกสารนี้มี NFR 8 ข้อ ครอบคลุม 6 ประเภท ได้แก่ Performance, Security, Usability, Accessibility, Availability และ Maintainability ซึ่งมากกว่าเกณฑ์ขั้นต่ำ 5 ข้อและ 4 ประเภทของ Lab 3

## Measurement Boundary

- ค่าเป้าหมายเป็นเกณฑ์สำหรับ prototype/MVP ของรายวิชา ไม่ใช่ SLA เชิงพาณิชย์
- การทดสอบต้องบันทึก environment, dataset, จำนวนผู้ใช้จำลอง และเวลาที่ทดสอบ เพื่อให้ทำซ้ำได้
- Flow ที่เรียก LLM แยกออกจาก NFR-PERF-02 เพราะ latency ของ provider อยู่นอกการควบคุมของทีม แต่ยังต้องมี timeout และข้อความผิดพลาดตาม NFR-AVL-01
