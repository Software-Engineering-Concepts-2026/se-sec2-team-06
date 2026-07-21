# เตรียมตอบคำถามอาจารย์: ทำไมถึงเลือกเครื่องมือและสถาปัตยกรรมนี้

เอกสารนี้รวมคำถามที่อาจารย์น่าจะถามเกี่ยวกับ `README.md` และ `ADR-001` ของโปรเจกต์ SynapseSync พร้อมแนวคำตอบที่อิงจากเหตุผลที่บันทึกไว้ในทั้งสองไฟล์ ใช้เป็น cheat sheet ก่อนนำเสนอหรือสอบปากเปล่า

---

## หมวด 1: ทำไมใช้ draw.io (เครื่องมือทำไดอะแกรม)

**Q: ทำไมไม่ใช้ Mermaid เหมือนเดิม แล้วเปลี่ยนมาใช้ draw.io ทำไม?**
เดิมทีมใช้ Mermaid CLI (`mmdc`) แต่เปลี่ยนมาใช้ draw.io เพราะไดอะแกรม C4 มี Actor ถึง 4 Persona (ปันปัน, ครูสมชาย, พี่เอิร์ธ, คุณแม่มล) ทำให้การจัดวาง layout ด้วย syntax ของ Mermaid เริ่มไม่ยืดหยุ่นพอ — จัดตำแหน่งกล่อง/เส้นให้อ่านง่ายได้ยากเมื่อจำนวน node เยอะขึ้น draw.io เป็น GUI แบบลากวาง จึงควบคุม layout ได้ละเอียดกว่า

**Q: ถ้าจะกลับไปใช้ Mermaid ต้องทำยังไง มีกระบวนการตัดสินใจไหม?**
ทีมกำหนดไว้ว่าการเปลี่ยนเครื่องมือ (เช่น กลับไปใช้ Mermaid) ต้องเขียน ADR ใหม่บันทึกเหตุผลไว้เสมอ — สะท้อนหลักการว่าการตัดสินใจทางสถาปัตยกรรมทุกครั้งต้องมีร่องรอยที่ตรวจสอบย้อนหลังได้ ไม่ใช่เปลี่ยนเงียบๆ

**Q: ทำไมต้องเก็บทั้งไฟล์ `.xml` (source) และ `.png` (export) คู่กัน?**
เพื่อให้เป็นไปตามหลัก "Documentation as Code" — ไฟล์ `.png` คือภาพที่แสดงผล แต่ `.xml` คือ source ที่แก้ไข/regenerate ได้ ถ้าเก็บแค่ `.png` การแก้ไขในอนาคตจะทำไม่ได้เลยนอกจากวาดใหม่ทั้งหมด การเก็บคู่กันทำให้ diagram อัปเดตตามโค้ด/สถาปัตยกรรมจริงได้เสมอ เหมือนที่เคยทำกับ Mermaid มาก่อน

---

## หมวด 2: ทำไมใช้ C4 Model (ไม่ใช้ไดอะแกรมแบบอื่น)

**Q: ทำไมมีแค่ Level 1 กับ Level 2 ทำไมไม่ทำ Level 3 (Component) หรือ Level 4 (Code)?**
Level 1 (System Context) และ Level 2 (Container) เพียงพอสำหรับสื่อสารกับผู้ฟังหลากหลายกลุ่มในสโคปของวิชานี้ — Level 1 เหมาะกับผู้ฟังที่ไม่ใช่นักเทคนิค (เห็นภาพรวมว่าระบบพึ่งพาอะไรบ้าง) ส่วน Level 2 เหมาะกับ developer/architect ที่ต้องเข้าใจ runtime topology ถ้าอาจารย์ถามควรตอบตามความจริงว่าโปรเจกต์ยังไม่ได้ทำ Level 3-4 เพราะยังอยู่ในช่วงออกแบบสถาปัตยกรรมภาพรวม ยังไม่ได้ลงรายละเอียดระดับ component ภายในแต่ละ container

**Q: Cloud Object Storage ทำไมไม่ปรากฏเป็น External System ใน Level 1 แต่ไปโผล่ใน Level 2?**
เพราะ Object Storage เป็น Infrastructure ที่ทีมเป็นผู้ deploy/config เอง ไม่ใช่ระบบภายนอกที่มีเจ้าของแยกต่างหาก (ต่างจาก LLM Provider ที่เป็นของ OpenAI/Anthropic หรือ LMS ที่เป็นของมหาวิทยาลัย) ตามหลัก C4 มาตรฐาน สิ่งที่ทีม deploy เองจะถูกจัดเป็น Container ภายใน system boundary ไม่ใช่ External System

**Q: ทำไมผู้ใช้ทั้ง 4 Persona ถึงติดต่อกับ Web Application ตัวเดียว ไม่แยกแอปตาม role?**
เพราะทีมออกแบบ Access Control เป็น RBAC (Role-based Access Control) ผ่าน JWT ที่มี role claim (`student`/`teacher`/`parent`) — SPA ตัวเดียวสามารถ decode role จาก token แล้ว render UI ต่างกันตาม role ได้ (เช่น ครูเห็นแดชบอร์ด, ผู้ปกครองเห็นหน้าสรุป) การแยก Service ตาม Role จะเพิ่ม operational overhead เกินความจำเป็นสำหรับทีมนักศึกษาที่มี timeline จำกัดเพียง 14 สัปดาห์

---

## หมวด 3: ทำไมเลือกสถาปัตยกรรมแบบ 2-tier นี้

**Q: ทำไมไม่ใช้ Next.js (full-stack framework) ให้ Frontend/Backend อยู่ codebase เดียว จะได้ deploy ง่ายกว่า?**
ทีมพิจารณาแล้วปฏิเสธด้วย 4 เหตุผลหลัก: (1) ทีมมี Python service (`stats-service`) อยู่แล้ว การใช้ Next.js จะทำให้ต้อง maintain ทั้ง TypeScript และ Python พร้อมกัน (2) ฟีเจอร์ AI และ PDF processing มี library ที่ดีกว่าในฝั่ง Python เช่น PyPDF2, langchain (3) Serverless function ของ Next.js มี timeout จำกัด ไม่เหมาะกับ LLM call ที่อาจใช้เวลานาน (4) ทีมไม่มีประสบการณ์ Next.js มาก่อน

**Q: ข้อเสียของการแยก Frontend (Vercel) กับ Backend (Render/Railway) คนละที่คืออะไร?**
ตอบตรงๆ ตามที่ ADR ระบุไว้ในผลกระทบเชิงลบ: ต้องจัดการ deployment 2 จุดแยกกัน เพิ่มพื้นที่ให้เกิด config drift และปัญหา CORS, cookie ใช้ `Secure; SameSite=Strict` ไม่ได้ตรงๆ เพราะ domain ต่างกัน (`vercel.app` เรียก `onrender.com`) จึงต้องใช้ JWT เก็บใน localStorage ซึ่งเสี่ยงต่อ XSS มากกว่า cookie แบบปลอดภัย

**Q: ทำไมเลือก React แทนที่จะแก้ HTML/CSS/JS แบบเดิมที่มีอยู่แล้วต่อไป?**
prototype เดิมมีปัญหาโค้ดซ้ำซ้อน — header, footer, form ต้อง copy ไปทุกไฟล์ (`login.html`, `home.html`, `register.html` ฯลฯ) แก้ทีต้องแก้หลายที่ React ใช้ Component Model แก้ปัญหานี้ได้ (ลดโค้ดซ้ำได้กว่า 60%) แถมมี React Router จัดการหลายหน้าที่ต้องเปลี่ยนสถานะ (Login → Home → Quiz → Result → To-do) ได้สะอาดกว่า และ ecosystem ใหญ่พอสำหรับ UI ที่หลากหลาย (กราฟ, chat interface)

**Q: ทำไมเลือก FastAPI เป็นค่าเริ่มต้นแทนที่จะใช้ Flask ไปเลยทั้งที่เขียนง่ายกว่า?**
FastAPI ให้ 3 อย่างที่ Flask ไม่มีมาให้ฟรี: (1) Auto-generate Swagger docs ที่ `/docs` ทำให้ทีม Frontend เห็น API contract ได้ทันทีโดยไม่ต้องเขียนเอกสารแยก — สำคัญมากเพราะทีมแบ่งงานคู่ขนาน (2) Pydantic validation ทำให้ request/response schema ตรวจสอบได้จริง ลดปัญหา "ส่งข้อมูลไม่ตรง schema แล้วแอปพังตอน runtime" (3) Type hints ช่วยให้ AI coding assistant (Copilot/ChatGPT ที่ทีมใช้อยู่แล้ว) ช่วยเขียนโค้ดได้แม่นยำกว่า อย่างไรก็ตาม Flask ยังเก็บไว้เป็นทางเลือกสำรองหากทีมประเมินว่า async/Pydantic learning curve กระทบ timeline มากเกินไป — ทีมจะตัดสินใจจริงหลังทำ POC endpoint แรกในสัปดาห์ที่ 6

**Q: ทำไมเลือก PostgreSQL แทน MongoDB ทั้งที่มี AI-generated content ที่ schema ไม่แน่นอน?**
เหตุผลหลักคือข้อมูลส่วนใหญ่เป็น relational ชัดเจน (User → Quiz → Question → Choice → Attempt เป็น one-to-many หลายชั้น) การ JOIN แบบ "คะแนน quiz ของ user คนนี้ใน course นี้" ทำง่ายด้วย SQL แต่ยากใน MongoDB ส่วนข้อมูลที่ schema ไม่แน่นอน เช่น options ของคำถามที่ AI generate หรือ metadata ของ LLM response ก็ใช้ `JSONB` column ของ PostgreSQL รองรับได้อยู่แล้ว โดยไม่ต้องแยก DB สองตัว — และทีมต้องการฝึก SQL เป็น learning outcome ของวิชาด้วย

**Q: ทำไมไฟล์ PDF/DOCX ไม่เก็บใน PostgreSQL เลยแต่ต้องแยกไป Object Storage?**
เพราะไฟล์เป็น binary blob ขนาดใหญ่ ถ้าเก็บใน relational database โดยตรงจะทำให้ database บวมและ backup ช้า จึงแยกเก็บใน S3-compatible storage (Cloudflare R2 หรือ AWS S3) ซึ่งเป็น de facto standard ของวงการ ใช้ `boto3` เรียกจาก Python ได้ และเปลี่ยน provider ได้โดยไม่ต้องแก้โค้ด เพราะใช้ S3 API มาตรฐาน

---

## หมวด 4: ทำไมต้องมี External Integration (LMS และ Notification)

**Q: ทำไมต้องเชื่อมกับ LMS ของมหาวิทยาลัย (Moodle) ทำไมไม่ให้ผู้ใช้พิมพ์ชื่อวิชาเอง?**
ถ้าให้ผู้ใช้พิมพ์เอง เสี่ยงพิมพ์ผิดหรือใช้ชื่อไม่สม่ำเสมอ ทำให้ข้อมูลไม่สะอาดในระยะยาว และระบบ AI Quiz Generator จะแนะนำ/จัดกลุ่มเนื้อหาตามวิชาไม่ได้อัตโนมัติ การดึงจาก LMS ทำให้ auto-tag เอกสารถูกต้องตั้งแต่ต้น ลดภาระผู้ใช้ และเพิ่มความแม่นยำของ prompt ที่ส่งให้ LLM — แต่ทีมจำกัดขอบเขตไว้แค่ **Read-only** (ดึง course catalog และรายวิชาที่ลงทะเบียน) ยังไม่เขียนข้อมูลกลับไปที่ LMS เพื่อลดความเสี่ยงเรื่อง permission

**Q: ถ้าขอสิทธิ์เข้าถึง Moodle API จากมหาวิทยาลัยไม่ทันจะทำยังไง?**
ทีมมีแผนสำรองคือ fallback ไปใช้ manual tagging (ผู้ใช้กรอกชื่อวิชาเอง) ชั่วคราวสำหรับ demo แล้วค่อยเปลี่ยนกลับมาใช้ LMS integration ภายหลัง — นี่คือเหตุผลที่ทีมพิจารณา "Manual Course Tagging" เป็นทางเลือกที่ปฏิเสธไม่ใช้เป็นหลัก แต่เก็บไว้เป็นแผนสำรอง ไม่ใช่ทิ้งไปเลย

**Q: ทำไมต้องมี Notification Service ภายนอก ทำไมแจ้งเตือนในแอปอย่างเดียวไม่พอ?**
เพราะ Persona พี่เอิร์ธ (ผู้เรียนผู้ใหญ่ เวลาเรียนไม่แน่นอน) และคุณแม่มล (ผู้ปกครอง ไม่ได้เปิดแอปเรียนเอง) มีพฤติกรรมไม่ได้เปิดแอปทุกวัน ถ้าแจ้งเตือนแค่ใน UI ตอนเปิดแอป ฟีเจอร์ reminder/alert ที่ทั้งสอง Persona ต้องการจะไม่ถึงพวกเขาเลย จึงต้องมีช่องทางนอกแอป เช่น email (ผ่าน Resend) หรือ push (ผ่าน Firebase Cloud Messaging) — ส่วนผู้ใช้ที่เปิดแอปอยู่แล้ว (ปันปัน, ครูสมชาย) ยังคงเห็นแจ้งเตือนในแอปควบคู่ไปด้วย เพื่อลดต้นทุนการส่ง email/push โดยไม่จำเป็น

**Q: ทำไม Notification Service ถึงเรียกแบบ asynchronous ไม่ใช่ synchronous?**
เพื่อ decouple จาก core flow — ถ้า Resend หรือ FCM ล่มหรือช้า จะไม่กระทบฟีเจอร์หลักอย่าง login หรือ quiz generation เพราะเรียกแบบ best-effort ไม่ block response หลักของ API แลกมาด้วยความเสี่ยงว่าแจ้งเตือนอาจล่าช้าหรือไม่ถึงผู้ใช้ ซึ่งทีมวางแผนจะ log สถานะการส่งไว้ debug และอาจทำ retry mechanism เบื้องต้น

---

## หมวด 5: Access Control และความเป็นส่วนตัว

**Q: ทำไมใช้ RBAC แบบ JWT แทนที่จะแยก authentication service ต่างหาก?**
เพราะ scope ของโปรเจกต์วิชาเรียนไม่จำเป็นต้องซับซ้อนขนาดนั้น — ฝัง role claim (`student`/`teacher`/`parent`) ไว้ใน JWT แล้วเช็กสิทธิ์ที่ endpoint level ผ่าน FastAPI dependency ทำได้เร็วกว่า และยัง testable อยู่ การแยก microservice ตาม role จะเพิ่ม operational overhead เกินความจำเป็นสำหรับทีมที่มี timeline จำกัด

**Q: การผูกบัญชีผู้ปกครอง-นักเรียน (Parent-Child Linking) ออกแบบยังไง แล้วเกี่ยวกับความเป็นส่วนตัวยังไง?**
ทีมเก็บความสัมพันธ์นี้เป็นตารางแยกใน PostgreSQL (`parent_student_links`) และออกแบบ consent flow ให้ **นักเรียนเป็นผู้ยินยอมผูกบัญชีเอง** ไม่ใช่ผู้ปกครองผูกได้เองฝ่ายเดียว — เพราะปันปันอายุ 16 ปี ถือเป็นผู้เยาว์ ต้องระวังเรื่องข้อมูลส่วนบุคคลเป็นพิเศษ นี่คือจุดที่อาจารย์น่าจะถามเรื่อง privacy/consent design ควรเน้นย้ำว่าทีมคิดเรื่องนี้ไว้ตั้งแต่ระดับ ADR ไม่ใช่แค่ implement ทีหลัง

---

## หมวด 6: เอกสารและ Governance

**Q: ทำไมต้องเขียน ADR แยกจาก README ทำไมไม่รวมเป็นไฟล์เดียว?**
README ให้ภาพรวมสถาปัตยกรรม ("คืออะไร") ส่วน ADR บันทึก "ทำไม" ของการตัดสินใจสำคัญแต่ละเรื่องแบบละเอียด รวมถึงทางเลือกที่ถูกปฏิเสธและเหตุผล — แยกกันเพื่อให้ README อ่านง่ายเป็นภาพรวม ในขณะที่ ADR เป็นเอกสารที่ไม่เปลี่ยนแปลงเมื่อ Accepted แล้ว (ถ้าตัดสินใจเปลี่ยนต้องเขียน ADR ใหม่ที่ supersede ตัวเดิม แทนที่จะแก้ของเดิม) ทำให้มี audit trail ของการตัดสินใจตลอดโปรเจกต์

**Q: ทำไม ADR ต้องมีทั้งผลกระทบเชิงบวกและเชิงลบ ไม่ใช่แค่บอกว่าทำไมถึงเลือก?**
เพื่อหลีกเลี่ยง ADR ที่มองแค่ด้านเดียว (biased) — การบันทึกทั้ง trade-off ทำให้ maintainer ในอนาคต (หรือทีมเองตอนย้อนมาอ่าน) เข้าใจว่าทำไมถึงยอมรับข้อเสียบางอย่าง เช่น cold start บน free tier หรือ CORS complexity เพื่อแลกกับความเร็วในการพัฒนาและต้นทุนที่ต่ำ

**Q: ทำไมชื่อในแผนภาพและ ADR ต้องเป็น "ชื่อนามธรรม" เช่น "LLM Provider API" ไม่ระบุชื่อจริง?**
เป็นไปตามแนวทาง Security & Governance ของโปรเจกต์ — ป้องกันไม่ให้ hostname, IP, ชื่อ bucket จริง หรือ account identifier หลุดเข้า repository ที่เป็น public/shared ค่าการเชื่อมต่อจริง (API keys, database URLs) ถูกจัดการผ่าน GitHub Secrets และ inject ตอน deploy เท่านั้น ทุก PR ที่แก้โฟลเดอร์นี้จะถูก review หา secret leak ด้วยความเข้มข้นเดียวกับ code review

---

## หมวด 7: คำถามเชิงวิจารณ์ที่ควรเตรียมใจตอบ

คำถามกลุ่มนี้อาจารย์มักถามเพื่อทดสอบว่าเข้าใจ trade-off จริงหรือท่องมาตอบ — ควรตอบตรงๆ ตามข้อเสียที่ ADR ระบุไว้ ไม่ต้องกลัวพูดถึงจุดอ่อน:

- **"ถ้า LLM API แพงขึ้นหรือ credit หมดจะทำยังไง"** → ทีมวางแผน enforce per-user rate limit และ daily token budget ใน backend เพราะ pricing เป็นแบบ per-token
- **"ทำไมไม่กังวลเรื่อง latency ของ backend ที่อยู่ region เดียว (US-East)"** → ยอมรับได้สำหรับโปรเจกต์วิชาเรียน แต่ต้องประเมินใหม่หากจะ launch จริง
- **"เก็บ JWT ใน localStorage ไม่เสี่ยง XSS เหรอ"** → เสี่ยงกว่า cookie แบบ `Secure; SameSite=Strict` จริง แต่เป็น trade-off ที่ยอมรับเพื่อแลกกับการ deploy Frontend/Backend คนละ domain ได้ง่าย
- **"ทำไมไม่ใช้ Next.js ทั้งที่ deploy ง่ายกว่าเห็นๆ"** → ตอบด้วย 4 เหตุผลในหมวด 3 (เน้นเรื่อง Python ecosystem สำหรับ AI/PDF และ Serverless timeout ที่ไม่เหมาะกับ LLM call)
