# Personas — SynapseSync

เอกสารนี้เป็นรายการ Persona หลักสำหรับ Lab 03 ส่วนรายละเอียดเชิงลึกและภาพประกอบแยกเก็บในโฟลเดอร์ [`personas/`](./personas/) เพื่อให้แก้ไขแต่ละ Persona ได้โดยไม่ทำให้ไฟล์หลักยาวเกินไป

## Persona 1 — ปันปัน: Student Learner

- **Personalization:** นักเรียนชั้น ม.5 อายุ 16 ปี เรียนสายวิทย์–คณิตและใช้สมาร์ทโฟนเป็นอุปกรณ์หลัก
- **Job / Role:** เรียนในโรงเรียนและทบทวนบทเรียนด้วยตนเองนอกเวลา
- **Education:** กำลังเรียนระดับมัธยมปลาย ต้องใช้ฟิสิกส์และคณิตศาสตร์เพื่อเตรียมสอบเข้ามหาวิทยาลัย
- **Relevance:** เป็นผู้ใช้หลักของ flow ถามคำถาม รับคำอธิบาย ฝึกโจทย์ และติดตามความเข้าใจ
- **Frequency of Use:** คาดว่าใช้หลายครั้งต่อสัปดาห์ โดยเฉพาะช่วงทำการบ้านและก่อนสอบ

รายละเอียด: [`personas/student_learner.md`](./personas/student_learner.md)

## Persona 2 — ครูสมชาย: Teacher Mentor

- **Personalization:** ครูมัธยมอายุ 42 ปี มีประสบการณ์สอน 15 ปีและดูแลนักเรียนมากกว่า 120 คน
- **Job / Role:** สอน ติดตามผล และจัดสรรเวลาช่วยเหลือนักเรียนที่มีปัญหา
- **Education:** มีความรู้ด้านการสอนคณิตศาสตร์และคุ้นเคยกับ Google Classroom แต่ไม่ต้องการเครื่องมือที่ซับซ้อน
- **Relevance:** ต้องการข้อมูลสรุปเพื่อค้นหาหัวข้อและนักเรียนที่ต้องได้รับความช่วยเหลือ โดยไม่ตรวจข้อมูลทีละคน
- **Frequency of Use:** คาดว่าเปิดดู dashboard สัปดาห์ละ 2–3 ครั้งและก่อนวางแผนสอนเสริม

รายละเอียด: [`personas/teacher_mentor.md`](./personas/teacher_mentor.md)

## Persona 3 — พี่เอิร์ธ: Adult Learner

- **Personalization:** ผู้เรียนวัยทำงานอายุ 29 ปี ทำงานเป็นกะและมีเวลาเรียนไม่แน่นอน
- **Job / Role:** ทำงานฝ่ายผลิตพร้อมเรียนคอร์สออนไลน์เพื่อเตรียมเปลี่ยนสายงาน
- **Education:** เรียนรู้ทักษะด้านข้อมูลและดิจิทัลด้วยตนเองนอกเวลางาน
- **Relevance:** ต้องการการทบทวนที่ยืดหยุ่น การเตือน และภาพความก้าวหน้าที่ช่วยให้กลับมาเรียนต่อได้
- **Frequency of Use:** ใช้ตามตารางกะ ประมาณ 1–4 ครั้งต่อสัปดาห์ และอาจเว้นช่วงเมื่อภาระงานสูง

รายละเอียด: [`personas/adult_learner.md`](./personas/adult_learner.md)

## Supporting Research Artifact

มี Persona ผู้ปกครองเป็นข้อมูลประกอบสำหรับศึกษาความต้องการด้านการแจ้งเตือนและ consent ใน [`personas/parent_guardian.md`](./personas/parent_guardian.md) แต่ยังไม่รวมเป็นหนึ่งใน 3 Persona หลักของ Lab 03 เพื่อควบคุม MVP และป้องกัน feature creep

## Traceability

- Scenario หลัก: [`main_scenario.md`](./main_scenario.md)
- Functional และ non-functional requirements: [`srs.md`](./srs.md)
- Measurable NFRs: [`nfr.md`](./nfr.md)
