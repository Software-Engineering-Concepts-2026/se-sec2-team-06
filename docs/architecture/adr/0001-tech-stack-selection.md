# 0001. เลือก Technology Stack สำหรับระบบแจ้งเตือนกำหนดส่งงาน

## Status
Accepted — 19 กรกฎาคม 2026

## Context

เรากำลังพัฒนาระบบแจ้งเตือนกำหนดส่งงานสำหรับนักศึกษา ซึ่งมี requirement หลักคือ:

- ผู้ใช้ (นักศึกษา) ต้องเพิ่ม ดู แก้ไข และ mark สถานะงานได้อย่างโต้ตอบรวดเร็ว (interactive UI)
- ข้อมูลมีโครงสร้างชัดเจนและมีความสัมพันธ์ตายตัว (user → tasks → notification settings)
- ระบบต้องมี background job คอยตรวจกำหนดที่ใกล้ถึงและส่งการแจ้งเตือนผ่านหลายช่องทาง (อีเมล / LINE)
- ทีมพัฒนาเป็นนักศึกษา มีเวลาและทรัพยากรจำกัด ไม่ใช่ทีม production ขนาดใหญ่
- ระบบต้อง deploy ได้จริงภายในกรอบเวลาของโปรเจกต์ ไม่ใช่แค่รันบนเครื่อง local

เราจึงต้องตัดสินใจ 4 เรื่องหลัก: frontend, backend, database, และ deployment platform

## Decision

เราจะใช้ tech stack ดังนี้:

| ส่วนประกอบ | ตัวเลือกที่เลือก |
|---|---|
| Frontend | React (Single-Page Application) |
| Backend | Node.js + Express |
| Database | PostgreSQL (Relational / SQL) |
| Deployment | Vercel (frontend) + Render/Railway (backend + DB) |

### เหตุผล

**Frontend — React**
ระบบมีการโต้ตอบบ่อย (เพิ่ม/แก้ไข/mark done, กรอง-เรียงลำดับ upcoming tasks) SPA ให้ประสบการณ์ลื่นไหลกว่าการ reload หน้าทุกครั้ง และ ecosystem ของ React มี library ด้าน state management และ calendar UI พร้อมใช้งานจำนวนมาก

**Backend — Node.js/Express**
งานหลักคือ CRUD API และ background job (ส่งแจ้งเตือนตามเวลา) ไม่มีความต้องการด้าน data science การใช้ JavaScript ทั้ง frontend-backend ลด context-switching สำหรับทีมที่มีเวลาจำกัด และ Node จัดการงาน async ได้ดี เหมาะกับการยิง notification หลายช่องทางพร้อมกัน

**Database — PostgreSQL**
ข้อมูลมีความสัมพันธ์ตายตัว (1 user มีหลาย task, 1 task ผูกกับ notification setting) การ query เช่น "งานที่ใกล้ถึงกำหนดของ user นี้" ต้องการ filter/sort ที่แม่นยำและรักษา data integrity ซึ่ง SQL ทำได้ดีกว่า NoSQL ในบริบทนี้

**Deployment — Vercel + Render/Railway**
เป็นโปรเจกต์นักศึกษาที่เน้นเรียนรู้สถาปัตยกรรมและส่งมอบให้ทันเวลา แพลตฟอร์มเหล่านี้ deploy ได้เร็ว มี free/hobby tier และลดภาระ DevOps ทำให้ทีมโฟกัสที่ฟีเจอร์ได้มากกว่า

## Alternatives Considered

| ตัวเลือก | เหตุผลที่ไม่เลือก |
|---|---|
| Server-Side Rendering (เช่น Next.js แบบ SSR เต็มรูปแบบ) | ไม่จำเป็นสำหรับระบบ internal tool ที่ไม่เน้น SEO และเพิ่มความซับซ้อนโดยไม่จำเป็น |
| Python/Flask (backend) | เหมาะกว่าถ้ามี requirement ด้าน data science/analytics ในอนาคต แต่ปัจจุบันยังไม่ใช่ pain point หลัก |
| NoSQL (เช่น MongoDB) | เหมาะกับข้อมูลที่ไม่มีโครงสร้างตายตัวหรือต้องสเกลระดับมหาศาล ซึ่งไม่ตรงกับลักษณะข้อมูลของระบบนี้ |
| AWS / Google Cloud | ให้การควบคุมและ scalability สูงกว่า แต่ต้องใช้เวลาเรียนรู้ DevOps มากกว่าที่ scope ของโปรเจกต์นี้ต้องการ |

## Consequences

**ผลดี**
- ทีมพัฒนาเร็วขึ้นเพราะใช้ JavaScript ทั้ง stack และแพลตฟอร์ม deploy ที่ตั้งค่าน้อย
- โครงสร้างข้อมูลแบบ relational ป้องกันข้อมูลไม่สอดคล้องกัน (เช่น task ที่ไม่มีเจ้าของ)
- SPA ให้ประสบการณ์ผู้ใช้ที่ตอบสนองไว เหมาะกับการใช้งานบ่อยครั้งต่อวัน

**ผลเสีย / สิ่งที่ต้องยอมรับ**
- หากในอนาคตต้องทำ analytics เชิงลึก (เช่น วิเคราะห์พฤติกรรมการส่งงานสาย) อาจต้องเพิ่ม service แยกที่ใช้ Python แทนการเขียนทับ backend เดิม
- Vercel/Render ฟรี tier มีข้อจำกัดด้านทรัพยากรและอาจ sleep เมื่อไม่ได้ใช้งาน ซึ่งไม่เหมาะกับ production จริงในระยะยาว
- ถ้าระบบเติบโตและต้องการ scale สูง จะต้องพิจารณา migrate ไปยัง cloud provider หลักในอนาคต (ADR ฉบับใหม่จะบันทึกการตัดสินใจนั้นแยกต่างหาก)