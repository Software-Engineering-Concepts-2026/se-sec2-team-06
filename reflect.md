# Post-quiz 5 Reflection — Architectural Artifacts

> เอกสารนี้เป็น team reflection draft จากการตัดสินใจใน Lab 05 ผู้ส่งงานต้องอ่านและยืนยันว่าข้อความสะท้อนความเข้าใจของตนเองก่อนใช้เป็นหลักฐาน Post-quiz

## 1. ADR Reflection — Context Changes the “Best” Architecture

ก่อนทำ Lab นี้ แนวคิด Microservices ดูเหมือนเป็น architecture ที่ทันสมัยและขยายระบบได้ง่าย แต่เมื่อใช้คำถามด้าน trade-off กับบริบทของ SynapseSync เราพบว่า “ขยายได้” ไม่ได้แปลว่า “เหมาะที่สุดตอนนี้” ทีมมีเวลาหนึ่งภาคการศึกษา ผู้ใช้เริ่มต้นตาม NFR ไม่เกิน 100 concurrent users และ core flow ต้องบันทึกข้อมูลที่สัมพันธ์กันตั้งแต่คำถาม แบบฝึกหัด จนถึง progress

การแยก Auth, Quiz และ Progress เป็น service ตั้งแต่แรกจะทำให้ต้องแก้ปัญหา network failure, API compatibility, distributed tracing, deployment และข้อมูลข้าม service ก่อนที่ทีมจะพิสูจน์คุณค่าของ core flow ได้ เราจึงเลือก Modular Monolith: Backend deploy หนึ่งหน่วย แต่แบ่ง module และ data ownership ให้ชัด การตัดสินใจนี้ไม่ได้ปิดทาง Microservices เพราะ ADR ระบุ extraction triggers ไว้ เช่น มี independent scaling need ที่วัดผลได้และทีมมี operations readiness

สิ่งสำคัญที่ได้จาก ADR คือ decision ที่ดีต้องบันทึกทั้งผลดี ผลเสีย และทางเลือกที่ปฏิเสธ หากเขียนเพียง “เลือก X เพราะดี” สมาชิกใหม่จะไม่รู้ว่าบริบทใดทำให้ X เหมาะ และไม่รู้ว่าเมื่อใดควรประเมิน decision ใหม่

## 2. C4 Reflection — Different Zoom Levels Answer Different Questions

C4 Level 1 ช่วยตอบคำถามของ stakeholder ว่า “SynapseSync คืออะไร ใครใช้ และพึ่งพาระบบใด” เราจึงแสดง Student Learner, Teacher Mentor และ LLM Provider โดยไม่ใส่รายละเอียดฐานข้อมูลหรือ framework ที่ทำให้ภาพระดับบริบทยุ่งเกินไป

C4 Level 2 ช่วยตอบคำถามของ developer ว่า “ระบบประกอบด้วยหน่วยใด และข้อมูลเดินทางอย่างไร” ภาพนี้จึงแสดง Web Application, Backend API, PostgreSQL และ Object Storage พร้อม technology และ protocol ของแต่ละเส้น ความต่างของสองระดับทำให้เราเห็นว่าการวาดกล่องจำนวนมากไม่ได้ทำให้ diagram ดีขึ้น หากกล่องนั้นอยู่ผิดระดับหรือไม่มี label คนอ่านจะตีความ boundary และ ownership ผิดได้

การทำ C4 ยังทำให้พบความไม่สอดคล้องกับ Project Proposal: LMS จริงถูกระบุเป็น `Won't Have This Term` และ Notification เป็น `Could Have` จึงไม่ควรแสดงเป็น dependency ปัจจุบัน เราเก็บสองรายการนี้เป็น future options แทน เพื่อให้ architecture สะท้อน scope ที่ทีมรับผิดชอบจริง

## 3. Tech Stack Reflection — Rationale Must Be Testable in Context

เราเรียนรู้ว่าเหตุผลว่า “ทีมถนัด” มีประโยชน์แต่ไม่เพียงพอสำหรับเลือก Tech Stack ตารางของทีมจึงเชื่อม choice กับข้อจำกัดที่ตรวจสอบได้ เช่น PostgreSQL เหมาะกับความสัมพันธ์ User → Practice → Attempt และ transaction, FastAPI/OpenAPI ช่วยให้ Web กับ Backend ทำงานผ่าน contract, และ provider adapter ช่วยทดสอบ timeout/error path ตาม NFR ได้

การเขียน alternative และ trade-off ทำให้เห็นต้นทุนของทุก choice ชัดขึ้น React ลด shared UI duplication แต่เพิ่ม dependency และ state design; Object Storage เหมาะกับ binary file แต่เพิ่ม infrastructure consistency problem; Vercel กับ Render ลดภาระดูแล OS แต่ทำให้มีสอง deploy targets และต้องจัดการ CORS/configuration

ดังนั้น Tech Stack ใน Lab 05 เป็น target architecture ไม่ใช่หลักฐานว่า implement แล้ว ขั้นต่อไปต้องแปลง architecture เป็น backlog, API/schema และ tests โดยใช้ NFR เป็นเกณฑ์วัด หากหลักฐานจริงขัดกับสมมติฐาน ทีมควรเขียน ADR ใหม่เพื่อ supersede decision เดิมแทนการแก้ประวัติย้อนหลัง

## Decision Summary

- Pattern: Modular Monolith
- Web: React + Vite
- Backend: Python + FastAPI
- Data: PostgreSQL + S3-compatible Object Storage
- External dependency: LLM Provider API ผ่าน provider adapter
- Deferred: LMS integration, External Notification Service, Parent-facing data sharing และ Microservices

---

# Post-quiz 6 Reflection — First Container

> ส่วนนี้เป็น reflection draft สำหรับ Lab 06 ผู้ส่งต้องอ่านและยืนยันว่าเหตุผลตรงกับความเข้าใจของตนเองก่อนใช้เป็นหลักฐาน Post-quiz

## 1. Dockerfile Reflection — Every Layer Has a Cost and a Security Effect

การเขียน Dockerfile ทำให้เห็นว่าแต่ละ instruction ไม่ได้เป็นเพียงขั้นตอนติดตั้ง แต่ส่งผลต่อ cache, image size, reproducibility และ security ทีมเลือก `python:3.12.13-slim-bookworm` แทน `latest` เพื่อให้ build ในอนาคตเริ่มจาก runtime เดียวกัน และใช้ multi-stage build เพื่อไม่ให้ test dependencies หรือไฟล์ระหว่างติดตั้งติดไปใน runtime image

การ copy `requirements.txt` ก่อน source code ช่วยให้ dependency layer ใช้ cache ซ้ำเมื่อแก้เฉพาะ application code ส่วน `.dockerignore` ลด build context และป้องกัน `.git`, `.env`, test cache และไฟล์ที่ไม่เกี่ยวข้องเข้า image เราใช้ UID/GID 10001 และ `USER appuser:appgroup` เพราะ API ไม่จำเป็นต้องมีสิทธิ์ root การลดสิทธิ์ไม่สามารถป้องกันช่องโหว่ทั้งหมด แต่ช่วยลดผลกระทบหาก process ถูกโจมตี

สิ่งที่สำคัญอีกข้อคือห้ามถือว่า Dockerfile ถูกต้องเพียงเพราะ syntax ดูสมเหตุสมผล ต้อง build, run, ตรวจ health endpoint, image size และ contents จริง Environment ปัจจุบันไม่มี Docker CLI จึงรายงาน Docker build/run เป็น Blocked แทนการสร้างผลทดสอบขึ้นมาเอง

## 2. Service Decomposition Reflection — Container Is Not Automatically a Microservice

ทีมเลือก containerize FastAPI API เพราะเป็น stateless process และเป็น deployable boundary ที่ระบุไว้ใน C4 Container diagram อย่างไรก็ตาม การมี container ไม่ได้แปลว่าต้องแยก Auth, Quiz และ Progress เป็นคนละ Microservice Backend ยังคงเป็น Modular Monolith ที่ deploy หนึ่ง image และแบ่ง module ภายใน process

เมื่อทบทวน Rule of Twos และบริบททีม เราพบว่ายังไม่มี independent scaling need, service owner, tracing หรือ deployment pipeline ที่รองรับหลาย service การสร้าง container เดียวจึงช่วยให้ environment สม่ำเสมอโดยไม่เพิ่ม distributed-system failure modes หากอนาคต module ใดต้อง scale/deploy แยกและมี data ownership ชัด ทีมจึงค่อยใช้ extraction triggers ใน ADR-0001 ประเมินอีกครั้ง

## 3. REST Endpoint Reflection — Health Check Is an Operational Contract

`GET /health` ดูเป็น endpoint เล็ก แต่มีบทบาทเป็น contract ระหว่าง application, container runtime และผู้ดูแลระบบ Response ต้องรวดเร็ว ไม่เรียก LLM หรือ database ที่ยังไม่มี และตอบ HTTP 2xx เมื่อ process พร้อมรับ request พื้นฐาน Docker `HEALTHCHECK` จึงเรียก endpoint นี้ด้วย Python standard library โดยไม่ติดตั้ง `curl` เพิ่มใน image

ทีมเขียน automated test ก่อน implementation และเห็น test ล้มเหลวเมื่อ `app.main` ยังไม่มี จากนั้นจึงเพิ่ม FastAPI app ให้ test ผ่าน วิธีนี้ยืนยันว่า test สามารถจับการหายไปของ service/route ได้จริง Root endpoint แยกข้อมูล discovery เช่น `/health` และ `/docs` โดยใช้สถานะ `prototype-to-mvp` เพื่อไม่อ้างว่า production implementation เสร็จแล้ว

## Lab 06 Decision Summary

- First container: FastAPI Modular Monolith API
- Local image tag: `synapsesync-api:v0.1.0`
- Base image: `python:3.12.13-slim-bookworm`
- Port/health: `8000` และ `GET /health`
- Runtime identity: non-root UID/GID 10001
- Docker build/run, image size และ registry image: ยังต้องตรวจเมื่อมี Docker CLI และ registry authentication
