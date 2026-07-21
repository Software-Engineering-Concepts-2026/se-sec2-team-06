# สถาปัตยกรรมโปรเจกต์ (Project Architecture)

โฟลเดอร์นี้เก็บแผนภาพสถาปัตยกรรมและบันทึกการตัดสินใจ (Architecture Decision Records) ของโปรเจกต์ **SynapseSync** — เว็บแอปพลิเคชัน All-in-One Learning Platform สำหรับนักศึกษา ที่รวมฟีเจอร์การจัดการโน้ตการเรียน การอัปโหลดเอกสาร PDF/DOCX ระบบ AI Quiz Generator ที่สร้างคำถามจากเนื้อหา และระบบ To-do List สำหรับติดตามงานการเรียน ไว้ในที่เดียว

## ภาพรวมสถาปัตยกรรม

SynapseSync ออกแบบเป็นเว็บแอปพลิเคชันแบบ 2-tier ตามมาตรฐาน:

- **React SPA** (deploy บน Vercel) จัดการ UI ทั้งหมดที่ผู้ใช้สัมผัส: หน้าแก้ไขโน้ต, อัปโหลดไฟล์, จัดการ To-do, หน้าทำ quiz, แดชบอร์ดสำหรับครู, และหน้าสรุปสำหรับผู้ปกครอง
- **Python/FastAPI REST API** (deploy บน Render หรือ Railway) จัดการ business logic, authentication พร้อม role-based access (นักเรียน / ครู / ผู้ปกครอง), การ orchestrate AI request, การส่งแจ้งเตือน, และ persistence
- **PostgreSQL** (managed โดย Supabase หรือ Neon) เก็บข้อมูลที่มีโครงสร้าง: users (พร้อม role และความสัมพันธ์ parent-child), courses, notes, to-dos, quizzes, questions, และ attempts
- **S3-compatible object store** (Cloudflare R2 หรือ AWS S3) เก็บไฟล์ PDF/DOCX ดิบและ text artifact ที่ extract แล้ว
- **LLM Provider API** ภายนอก (OpenAI GPT-4o-mini) ถูกเรียกจาก backend เพื่อสร้างคำถามและสรุปเนื้อหา
- **University LMS API** ภายนอก (Moodle) ถูกเรียกเพื่อ auto-tag เอกสารที่อัปโหลดด้วย course metadata
- **Notification Service** ภายนอก (เช่น Resend สำหรับ email หรือ Firebase Cloud Messaging สำหรับ push) ถูกเรียกจาก backend เพื่อแจ้งเตือนผู้ปกครองและผู้เรียนผู้ใหญ่

สำหรับเหตุผลเต็มของการเลือก stack นี้ ดูที่ [ADR-001: การเลือก Core Technology Stack](./adr/0001-tech-stack-selection.md)

---

## C4 Model: System Context (Level 1)

แผนภาพ System Context แสดง SynapseSync เป็นกล่องเดียวและความสัมพันธ์กับบุคคลและระบบภายนอกที่ระบบพึ่งพา เป็นมุมมองระดับสูงสุดของสถาปัตยกรรม เหมาะสำหรับผู้ฟังทุกประเภท รวมถึงผู้ที่ไม่ใช่นักเทคนิค

![SynapseSync — C4 Level 1: System Context](./diagrams/c4-level-1-context.png)

**ข้อสรุปสำคัญ:**

- ผู้ใช้ระบบมี **4 Persona** ที่ติดต่อโดยตรงกับ SynapseSync: **ปันปัน** (นักเรียน — ถามคำถาม/ฝึกโจทย์), **ครูสมชาย** (ครู — ดูแดชบอร์ดภาพรวม), **พี่เอิร์ธ** (ผู้เรียนผู้ใหญ่ — ทบทวนเนื้อหา/ดูความคืบหน้า), และ **คุณแม่มล** (ผู้ปกครอง — รับสรุปและแจ้งเตือน) — *หมายเหตุ: พี่เอิร์ธและคุณแม่มล ยังไม่มีไฟล์ Persona ฉบับเต็ม อ้างอิงจาก user story ในเอกสาร `main_scenario.md` เท่านั้น รอทีมเพิ่มไฟล์ Persona ที่สมบูรณ์ภายหลัง*
- SynapseSync พึ่งพาระบบภายนอก 2 ระบบ ได้แก่ **LLM Provider API** (สำหรับฟีเจอร์ AI สร้างคำถามและสรุปเนื้อหา) และ **University LMS API** (สำหรับดึง course catalog และข้อมูลการลงทะเบียนมา auto-tag เอกสาร) — ทั้งสองระบบนี้เป็นระบบอิสระที่มีเจ้าของแยกต่างหากจากทีม (OpenAI/Anthropic และมหาวิทยาลัยตามลำดับ)
- **Cloud Object Storage** ไม่แสดงเป็น External System ใน Level นี้ เพราะเป็น Infrastructure ที่ทีมเป็นผู้ deploy/config เอง (ดูรายละเอียดใน C2 ในฐานะ Container "Document Store")
- การเชื่อมต่อกับระบบภายนอกทั้งหมดเริ่มจาก SynapseSync — ไม่มีระบบภายนอกใด push ข้อมูลเข้ามาในแพลตฟอร์มของเรา

### ซอร์สโค้ด

draw.io source ของแผนภาพนี้อยู่ที่ [`diagrams/c4-level-1-context-drawio.xml`](./diagrams/c4-level-1-context-drawio.xml) เพื่อให้สามารถ regenerate หรือ update ได้ในฐานะ "Documentation as Code"

---

## C4 Model: Container (Level 2)

แผนภาพ Container ซูมเข้าไปใน boundary ของ SynapseSync และแสดงหน่วยที่ deploy ได้แบบหลัก (containers) พร้อมวิธีการสื่อสารระหว่างกัน เหมาะสำหรับ developer และ architect ที่ต้องการเข้าใจ runtime topology

![SynapseSync — C4 Level 2: Container](./diagrams/c4-level-2-container.png)

**ข้อสรุปสำคัญ:**

- System boundary (กล่องสีส้ม) ประกอบด้วย **4 containers**: React Web Application, FastAPI Backend API, PostgreSQL Primary Database, และ S3-compatible Document Store
- **ผู้ใช้ทั้ง 4 Persona** (ปันปัน, ครูสมชาย, พี่เอิร์ธ, คุณแม่มล) ติดต่อโดยตรงเฉพาะกับ Web Application ผ่าน HTTPS เท่านั้น — ไม่ได้เรียก backend หรือ database โดยตรง ใช้ Web Application ตัวเดียวกันทุกคน แยกสิทธิ์การมองเห็นด้วย Role-based Access ที่ Backend
- Backend API เป็นจุด orchestrate เดียว: ให้บริการ SPA, query database, อ่าน/เขียนไฟล์ใน object storage, เรียก API ภายนอก (LLM, LMS), และส่งคำขอแจ้งเตือนผ่าน Notification Service
- ระบบภายนอก (LLM Provider, LMS, **Notification Service**) ปรากฏเป็นกล่องที่มีเส้นประนอก system boundary ตามธรรมเนียม C4 มาตรฐาน — Notification Service เป็นการตัดสินใจใหม่ที่เพิ่มเข้ามาเพื่อรองรับความต้องการแจ้งเตือนของพี่เอิร์ธและคุณแม่มล (ดูเหตุผลใน ADR-001)

### ซอร์สโค้ด

draw.io source ของแผนภาพนี้อยู่ที่ [`diagrams/c4-level-2-container-drawio.xml`](./diagrams/c4-level-2-container-drawio.xml)

---

## บันทึกการตัดสินใจทางสถาปัตยกรรม (Architecture Decision Records — ADRs)

ADR เป็นเอกสารสั้นที่ไม่เปลี่ยนแปลง ใช้บันทึก "เหตุผล" ที่ตัดสินใจเลือกทางเทคนิคที่สำคัญ แต่ละ ADR มีเลขกำกับเรียงตามลำดับและเก็บใน [`./adr/`](./adr/)

| ADR | ชื่อเรื่อง | สถานะ |
|---|---|---|
| [ADR-001](./adr/0001-tech-stack-selection.md) | การเลือก Core Technology Stack ของโปรเจกต์ SynapseSync | Accepted |

### รูปแบบ ADR ที่ใช้ในโปรเจกต์นี้

- ฟิลด์ **สถานะ** ติดตาม lifecycle: `Proposed` → `Accepted` → `Deprecated` / `Superseded`
- **บริบท** อธิบายแรงกดดันในขณะตัดสินใจ (ทักษะทีม, timeline, ข้อจำกัด)
- **การตัดสินใจ** ระบุสิ่งที่เลือกและเหตุผลอย่างชัดเจน
- **ผลกระทบ** ระบุทั้งผลบวกและลบ — เราหลีกเลี่ยง ADR ที่มองแค่ด้านเดียว
- **ทางเลือกอื่นที่พิจารณา** บันทึกตัวเลือกที่ปฏิเสธ เพื่อให้ maintainer ในอนาคตเข้าใจ trade space
- เมื่อ ADR ถูกทำเครื่องหมาย `Accepted` แล้ว จะ **ไม่ถูกแก้ไข** — หากการตัดสินใจเปลี่ยน ต้องเขียน ADR ใหม่ที่ supersede ตัวเดิม

---

## หมายเหตุด้านความปลอดภัยและธรรมาภิบาล

ตามแนวทาง *Grounded Security & Governance Alert — 2026*:

- แผนภาพและ ADR ในโฟลเดอร์นี้ใช้ **ชื่อนามธรรม** เท่านั้น (เช่น "LLM Provider API", "Primary Database") ไม่มี hostname, IP address, ชื่อ bucket จริง หรือ account identifier ใดๆ ถูก commit เข้า repository
- Secret จริง (API keys, database URLs, OAuth client secrets) ถูกจัดการผ่าน **GitHub Secrets** และ inject เข้า runtime environment ตอน deploy ไม่มีใน source file, environment file ที่ commit, หรือแผนภาพใดๆ
- Pull Request ที่แก้ไขโฟลเดอร์นี้จะถูก review หาการ leak secret ด้วยความเข้มข้นเดียวกับ code review — แผนภาพที่มีรายละเอียด infrastructure จริงจะถูก reject ก่อน merge

---

## โครงสร้างโฟลเดอร์

```
docs/architecture/
├── README.md                                  ← ไฟล์นี้
├── diagrams/
│   ├── c4-level-1-context-drawio.xml          ← draw.io source (C1)
│   ├── c4-level-1-context.png                 ← ภาพที่ export แล้ว (C1)
│   ├── c4-level-2-container-drawio.xml        ← draw.io source (C2)
│   └── c4-level-2-container.png               ← ภาพที่ export แล้ว (C2)
└── adr/
    └── 0001-tech-stack-selection.md           ← ADR-001
```

## วิธี Regenerate แผนภาพ

ไดอะแกรมของโปรเจกต์นี้ใช้ **draw.io** เป็นเครื่องมือหลัก หากต้องการแก้ไขหรือ regenerate PNG ใหม่:

1. เปิดเว็บ [app.diagrams.net](https://app.diagrams.net) (หรือแอป draw.io บนเครื่อง)
2. ไปที่เมนู **Extras > Edit Diagram...**
3. วางเนื้อหาจากไฟล์ `.xml` ที่ต้องการแก้ (เช่น `c4-level-1-context-drawio.xml`) ทับลงไปในกล่องข้อความ แล้วกด **OK**
4. แก้ไขไดอะแกรมตามต้องการ
5. Export เป็น PNG: **File > Export as > PNG...** ตั้งค่า Zoom ให้เพียงพอ (แนะนำ 150–200%) และเลือก **Selection: None** (export ทั้งภาพ) เพื่อไม่ให้ข้อความถูกตัดขอบ
6. บันทึกทับไฟล์ `.png` เดิมในโฟลเดอร์ `diagrams/`
7. ถ้าแก้เนื้อหาในไดอะแกรมด้วย ให้ **Export as > XML...** บันทึกทับไฟล์ `.xml` เดิมด้วย เพื่อให้ source ตรงกับภาพล่าสุดเสมอ (หลักการ "Documentation as Code" เดียวกับที่เคยใช้กับ Mermaid)

> **หมายเหตุ:** เดิมทีโปรเจกต์นี้เคยใช้ Mermaid CLI (`mmdc`) ในการ generate แต่เปลี่ยนมาใช้ draw.io แทนเพื่อให้แก้ layout และจัดตำแหน่งกล่อง/เส้นได้ง่ายกว่าเมื่อ Diagram มี Actor หลายคน (4 Persona) ถ้าทีมต้องการกลับไปใช้ Mermaid ในอนาคต ให้เขียน ADR ใหม่บันทึกเหตุผลของการเปลี่ยนเครื่องมือไว้ด้วย
