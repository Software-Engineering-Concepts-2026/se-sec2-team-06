# WebApp — SynapseSync Application Design

## Goal

สร้าง application ใหม่ภายใต้ root ของ `se-sec2-team-06-main-new` ที่สามารถพัฒนาไปเป็นหน้าใช้งานจริงของ SynapseSync ได้ โดยแยกจาก prototype เดิมอย่างเด็ดขาด และไม่แก้ ย้าย หรือลบทับไฟล์ใด ๆ ใน `prototypes/`.

## User-approved scope

- โฟลเดอร์ใหม่อยู่ที่ `se-sec2-team-06-main-new/WebApp/`
- `prototypes/` เป็นขอบเขต read-only สำหรับงานนี้
- WebApp เป็นโค้ดชุดใหม่ ไม่ import runtime จาก prototype และไม่ใช้ไฟล์ prototype เป็น source ที่แก้ไขร่วมกัน
- Backend ที่ WebApp จะเรียกใช้คือ FastAPI ใน `services/api/` เมื่อมี API contract พร้อม
- ห้ามใส่ AI provider API key, database password หรือ secret ใด ๆ ใน frontend หรือใน Git
- การเปลี่ยนแปลงรอบแรกเป็นการสร้าง application shell, API client boundary และ Docker packaging ที่ตรวจสอบได้

## Architecture

```text
se-sec2-team-06-main-new/
├── WebApp/                 # new application; all files created here
│   ├── src/                # app logic and API boundary
│   ├── public/             # static public assets
│   ├── tests/              # frontend tests
│   ├── index.html          # WebApp entry point
│   ├── package.json        # Node/Vite scripts and dependencies
│   ├── vite.config.js      # development/build configuration
│   ├── Dockerfile          # production frontend image
│   ├── nginx.conf          # static serving and /api reverse-proxy contract
│   ├── .env.example        # non-secret public configuration only
│   └── README.md           # local, Docker and API integration instructions
├── services/api/           # existing FastAPI modular monolith
└── prototypes/             # existing Lab 4 artifacts; do not modify
```

WebApp ใช้ Vite + Vanilla JavaScript ในระยะแรก เพื่อให้ทีมใช้ภาษาเดียวกับ prototype เดิมโดยไม่ต้องย้ายไป React หรือ framework ใหม่ ส่วน production runtime ใช้ Nginx เสิร์ฟไฟล์ที่ build แล้ว และส่ง `/api/*` ไปยัง FastAPI ผ่าน network ของ Docker Compose.

Node.js จึงทำหน้าที่เป็น build/test tool ของ WebApp ไม่ใช่การย้าย Backend ออกจาก FastAPI. FastAPI ยังคงรับผิดชอบ authentication, file processing, AI provider calls และ database access.

## Boundaries and data flow

```text
Browser
  └── WebApp UI
        └── src/api/client.js
              └── same-origin /api/*
                    └── services/api (FastAPI)
                          ├── AI provider (server-side key only)
                          └── PostgreSQL (server-side credentials only)
```

`src/api/client.js` เป็น boundary เดียวระหว่าง UI กับ backend. UI ห้ามประกอบ provider URL, ห้ามอ่าน provider key และห้ามเรียก AI provider โดยตรง. ในระยะแรก client จะแสดง error state ที่อ่านได้เมื่อ API ยังไม่พร้อม แทนการฝังข้อมูลลับหรือสร้างข้อมูลปลอมที่ดูเหมือน production result.

## Initial application contract

รอบแรกต้องเตรียมชื่อและรูปแบบของ boundary ต่อไปนี้ แต่ยังไม่ถือว่า AI/database เสร็จจนกว่า API จะ implement และทดสอบจริง:

- `POST /api/quizzes/generate` — รับไฟล์และตัวเลือกแบบทดสอบ แล้วคืน quiz ที่ validate แล้ว
- `GET /api/health` — ใช้ตรวจว่า WebApp ติดต่อ backend ได้
- Error response ที่มี `message` สำหรับแสดงผลใน UI โดยไม่เผย secret หรือ stack trace

เมื่อ API contract เปลี่ยน ต้องแก้ `src/api/client.js`, tests และ `WebApp/README.md` ใน change เดียวกัน.

## Docker contract

- Development: `npm run dev` รัน Vite แยกจาก FastAPI ได้
- Production build: `npm run build` สร้าง `dist/`
- Production image: multi-stage Node build แล้วคัดลอก `dist/` เข้า Nginx image
- WebApp image ไม่ฝัง `.env`, API key หรือ database credential
- Nginx ต้องเสิร์ฟ SPA/static assets และสงวนเส้นทาง `/api/` ให้ proxy ไป FastAPI เมื่อใช้ Compose
- ห้ามใช้ volume bind ของ source code ใน production Compose configuration

## Non-goals for the first WebApp scaffold

- ไม่แก้หรือ refactor `prototypes/sprint1/` และไม่แก้ไฟล์ของสมาชิกใน prototype
- ยังไม่ย้าย HTML/CSS/JavaScript ของ Thakorn มาใช้โดยตรง
- ยังไม่สร้างระบบสมัครสมาชิกจริงหรือเก็บรหัสผ่าน
- ยังไม่เรียก AI provider จาก browser
- ยังไม่อ้างว่า upload, AI generation หรือ database ใช้งานจริงจนกว่าจะมี endpoint และ integration test
- ยังไม่เพิ่ม microservices; Backend ยังคงเป็น Modular Monolith ตาม Lab 5

## Security requirements

- เก็บเฉพาะค่าที่เปิดเผยได้ใน `WebApp/.env.example` เช่น public API base path
- เก็บ `AI_API_KEY` และ `DATABASE_URL` ฝั่ง FastAPI/Docker secret เท่านั้น
- ตรวจชนิดและขนาดไฟล์ทั้ง frontend และ backend เมื่อมี upload endpoint
- ไม่ส่ง API key, raw provider error หรือ database connection string กลับไปที่ browser
- ใช้ same-origin `/api` เป็นค่าเริ่มต้นเพื่อลด CORS configuration ที่ไม่จำเป็น

## Verification requirements

1. `git diff -- prototypes` ต้องไม่มีผลต่างหลังสร้าง WebApp
2. `npm install` และ `npm run build` ใน `WebApp/` ต้องผ่าน
3. frontend tests ตรวจ API client success, API error และ malformed response
4. `docker build -f WebApp/Dockerfile WebApp` ต้องสร้าง image ได้โดยไม่มี secret ใน build context
5. เปิด WebApp แล้วหน้า shell ต้องแสดงสถานะ API ที่เข้าใจได้เมื่อ FastAPI ยังไม่รัน
6. เมื่อ FastAPI health endpoint พร้อม `GET /api/health` ต้องแสดงสถานะเชื่อมต่อสำเร็จ
7. README ต้องระบุชัดว่า WebApp ใหม่แยกจาก prototype และระบุคำสั่ง local/Docker

## Definition of done for this design

WebApp รอบแรกถือว่าเสร็จเมื่อโฟลเดอร์ใหม่ build และรันใน Docker ได้, มี API boundary ที่ทดสอบได้, มีเอกสารวิธีรัน, ไม่มีการเปลี่ยนแปลงใต้ `prototypes/`, และยังไม่อ้างฟีเจอร์ AI/database ที่ยังไม่ได้ implement.
