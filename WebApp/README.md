# SynapseSync WebApp

WebApp สำหรับเริ่มใช้งาน SynapseSync แบบ local ประกอบด้วยหน้า Home, สมัครสมาชิก,
เข้าสู่ระบบ และโปรไฟล์ บัญชีถูกบันทึกใน SQLite รหัสผ่านถูกแฮช และรูปโปรไฟล์
เก็บเป็นไฟล์ในเครื่อง เบราว์เซอร์เรียก FastAPI ผ่าน `/api/*` โดยไม่เชื่อมต่อ
ฐานข้อมูลหรือเก็บ session token เอง

โฟลเดอร์ `prototypes/` เป็นงานต้นฉบับและไม่ได้ถูกแก้หรือใช้เป็น runtime ของแอปนี้

## เริ่มใช้งานในเครื่อง

ต้องมี Python 3.10 ขึ้นไป และ Node.js 20 ขึ้นไป เปิด terminal แรกที่ root ของ
repository แล้วเริ่ม API:

```powershell
Set-Location services/api
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

เปิด terminal ที่สองจาก root ของ repository เพื่อเริ่ม WebApp:

```powershell
Set-Location WebApp
npm ci
npm run dev
```

เปิด <http://localhost:5173/> จากนั้นสมัครบัญชีและเข้าสู่ระบบได้เลย Vite ส่งคำขอ
`/api/*` ไปยัง FastAPI ที่ `127.0.0.1:8000` โดยรักษา origin ของ browser ไว้

ข้อมูล local อยู่ใต้ `.local/` ที่ root ของ repository:

- `.local/synapsesync.db` — บัญชีและ session ใน SQLite
- `.local/profile-images/` — รูปโปรไฟล์ที่ตรวจชนิดและเนื้อหาก่อนบันทึก

`.local/` ถูก ignore โดย Git ไม่ควรลบโฟลเดอร์นี้หากต้องการเก็บบัญชีและรูปที่สร้างไว้

## ทดสอบและ build

จาก `WebApp/`:

```powershell
npm test
npm run build
```

จาก `services/api/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

สามารถเปลี่ยนปลายทาง API ของ Vite ได้ผ่าน `VITE_API_PROXY_TARGET` เช่น
`http://localhost:9000` โดยค่าปกติคือ `http://127.0.0.1:8000`

## ใช้ Docker Compose

จาก root ของ repository:

```powershell
docker compose -f compose.webapp.yml up --build
```

เปิด <http://localhost:8080/> ข้อมูลยังอยู่ใน `.local/` ของเครื่อง แม้หยุดและ
สร้าง container ใหม่ด้วย `docker compose -f compose.webapp.yml down` แล้วสั่ง
`up --build` อีกครั้ง อย่าลบ `.local/` หากต้องการเก็บข้อมูลเดิม

## ขอบเขตตอนนี้

- ใช้ SQLite สำหรับบัญชีและ session ในการพัฒนา local
- รหัสผ่านสมัครสมาชิกต้องมีอย่างน้อย 8 ตัวอักษร มีตัวอักษรอย่างน้อย 1 ตัว และมีตัวเลขอย่างน้อย 1 ตัว; หน้า Register แสดง checklist และตัววัดความแข็งแรงขณะพิมพ์ โดยตัววัดเป็นคำแนะนำ ไม่ได้เพิ่มเงื่อนไขการสมัคร
- API จำกัดข้อมูลรหัสผ่านที่รับไว้ไม่เกิน 128 ตัวอักษรเป็นเพดานทางเทคนิค ส่วนกติกาที่ผู้ใช้ต้องทำตามมีเพียง 3 ข้อข้างต้น
- session ใช้ cookie แบบ HttpOnly และถูกเพิกถอนเมื่อออกจากระบบ
- โปรไฟล์มีชื่อที่ใช้แสดง คำแนะนำตัว และรูป JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MB
- ยังไม่เชื่อม API ของมหาวิทยาลัยหรือผู้ให้บริการ AI และยังไม่ใช่ระบบ production
