# SynapseSync API Container — Lab 06

เอกสารนี้เป็นคู่มือของ container แรกใน Lab 6 โดยใช้ FastAPI backend แบบ **Modular Monolith** เป็น deployment unit เดียว ภายใน container ยังแบ่งความรับผิดชอบด้วย module/router แต่ยังไม่แยกเป็น Microservices

## Image และ source

| รายการ | ค่า |
| --- | --- |
| Build context | repository root (`.`) |
| Runtime source | `services/api/app/` |
| Python base | `python:3.12.13-slim-bookworm` |
| Image tag | `synapsesync-api:v0.1.0` |
| Container port | `8000` |
| Health endpoint | `GET /health` |
| Runtime user | `appuser` (UID/GID 10001) |

`Dockerfile` ใช้ multi-stage build: builder ติดตั้ง production dependencies ใน `/opt/venv` แล้ว runtime copy เฉพาะ virtual environment และ application source เข้า image สุดท้าย จึงไม่พก compiler/cache, tests หรือ dev dependencies ไปด้วย

## Build และ run ในเครื่องที่มี Docker

รันคำสั่งจาก root ของ repository (`se-sec2-team-06-main-new`) เท่านั้น เพื่อให้ Docker เห็น path `services/api/requirements.txt` และ `services/api/app/`

```bash
docker build -t synapsesync-api:v0.1.0 .
docker run --rm --name synapsesync-api \
  --publish 8000:8000 \
  synapsesync-api:v0.1.0
```

ตรวจ service จาก terminal อื่น:

```bash
curl http://127.0.0.1:8000/
curl http://127.0.0.1:8000/health
```

ผล `/health` ที่คาดหวังคือ HTTP `200` และ JSON นี้:

```json
{
  "status": "healthy",
  "service": "synapsesync-api",
  "architecture": "modular-monolith",
  "version": "0.1.0"
}
```

FastAPI OpenAPI UI อยู่ที่ <http://127.0.0.1:8000/docs> เมื่อ container กำลังทำงาน การหยุด container แบบ foreground ใช้ `Ctrl+C`; หากรันแบบ detached ให้ใช้ `docker stop synapsesync-api`

## Configuration และความปลอดภัย

health-only prototype นี้ยังไม่ต้องใช้ environment variable, database หรือ secret ใด ๆ จึงไม่ควรใส่ `.env`, token หรือ credential ลงใน image หรือในคำสั่ง build

- base image และ Python packages ใช้ version ที่ pin ไว้ ไม่ใช้ `latest`
- `.dockerignore` ตัด Git metadata, `.env`, IDE files, cache, tests, dev requirements, docs และ placeholder `services/stats-service` ออกจาก build context
- runtime ใช้ `USER appuser:appgroup` แทน root
- `EXPOSE 8000` บอก port ที่ process ฟังอยู่ ส่วนการเปิด port ให้ host ต้องทำผ่าน `--publish 8000:8000`
- `HEALTHCHECK` เรียก `http://127.0.0.1:8000/health` ทุก 30 วินาที และไม่ส่งข้อมูลลับออกไป
- image เป้าหมายต่ำกว่า 500 MB ตาม rubric; ต้องวัดด้วย `docker image inspect` หลัง build จริง ไม่เดาขนาดจาก Dockerfile

## Container เทียบกับ Virtual Machine (ESP §5.4)

| ประเด็น | Container | Virtual Machine |
| --- | --- | --- |
| Isolation | แยก process และ filesystem ด้วย host kernel | จำลองเครื่องพร้อม guest OS และ kernel ของตัวเอง |
| Startup/resource | เริ่มเร็วและใช้ทรัพยากรน้อยกว่าโดยทั่วไป | boot ช้ากว่าและใช้ memory/storage มากกว่า |
| Artifact | Image เป็น immutable template; container คือ instance ที่กำลังรัน | VM image รวม OS และ application |
| เหมาะกับงานนี้ | ส่ง FastAPI runtime ที่ทำซ้ำได้และตรวจ health ได้ | เหมาะเมื่อจำเป็นต้องแยก kernel/OS หรือ workload ต่างชนิด |

Docker image ไม่ใช่ container ที่กำลังรัน และ registry ไม่ใช่ runtime host: image ถูก build จาก Dockerfile, container สร้างจาก image, และ registry ใช้เก็บ/แจกจ่าย image

การมี container แรกไม่ได้เปลี่ยน architecture decision ของ Lab 5 เป็น Microservices เพราะการแบ่ง service ต้องมีเหตุผลด้าน boundary, deploy, scale และ operational ownership เพิ่มเติม ทีมยังคงใช้ Modular Monolith สำหรับ MVP ตาม ADR

## Registry tag — Docker Hub (verified)

Image ถูก tag และ push ขึ้น Docker Hub แล้ว โดยใช้ repository สาธารณะของผู้จัดทำ:

<https://hub.docker.com/r/thakornj/synapsesync-api/tags>

```bash
docker tag synapsesync-api:v0.1.0 thakornj/synapsesync-api:v0.1.0
docker push thakornj/synapsesync-api:v0.1.0
docker pull thakornj/synapsesync-api:v0.1.0
```

ผลการ push แสดง tag `v0.1.0`, digest และขนาด compressed image บน Docker Hub หลักฐานเก็บไว้ที่ [`docs/evidence/lab06/03-dockerhub-v0.1.0-tags.png`](../docs/evidence/lab06/03-dockerhub-v0.1.0-tags.png) และ [`docs/evidence/lab06/04-dockerhub-push-success.png`](../docs/evidence/lab06/04-dockerhub-push-success.png) ห้ามใส่ token หรือ credential ลง repository

## Verification checklist

| Check | Command/evidence | Pass condition |
| --- | --- | --- |
| API contract | `pytest services/api/tests -q` (หรือรันจาก `services/api`) | tests ของ `/` และ `/health` ผ่าน |
| Image build | `docker build -t synapsesync-api:v0.1.0 .` | exit code 0 |
| Runtime health | `curl http://127.0.0.1:8000/health` | HTTP 200, `status=healthy` |
| Non-root | `docker inspect --format '{{.Config.User}}' synapsesync-api` | `appuser:appgroup` หรือ UID/GID ที่กำหนด |
| Image size | `docker image inspect --format '{{.Size}}' synapsesync-api:v0.1.0` | ต่ำกว่า 500 MB เป้าหมาย |
| Registry push | Docker Hub tag page และ push log ใน `docs/evidence/lab06/` | public image `thakornj/synapsesync-api:v0.1.0` |

ใน environment ที่ไม่มี Docker CLI สามารถยืนยัน API contract, Python smoke check และ static diff ได้ แต่ต้องรายงานว่า image build/size/non-root runtime ยังรอการตรวจบนเครื่องที่มี Docker ห้ามเขียนรายงานว่า build สำเร็จโดยไม่มี log หรือ screenshot
