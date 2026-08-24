# SynapseSync API Container

เอกสารนี้อธิบาย first container ของ SynapseSync สำหรับ Lab 06 โดย containerize FastAPI entry point `app.main:app` จาก `services/api/`

## Image

| Item | Value |
|---|---|
| Local image | `synapsesync-api:v0.1.0` |
| Intended registry image | `ghcr.io/software-engineering-concepts-2026/se-sec2-team-06-api:v0.1.0` |
| Base image | `python:3.12.13-slim-bookworm` |
| Container port | `8000` |
| Runtime user | `appuser:appgroup` — UID/GID `10001` |
| Health endpoint | `GET /health` |
| Docker build/run status | Not verified — Docker CLI is not installed in the current environment |
| Image size | Not measured until Docker build is available |
| Registry status | Not pushed until a verified local image and registry authentication are available |

## Why This Service

ทีมเลือก FastAPI API เป็น first container เพราะเป็น stateless process และตรงกับ [ADR-0001 — Modular Monolith](../docs/architecture/adr/0001-tech-stack-selection.md) Container นี้เป็น Backend deployable unit หนึ่งชุด ไม่ได้หมายความว่า SynapseSync เปลี่ยนเป็น Microservices

## Dockerfile Structure

### Builder Stage

- ใช้ base image ที่ pin version แล้ว
- สร้าง virtual environment ที่ `/opt/venv`
- copy เฉพาะ `services/api/requirements.txt` ก่อนติดตั้ง dependencies เพื่อให้ Docker layer cache ใช้ซ้ำได้
- ไม่ติดตั้ง test dependencies ใน runtime image

### Runtime Stage

- เริ่มจาก Python slim image ใหม่เพื่อไม่พก build cache
- copy virtual environment จาก builder
- copy เฉพาะ application package
- สร้างและรันด้วย non-root UID/GID 10001
- เปิด port 8000 และตรวจ `/health` ด้วย Python standard library

## Build

จาก repository root:

```bash
docker build --tag synapsesync-api:v0.1.0 .
```

Dockerfile ใช้ build context ที่ root เพราะต้อง copy `services/api/requirements.txt` และ `services/api/app/`

## Run

```bash
docker run --rm --name synapsesync-api --publish 8000:8000 synapsesync-api:v0.1.0
```

ทดสอบจากอีก terminal:

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8000/
```

Expected health response:

```json
{
  "status": "healthy",
  "service": "synapsesync-api",
  "architecture": "modular-monolith",
  "version": "0.1.0"
}
```

Swagger UI อยู่ที่ `http://127.0.0.1:8000/docs`

## Environment Variables

Health-only service เวอร์ชัน `v0.1.0` ไม่มี environment variable ที่จำเป็น เมื่อเพิ่ม database หรือ LLM integration ต้องส่งค่าที่ runtime เท่านั้น:

```bash
docker run --rm --publish 8000:8000 \
  --env DATABASE_URL="<runtime-secret>" \
  --env LLM_API_KEY="<runtime-secret>" \
  synapsesync-api:v0.1.0
```

ห้ามวางค่าจริงใน Dockerfile, `.dockerignore`, README, source code หรือ image layer ใช้ local secret store หรือ deployment secret manager แทน

## Inspect and Stop

```bash
docker image ls synapsesync-api:v0.1.0
docker inspect synapsesync-api:v0.1.0
docker stop synapsesync-api
```

เป้าหมายตาม Lab คือ image เล็กกว่า 500 MB แต่ต้องบันทึกขนาดจริงจาก `docker image ls` หลัง build สำเร็จ ห้ามประมาณหรือกรอกแทนผลทดสอบ

## Registry Push — Run Only After Local Verification

```bash
docker tag synapsesync-api:v0.1.0 \
  ghcr.io/software-engineering-concepts-2026/se-sec2-team-06-api:v0.1.0

docker push ghcr.io/software-engineering-concepts-2026/se-sec2-team-06-api:v0.1.0
```

ก่อน push ต้องยืนยันว่า:

- image build และ run ได้ใน local
- `/health` ตอบ HTTP 2xx
- image ไม่มี `.env`, token หรือ credential
- tag เป็น version เช่น `v0.1.0` ไม่ใช่ `latest`
- registry package visibility และสิทธิ์ของ organization ถูกต้อง

## Container vs Virtual Machine

อ้างอิงแนวคิดจาก *Engineering Software Products*, Chapter 5 §5.4:

| Aspect | Container | Virtual Machine | SynapseSync Decision |
|---|---|---|---|
| Isolation | แยก process/filesystem แต่ใช้ host kernel ร่วม | มี guest OS และ kernel แยก | Container เพียงพอสำหรับ stateless API ในงานรายวิชา |
| Startup | เร็วและใช้ resource น้อยกว่า | ช้ากว่าเพราะต้อง boot guest OS | Container เหมาะกับ build/test/deploy รอบสั้น |
| Portability | Image ระบุ runtime/dependencies | VM image รวม OS มากกว่า | Dockerfile ทำให้ dev/CI/PaaS ใช้ artifact เดียวกัน |
| Security boundary | เบากว่า VM และต้องใช้ non-root/minimal image | Isolation แข็งแรงกว่า | ลด attack surface ด้วย slim base, non-root และไม่ใส่ secrets |
| Operations | ต้องจัดการ image/tag/registry | ต้อง patch guest OS และดูแล VM | Managed container platform ลดภาระทีมขนาดเล็ก |

ข้อเสียของ Container คือยังต้องดูแล base-image vulnerabilities, tag lifecycle, secret injection และ host-kernel assumptions ส่วน VM เหมาะกว่าเมื่อจำเป็นต้องมี OS/kernel isolation หรือ software ที่ควบคุม host environment อย่างละเอียด

## Troubleshooting

### `docker` is not recognized

ติดตั้งและเปิด Docker Desktop หรือใช้ Docker-compatible environment เช่น GitHub Codespaces แล้วตรวจด้วย:

```bash
docker version
```

### Container starts but health check fails

- ตรวจว่าใช้ `--publish 8000:8000`
- ตรวจ log ด้วย `docker logs synapsesync-api`
- ตรวจว่า Uvicorn ฟัง `0.0.0.0:8000`
- ตรวจ `docker inspect` ในส่วน health status

### Build context is unexpectedly large

ตรวจ `.dockerignore` และยืนยันว่า `.git`, `.env*`, `node_modules`, tests, prototypes และ docs ไม่ถูกส่งเข้า build context

## Verification Record

| Check | Result |
|---|---|
| FastAPI automated tests | Passed locally outside Docker |
| Uvicorn `/health` HTTP 2xx | Passed on `127.0.0.1:8000` with the pinned dependencies |
| Dockerfile static requirements | Passed: multi-stage, pinned slim base, non-root, `EXPOSE`, `HEALTHCHECK` |
| Docker build/run | Blocked: Docker CLI unavailable |
| Image size | Blocked until build |
| Registry image | Blocked until verified image and authentication are available |
