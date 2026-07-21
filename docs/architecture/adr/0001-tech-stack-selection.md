# ADR-001: การเลือก Core Technology Stack ของโปรเจกต์ SynapseSync

**สถานะ (Status):** Accepted

**วันที่:** 2026-07-18

**ผู้มีส่วนร่วมตัดสินใจ (Deciders):** ทีมพัฒนา SynapseSync

---

## บริบท (Context)

โปรเจกต์ **SynapseSync** เป็นเว็บแอปพลิเคชันแบบ All-in-One Learning Platform สำหรับนักศึกษา ที่ผสมผสานฟังก์ชันหลายอย่างไว้ในที่เดียว ได้แก่ การสร้างและจัดการโน้ตการเรียน การอัปโหลดเอกสาร PDF/DOCX ระบบ AI Quiz Generator ที่สร้างคำถามฝึกหัดจากเนื้อหาที่อัปโหลด และระบบ To-do List สำหรับติดตามงานการเรียน

### สิ่งที่ทีมมีอยู่แล้วในปัจจุบัน

ก่อนตัดสินใจเลือก Tech Stack ทีมได้เริ่มต้นสร้าง prototype และโครงสร้าง repository เบื้องต้นไว้แล้ว ดังนี้:

- **Frontend Prototype:** เป็น HTML/CSS/JavaScript แยกไฟล์แบบดั้งเดิม (`login.html`, `home.html`, `register.html`, ฯลฯ) พบปัญหาโค้ดซ้ำซ้อนในส่วนของ header, footer, โครงสร้างหน้า และ style ที่ต้อง copy ไปทุกหน้า
- **Backend ที่มีอยู่บางส่วน:** มีโฟลเดอร์ `services/stats-service/` ที่ประกอบด้วย `app.py`, `Dockerfile`, `requirements.txt` ซึ่งแสดงว่าทีมมีการใช้ Python อยู่แล้วในบางส่วนของระบบ และมีการเตรียม Docker workflow ไว้แล้ว
- **โครงสร้างทีม:** เป็นทีมนักศึกษาที่ต้องแบ่งงานกันทำแบบคู่ขนานระหว่างฝั่ง Frontend และ Backend จึงต้องการ API Contract ที่ชัดเจนเพื่อให้ทั้งสองฝั่งทำงานพร้อมกันได้โดยไม่บล็อกกัน
- **ความคุ้นเคยเครื่องมือ:** ทีมส่วนใหญ่คุ้นเคยกับการใช้ GitHub Copilot และ ChatGPT ในการช่วยเขียนโค้ด

### ข้อจำกัดหลักของโปรเจกต์

- **Timeline:** ภาคเรียนเดียว (ประมาณ 14 สัปดาห์) ต้องการ rapid prototyping และ iterate บ่อย
- **งบประมาณ:** เป็นโปรเจกต์วิชาเรียน ไม่มีงบ ต้องพึ่ง free tier ของบริการต่างๆ
- **ฟีเจอร์ที่เน้น AI:** ต้องเรียก LLM API (เช่น OpenAI หรือ Claude) เพื่อสร้างคำถามและสรุปเนื้อหา รวมถึงการ parse ไฟล์ PDF/DOCX
- **ความต้องการด้าน Course Metadata:** ทีมต้องการให้เอกสารที่ผู้ใช้อัปโหลด ถูก auto-tag ด้วยชื่อวิชา/รายวิชาที่เกี่ยวข้องโดยอัตโนมัติ เพื่อให้ระบบ AI Quiz Generator แนะนำเนื้อหาได้ตรงบริบทมากขึ้น และลดภาระผู้ใช้ที่ต้องกรอกข้อมูลวิชาเอง จึงต้องพึ่งพา course catalog และข้อมูลการลงทะเบียนจากระบบ LMS ของมหาวิทยาลัย (เช่น Moodle) ซึ่งเป็นระบบที่มีอยู่แล้วและนักศึกษาทุกคนมีบัญชีอยู่แล้ว
- **ความต้องการด้านการสื่อสาร API:** ต้องมีเอกสาร API ที่อัปเดตอัตโนมัติ เพื่อให้ทีม Frontend และ Backend คุยกันผ่าน contract ได้ชัดเจน
- **ผู้ใช้มีหลาย Role ที่ต้องการเห็นข้อมูลต่างกัน:** จาก Persona ที่ทีมทำไว้ (`student_learner.md`, `teacher_mentor.md`) และ user story ใน `main_scenario.md` ระบบต้องรองรับผู้ใช้ 4 กลุ่ม ได้แก่ **นักเรียน** (ปันปัน — ถามคำถาม/ฝึกโจทย์), **ครู** (ครูสมชาย — ดูแดชบอร์ดภาพรวมนักเรียนหลายคน), **ผู้เรียนผู้ใหญ่** (พี่เอิร์ธ — ทบทวนเนื้อหา/ดูความคืบหน้าของตัวเอง), และ **ผู้ปกครอง** (คุณแม่มล — ดูสรุปและรับแจ้งเตือนของบุตรหลาน) แต่ละ Role เห็นข้อมูลและสิทธิ์การใช้งานต่างกัน จึงต้องมีระบบ Role-based Access Control (RBAC) ไม่ใช่แค่ authentication ธรรมดา *(หมายเหตุ: Persona พี่เอิร์ธและคุณแม่มล ยังไม่มีไฟล์ Persona ฉบับเต็ม อ้างอิงจาก user story 7-10 ใน `main_scenario.md` เท่านั้น)*
- **ความต้องการด้าน Notification:** จาก user story ของพี่เอิร์ธ (แจ้งเตือนให้กลับมาทบทวน) และคุณแม่มล (แจ้งเตือนล่วงหน้าหากบุตรหลานเริ่มมีปัญหาต่อเนื่อง) ระบบต้องส่งการแจ้งเตือนออกไปนอกแอปได้ (email หรือ push notification) ไม่ใช่แค่แสดงผลใน UI เมื่อผู้ใช้เปิดแอปเท่านั้น

ทีมได้ประเมินมิติหลัก 4 ด้าน ได้แก่ Frontend framework, Backend language/framework, Database และ Deployment platform โดยเทียบกับเกณฑ์ที่ชัดเจน ได้แก่ ความคุ้นเคยของทีม, ความเหมาะสมของ ecosystem กับฟีเจอร์ของระบบ, ต้นทุนระหว่างพัฒนา และความเรียบง่ายในการดูแลระบบ

---

## การตัดสินใจ (Decision)

ทีมตัดสินใจเลือก Core Technology Stack สำหรับ SynapseSync ดังนี้:

| Layer | เทคโนโลยีที่เลือก |
|---|---|
| **Frontend** | React 18 + Vite (Single-Page Application) |
| **Backend** | Python 3.11 + FastAPI (ค่าเริ่มต้น) — หรือ Flask หากทีมตัดสินใจว่าต้องการความเรียบง่ายกว่า |
| **Database** | PostgreSQL 15 (managed, เช่น Supabase หรือ Neon free tier) |
| **File Storage** | S3-compatible object storage (เช่น Cloudflare R2 หรือ AWS S3 free tier) |
| **AI Service** | OpenAI GPT-4o-mini (หรือ Anthropic Claude Haiku) ผ่าน official Python SDK |
| **Course Metadata Integration** | University LMS API (Moodle REST API) เรียกจาก Backend เพื่อดึง course catalog และการลงทะเบียน |
| **Access Control** | Role-based Access Control (RBAC) ใน Backend ด้วย JWT ที่มี role claim (`student` / `teacher` / `parent`) |
| **Notification** | Notification Service ภายนอก (เช่น Resend สำหรับ email, Firebase Cloud Messaging สำหรับ push) เรียกจาก Backend |
| **Deployment** | Vercel (Frontend) + Render หรือ Railway (Backend) — รองรับ Docker ที่ทีมมีอยู่แล้ว |

---

### Frontend: React + Vite

ทีมเลือก React กับ Vite มาแทน HTML/CSS/JS แบบแยกไฟล์ที่ใช้อยู่ใน prototype ด้วยเหตุผลหลัก 4 ข้อ:

**1. ลดโค้ดซ้ำซ้อนด้วย Component Model**
prototype ปัจจุบันมี `login.html`, `home.html`, `register.html` แยกกันหลายไฟล์ ทำให้ส่วนของ header, footer, โครงสร้าง form, และ style ต้อง copy ไปทุกหน้า — เมื่อต้องแก้ header ก็ต้องแก้ในทุกไฟล์ React ช่วยแตกส่วนเหล่านี้เป็น Component ที่ใช้ซ้ำได้ เช่น `<Button />`, `<Card />`, `<FormInput />`, `<Layout />` แก้ครั้งเดียวสะท้อนไปทุกหน้า ลดโค้ดซ้ำได้มากกว่า 60%

**2. การจัดการ Routing ที่สะอาดกว่า**
ระบบมีหลายหน้าที่ต้องเปลี่ยนสถานะไปมา (Login → Home → Quiz → Result → To-do) การใช้ React Router จัดการ routing ผ่าน URL ได้สะอาดกว่าการ hidden/show section ด้วย JavaScript ธรรมดา ทั้งยังรองรับ browser back/forward button และ deep linking ที่ผู้ใช้คาดหวัง

**3. Ecosystem ใหญ่ หา Library ง่าย**
SynapseSync ต้องการ UI หลากหลายรูปแบบ ทั้ง AI Chat interface, กราฟแสดงคะแนน quiz และสถิติการเรียน React ecosystem มี library พร้อมใช้ เช่น Recharts หรือ Chart.js สำหรับกราฟ, `react-markdown` สำหรับแสดงเนื้อหา, และ `@chatscope/chat-ui-kit-react` สำหรับ chat interface ทำให้ไม่ต้องเขียนทุกอย่างจากศูนย์

**4. รองรับการใช้ AI Coding Assistant ได้ดี**
ทีมส่วนใหญ่คุ้นเคยกับการใช้ GitHub Copilot และ ChatGPT ช่วยเขียนโค้ด React เป็น framework ที่มีข้อมูล training ใน LLM เยอะมาก ทำให้ AI ช่วยเขียน component, hook และแก้บั๊กได้แม่นยำกว่า framework ที่ใหม่กว่าหรือ niche กว่า

---

### Backend: Python + FastAPI (ค่าเริ่มต้น) / Flask (ทางเลือก)

ทีมเลือก Python เป็นภาษาหลักของ Backend ด้วยเหตุผลหลัก 2 ข้อ และเลือก FastAPI เป็น framework เริ่มต้นโดยมี Flask เป็นทางเลือกสำรอง

**เหตุผลที่เลือก Python (เหมือนกับ stats-service ที่มีอยู่แล้ว):**

1. **สอดคล้องกับ Stack ที่ทีมมีอยู่แล้ว** — ทีมมี `services/stats-service/app.py` อยู่แล้ว การเลือก Python ต่อทำให้ทั้งระบบใช้ภาษาเดียวกัน ไม่ต้องมีทั้ง Node.js และ Python พร้อมกันโดยไม่จำเป็น ลดภาระการเรียนรู้และ context switching ของทีม

2. **รองรับฟีเจอร์ AI และ Document Processing ได้ดีกว่า** — ฟีเจอร์หลักของ SynapseSync คือ "AI สร้างคำถามจากเนื้อหา" ที่ต้องเรียก LLM API และ parse ไฟล์ PDF/DOCX Python มี library สายนี้ครบและใช้ง่ายกว่ามาก เช่น `PyPDF2` และ `pdfplumber` สำหรับ PDF, `python-docx` สำหรับ Word, `langchain` สำหรับ prompt chaining และ RAG ในอนาคต รวมถึง `openai` SDK ที่เป็น Python-first

**เหตุผลที่เลือก FastAPI เป็นค่าเริ่มต้น:**

1. **Auto-generate API Docs (Swagger UI)** — FastAPI สร้าง interactive API documentation ที่ `/docs` อัตโนมัติ ทีม Frontend สามารถเข้าไปดู endpoint, request/response schema และทดสอบเรียก API ได้ทันทีโดยไม่ต้องเขียนเอกสารแยก ลดช่องว่างการสื่อสารระหว่างฝั่งที่ทำงานคู่ขนานกัน

2. **Pydantic Validation สร้าง API Contract ที่ชัดเจน** — การ define request/response ผ่าน Pydantic model ทำให้ทั้งสองฝั่งคุยกันผ่าน contract ที่ตรวจสอบได้ หาก Backend เปลี่ยน field ใด Frontend จะเห็นใน Swagger ทันที ลดปัญหา "ส่งข้อมูลไม่ตรง schema แล้วแอปพังตอน runtime"

3. **Type hints ทำให้ AI Coding Assistant ช่วยได้ดีกว่า** — FastAPI ใช้ type hints เป็นพื้นฐาน Copilot และ ChatGPT สามารถ suggest โค้ดและตรวจจับบั๊กได้แม่นยำกว่า Flask แบบไร้ type

**ทางเลือกสำรอง: Flask (หากทีมยังไม่คุ้น async/FastAPI):**

หากทีมประเมินแล้วว่า curve การเรียนรู้ async/await และ Pydantic ของ FastAPI จะกระทบ timeline มากเกินไป สามารถเลือก Flask แทนได้ โดยได้ข้อดีคือเขียนง่าย เรียนรู้เร็ว เหมาะกับ MVP ระยะสั้นแบบโปรเจกต์วิชาเรียน แต่ต้องแลกกับการเขียน API docs เองด้วย Flask-RESTX หรือ `flask-smorest` และไม่มี validation อัตโนมัติ

ทีมจะตัดสินใจขั้นสุดท้ายระหว่าง FastAPI กับ Flask หลังจากสร้าง POC endpoint แรก (เช่น `/api/health` และ `/api/quiz/generate`) ในสัปดาห์ที่ 6

---

### Database: PostgreSQL

ทีมเลือก PostgreSQL เป็น primary database ด้วยเหตุผลหลัก 3 ข้อ:

**1. ข้อมูลมีความสัมพันธ์ชัดเจน (Relational by nature)**
โครงสร้างข้อมูลของ SynapseSync เป็น relational อย่างชัดเจน:

```
User (1) ──< Quiz (N)
Quiz (1) ──< Question (N)
Question (1) ──< Choice (N)
User (1) ──< QuizAttempt (N)
QuizAttempt (1) ──< Answer (N)
User (1) ──< Note (N)
Note (1) ──< Todo (N)
```

ความสัมพันธ์แบบ one-to-many หลายชั้นนี้เหมาะกับ relational database มากกว่า NoSQL เพราะสามารถใช้ foreign key, JOIN, และ transaction เพื่อ maintain data integrity ได้โดยธรรมชาติ การดึงข้อมูลแบบ "คะแนน quiz ของ user คนนี้ใน course นี้" ทำได้ด้วย SQL query เดียว ในขณะที่ NoSQL ต้องทำ multiple queries หรือ aggregation pipeline

**2. รองรับ Docker workflow ที่ทีมมีอยู่แล้ว**
ทีมมี `Dockerfile` ใน `services/stats-service/` อยู่แล้ว การเพิ่ม PostgreSQL เข้าไปใน `docker-compose.yml` เป็น service เดียวกับ backend ทำได้ทันที โดยใช้ image `postgres:15-alpine` ทำให้ developer ใหม่ในทีมสามารถ `docker compose up` แล้วได้ environment ครบในคำสั่งเดียว

**3. รองรับ JSONB สำหรับข้อมูลกึ่งโครงสร้าง**
แม้ข้อมูลหลักจะเป็น relational แต่บางส่วนของระบบมีลักษณะกึ่งโครงสร้าง เช่น:
- เนื้อหาที่ extract จากไฟล์ที่อัปโหลด (PDF text ที่มี layout หลากหลาย)
- Options ของคำถามที่ AI generate มา (บางข้อเป็น multiple choice, บางข้อเป็น true/false, บางข้อเป็น short answer)
- Metadata ของ LLM response (token usage, model version, prompt history)

PostgreSQL รองรับ `JSONB` column type ทำให้เก็บข้อมูลเหล่านี้แบบยืดหยุ่นได้โดยไม่ต้องเปลี่ยน DB ทั้งระบบ และยัง query ด้วย `->` และ `->>` operator ได้

**4. Deploy ฟรีได้ง่าย**
สำหรับโปรเจกต์วิชาเรียนที่ไม่มีงบ PostgreSQL สามารถ deploy ฟรีได้หลายทาง:
- **Supabase** — 500 MB storage, ฟรีตลอด, มี dashboard และ REST API ให้
- **Neon** — มี branching feature ที่ช่วยสร้าง database copy สำหรับ testing
- **Railway** — ให้ $5 credit ต่อเดือน พอสำหรับ dev workload

---

### ทางเลือกเสริมด้าน Database: MongoDB (Hybrid)

หากในอนาคตข้อมูลบางประเภท เช่น "เนื้อหาไฟล์ที่อัปโหลด" หรือ "log การสนทนากับ AI" มีปริมาณมากและไม่ต้อง query แบบซับซ้อน ทีมอาจพิจารณาใช้ MongoDB เป็น secondary database เฉพาะส่วน (Hybrid architecture) อย่างไรก็ตาม สำหรับโปรเจกต์ระดับนี้ PostgreSQL เดียวพอเพียงและจัดการง่ายกว่า ไม่ต้อง maintain 2 database พร้อมกัน การเลือก hybrid ควรทำเมื่อมี data จริงที่ทดสอบแล้วว่า PostgreSQL ไม่ตอบโจทย์

---

### File Storage: S3-compatible Object Storage

ไฟล์ PDF และ DOCX ที่ผู้ใช้อัปโหลดเป็น binary blob ที่ไม่ควรเก็บใน relational database เพราะจะทำให้ database บวมและ backup ช้า ทีมเลือก S3-compatible object storage เพราะ:

- เป็น de facto standard ของวงการ
- มี free tier ให้เลือกหลายค่าย (Cloudflare R2 ให้ 10 GB ฟรี + ไม่คิด egress fee; AWS S3 มี free tier 12 เดือน)
- ใช้งานผ่าน `boto3` library ของ Python ได้โดยตรง
- ใช้ S3 API มาตรฐาน ทำให้ switch provider ได้โดยไม่ต้องแก้ application code

---

### AI Service: OpenAI GPT-4o-mini (หรือ Claude Haiku)

ทีมเลือกใช้ LLM ผ่าน API แบบ hosted แทนการ self-host เพราะ:
- คุณภาพของ model สูงกว่าที่ทีมสามารถ self-host ได้ใน timeline นี้
- มี Python SDK ที่ใช้ง่าย
- มี pricing แบบ pay-per-token ที่คุม cost ได้สำหรับ dev/demo workload

ทีมจะใช้ GPT-4o-mini เป็นค่าเริ่มต้นเพราะราคาถูกและเร็วพอสำหรับการสร้างคำถาม หากพบว่าคุณภาพคำถามไม่เพียงพอ จะทดลอง Claude Haiku ซึ่งมีราคาใกล้เคียงและมีเอกภาพในการเขียนคำถามที่ดีกว่าในบางกรณี

---

### Course Metadata Integration: University LMS API (Moodle)

ทีมเลือกเชื่อมต่อกับ LMS ของมหาวิทยาลัย (Moodle REST API) เพื่อดึงข้อมูล course catalog และการลงทะเบียนของนักศึกษา ด้วยเหตุผลหลัก 3 ข้อ:

1. **ลดภาระผู้ใช้ในการกรอกข้อมูลเอง** — หากไม่เชื่อมกับ LMS ผู้ใช้ต้องพิมพ์ชื่อวิชา/รหัสวิชาเองทุกครั้งที่อัปโหลดเอกสาร ซึ่งเสี่ยงพิมพ์ผิดหรือไม่สม่ำเสมอ การดึงข้อมูลจาก LMS ทำให้ auto-tag เอกสารด้วย course metadata ที่ถูกต้องได้ทันที

2. **เพิ่มความแม่นยำของฟีเจอร์ AI Quiz Generator** — เมื่อระบบรู้ว่าเอกสารที่อัปโหลดอยู่ในวิชาใด สามารถใช้ context นั้นช่วยปรับ prompt ที่ส่งให้ LLM ให้สร้างคำถามที่ตรงกับเนื้อหาวิชานั้นมากขึ้น รวมถึงจัดกลุ่มคำถาม/quiz ตามรายวิชาให้ผู้ใช้ดูภาพรวมการเรียนแต่ละวิชาได้

3. **Moodle เป็นระบบที่มหาวิทยาลัยส่วนใหญ่ใช้อยู่แล้วและมี REST API มาตรฐาน** — นักศึกษาทุกคนมีบัญชีอยู่แล้ว ไม่ต้องสร้างระบบลงทะเบียนวิชาขึ้นมาใหม่ และ Moodle มี Web Service API ที่เป็นมาตรฐานเปิด ทำให้เชื่อมต่อได้โดยไม่ต้องพึ่งพา LMS เจ้าใดเจ้าหนึ่งแบบผูกติด (vendor lock-in น้อยกว่าการเขียนเฉพาะสำหรับ LMS ยี่ห้อเดียว หากใช้ Moodle REST API มาตรฐาน)

**ขอบเขตของการเชื่อมต่อ (Scope) ในเฟสนี้:** ทีมจะเรียก LMS API แบบ **Read-only** เท่านั้น (ดึง course catalog และรายวิชาที่ลงทะเบียน) ยังไม่มีการเขียนข้อมูลกลับไปที่ LMS เพื่อลดความเสี่ยงด้าน permission และความซับซ้อนของการขอสิทธิ์เข้าถึงจากฝ่าย IT มหาวิทยาลัย

---

### Access Control: Role-based Access Control (RBAC) ด้วย JWT

เนื่องจากระบบมีผู้ใช้ 4 กลุ่มที่เห็นข้อมูลต่างกัน (นักเรียน, ครู, ผู้เรียนผู้ใหญ่, ผู้ปกครอง) ทีมเลือกทำ RBAC แบบง่ายที่ระดับ Backend แทนการแยก Service ตาม Role ด้วยเหตุผล:

1. **ความซับซ้อนเหมาะสมกับ scope ของโปรเจกต์วิชาเรียน** — การแยก Microservice ตาม Role จะเพิ่ม operational overhead เกินความจำเป็นสำหรับทีมนักศึกษาที่มี timeline จำกัด การฝัง role claim ไว้ใน JWT (`student` / `teacher` / `parent`) แล้วเช็กสิทธิ์ที่ endpoint level ผ่าน FastAPI dependency ทำได้เร็วกว่าและยังคง testable
2. **Backend เดียวรองรับ Web Application เดียว** — ทั้ง 4 Persona ใช้ Web Application (React SPA) ตัวเดียวกัน แต่ UI จะ render ต่างกันตาม role ที่ decode ได้จาก JWT ฝั่ง Frontend (เช่น ครูเห็นแดชบอร์ด, ผู้ปกครองเห็นหน้าสรุป) โดยไม่ต้องแยก deploy target
3. **ต้องมี Parent-Child Account Linking** — กรณีของคุณแม่มลต้องผูกบัญชีผู้ปกครองกับบัญชีนักเรียน (บุตรหลาน) ทีมจะเก็บความสัมพันธ์นี้เป็นตารางแยกใน PostgreSQL (`parent_student_links`) พร้อม flow ยืนยันตัวตนแบบ opt-in จากฝั่งนักเรียนก่อน เพื่อป้องกันการเชื่อมบัญชีโดยไม่ได้รับความยินยอม

---

### Notification: External Notification Service (Resend / Firebase Cloud Messaging)

ทีมเลือกเรียกใช้ Notification Service ภายนอกแทนการสร้างระบบส่ง email/push เอง ด้วยเหตุผล:

1. **ไม่ต้องดูแล Infrastructure การส่ง Email/Push เอง** — การรัน SMTP server หรือ push notification gateway เองมีความซับซ้อนด้าน deliverability (SPF/DKIM, spam filtering) ที่ไม่คุ้มกับ timeline ของโปรเจกต์วิชาเรียน บริการอย่าง Resend (email) มี free tier เพียงพอสำหรับ demo และมี API ที่เรียกง่ายจาก FastAPI
2. **รองรับ Use Case ที่ต่างกันของ 2 Persona** — พี่เอิร์ธต้องการการแจ้งเตือนแบบ "reminder" (ทบทวนเนื้อหา) ซึ่งเหมาะกับ email หรือ push แบบ schedule ล่วงหน้า ส่วนคุณแม่มลต้องการแจ้งเตือนแบบ "alert" เมื่อ threshold บางอย่างถูกกระตุ้น (เช่น ผิดซ้ำ 3 ครั้งในหัวข้อเดียว ตาม user story 10) ซึ่งเป็น event-driven — ทั้งสองแบบเรียกผ่าน Notification Service ตัวเดียวกันได้ โดย Backend เป็นผู้ตัดสินใจ trigger เงื่อนไข
3. **Decouple จาก Backend หลัก** — หาก Notification Service ล่มหรือช้า จะไม่กระทบ core feature อื่น (login, quiz generation) เพราะเรียกแบบ asynchronous/best-effort ไม่ block response หลักของ API

**ขอบเขตในเฟสนี้:** เริ่มจาก Email เท่านั้น (ผ่าน Resend) ยังไม่ทำ Push Notification เพราะต้องมี mobile app หรือ service worker เพิ่มเติมซึ่งอยู่นอก scope ของเว็บแอปในเฟส Prototype/MVP นี้

---

### Deployment: Vercel + Render/Railway

- **Vercel** สำหรับ Frontend เพราะ zero-config deployment สำหรับ Vite/React, automatic HTTPS, และ global CDN
- **Render หรือ Railway** สำหรับ Backend เพราะรองรับ Docker (ที่ทีมมีอยู่แล้วใน stats-service), one-command deploy จาก GitHub, และ free tier สำหรับ demo
- ทีมหลีกเลี่ยง AWS/GCP ในขั้นต้นเพราะไม่มี bandwidth ดูแล IAM, VPC, และ container registry ภายในภาคเรียน สามารถ migrate ได้ภายหลังหาก usage โต

---

## ผลกระทบที่ตามมา (Consequences)

### ผลกระทบเชิงบวก

- **ลดโค้ดซ้ำซ้อนใน Frontend** — การเปลี่ยนจาก HTML แยกไฟล์มาเป็น React Component จะลดโค้ดซ้ำในส่วน header/footer/form ได้มากกว่า 60% และทำให้การแก้ไข UI มี single source of truth
- **Stack สอดคล้องกับที่มีอยู่** — การเลือก Python ต่อจาก stats-service ทำให้ทีมไม่ต้องเรียนรู้ภาษาใหม่ และสามารถ reuse pattern จาก codebase เดิมได้ เช่น Docker workflow, dependency management
- **API Contract ชัดเจน** — FastAPI + Pydantic + Swagger ทำให้ทีม Frontend และ Backend ทำงานคู่ขนานกันได้โดยไม่ต้องรอ ลดปัญหา "ส่งข้อมูลไม่ตรง schema" ที่พบบ่อยในงานกลุ่ม
- **AI Coding Assistant ช่วยได้ดี** — React และ FastAPI เป็น framework ที่ LLM คุ้นเคย Copilot และ ChatGPT ช่วยเขียน component และ endpoint ได้แม่นยำ ลดเวลา development ได้มาก
- **Ecosystem พร้อมสำหรับฟีเจอร์ AI** — library สำหรับ PDF parsing, LLM SDK, และ langchain ล้วนเป็น Python-first ทำให้ฟีเจอร์ AI Quiz Generator และ Summarization ทำได้เร็วกว่าการใช้ Node.js
- **PostgreSQL ตอบโจทย์ทั้ง relational และ semi-structured** — โครงสร้าง User → Quiz → Question → Choice เป็น relational ที่ชัดเจน ในขณะที่ JSONB รองรับ metadata ของ AI response ได้โดยไม่ต้องเปลี่ยน DB
- **Cost ใกล้ศูนย์ระหว่างพัฒนา** — ทุก service ที่เลือกมี free tier ที่เพียงพอสำหรับ dev/demo workload ของโปรเจกต์วิชาเรียน
- **ลดภาระผู้ใช้และเพิ่มความแม่นยำของ Quiz Generator** — การดึง course metadata จาก LMS อัตโนมัติ ทำให้ผู้ใช้ไม่ต้องกรอกข้อมูลวิชาเอง และช่วยให้ AI สร้างคำถามที่ตรงบริบทวิชามากขึ้น
- **รองรับผู้ใช้ 4 กลุ่มโดยไม่เพิ่ม Service ใหม่** — RBAC แบบ JWT role claim ทำให้ Web Application และ Backend ตัวเดียวรองรับทั้งนักเรียน ครู ผู้เรียนผู้ใหญ่ และผู้ปกครองได้ โดยไม่ต้องแยก deploy target ตาม role
- **Notification แยกส่วนจาก core flow** — การเรียก Notification Service แบบ asynchronous ทำให้ปัญหาการส่ง email/push ไม่กระทบ availability ของฟีเจอร์หลัก (login, quiz generation)

### ผลกระทบเชิงลบ

- **การแยก deployment target** — เนื่องจากไม่ไช่ full-stack framework อย่าง Next.js ทีมต้องจัดการ deployment ของ Frontend และ Backend แยกกัน เพิ่มพื้นที่ให้ config drift และ CORS issue
- **Cold start บน free tier** — Render และ Railway free tier จะ sleep เมื่อไม่มี traffic ทำให้ request แรกหลัง idle ใช้เวลา 30–60 วินาที ต้องเตือนผู้ฟัง demo ล่วงหน้า หรือพิจารณา upgrade เป็น paid tier ก่อนนำเสนอ
- **Async learning curve (หากเลือก FastAPI)** — หากทีมยังไม่คุ้น async/await และ Pydantic อาจใช้เวลา 1–2 สัปดาห์ในการ adapt ก่อนที่ productivity จะกลับมาเท่า Flask แบบ sync
- **CORS และ cookie complexity** — SPA บน `vercel.app` ที่เรียก API บน `onrender.com` ต้องตั้ง CORS ให้ถูกต้อง และไม่สามารถใช้ `Secure; SameSite=Strict` cookie ได้โดยตรง ทีมต้องใช้ JWT token ใน localStorage ซึ่งมี exposure ต่อ XSS มากกว่า
- **LLM API cost variability** — pricing เป็นแบบ per-token PDF ที่ยาวผิดปกติหรือ prompt ที่ซับซ้อนอาจทำให้ credit หมดเร็ว ทีมต้อง enforce per-user rate limit และ daily token budget ใน backend
- **Single region สำหรับ backend** — free tier backend มักอยู่ใน region เดียว (มักเป็น US-East) ทำให้ผู้ใช้ใน region อื่นประสบ latency ที่สังเกตได้ ยอมรับได้สำหรับโปรเจกต์วิชาเรียน แต่ต้องประเมินใหม่หาก launch จริง
- **พึ่งพาสิทธิ์เข้าถึง LMS ของมหาวิทยาลัย** — การเชื่อมต่อ Moodle REST API ต้องขอ API credential จากฝ่าย IT มหาวิทยาลัยก่อน ซึ่งอยู่นอกเหนือการควบคุมของทีมและอาจใช้เวลานานกว่าที่คาด หากขอสิทธิ์ไม่ทันตาม timeline ทีมมีแผนสำรองคือให้ผู้ใช้กรอกชื่อวิชาเอง (manual tagging) ไปก่อนในช่วง demo
- **ความซับซ้อนด้าน Privacy ของ Parent-Child Linking** — ต้องออกแบบ consent flow ให้นักเรียนเป็นผู้ยินยอมผูกบัญชีกับผู้ปกครองเอง ไม่ใช่ผู้ปกครองผูกบัญชีได้เองฝ่ายเดียว เพิ่มความซับซ้อนของ onboarding flow และต้องระวังเรื่องข้อมูลส่วนบุคคลของผู้เยาว์ (ปันปันอายุ 16 ปี) เป็นพิเศษ
- **Notification Service เพิ่ม external dependency อีกจุด** — หาก Resend หรือ FCM มีปัญหา อาจทำให้แจ้งเตือนล่าช้าหรือไม่ถึงผู้ใช้ ทีมต้อง log สถานะการส่งไว้เพื่อ debug และอาจต้องมี retry mechanism เบื้องต้น

---

## ทางเลือกอื่นที่พิจารณา (Alternatives Considered)

### Next.js (full-stack) แทน React + FastAPI

**ผลประโยชน์:** รวม Frontend และ Backend ใน codebase เดียว, ลด deployment target, มี server-side rendering สำหรับ SEO

**เหตุผลที่ปฏิเสธ:**
1. ทีมมี Python service (stats-service) อยู่แล้ว การใช้ Next.js จะทำให้ต้อง maintain ทั้ง TypeScript และ Python พร้อมกัน
2. ฟีเจอร์ AI และ PDF processing มี library ที่ดีกว่าใน Python (PyPDF2, langchain)
3. Serverless function มี timeout ที่จำกัด ไม่เหมาะกับ LLM call ที่อาจใช้เวลานาน
4. ทีมไม่มีประสบการณ์ Next.js มาก่อน เพิ่ม learning curve

### Node.js + Express แทน Python + FastAPI

**ผลประโยชน์:** ใช้ JavaScript ทั้ง stack, ลด context switching

**เหตุผลที่ปฏิเสธ:**
1. ทีมมี Python codebase อยู่แล้วใน stats-service การเลือก Node.js จะทำให้มี 2 ภาษาในระบบ
2. Ecosystem สำหรับ AI/PDF ใน Python ทำได้ง่ายกว่าและครบกว่า
3. ทีมคุ้นเคย Python ในงาน backend มากกว่า JavaScript

### MongoDB แทน PostgreSQL

**ผลประโยชน์:** Schema ยืดหยุ่น, เหมาะกับข้อมูลที่ไม่มีโครงสร้างคงที่

**เหตุผลที่ปฏิเสธ:**
1. ข้อมูลของ SynapseSync เป็น relational อย่างชัดเจน (User → Quiz → Question → Choice → Attempt)
2. การ JOIN ที่จำเป็น เช่น "คะแนน quiz ของ user ใน course นี้" ทำได้ง่ายใน SQL แต่ยากใน MongoDB
3. ทีมต้องการฝึก SQL skill เป็น learning outcome ของวิชา
4. PostgreSQL มี JSONB ที่รองรับ semi-structured data ได้ดีพอ ไม่ต้องการ NoSQL แยก

### Self-hosted VPS แทน managed services

**ผลประโยชน์:** ควบคุมได้เต็มที่, ไม่จำกัด free tier

**เหตุผลที่ปฏิเสธ:**
1. ภาระการดูแล OS update, reverse proxy, database backup, SSL renewal มากเกินไปสำหรับทีมนักศึกษา
2. เวลาที่ใช้กับ ops จะกินเวลาที่ควรใช้กับ feature development
3. Free tier ของ Vercel/Render/Supabase เพียงพอสำหรับโปรเจกต์วิชาเรียน

---

### Manual Course Tagging แทน LMS Integration

**ผลประโยชน์:** ไม่ต้องขอสิทธิ์เข้าถึง API จากฝ่าย IT มหาวิทยาลัย, พัฒนาได้เร็วกว่าและไม่ผูกกับ timeline ของหน่วยงานภายนอก

**เหตุผลที่ปฏิเสธ (เป็นทางเลือกหลัก แต่เก็บไว้เป็นแผนสำรอง):**
1. ผู้ใช้ต้องกรอกชื่อ/รหัสวิชาเองทุกครั้ง เสี่ยงพิมพ์ผิดหรือใช้ชื่อไม่สม่ำเสมอ ทำให้ข้อมูลไม่สะอาดในระยะยาว
2. ระบบไม่สามารถแนะนำ/จัดกลุ่มเนื้อหาให้อัตโนมัติได้ ลดคุณค่าของฟีเจอร์ AI Quiz Generator ที่ต้องการ context ของวิชา
3. ทีมยังคงเลือก LMS Integration เป็นทางหลัก แต่หากขอสิทธิ์เข้าถึง Moodle API จากมหาวิทยาลัยไม่ทันตาม timeline ของภาคเรียน จะ fallback มาใช้ manual tagging ชั่วคราวสำหรับ demo แล้วค่อยเปลี่ยนกลับภายหลัง

---

### In-app Notification เท่านั้น (ไม่เรียก Notification Service ภายนอก) แทน Email/Push

**ผลประโยชน์:** ไม่ต้องพึ่ง external dependency เพิ่ม, ไม่มีค่าใช้จ่ายหรือ rate limit จากผู้ให้บริการภายนอก, พัฒนาได้เร็วกว่า

**เหตุผลที่ปฏิเสธ:**
1. Persona พี่เอิร์ธและคุณแม่มล มีพฤติกรรมไม่ได้เปิดแอปทุกวัน (พี่เอิร์ธ: "เวลาเรียนไม่แน่นอน", คุณแม่มล: ไม่ได้ใช้แอปเรียนเอง แค่ต้องการติดตามลูก) การแจ้งเตือนในแอปอย่างเดียวจะไม่ถึงผู้ใช้กลุ่มนี้เลยหากไม่ได้เปิดแอป ทำให้ฟีเจอร์ที่ Persona ต้องการ (reminder, alert ล่วงหน้า) ไม่เกิดประโยชน์จริง
2. คุณแม่มลอาจไม่ได้เป็นผู้ใช้แอปโดยตรง (ไม่มี Persona บ่งชี้ว่าเธอ log-in บ่อย) จึงจำเป็นต้องมีช่องทางแจ้งเตือนที่อยู่นอกแอป เช่น email
3. ทีมจึงเลือกใช้ Notification Service ภายนอกเป็นทางหลัก แต่ยังคงแสดงแจ้งเตือนในแอปควบคู่ไปด้วยสำหรับผู้ใช้ที่เปิดแอปอยู่แล้ว (เช่น ปันปัน, ครูสมชาย) เพื่อลดต้นทุนการส่ง email/push ในกรณีที่ไม่จำเป็น

---

## หมายเหตุด้านความปลอดภัยและธรรมาภิบาล (Security & Governance Notes)

ตามแนวทาง *Grounded Security & Governance Alert — 2026* ADR นี้และแผนภาพ C4 ที่เกี่ยวข้องใช้ **ชื่อนามธรรม** เท่านั้น (เช่น "LLM Provider API", "Primary Database", "Cloud Object Storage") ไม่ระบุ hostname, IP address, ชื่อ bucket จริง, หรือ account identifier ใดๆ ค่าการเชื่อมต่อจริง (connection strings, API keys) ถูกจัดการผ่าน **GitHub Secrets** และ inject เข้า runtime environment ตอน deploy เท่านั้น ไม่มีใน source code หรือ diagram ในรูปแบบใด

Pull Request ที่แก้ไขไฟล์ใน `docs/architecture/` จะถูก review หาความเสี่ยงของการ leak secret ด้วยความเข้มข้นเดียวกับ code review — diagram ที่มีข้อมูล infrastructure จริงจะถูก reject ก่อน merge

---

## อ้างอิง (References)

- C4 Model: https://c4model.com/
- ADR template (Michael Nygard): https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- แผนภาพ C4 ของ SynapseSync: `docs/architecture/diagrams/c4-level-1-context.png`, `docs/architecture/diagrams/c4-level-2-container.png`
- ภาพรวมสถาปัตยกรรม: `docs/architecture/README.md`
- โครงสร้าง prototype ปัจจุบัน: โฟลเดอร์ `services/stats-service/` (Python + Docker) และ HTML แยกไฟล์ใน prototype frontend
