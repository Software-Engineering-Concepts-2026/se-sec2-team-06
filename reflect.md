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

---

# Post-quiz 6 — Reflection on the First Container

## 1. Dockerfile เป็นทั้ง build recipe และ security boundary

การทำ multi-stage Dockerfile ทำให้เห็นว่า layer ของ dependency ควรแยกจาก source เพื่อให้ cache กลับมาใช้ได้ และ runtime image ควรมีเฉพาะสิ่งที่ต้องใช้จริง การกำหนด base tag, `.dockerignore` และ `USER appuser` ช่วยลดความเสี่ยงจาก dependency/cache ที่ไม่จำเป็นและการรัน process เป็น root บทเรียนที่นำไปใช้ต่อคือทุกครั้งที่เพิ่ม package ต้องถามทั้งเรื่องขนาด image, reproducibility และสิทธิ์ของ process ไม่ใช่ดูแค่ว่า build ผ่านหรือไม่

## 2. Container ไม่ได้แปลว่า Microservices

การส่ง FastAPI Modular Monolith เป็น image เดียวช่วยย้ำว่า container คือรูปแบบการบรรจุและส่งมอบ runtime ส่วน service boundary เป็นการตัดสินใจด้านสถาปัตยกรรม การแยกเป็นหลาย container ตอนนี้จะเพิ่ม deployment, monitoring และ data-consistency cost โดยยังไม่มีเหตุผลจาก scale หรือ ownership เพียงพอ ขั้นตอนถัดไปคือรอหลักฐานจาก workload จริงก่อนทบทวน ADR ไม่ใช้จำนวน Dockerfile เป็นตัวตัดสิน architecture แทนทีม

## 3. REST health endpoint คือ operational contract

`GET /health` ที่คืน HTTP 200 และ JSON ที่มี version, service และ architecture ทำให้เครื่องมือภายนอกตรวจสถานะ container ได้โดยไม่ต้องรู้รายละเอียดภายใน ส่วน `GET /` ช่วยให้คนหรือระบบค้นพบ service และเอกสาร OpenAPI ได้ง่ายขึ้น การเขียน tests ก่อน source ทำให้ contract นี้ไม่หายไประหว่าง refactor บทเรียนที่นำไปใช้ต่อคือ endpoint สำหรับ health/readiness ต้องมี response ที่เสถียร วัดผลได้ และแยกจาก business logic ตั้งแต่เริ่มทำ service

---

# Post-quiz 7 — Reflection on Refactoring

## 1. Refactor ต้องเริ่มจาก behavior ที่ตรวจได้

การเขียน test ของ view model ก่อนแก้ `renderQuestion()` ทำให้ผมเห็น contract ที่ต้องรักษาไว้จริง ๆ คือ label, progress, feedback, choice state และ navigation ไม่ใช่แค่ทำให้โค้ดสั้นลง เมื่อ test รอบ RED ล้มเหลวเพราะ module ยังไม่มี ผมจึงรู้ว่า test กำลังตรวจ behavior ของส่วนที่จะแยกออกมา ไม่ใช่ตรวจข้อความใน source

## 2. แยก logic กับ DOM ช่วยลด coupling

ก่อนหน้านี้ logic คำตอบกับการสร้างปุ่มอยู่ในฟังก์ชันเดียว การแยก `buildQuestionViewModel()` ทำให้กติกาคำตอบเป็นข้อมูลที่ทดสอบได้ด้วย Node ส่วน helper rendering รับผิดชอบ DOM อย่างเดียว บทเรียนที่นำไปใช้ต่อคือเมื่อฟังก์ชันเริ่มรู้ทั้ง business rule และรายละเอียดหน้าจอ ควรหาขอบเขตที่แยกได้ก่อนเพิ่ม feature

## 3. AI ช่วยเสนอทางเลือก แต่การตัดสินใจและ verification เป็นของทีม

AI ช่วยชี้ smell และเสนอชื่อ helper ได้เร็ว แต่ผมต้องเลือก scope เองเพื่อไม่แตะงานสมาชิกและไม่เปลี่ยน behavior การรัน unit test, browser flow และการตรวจ diff ทำให้มั่นใจว่าการ refactor เป็น Milestone 1 ที่อธิบายได้ ไม่ใช่การรับโค้ดจาก AI โดยไม่ตรวจสอบ
