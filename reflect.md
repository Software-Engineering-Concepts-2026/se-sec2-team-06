# Post-quiz 4 — Reflection

## 1. Prompt Critique

Prompt ที่กว้างเกินไป เช่น “ช่วยทำหน้าเว็บให้สวยและใช้งานได้” ทำให้ผลลัพธ์ไม่ระบุ user flow, ขอบเขตข้อมูล หรือวิธีตรวจสอบ จึงนำไปใช้ตรง ๆ ไม่ได้

หลังปรับตาม Five S’s ผมระบุบริบท, งานเดียว, selector และข้อจำกัดให้ชัดขึ้น เช่น “ปรับ Deadline Planner ของ SynapseSync ด้วย vanilla HTML/CSS/JS ให้เพิ่มงาน กรองงาน และทำเครื่องหมายเสร็จได้ ใช้ in-memory state เท่านั้น และต้องทดสอบที่ 390 × 844” ผลลัพธ์จึงตรวจสอบและนำไปแก้ต่อได้ง่ายกว่า

## 2. AI in Real Life

ผมใช้ AI เป็น co-pilot สำหรับอ่าน rubric, เสนอทางเลือกด้าน layout และช่วยวิเคราะห์ test failure แต่ไม่ได้ให้ AI ตัดสินใจแทนทีม โค้ดที่ได้ต้องอ่าน ทำความเข้าใจ แก้ให้เข้ากับ SynapseSync และทดสอบใน browser ก่อนรับเข้า prototype

สิ่งที่เห็นชัดคือ AI ช่วยลดเวลาหาจุดผิดของ route และ CSS ได้ดี แต่ยังต้องใช้คนตรวจ context เช่น การห้ามใช้ storage และการแยกขอบเขตงานของสมาชิก

## 3. AI Strategy

กลยุทธ์ของผมคือให้คนกำหนด requirement, user story, visual direction และ acceptance checks ก่อน แล้วใช้ AI ช่วยงานที่มีขอบเขต เช่น skeleton, wording, CSS suggestion และการอธิบาย error จาก test จากนั้นผมเป็นคนแก้โค้ด ตรวจ diff และรัน verification เอง

บทเรียนจาก SynapseSync คือ shared Navbar และ design tokens ควรถูกกำหนดก่อนให้ AI ช่วยแต่งแต่ละหน้า เพราะช่วยลดความแตกต่างของขนาดและตำแหน่งระหว่าง module ได้มากกว่าการแก้หน้าใดหน้าหนึ่งแบบแยกกัน

---

# Post-quiz 5 — Reflection on Architecture

## 1. ADR ทำให้เหตุผลของทีมตรวจสอบได้

ก่อนทำ Lab 5 ผมมอง ADR คล้ายเอกสารสรุปว่าเลือก technology อะไร แต่เมื่อเขียน `ADR-0001` จริงจึงเห็นว่าหัวใจคือการบันทึกบริบทและทางเลือกที่ไม่ได้เลือกด้วย การเขียนว่าเหตุใดทีมยังไม่ใช้การแยก service ทำให้ trade-off เรื่องเวลา, monitoring, deployment และ data consistency ชัดขึ้น บทเรียนที่นำไปใช้ต่อคือทุก decision ที่มีผลต่อโครงสร้างควรมี review trigger และไม่ควรแก้ความหมายของ ADR ที่ Accepted เงียบ ๆ

## 2. C4 ช่วยแยกภาพรวมออกจากรายละเอียด implementation

ผมเรียนรู้ว่า Context diagram ไม่ควรใส่ database หรือ framework เพราะหน้าที่คือบอกว่าใครใช้ระบบและระบบพึ่งพาใคร ส่วน Container diagram จึงค่อยอธิบาย Web Application, Backend API, PostgreSQL และ Object Storage พร้อม protocol การแยกสองระดับนี้ช่วยให้ผมเห็นว่า module ภายใน FastAPI ไม่จำเป็นต้องถูกวาดเป็น service ภายนอก และช่วยคุยกับคนที่ไม่ได้ลงรายละเอียด code ได้ง่ายขึ้น ขั้นตอนถัดไปคือรักษาชื่อและความสัมพันธ์เดียวกันใน Markdown, Mermaid และ draw.io ทุกครั้งที่แก้ architecture

## 3. Technology stack ต้องตาม NFR และข้อจำกัดจริง

การเลือก React + Vite, FastAPI, PostgreSQL, S3-compatible Object Storage และ provider adapter ไม่ได้เกิดจากความนิยมของเครื่องมือ แต่โยงกับ state ของ learning flow, relational integrity, binary file size, LLM failure และทักษะ/เวลาของทีม การเขียน alternatives และ trade-offs ทำให้เห็นว่า Modular Monolith เป็นคำตอบที่เหมาะกับ MVP ตอนนี้ ไม่ใช่คำตอบถาวรสำหรับทุก scale บทเรียนของผมคือก่อนรับคำแนะนำจาก AI ต้องกำหนด NFR, จำนวนผู้ใช้, อายุ product และ compatibility constraints ให้ชัด แล้วตรวจว่า stack ที่เลือกตอบเงื่อนไขเหล่านั้นจริง
