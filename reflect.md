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
