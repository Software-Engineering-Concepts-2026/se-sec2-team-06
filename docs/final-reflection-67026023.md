# Lab 15 — Final Reflection

- **ผู้จัดทำ:** Thakorn
- **รหัสนักศึกษา:** 67026023
- **โครงการ:** SynapseSync

## 1. What did you build?

ตลอดเทอมผมได้ทำงานกับ SynapseSync หลายส่วน ไม่ได้มีแค่หน้าเว็บอย่างเดียว เริ่มจากปรับ prototype ของ Quiz Generator กับ Document Library ให้หน้าตาและ flow ไปในทิศทางเดียวกัน พร้อมเพิ่ม visual regression tests ([PR #50](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/50)) จากนั้นทำเอกสาร C4/ADR เพื่ออธิบายโครงสร้างและการเลือกเทคโนโลยี ([PR #35](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/35), [PR #37](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/37)) และทำ FastAPI container ที่มี health check ([PR #52](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/52))

ต่อมาผมแยกการสร้างหน้าคำถามออกจากการ render เพื่อให้ทดสอบง่ายขึ้น ([PR #53](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/53)) แล้วต่อยอด test และ CI ในงาน Lab 9 กับ Lab 12B ([PR #67](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/67), [PR #70](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/70), [PR #71](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/71)) งานล่าสุดคือรวม Dashboard, กำหนดส่งงาน, คลังเอกสารและตัวอ่าน, คลังข้อสอบ, AI Tutor, ระบบบัญชีผู้ใช้ และการจัดเก็บไฟล์ผ่าน Supabase Storage ใน WebApp ([PR #76](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/76)) โดย PR นี้ยังเปิดรอ review และยังไม่ถือว่างานถูก merge หรือ deploy แล้ว

## 2. What problem did you solve?

ผมอยากลดการสลับไปมาระหว่างหลายหน้าเวลาจะอ่านเอกสาร ทำข้อสอบ เช็กงานที่ใกล้ถึงกำหนด หรือดูความก้าวหน้าของตัวเอง งานที่ทำกับ SynapseSync จึงพยายามรวมขั้นตอนเหล่านี้ไว้ในที่เดียว ตั้งแต่ต้นแบบใน Lab 4 จนถึง WebApp ใน PR #76 เป้าหมายคือทำให้ผู้เรียนหาสิ่งที่ต้องทำต่อได้ง่ายขึ้น ไม่ใช่แค่เพิ่มเมนูให้ครบ

## 3. What technical decision are you proudest of?

การตัดสินใจที่ผมอธิบายเหตุผลได้ชัดที่สุดคือคงระบบหลักไว้เป็น **Modular Monolith** แทนการแยกเป็นหลาย service ตั้งแต่แรก งาน C4/ADR ช่วยให้เห็นภาพระบบและเหตุผลเลือกเทคโนโลยี ([PR #35](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/35), [PR #37](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/37)) ส่วนงาน container ทำให้แนวทางนี้นำไปรันได้จริงด้วย FastAPI, multi-stage Dockerfile, non-root user และ health check ([PR #52](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/52)) สำหรับขนาดทีมและเวลาของโครงการ การ deploy เป็นหน่วยเดียวจัดการง่ายกว่า แต่ยังแบ่งส่วนในโค้ดเพื่อทดสอบและพัฒนาต่อได้

## 4. What failure taught you the most?

สิ่งที่ทำให้ผมเห็นข้อจำกัดของการทดสอบในเครื่องชัดที่สุดคือหน้าเอกสารบน local กับ Render แสดงผลไม่ตรงกัน: ในเครื่องเปิดไฟล์ตัวอย่างได้ แต่บน Render พบข้อความ `PDF could not be parsed` และรายการเอกสารที่เห็นก็ต่างกัน ตอนแรกผมคิดว่าถ้าทำงานบน local ได้ก็น่าจะใช้บนเว็บได้เหมือนกัน แต่หลักฐานที่มีไม่พอจะระบุสาเหตุว่าเป็นตัวไฟล์ ข้อมูลผู้ใช้ revision ที่ deploy หรือการตั้งค่า environment ผมจึงไม่เขียนว่าปัญหานี้แก้แล้ว

อีกบทเรียนจาก Lab 12B คือ test ที่ fail มีประโยชน์เมื่อใช้พิสูจน์ขอบเขตของระบบอย่างตั้งใจ: ใน [PR #73](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/73) ผมทำ test ให้ fail เพื่อดูว่า required check จะบล็อกการ merge หรือไม่ จากนั้นเอา test ทดลองออกและคืนชุดทดสอบใน [PR #74](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/74) ซึ่ง merge หลัง checks ผ่าน 6 รายการ งานนี้ทำให้ผมเห็นว่าควรดูสาเหตุและหลักฐานของสถานะ fail ไม่ใช่ดูแค่เครื่องหมายกากบาท

## 5. What would you do differently?

ถ้าเริ่มงานเว็บใหม่ ผมจะทดสอบเส้นทางสำคัญบนระบบที่ deploy ไปพร้อมกับการทดสอบในเครื่อง โดยใช้บัญชีและไฟล์ตัวอย่างชุดเดียวกัน: เข้าสู่ระบบ อัปโหลด PDF/Markdown เปิดอ่าน แล้ว refresh เพื่อตรวจว่าข้อมูลยังอยู่ ก่อนเปรียบเทียบผล ผมจะเช็กด้วยว่า Render ใช้ branch และ commit ไหน รวมถึงดู log เมื่อเกิดข้อผิดพลาด แล้วบันทึกผล smoke test ไว้ใน PR วิธีนี้น่าจะช่วยแยกปัญหาจากโค้ด ไฟล์ ข้อมูล และ environment ได้เร็วกว่าเดิม

## 6. How did you embody Tip 52 (Delight Users)?

ใน prototype ของ Lab 4 ผมปรับสีและ layout ให้สอดคล้องกับหน้า Home แต่คง navigation และ flow อัปโหลดเอกสาร/สร้างข้อสอบที่มีอยู่ไว้ พร้อมเพิ่ม visual regression tests ([PR #50](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/50)) ส่วน Dashboard ในงานล่าสุด ผมปรับตาม feedback ให้ตัวเลขอ่านง่ายขึ้น คงกราฟที่จำเป็น และใช้สีช่วยแยกวิชากับงานใกล้กำหนด งาน WebApp นี้อยู่ใน [PR #76](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/76) ซึ่งยังรอ review จึงยังต้องตรวจผลหลังรวมงานและ deploy อีกครั้ง

## 7. How did you embody Tip 53 (Sign Your Work)?

ผมพยายามแยกงานเป็น branch และ PR ตามขอบเขต พร้อมเขียน commit และแนบผลทดสอบให้คนอื่นตรวจได้ ตัวอย่างเช่น PR #70 บันทึกชุดทดสอบ 39 รายการและ coverage 100% ในขอบเขตที่ระบุ ส่วน PR #71 เพิ่ม test/CI safety net สำหรับ pull request งานล่าสุดผมเพิ่มวิธีเปิดเว็บที่ deploy และวิธีรัน local ไว้ใน README ([commit เว็บ](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/commit/caa539c9778466fbd13625f8b21d03360f102743), [commit README](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/commit/eb1ff2e0c1f2c9f959c40490e052ebfcf2bdc9f0)) แต่ PR #76 ยังไม่ผ่าน review และยังไม่มี deployment ของ branch นี้ ผมจึงแยกสถานะที่ทำแล้วออกจากงานที่ยังต้องตรวจต่อ

## 8. What value did this experience add to your SE journey?

พอมองย้อนจาก prototype, เอกสารสถาปัตยกรรม, container, การ refactor, test/CI จนถึง WebApp ผมเห็นชัดขึ้นว่างานไม่ได้จบตอนฟีเจอร์ทำงานบนเครื่องตัวเอง แต่ต้องคิดต่อว่าจะตรวจสอบและส่งมอบให้คนอื่นใช้ได้อย่างไร สิ่งที่ผมจะนำไปใช้กับงานถัดไปคือทำ checklist ของ flow สำคัญตั้งแต่ต้น ระบุบัญชีและข้อมูลทดสอบให้เหมือนกันทุก environment ตรวจ commit ที่ deploy แล้วบันทึกผล smoke test ไว้ใน PR ก่อนขอ review
