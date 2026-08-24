# AI Usage Disclosure

## Tools Used

- OpenAI Codex — ใช้ช่วย audit โครงสร้าง repository เทียบกับโจทย์ Lab 02–03 และช่วยร่าง/ตรวจเอกสาร Markdown

## Prompt Purposes

- ตรวจว่า deliverables ใน repository มีชื่อ ตำแหน่ง และองค์ประกอบตรงกับ Lab 02–03 หรือไม่
- จัด Project Proposal ให้ครบ Theme, Persona, Value Proposition, MoSCoW, Risks และ Definition of Done
- ปรับ functional/non-functional requirements ให้มี ID, source และวิธีตรวจสอบที่ชัดเจน
- ตรวจหาความซ้ำ ความขัดแย้ง placeholder และ requirement ที่ยังต้องให้ทีมตัดสินใจ

## AI-Assisted Content Accepted After Review

- โครงสร้างเอกสาร `docs/project-proposal.md` และ `docs/definition-of-done.md`
- Persona overview ใน `docs/requirements/personas.md` ซึ่งสรุปจากไฟล์ Persona เดิมของทีม
- ตาราง measurable NFR ใน `docs/requirements/nfr.md`
- การจัดหมวดและ traceability เบื้องต้นใน `docs/requirements/srs.md`

## Human Review and Decisions

- ทีมเป็นผู้ตัดสิน Theme, Persona, Value Proposition, MoSCoW priority, Estimate และขอบเขตผลิตภัณฑ์ขั้นสุดท้าย
- เนื้อหาที่ AI ช่วยร่างต้องผ่านการอ่านเทียบกับ Persona, Scenario และ Project Proposal ก่อนนำไปใช้
- ห้ามถือว่าตัวเลข NFR เป็นผลทดสอบจริงจนกว่าจะมี test report หรือหลักฐานการวัด
- หากมีการใช้ AI เพิ่มใน PR หรือ Lab ถัดไป ให้เพิ่มเครื่องมือ ลักษณะ prompt ส่วนที่รับมา และวิธีตรวจสอบในไฟล์นี้

---

## Lab 04 — Rapid Prototyping with AI

### Tools Used

- OpenAI Codex — ใช้ช่วย audit requirement ของ Lab 04, ปรับ HTML/CSS/JavaScript, ออกแบบ shared component, สร้าง browser tests และจัดทำเอกสารประกอบ Prototype

### Prompt Purposes

- ตรวจโครงสร้าง `prototypes/sprint1/` และกำหนด main entry point ของทีม
- ออกแบบหน้า Register แบบ simulation ก่อนเข้า Home โดยไม่มี database หรือการจัดเก็บข้อมูล
- ปรับ Login และ Home ให้มี visual language เดียวกับ Prototype ของ Thakorn
- แยก Navbar เป็น `navbar.js` และ `navbar.css` เพื่อให้ทุกหน้ามี source of truth เดียว
- แก้ความต่างของขนาด ฟอนต์ และตำแหน่ง Navbar ระหว่าง Register, Login, Home และ Thakorn
- ตรวจ responsive behavior บน Desktop/Mobile และสร้าง automated browser regression tests
- ร่าง Sprint README, Test Report และข้อจำกัดของ Interactive Prototype

### AI-Assisted Content Accepted After Review

- โครงสร้างและ presentation ของ `webtest/register.html`, `webtest/login.html` และ `webtest/home.html`
- CSS กลางใน `webtest/shared.css`, `webtest/navbar.css` และ `webtest/auth_style.css`
- Navbar injection และ route mapping ใน `webtest/navbar.js`
- การปรับ presentation ของ `Thakorn/thakorn_quizgenerator_prototype.html` และไฟล์ CSS ที่เกี่ยวข้อง
- Automated browser regression tests ใน `prototypes/sprint1/tests/navbar.test.cjs`
- เอกสาร `prototypes/sprint1/README.md` และ `prototypes/sprint1/webtest/readme.md`

### Human Review and Decisions

- ผู้ใช้อนุมัติการแก้ Lab 04 เป็นช่วง ๆ ก่อนแก้ไฟล์จริง
- ผู้ใช้กำหนดให้หน้า Register เป็นจุดเริ่มต้น แต่ Logo ของ Navbar เชื่อมไป Login และปุ่ม `เริ่มใหม่` เชื่อมไป Register
- ผู้ใช้ตัดสินใจให้ Navbar มีขนาดและตำแหน่งตรงกันทุกหน้าที่อยู่ในขอบเขตงาน
- ผู้ใช้กำหนดไม่ให้แก้ไฟล์หรือโฟลเดอร์ที่มีชื่อ `Chaiwat` และ `shuwichada`; งานของสมาชิกดังกล่าวถูกอ้างอิงและเชื่อมจาก Home เท่านั้น
- ทีมยังต้องทำ usability test กับ Persona จริงและตัดสินใจว่าจะนำ feedback ใดเข้าสู่ Sprint ถัดไป

### Verification Performed

- เขียน browser tests ก่อนแก้ behavior สำคัญและตรวจ red/green cycle
- Automated suite ผ่าน 7 tests โดยไม่มี failure
- ตรวจ Desktop `1280 × 900` และ Mobile `390 × 844`
- เปรียบเทียบขนาด ตำแหน่ง ฟอนต์ และ scrollbar behavior ของ Navbar ใน 4 หน้า
- ตรวจว่าไม่มี horizontal overflow และ JavaScript runtime error ในหน้าที่ทดสอบ
- ตรวจ JavaScript syntax และ `git diff --check`
- ตรวจยืนยันว่า path ของ `Chaiwat` และ `shuwichada` ไม่มีการเปลี่ยนแปลง

### Prototype Boundaries

- ผลงานนี้เป็น client-side Interactive Prototype ไม่ใช่ production authentication system
- ไม่มีการส่งหรือจัดเก็บข้อมูลบัญชี คำตอบ หรือไฟล์อัปโหลดแบบถาวร
- AI Quiz Generator ใช้ mock question bank และไม่ได้อ่านเอกสารหรือเรียก AI service จริง
- ผลการทดสอบทางเทคนิคไม่ใช่หลักฐาน usability จนกว่าจะทดลองกับผู้ใช้เป้าหมาย

---

## Lab 05 — Architectural Artifacts

### Tools Used

- OpenAI Codex — ช่วยตรวจความสอดคล้องของ Requirements/Prototype/Architecture, ร่าง Mermaid syntax, challenge trade-offs ของ ADR และจัดโครงสร้างเอกสาร Lab 05
- Codex in-app browser — ใช้อ่านโจทย์ Lab 05 จากหน้า Notion ต้นฉบับเพื่อยืนยันชื่อไฟล์ เกณฑ์ C4/ADR/Tech Stack และข้อกำหนด AI disclosure

### Prompts Used and Purposes

1. **“ตรวจ Lab 05 เทียบกับ repository และระบุ deliverables/ความขัดแย้งก่อนแก้”** — ใช้หาไฟล์ที่ขาด, ADR หมายเลขซ้ำ และ dependency ที่ไม่ตรงกับ MVP scope
2. **“ออกแบบ C4 Context และ Container สำหรับ SynapseSync แบบ Modular Monolith พร้อม technology/protocol labels”** — ใช้ช่วยร่าง Mermaid และตรวจว่า Level 1/Level 2 อยู่คนละระดับ abstraction
3. **“Challenge ADR ที่เลือก Modular Monolith แทน Microservices”** — ใช้ค้นหาผลเสีย, failure modes, extraction triggers และ alternatives ที่ทีมอาจมองข้าม
4. **“จัด Tech Stack อย่างน้อย 5 layers พร้อม contextual rationale, alternative และ trade-off”** — ใช้ตรวจว่าการเลือกแต่ละ layer เชื่อมกับ timeline, Must-have flow และ NFR ไม่ใช่เพียงความคุ้นเคย

### AI-Assisted Content Accepted After Review

- Mermaid source และคำอธิบายใน `docs/architecture/c4-context.md`
- Mermaid source, container responsibilities, data flow และ NFR mapping ใน `docs/architecture/c4-container.md`
- ตาราง stack 9 layers และ five trade-off questions ใน `docs/architecture/tech_stack.md`
- โครงสร้าง/ถ้อยคำของ ADR-0001 และ ADR-0002 ตาม Michael Nygard format
- Architecture index ใน `docs/architecture/README.md`
- Team reflection draft ใน `reflect.md`
- Design specification และ implementation plan ใน `docs/superpowers/`

### Human Decisions and Rejected Suggestions

- ทีมเป็นผู้เลือก **Modular Monolith** และยืนยัน React + Vite, FastAPI, PostgreSQL, S3-compatible Object Storage และ LLM provider adapter เป็น target architecture
- ทีมอนุมัติ design specification ก่อนสร้าง deliverables และเลือก Inline Execution
- ทีมไม่เลือก Microservices สำหรับ MVP เพราะยังไม่มี independent scaling need หรือ operations readiness ที่พิสูจน์ได้
- University LMS ถูกนำออกจาก current diagram เพราะ Project Proposal ระบุเป็น `Won't Have This Term` หากยังไม่มีสิทธิ์ API
- External Notification Service ถูกเลื่อนไว้เป็น future option เพราะ reminder อยู่ใน `Could Have`
- ไฟล์หรือโฟลเดอร์ที่มีชื่อ `Chaiwat` และ `shuwichada` ถูกสงวนไว้และไม่แก้ไข
- ทีมกำหนดให้รอจนงานทุก Lab เสร็จก่อน commit/push

### Verification Performed

- ตรวจว่า C4 Context มี Student, Teacher, SynapseSync และ LLM Provider พร้อม relation/protocol labels
- ตรวจว่า C4 Container มี 4 containers พร้อม technology labels ครบ
- ตรวจว่า Tech Stack มี 9 layers พร้อม rationale, alternative และ trade-off
- ตรวจว่า ADR-0001 มี Status, Context, Decision, Consequences และ Alternatives
- ตรวจข้อความแยก Current Prototype ออกจาก MVP Target Architecture เพื่อไม่อ้างว่า backend/database ถูก implement แล้ว
- ตรวจ local links, Mermaid rendering, whitespace และ protected paths ในรอบ verification สุดท้ายก่อนรายงานผล

### AI Boundaries

- AI ช่วยร่าง syntax, rationale และ challenge decision แต่ไม่ได้เป็นผู้เลือก architecture/tech stack แทนทีม
- `reflect.md` เป็น draft ที่ผู้ส่งต้องอ่านและยืนยันด้วยตนเองก่อนใช้เป็นหลักฐาน Post-quiz
- Architectural Artifacts เป็น design target ไม่ใช่หลักฐาน production deployment, performance หรือ security test

---

## Lab 06 — First Container

### Tools Used

- OpenAI Codex — ช่วยออกแบบ FastAPI health contract, ร่าง Dockerfile/.dockerignore, challenge container security และสร้างเอกสาร build/run/trade-off
- Official PyPI JSON API — ใช้ตรวจเวอร์ชันล่าสุดก่อน pin `fastapi`, `uvicorn`, `pytest` และ `httpx`
- Official Docker Hub API — ใช้ยืนยันว่า tag `python:3.12.13-slim-bookworm` มีอยู่จริงก่อนใช้เป็น base image

### Prompts Used and Purposes

1. **“ออกแบบ first container ให้ต่อเนื่องกับ FastAPI Modular Monolith จาก Lab 05”** — ใช้กำหนด service boundary, entry point, port และ health endpoint
2. **“เขียน Dockerfile แบบ multi-stage ด้วย slim base, non-root user, EXPOSE และ HEALTHCHECK โดยไม่ใส่ secret”** — ใช้ร่าง container layers และ security controls
3. **“Challenge Dockerfile ว่า image อาจใหญ่หรือมีไฟล์/secret ใดหลุดเข้า build context”** — ใช้ปรับ `.dockerignore`, COPY scope และ runtime dependencies
4. **“อธิบาย Container vs VM ในบริบททีมหนึ่งภาคการศึกษา”** — ใช้ร่าง trade-off โดยเชื่อมกับ deployment speed, isolation และ operations cost

### AI-Assisted Content Accepted After Review

- FastAPI service และ tests ใน `services/api/`
- Root `Dockerfile` และ `.dockerignore`
- Build/run/security/trade-off documentation ใน `docker/README.md`
- Post-quiz 6 reflection draft ใน `reflect.md`
- Lab 06 implementation plan ใน `docs/superpowers/plans/2026-08-25-lab06-first-container.md`

### Human Decisions and Rejected Suggestions

- ผู้ใช้อนุมัติ FastAPI API เป็น first container เพื่อให้ตรงกับ Modular Monolith จาก Lab 05
- ผู้ใช้อนุมัติ branch `feat/first-container-synapsesync-Thakorn` และสั่งให้ commit/push หลังงานผ่านการตรวจ
- ทีมเลือก container หนึ่งชุดสำหรับ Backend และไม่ตีความว่า Container เท่ากับ Microservice
- ทีมใช้ pinned Python slim image และ non-root UID/GID 10001
- ไม่ใช้ `latest`, ไม่ copy repository ทั้งหมดด้วย `COPY . .` และไม่วาง `.env`/credential ใน image
- ไฟล์หรือโฟลเดอร์ที่มีชื่อ `Chaiwat` และ `shuwichada` ยังคงถูกสงวนไว้

### Verification Performed

- ตรวจ TDD RED เมื่อ `app.main` และ root route ยังไม่มี
- ตรวจ TDD GREEN ของ `/health` และ `/` ด้วย real ASGI requests โดยไม่ mock application
- ตรวจ Dockerfile แบบ static ว่ามี 2 stages, pinned slim base, non-root `USER`, `EXPOSE 8000`, `HEALTHCHECK`, scoped `COPY` และ Uvicorn command
- ตรวจ `.dockerignore` มีมากกว่า 5 รายการและครอบคลุม `.git`, `.env`, `node_modules`, tests และ IDE files
- ตรวจ FastAPI service ด้วย local Uvicorn HTTP request ใน final verification

### Verification Boundaries

- Environment ปัจจุบันไม่มี Docker CLI จึงยังไม่สามารถอ้างว่า Docker build/run ผ่านหรือบันทึก image size จริงได้
- Registry image ยังไม่ถูก push เพราะต้อง build/test image และ authenticate registry ก่อน
- Git branch สามารถ commit/push แยกจาก Docker registry image โดยต้องรายงานข้อจำกัดนี้อย่างชัดเจน
- `reflect.md` เป็น draft ที่ผู้ส่งต้องอ่านยืนยันด้วยตนเอง
