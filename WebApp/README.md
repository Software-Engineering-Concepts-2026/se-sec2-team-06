# SynapseSync WebApp

WebApp ชุดใหม่นี้เป็น application shell ของ SynapseSync ที่อยู่ในโฟลเดอร์
`WebApp/` โดยแยกออกจากไฟล์ Lab 4 ใต้ `prototypes/` อย่างชัดเจน
การเปลี่ยนแปลงชุดนี้จึงไม่แก้ ย้าย หรือนำไฟล์จาก `prototypes/` มา import ตอน runtime

## ขอบเขตปัจจุบัน

- ใช้ Vite + Vanilla JavaScript สำหรับ development และ production build
- เรียก backend ผ่าน same-origin API ที่ `/api/*`
- ตรวจสอบการเชื่อมต่อผ่าน `GET /api/health`
- API key ของ AI และ database credential ต้องอยู่ฝั่ง FastAPI เท่านั้น
- shell รอบนี้ยังไม่อ้างว่า upload, AI generation หรือ database persistence เสร็จแล้ว

## รันแบบ local

จากโฟลเดอร์ `WebApp/`:

```powershell
Set-Location WebApp
npm install
npm run dev
```

เปิด `http://127.0.0.1:5173/` แล้วกด **ตรวจสอบ API** ได้เมื่อ FastAPI ทำงานอยู่

คำสั่งทดสอบและ build:

```powershell
npm test
npm run build
```

ถ้าต้องการทดสอบ FastAPI ให้รันจาก `services/api/` เพื่อให้ package `app` อยู่ใน
Python path:

```powershell
Set-Location services/api
.\.venv\Scripts\python.exe -m pytest tests -q
```

## สัญญา API

`src/api/client.js` เป็นจุดเชื่อมต่อเดียวระหว่าง UI กับ backend โดยเริ่มต้นจาก
`VITE_API_BASE_PATH=/api` ใน `.env.example` และคาดหวัง response ของ health ดังนี้:

```json
{
  "status": "healthy",
  "service": "synapsesync-api",
  "architecture": "modular-monolith",
  "version": "0.1.0"
}
```

FastAPI ยังคงรองรับ `/health` เดิม และเพิ่ม `/api/health` สำหรับ WebApp
โดยไม่เปิดเผย stack trace, provider key หรือ database connection string ให้ browser

## รันด้วย Docker Compose

จาก root ของ repository (`se-sec2-team-06-main-new`):

```powershell
docker compose -f compose.webapp.yml up --build
```

เปิดใช้งานที่:

- WebApp: <http://127.0.0.1:8080/>
- API health ผ่าน Nginx: <http://127.0.0.1:8080/api/health>
- API health โดยตรง: <http://127.0.0.1:8000/health>

หยุดและลบเฉพาะ container/network ของชุดทดสอบ:

```powershell
docker compose -f compose.webapp.yml down
```

Image ของ WebApp ใช้ Nginx เสิร์ฟไฟล์ที่ build แล้ว และ proxy `/api/` ไปยัง
service `api` ใน Compose ไม่มี `.env`, API key, database credential หรือไฟล์
`prototypes/` อยู่ใน production image และไม่มี prototype page ใดถูกเสิร์ฟจาก image นี้

## โครงสร้างที่เกี่ยวข้อง

```text
WebApp/
├── src/             # UI และ API client boundary
├── tests/           # frontend tests (ไม่ถูก copy เข้า production image)
├── index.html
├── Dockerfile
├── nginx.conf
└── README.md

services/api/        # FastAPI modular monolith เดิม
prototypes/          # Lab 4 artifacts; read-only สำหรับงานนี้
```

การเพิ่ม endpoint จริงสำหรับ upload, AI provider หรือ database ต้องทำเป็นงานถัดไป
พร้อม validation, integration tests และการจัดการ secret ฝั่ง backend โดยไม่แก้
ไฟล์ใน `prototypes/`
