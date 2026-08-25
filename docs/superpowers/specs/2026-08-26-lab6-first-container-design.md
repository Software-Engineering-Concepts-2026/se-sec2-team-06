# Lab 6 — First Container Design Specification

**วันที่:** 2026-08-26

**Branch:** `feature/lab6-dockerfile-Thakorn`

**สถานะ:** รอตรวจทานก่อนเริ่ม implementation
**Lab:** Lab 06 — First Container

## 1. เป้าหมายและการตัดสินใจที่อนุมัติแล้ว

งานนี้จะทำให้ SynapseSync มี container แรกที่ build และ run ได้จริงจาก root ของ repository โดยใช้ FastAPI backend เป็นตัวอย่างที่เล็กและตรวจสอบได้ง่าย ผู้ใช้ยืนยัน branch และแนวทางนี้แล้ว:

- สร้างจาก `se-sec2-team-06-main-new` บนฐาน commit ล่าสุดของ Lab 5
- ใช้ branch `feature/lab6-dockerfile-Thakorn`
- ใช้ **FastAPI API แบบ Modular Monolith** เป็น container แรก
- ยังไม่แยกเป็น microservices และยังไม่ทำ Docker Compose หรือ database integration

หลักการสำคัญคือ container เป็นหน่วยบรรจุและส่งมอบ runtime ส่วนการแบ่ง service ต้องอาศัย boundary และเหตุผลด้านการ deploy/scale ที่ชัดเจน ดังนั้น Lab นี้จะส่งมอบ container เดียวสำหรับ API และคงสถาปัตยกรรม Modular Monolith ตาม Lab 5

## 2. ขอบเขตงาน

### ทำใน branch นี้

1. เพิ่ม root `Dockerfile` แบบ multi-stage สำหรับ FastAPI API
2. ปรับ root `.dockerignore` ให้ลด build context และไม่ส่ง secret, dependency cache, test และไฟล์ IDE เข้า image
3. เติม API ขั้นต่ำใน `services/api/` พร้อม endpoint health ที่ใช้ตรวจ container
4. เพิ่ม `docker/README.md` อธิบาย image, build/run, environment, registry tag, security และ trade-off ตาม ESP §5.4
5. ปรับ root `README.md` ให้คำสั่ง Docker ชี้ไปที่ root Dockerfile และเอกสาร Docker ชุดเดียวกัน
6. เติม `AI_USAGE.md` ส่วน Lab 6 ให้แยกสิ่งที่ AI ช่วยร่างออกจากการตัดสินใจและการตรวจสอบของทีม
7. เติม `reflect.md` ส่วน Post-quiz 6 ให้สะท้อน Dockerfile, service boundary และ REST health contract

### ไม่อยู่ในขอบเขต

- ไม่แก้ไขหรือลบเอกสาร/โฟลเดอร์ของ Chaiwat หรือ Shuwichada
- ไม่เปลี่ยน architecture artifacts ของ Lab 5 ที่ไม่เกี่ยวกับ container
- ไม่ทำ database, authentication, LLM integration หรือ business endpoint เพิ่ม
- ไม่เปลี่ยน `services/stats-service/` placeholder ให้กลายเป็น service หลัก
- ไม่สร้าง microservice หลายตัว, Kubernetes manifest หรือ Compose stack
- ไม่ push image ไป Docker Hub/GHCR จนกว่าจะมี registry และสิทธิ์ที่ผู้ใช้ระบุชัดเจน

## 3. Runtime contract ที่จะใช้

API จะใช้ Python 3.12 และ FastAPI/Uvicorn ที่ pin version ใน `services/api/requirements.txt` เพื่อให้ build reproducible

| Method | Path | Success response | วัตถุประสงค์ |
| --- | --- | --- | --- |
| `GET` | `/` | `200` พร้อม service discovery และลิงก์ `/health`, `/docs` | ตรวจว่า API ตอบสนอง |
| `GET` | `/health` | `200` พร้อม `status`, `service`, `architecture`, `version` | liveness/readiness เบื้องต้นและ Docker `HEALTHCHECK` |

สัญญา `/health` ที่ต้องคงที่คือ:

```json
{
  "status": "healthy",
  "service": "synapsesync-api",
  "architecture": "modular-monolith",
  "version": "0.1.0"
}
```

ตัว application จะ bind ที่ `0.0.0.0:8000` ภายใน container และเปิด `EXPOSE 8000` เป็น metadata ของ image การ map port บน host จะใช้ `8000:8000`

## 4. แบบ Docker image

### Builder stage

- ใช้ `python:3.12.13-slim-bookworm` ที่ระบุ tag ชัดเจน
- สร้าง virtual environment ที่ `/opt/venv`
- ติดตั้งเฉพาะ production dependencies จาก `services/api/requirements.txt`
- วาง dependency layer ก่อน source layer เพื่อให้ Docker cache กลับมาใช้ได้เมื่อแก้ source แต่ไม่แก้ dependency

### Runtime stage

- ใช้ base image slim tag เดียวกันและ copy เฉพาะ virtual environment กับ `services/api/app`
- สร้าง user/group แบบ non-root (`appuser`, UID/GID 10001)
- ตั้ง `WORKDIR /app`, `PYTHONUNBUFFERED=1` และ `PYTHONDONTWRITEBYTECODE=1`
- ใช้ `USER appuser` ก่อน start process
- `EXPOSE 8000` และ `HEALTHCHECK` เรียก `GET /health`
- start ด้วย `uvicorn app.main:app --host 0.0.0.0 --port 8000`

การเลือก slim แทน Alpine เป็น trade-off ที่ตั้งใจ: slim ลดขนาดโดยไม่เพิ่มความเสี่ยงจากการ compile binary dependency บน musl ในขณะที่ยังตรงกับข้อกำหนด Lab ที่ให้ใช้ slim/Alpine และ image เป้าหมายต่ำกว่า 500 MB

## 5. โครงสร้างไฟล์ที่คาดว่าจะเปลี่ยน

```text
.
├── Dockerfile                         # ใหม่: multi-stage production image
├── .dockerignore                      # ปรับ: ลด build context
├── README.md                          # ปรับคำสั่งและลิงก์ Docker docs
├── AI_USAGE.md                        # เพิ่มบันทึก Lab 6
├── reflect.md                         # เพิ่ม Post-quiz 6
├── docker/
│   └── README.md                      # ใหม่: build/run/registry/trade-off
└── services/
    └── api/
        ├── app/
        │   ├── __init__.py
        │   ├── main.py
        │   └── routers/
        │       ├── __init__.py
        │       └── health.py
        ├── requirements.txt
        ├── requirements-dev.txt
        └── tests/
            └── test_health.py
```

ไฟล์ใน `services/api/tests/` จะอยู่ใน repository เพื่อทดสอบ contract แต่ถูก exclude จาก production image ผ่าน `.dockerignore` และไม่ติดตั้ง dev dependencies ใน runtime image

## 6. ความปลอดภัยและ reproducibility

- pin Python base tag และ package versions; ไม่ใช้ `latest`
- ไม่ copy `.env`, credential, token, Git metadata หรือ IDE settings เข้า image
- run เป็น non-root และไม่ใช้ secret เป็น build argument
- ใช้ production requirements แยกจาก dev/test requirements
- ใช้ `--no-cache-dir`/virtual environment เพื่อลดขนาด image และลด package cache ที่ไม่จำเป็น
- `HEALTHCHECK` ใช้ endpoint ภายใน container และไม่เปิดเผยข้อมูลลับ

## 7. แผนการตรวจสอบ

| รายการ | วิธีตรวจ | เกณฑ์ผ่าน |
| --- | --- | --- |
| Static files | `docker build --check` (ถ้า Docker รองรับ), `git diff --check`, ตรวจ Dockerfile/.dockerignore | ไม่มี syntax issue และไม่มี whitespace error |
| API contract | `pytest -q` ใน `services/api` | `/` และ `/health` ตรงตาม JSON contract |
| Image build | `docker build -t synapsesync-api:v0.1.0 .` | build สำเร็จและ image ต่ำกว่า 500 MB เป้าหมาย |
| Runtime | `docker run --rm -p 8000:8000 synapsesync-api:v0.1.0` แล้วเรียก `GET /health` | ได้ HTTP 200 และ status `healthy` |
| User/security | inspect user, exposed port, healthcheck และ process command | process ไม่ใช่ root และใช้ port/health contract ถูกต้อง |

ถ้าเครื่องตรวจไม่มี Docker CLI จะยังรัน unit/static checks ได้ และจะบันทึกข้อจำกัดนี้อย่างโปร่งใสใน `docker/README.md`/PR แทนการอ้างว่า image build สำเร็จโดยไม่มีหลักฐาน

## 8. Registry และการส่งงาน

เอกสารจะเตรียมตัวอย่าง tag สำหรับ registry ที่ทีมเลือก เช่น:

```text
ghcr.io/software-engineering-concepts-2026/se-sec2-team-06-api:v0.1.0
```

คำสั่ง `docker tag`/`docker push` จะเป็นคำแนะนำเท่านั้นในรอบนี้ การ push จริงต้องรอการยืนยัน registry, namespace และ credentials จากผู้ใช้ก่อน เพราะเป็นการเปลี่ยนแปลงภายนอก repository

PR ของ branch นี้ควรแนบ:

- ภาพหรือ log ของ `docker build` และ `docker run` ที่ตรวจสอบได้
- ผล `GET /health`
- ขนาด image และ user ที่ runtime ใช้ (ถ้า Docker พร้อมใช้งาน)
- รายการข้อจำกัดของ environment หากยังไม่มี Docker CLI

## 9. เกณฑ์เสร็จของ design นี้

ก่อนเริ่ม implementation ต้องยืนยันว่า:

- เลือก FastAPI Modular Monolith เป็น container แรกอย่างชัดเจน
- API contract และ port 8000 ไม่ขัดกับ architecture artifacts เดิม
- multi-stage, pinned slim base, non-root, `.dockerignore`, `EXPOSE` และ healthcheck ถูกกำหนดครบ
- registry push ถูกแยกออกจากงาน local จนกว่าจะได้รับอนุญาต
- รายการไฟล์ที่แก้ไม่แตะงานของสมาชิกคนอื่น
