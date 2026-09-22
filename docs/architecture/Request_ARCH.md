# เตรียมตอบคำถามอาจารย์: Architecture ของ SynapseSync

เอกสารนี้เป็น cheat sheet สำหรับอธิบาย Lab 5 โดยยึด [C4 Level 1](./c4-context.md), [C4 Level 2](./c4-container.md), [Technology Stack](./tech_stack.md) และ [ADR-0001](./adr/0001-modular-monolith.md) เป็น source of truth

---

## หมวด 1: ทำไมเลือก Modular Monolith

**Q: ทำไมไม่เริ่มด้วย Microservices?**
MVP ต้องส่งภายในหนึ่งภาคการศึกษา มีผู้ใช้เริ่มต้นไม่เกิน 100 concurrent users และยังไม่มีหลักฐานว่าต้อง scale/deploy module แยกกัน การเริ่มด้วย Microservices จะเพิ่ม service discovery, distributed tracing, deployment coordination และปัญหา data consistency โดยยังไม่เพิ่มคุณค่าให้ core learning flow

**Q: Modular Monolith ต่างจาก monolith แบบก้อนเดียวอย่างไร?**
Backend deploy เป็นหน่วยเดียว แต่แบ่ง Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context ด้วย in-process service interfaces และกฎการเข้าถึงข้อมูล ไม่ให้ module เรียก storage implementation ของกันและกันโดยตรง จึงรักษา boundary และมี extraction seam ในอนาคต

**Q: เมื่อไรจึงค่อยพิจารณาแยก service?**
เมื่อมี independent scaling/deployment need ที่วัดผลได้ มี owner/monitoring พร้อม และ data boundary ไม่เหมาะกับ shared transaction แล้ว การเปลี่ยนต้องมี ADR ใหม่ที่ระบุ decision และผลกระทบ

---

## หมวด 2: อ่าน C4 อย่างไร

**Q: C4 Level 1 แสดงอะไร?**
Level 1 มอง SynapseSync เป็น Software System หนึ่งก้อน แสดง Student Learner, Teacher Mentor และ LLM Provider API เพื่อให้เห็นผู้ใช้และ dependency โดยไม่ลงรายละเอียด technology หรือ module ภายใน

**Q: C4 Level 2 แสดงอะไร?**
Level 2 ขยาย system boundary เป็น 4 internal containers: React + Vite Web Application, FastAPI Modular Monolith Backend API, PostgreSQL และ S3-compatible Object Storage ส่วน LLM Provider อยู่ภายนอกและไม่ถูกนับเป็น internal container

**Q: ทำไม Object Storage อยู่ใน Level 2 แต่ไม่อยู่ Level 1?**
ใน target architecture ทีมควบคุมและ deploy Object Storage เป็น infrastructure ของระบบ จึงอธิบายเป็น container ที่ Backend ใช้ผ่าน S3 API ส่วน LLM Provider เป็น external system ที่มีเจ้าของแยกต่างหาก

**Q: ทำไมไม่ทำ C4 Level 3–4 ใน Lab นี้?**
โจทย์ต้องการภาพรวม Context และ Container เพื่อสื่อสาร boundary กับ technology การลงรายละเอียด component/code จะทำเมื่อ module interface และ implementation มีความเสถียรพอ

---

## หมวด 3: ทำไมเลือก technology stack นี้

**Q: ทำไมใช้ React + Vite?**
Prototype มีหลายหน้าและ shared UI/state หลายช่วง React ช่วยจัด component และ state เมื่อขยับเป็น MVP ขณะที่ Vite ให้ build pipeline เล็กและเร็วสำหรับทีมรายวิชา Prototype เดิมยังคงเป็น HTML/CSS/JavaScript เพื่อสาธิต flow เท่านั้น

**Q: ทำไมใช้ FastAPI?**
FastAPI ให้ OpenAPI docs และ Pydantic validation จาก type hints โดยอัตโนมัติ เหมาะกับทีมที่ต้องทำงาน frontend/backend คู่ขนานและมี AI/document processing ใน Python

**Q: ทำไมใช้ PostgreSQL?**
User, practice, attempt และ progress มีความสัมพันธ์และต้องการ foreign key/transaction ส่วน metadata ที่ยืดหยุ่นใช้ JSONB ได้ จึงไม่ต้องดูแลฐานข้อมูลหลายชนิดใน MVP

**Q: ทำไมเก็บเอกสารใน S3-compatible Object Storage?**
PDF/DOCX เป็น binary blob ขนาดใหญ่ ไม่ควรทำให้ relational database และ backup โตขึ้น ใช้ S3 API ผ่าน Backend เพื่อซ่อน credential และเปลี่ยน provider ได้

---

## หมวด 4: ตอบคำถาม trade-off 5 ด้าน

| ประเด็น | คำตอบของทีม |
|---|---|
| NFR สำคัญ | Security, maintainability, responsive performance และ graceful failure เมื่อ LLM ไม่พร้อม |
| อายุของ product | MVP ต้องส่งภายในหนึ่งภาคการศึกษา แต่ต้องอ่านต่อได้เมื่อสมาชิกใหม่เข้าทีม |
| สิ่งที่ reuse | Shared UI, API schema, transaction และ provider adapter ใช้ร่วมหลาย capability |
| จำนวนผู้ใช้ | เริ่มต้นไม่เกิน 100 concurrent users จึงยังไม่มีเหตุผลรับ operational cost ของ Microservices/Kubernetes |
| Compatibility | Browser เรียก HTTPS/JSON ได้ และ LMS จริงยังไม่มี API access จึงไม่ผูก MVP กับ LMS |

---

## หมวด 5: ความปลอดภัยและขอบเขต

- Browser ไม่ติดต่อ PostgreSQL, Object Storage หรือ LLM Provider โดยตรง
- Backend ตรวจ authentication/authorization ทุก endpoint และส่งข้อมูลไป provider เท่าที่จำเป็น
- Diagram/ADR ใช้ชื่อเชิงนามธรรม ไม่มี hostname, IP, bucket, account identifier หรือ secret จริง
- LMS, Notification และ parent-facing summary เป็น future options ต้องมีสิทธิ์และ consent ก่อนนำเข้า scope
- หาก LLM ไม่พร้อม ระบบต้อง map timeout/error และไม่ทำให้ข้อมูล core flow สูญหาย

## อ้างอิงสำหรับการนำเสนอ

- [Architecture README](./README.md)
- [C4 Level 1](./c4-context.md)
- [C4 Level 2](./c4-container.md)
- [Technology Stack](./tech_stack.md)
- [ADR-0001 — Modular Monolith](./adr/0001-modular-monolith.md)
- [ADR-0002 — REST API Communication](./adr/0002-rest-api-communication.md)
