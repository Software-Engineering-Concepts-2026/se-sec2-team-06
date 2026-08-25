# AI Usage — Lab 01

## Tools used

- GitHub Copilot
- ChatGPT / Codex Generative AI assistant

AI ถูกใช้เป็นผู้ช่วยระหว่างการทำงาน ไม่ได้เป็นผู้ตัดสินใจหรือผู้เขียนประสบการณ์ส่วนตัวแทนผู้จัดทำ

## Prompts used

1. “ช่วยตรวจข้อกำหนด Lab 01 และสรุป deliverables ที่ต้องส่งให้ครบตาม rubric”
2. “ช่วยตรวจโครงสร้างไฟล์ `team/Thakorn.md` ว่าครบ 4 sections และอยู่ในช่วง 200–500 คำหรือไม่”
3. “ช่วยตรวจภาษาและรูปแบบ `AI_USAGE.md` โดยคงความหมายและเสียงการเขียนของผู้จัดทำไว้”

## Direct AI-generated content

งานส่วนใหญ่ใน submission นี้จัดทำและตัดสินใจโดย Thakorn โดยใช้ AI เป็นผู้ช่วยในด้านต่อไปนี้:

- ตรวจความเข้าใจโจทย์และ checklist ของ Lab 01
- เสนอแนวทางจัดลำดับหัวข้อและรูปแบบ Markdown
- ช่วยตรวจภาษา การสะกด และความสอดคล้องของเอกสาร
- ช่วยตรวจ branch, file path, commit message และขั้นตอน Pull Request

เนื้อหา Identification, Pragmatic Promise, เหตุผลที่อยากเรียน SE และ Broken Window เป็นข้อมูลของ Thakorn ซึ่งผู้จัดทำเป็นผู้เลือก ตรวจสอบ และรับผิดชอบก่อนส่งงาน AI ไม่ได้สร้างประสบการณ์ส่วนตัวหรือการตัดสินใจแทนผู้จัดทำ

## Lab 1 — First Pragmatic Commit Usage

### Tools and tasks

- อ่านและทำความเข้าใจใบงานด้วยตนเอง แล้วใช้ ChatGPT/Codex ช่วยตรวจว่ารายการส่งงานไม่ตกหล่น
- ใช้ข้อมูลทีมและข้อมูลส่วนตัวที่มีอยู่จริงมาเขียน `team/Thakorn.md`
- ใช้ AI ช่วยตรวจความครบถ้วนของ Identification, Pragmatic Promise, เหตุผลที่อยากเรียน SE และ Broken Window
- ใช้ AI ช่วยตรวจจำนวนคำและรูปแบบ headings หลังจากเขียนเนื้อหาหลักแล้ว
- ผู้จัดทำเป็นผู้เลือกว่าจะรับหรือแก้คำแนะนำของ AI ทุกจุด

### Team verification and responsibility

- Thakorn เป็นผู้รับผิดชอบเนื้อหาและตรวจสอบชื่อเล่น เหตุผลที่อยากเรียน Software Engineering และประสบการณ์ Broken Window ด้วยตนเอง
- Pragmatic Promise ต้องสะท้อนพฤติกรรมที่ Thakorn ตั้งใจทำจริง ไม่ใช่ข้อความที่ AI แต่งขึ้นเพื่อส่งแทน
- ทีมเป็นผู้ตรวจเนื้อหา ความถูกต้องของ README, branch, commit message, Pull Request และ reviewer ก่อน merge
- ไม่มีการนำเนื้อหาจากไฟล์หรือโฟลเดอร์ที่เป็นงานของ Chaiwat และ shuwichada มาใช้หรือแก้ไข
- ไม่ส่งรหัสผ่าน ข้อมูลบัญชี secret หรือข้อมูลส่วนบุคคลของสมาชิกคนอื่นเข้าไปใน prompt

### Verification status

- Branch งานปัจจุบัน: `se-sec2-team-06-lab02-proposal-Thakorn` โดยต่อยอดจาก worktree ที่เริ่มจาก `origin/main`
- `team/Thakorn.md` มี 4 sections และความยาวอยู่ในช่วง 200–500 คำ
- README มีคำอธิบายโปรเจกต์ รายชื่อสมาชิก และ Theme แล้ว
- ก่อนส่งงานยังต้อง commit ด้วย Conventional Commits, push branch, เปิด Pull Request, tag reviewer, ผ่าน review, merge เข้า `main` และย้าย Project Board ไป `Done`

## Lab 2 — Sprint Zero Usage

### Tools and tasks

- ใช้ ChatGPT/Codex ช่วยตรวจ checklist ของ Lab 02 และโครงสร้าง Project Proposal
- ใช้ AI ช่วยจัดหมวด Theme, Persona, Value Proposition, MoSCoW priorities และ Risks จากข้อมูลโครงการเดิม
- ใช้ AI ช่วยตรวจว่า Proposal มี 6 sections และมีลิงก์ไปยัง Definition of Done
- ใช้ AI ช่วยร่าง acceptance criteria และรูปแบบ Issue ได้ แต่การสร้าง Issue, label, milestone และการจัดลำดับ backlog ต้องให้ทีมตัดสินใจเอง

### Human review and decisions

- ทีมเป็นผู้ยืนยัน Theme `Tools for Modern Learners`, ชื่อ SynapseSync และ Persona หลักก่อน merge
- ทีมเป็นผู้ตัดสินใจ MoSCoW priorities, risks, assumptions, Definition of Done และ Sprint ที่จะนำ Issue ไปทำ
- เนื้อหาที่นำมาจาก workspace เดิมถูกอ่านและปรับให้ตรงกับ repository ปัจจุบันก่อนนำมาใช้
- ห้ามใช้ AI ตัดสินใจแทนทีม และห้ามสร้าง Issue หรือ Pull Request โดยที่สมาชิกทีมยังไม่ได้อ่านตรวจ

## Lab 3 — Requirements Documents Usage

### Tools and tasks

- ใช้ ChatGPT/Codex ช่วยตรวจ rubric ของ Lab 3 และแยก Main Scenario เดิมออกเป็น `scenarios.md` กับ `user-stories.md`
- ใช้ AI ช่วยตรวจว่า Persona แต่ละคนมี Personalization, Job, Education, Relevance และ Frequency of use ครบ
- ใช้ AI ช่วยปรับ narrative scenarios ให้ครอบคลุม happy path และ edge cases โดยยึดบริบท SynapseSync จากเอกสารเดิม
- ใช้ AI ช่วยจัดรูปแบบ User Stories เป็น As a / I want / So that และตรวจ Acceptance Criteria แบบ Given/When/Then
- ใช้ AI ช่วยตรวจ NFR ให้มี metric และวิธีทดสอบ เช่น p95 response time, timeout, uptime, concurrent users และ usability success rate

### Human review and decisions

- ทีมเป็นผู้ยืนยัน Persona หลัก 3 คน ขอบเขต MVP และความสอดคล้องกับ Project Proposal ของ Lab 2
- Priority (MoSCoW), Estimate (S/M/L), quality bar และการเลือก User Stories ที่จะนำเข้า Sprint เป็น product decisions ของทีม ไม่ใช่การตัดสินใจของ AI
- เนื้อหาใน `se-sec2-team-06-lab03` ถูกดึงจาก Requirements เดิมแล้วปรับโครงสร้างและลิงก์ให้ตรงกับ repository ปัจจุบัน
- ทีมต้องอ่าน ตรวจ และแก้เอกสารก่อนสร้าง GitHub Issues หรือเปิด Pull Request ของ Lab 3
- ไม่ส่งรหัสนิสิต ข้อมูลบัญชี secret หรือข้อมูลส่วนบุคคลจริงของผู้ใช้เข้าไปใน prompt

---

## Lab 4 — Rapid Prototyping with AI

### Tools used

- VS Code และ browser สำหรับเขียน/ตรวจ prototype ด้วยตนเอง
- OpenAI Codex / ChatGPT ใช้เป็น co-pilot เพื่ออ่าน rubric, เสนอแนวทาง UI, ช่วยตรวจ selector และช่วยไล่ปัญหา JavaScript
- Node.js built-in test runner และ Playwright/Chrome สำหรับตรวจ flow จริงใน browser

### Prompts used and purposes

1. “ช่วยอ่านเกณฑ์ Lab 4 แล้วสรุปไฟล์ที่ต้องมี พร้อมแยก Tracer Bullet กับ Prototype ให้ชัดเจน”
2. “ช่วยเสนอ design tokens และ layout ที่ทำให้ Register, Home, Quiz, Document Library และ Deadline Planner ใช้ theme เดียวกัน โดยไม่ใช้ framework”
3. “ช่วยตรวจ interactive flow ของฟอร์มกำหนดส่งงาน: เพิ่มรายการ, ทำเครื่องหมายเสร็จ, filter และ weekly planner โดยข้อมูลต้องอยู่ใน memory เท่านั้น”
4. “ช่วยตรวจ test failure จาก Navbar และ browser flow แล้วอธิบายสาเหตุโดยไม่แก้ requirement แทนทีม”
5. “ช่วยปรับ visual direction ของ Thakorn และ Chaiwat ให้ใช้สีและ Navbar เหมือน Home แต่ยังคง layout และ flow ที่ทดสอบไว้”

### AI-assisted content accepted after review

- โครงร่าง shared Navbar, design tokens และ responsive CSS ที่นำมาปรับให้เข้ากับ SynapseSync
- แนวทางจัดโครงสร้าง HTML ของ Thakorn, Chaiwat และ shuwichada
- การ mapping Home palette (`#F3F3F0`, `#B9B9FF`, `#7DD8DA`, `#5959D6`) ถูกใช้เป็น starting point เท่านั้น ผู้จัดทำเป็นผู้เลือกสี layout และรายละเอียด visual เอง
- ข้อเสนอแนะเรื่อง in-memory state, query-string metadata handoff และ browser test cases
- ร่าง wording ใน `prototypes/sprint1/README.md`, `webtest/readme.md` และส่วน Lab 4 ของเอกสารนี้

### Human review and decisions

- ผู้จัดทำเป็นผู้เลือก User Story หลัก `US-03`, ตัดสินใจใช้ Prototype แทน Tracer Bullet และกำหนดขอบเขตว่าไม่มี backend/AI service จริง
- ผู้จัดทำเป็นผู้ตรวจ แก้ และทดสอบ HTML/CSS/JavaScript ก่อนรับคำแนะนำจาก AI เข้า repository โดยต้องเขียน/ปรับ code เองอย่างน้อย 50% ตาม rubric
- คำขอล่าสุดอนุญาตให้ปรับเฉพาะ prototype ใน `prototypes/sprint1/Chaiwat/` และ `prototypes/sprint1/shuwichada/` เพื่อให้เข้าธีมทีมเดียวกัน ไม่ได้เปลี่ยนเอกสารทีมของสมาชิก
- ไม่มีการใส่รหัสนิสิต ข้อมูลบัญชี ไฟล์ส่วนตัว หรือ secret ใน prompt

### Verification status

- Branch: `feature/lab4-prototype-synapsesync`
- ตรวจ shared Navbar ทั้ง 7 route/page ใน desktop/mobile viewport
- ตรวจ visual system ใหม่ของ Thakorn, Chaiwat Library และ Chaiwat Viewer ว่าใช้ token ชุดเดียวกันและไม่มี horizontal overflow
- ตรวจ Quiz flow ตั้งแต่ upload simulation ถึงผลคะแนน
- ตรวจ Library upload/filter/viewer handoff โดยไม่ใช้ browser storage
- ตรวจ Deadline Planner เพิ่มงาน/ทำเสร็จ/filter/planner
- ตรวจ JavaScript syntax และ browser tests ก่อนสรุปผล

### Prototype boundaries

- ข้อมูลทั้งหมดเป็น mock หรือ in-memory state และจะหายเมื่อ refresh
- ไม่มีการสร้างบัญชีจริง ไม่มีการอ่านเนื้อหาไฟล์จริง ไม่มีการส่งข้อมูลไป server และไม่มีการแจ้งเตือนจริง
- ผลการทดสอบนี้ยืนยัน technical flow เท่านั้น ยังไม่ใช่ผล usability test กับ Persona จริง

---

## Lab 5 — Architectural Artifacts Usage

### Tools and tasks

- ผมอ่านใบงาน Lab 5 และ chapter note ก่อน แล้วใช้ ChatGPT/Codex เป็นผู้ช่วยจัด checklist ของ C4 Level 1, C4 Level 2, Technology Stack และ ADR
- ใช้ AI ช่วยเปรียบเทียบ Modular Monolith, layered monolith และการแยก service โดยยึดขนาดทีม, เวลาในหนึ่งภาคการศึกษา, จำนวนผู้ใช้เริ่มต้น และ NFR ของ SynapseSync
- ใช้ AI ช่วยจัดโครงสร้างคำอธิบายและตรวจความสอดคล้องระหว่าง `c4-context.md`, `c4-container.md`, `tech_stack.md`, ADR และ diagram source
- ใช้ AI ช่วยร่าง wording ของ trade-offs, alternatives, review triggers และคำตอบสำหรับ `Request_ARCH.md`
- ใช้ Mermaid CLI ช่วย render diagram เพื่อตรวจ syntax และดูว่าชื่อ actor, container และ protocol อ่านได้จริง

### Example prompts

1. “ช่วยตรวจว่า C4 Level 1 แสดงผู้ใช้ ระบบหลัก และ external system โดยไม่ลงรายละเอียด container เกินขอบเขตหรือไม่”
2. “ช่วยเปรียบเทียบ Modular Monolith กับ Microservices สำหรับทีมเล็กที่มี MVP หนึ่งภาคการศึกษา โดยให้ระบุ NFR, operational cost และเงื่อนไขที่ควรทบทวน ADR”
3. “ช่วยตรวจว่า C4 Level 2 มี internal containers 3–4 ตัว เทคโนโลยีและ protocol ตรงกับ technology stack หรือไม่”
4. “ช่วยตรวจ ADR ให้มี Status, Context, Decision, Consequences และ Alternatives Considered ครบ โดยไม่อ้างว่า AI เป็นผู้ตัดสินใจแทนทีม”

### AI-assisted content accepted after review

- โครงร่างตาราง technology stack, C4 element descriptions, requirement traceability และ ADR headings
- ข้อเสนอแนะเรื่องการแยก module ภายใน FastAPI ได้แก่ Authentication, Learning Assistant, Practice/Quiz, Progress และ Document Context
- ร่างคำอธิบาย trade-off ของ PostgreSQL, S3-compatible Object Storage, REST/OpenAPI และ provider adapter
- ร่างคำตอบใน `docs/architecture/Request_ARCH.md` และ reflection ของ Lab 5

### Human review and decisions

- ผมเป็นผู้ตัดสินใจเลือก **Modular Monolith** สำหรับ MVP และกำหนดว่า backend deploy เป็นหน่วยเดียว แต่แบ่ง capability modules ด้วย in-process interfaces
- ทีมเป็นผู้ยืนยันจำนวน internal containers, technology labels, NFR priorities, scope ของ LMS/Notification และเงื่อนไขที่จะทบทวน decision ในอนาคต
- ผมตรวจและแก้ทุกไฟล์ให้ตรงกับ requirements/prototype ที่มีจริง แยก target architecture ออกจาก current prototype และตรวจว่าเอกสารเก่าที่ขัดแย้งกันไม่มีข้อความ Microservices เป็น baseline
- AI ไม่ได้สร้าง credential, secret, hostname, account identifier หรือข้อมูลส่วนบุคคล และไม่มีการส่งข้อมูลลับเข้า prompt

### Verification status

- สร้าง canonical artifacts: `docs/architecture/c4-context.md`, `c4-container.md`, `tech_stack.md` และ ADR-0001/0002
- ปรับ `README.md`, `Request_ARCH.md`, `uml_models.md`, Mermaid/draw.io sources และ legacy ADR pointers ให้ชี้ไปยังชุด canonical เดียวกัน
- Render Mermaid C4 diagrams สำเร็จเป็น PNG และตรวจจำนวน internal containers/ชื่อ technology กับตาราง stack
- เตรียม handoff folders แยก C4 และ ADR สำหรับสมาชิก โดยไม่มี `.git` หรือไฟล์งานอื่นปะปน
- การ review/merge/push เป็นขั้นตอนของทีมหลังตรวจ diff และหลักฐานครบ ไม่ใช่การตัดสินใจโดย AI

---

## Lab 6 — First Container Usage

### Tools and tasks

- ผมอ่าน chapter 6 และ rubric Lab 6 ก่อน แล้วใช้ ChatGPT/Codex เป็นผู้ช่วยแตก deliverables เป็น Dockerfile, `.dockerignore`, API health contract, Docker guide, registry note และ reflection
- ใช้ Python virtual environment, pytest และ httpx ตรวจ contract ของ FastAPI ก่อนเขียน application code ตามแนวทาง test-first
- ใช้ AI ช่วยเสนอ skeleton ของ multi-stage Dockerfile, การจัด dependency layer, non-root user, `EXPOSE` และ `HEALTHCHECK`
- ใช้ AI ช่วยตรวจ wording ของ Container เทียบกับ Virtual Machine ตาม ESP §5.4 และตรวจว่า container แรกไม่ถูกอธิบายเกินจริงว่าเป็น Microservices

### Example prompts

1. “ช่วยออกแบบ health contract ขั้นต่ำสำหรับ FastAPI Modular Monolith ที่จะใช้เป็น container แรก โดยกำหนด response ของ `/` และ `/health` ให้ตรวจสอบได้”
2. “ช่วยร่าง multi-stage Dockerfile สำหรับ Python 3.12 slim ที่ pin version, ใช้ non-root user, เปิด port 8000 และมี healthcheck โดยไม่ copy dev dependencies”
3. “ช่วยตรวจ `.dockerignore` ว่าตัด `.env`, `node_modules`, Git metadata, IDE files, tests และ cache แต่ยังคง requirements กับ application source ที่จำเป็นไว้”
4. “ช่วยอธิบายความต่างระหว่าง image, container, registry และ Virtual Machine ตาม ESP §5.4 พร้อม trade-off ของการใช้ slim image กับ Alpine”

### AI-assisted content accepted after review

- โครงร่าง `services/api/` และตัวอย่าง test สำหรับ `/` กับ `/health` ซึ่งผมปรับชื่อ field และ response ให้ตรงกับ architecture contract ของทีม
- โครงสร้าง root `Dockerfile` แบบ builder/runtime, `.dockerignore` และคำสั่ง build/run ใน `docker/README.md`
- ร่างตาราง Container vs VM, security checklist, registry tag และ Post-quiz 6 ซึ่งผมแก้ภาษาและขอบเขตให้ตรงกับเครื่องมือที่ตรวจได้จริง

### Human review and decisions

- ผมเป็นผู้ตัดสินใจใช้ FastAPI Modular Monolith เป็น container แรก ไม่แยก Microservices และไม่เพิ่ม database/LLM integration ใน Lab 6
- ผมเลือก Python slim ที่ pin version, production/dev requirements แยกกัน, non-root `appuser`, port `8000` และ `/health` เป็น operational contract
- ผมเขียนและปรับ code, tests และเอกสารให้เข้ากับ repository เอง ตรวจ diff และตรวจว่าการแก้ไม่ปะปนกับไฟล์ Lab 2 หรือไฟล์ของสมาชิก
- ไม่มีการส่ง credential, secret, token, hostname จริง หรือข้อมูลส่วนบุคคลเข้า prompt และไม่มีการอ้างว่า image build สำเร็จใน environment ที่ไม่มี Docker CLI

### Verification status

- Contract tests ของ `/` และ `/health` ผ่านด้วย `pytest` จำนวน 2 tests และ ASGI smoke check ได้ HTTP 200 พร้อม `status=healthy`
- ตรวจ static Dockerfile/.dockerignore และ `git diff --check` ในเครื่องพัฒนาแล้ว
- หลังติดตั้ง Docker Desktop แล้ว `docker build -t synapsesync-api:v0.1.0 .` สำเร็จ และ image มีขนาด `52,513,980` bytes (ประมาณ 50.1 MiB) ต่ำกว่าเป้าหมาย 500 MB
- ทดสอบ `docker run` และ `GET /health` ได้ HTTP 200 พร้อม `status=healthy`; `docker inspect` ยืนยัน runtime user เป็น `appuser:appgroup` และ health status เป็น `healthy`
- ยังไม่ได้ push image ไป registry เพราะยังไม่มีการยืนยัน namespace/credentials; คำสั่งและหลักฐานที่ต้องแนบใน PR ระบุไว้ใน `docker/README.md`
