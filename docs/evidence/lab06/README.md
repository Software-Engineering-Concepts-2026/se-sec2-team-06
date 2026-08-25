# Lab 6 Evidence

ภาพหลักฐานของ Lab 6 ที่เก็บไว้ในโฟลเดอร์นี้:

- `01-docker-build-image-inspect.png` — build image สำเร็จ, tag `synapsesync-api:v0.1.0`, ขนาด image และผล inspect runtime
- `02-docker-runtime-health.png` — การ run container และตรวจ `/health`; ภาพนี้มีบันทึกการลอง build จากโฟลเดอร์ผิดก่อนหน้า จึงใช้เป็น runtime evidence ไม่ใช่ภาพ build หลัก
- `03-dockerhub-v0.1.0-tags.png` — Docker Hub repository `thakornj/synapsesync-api` พร้อม tag `v0.1.0`, digest และ compressed size
- `04-dockerhub-push-success.png` — ผล `docker push` สำเร็จ พร้อม digest ของ image และ tag `v0.1.0`

ภาพ `docker login` ที่มี one-time device code ไม่ถูกเก็บหรือ commit เพื่อป้องกันข้อมูลยืนยันตัวตนรั่วไหล ควรแนบภาพ registry และผล verification ที่ไม่มี credential ใน Pull Request เท่านั้น
