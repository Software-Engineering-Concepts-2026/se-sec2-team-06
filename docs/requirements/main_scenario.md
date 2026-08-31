# Main Scenario: แอปการเรียนที่มีตัวช่วย AI

**Persona หลัก:** ปันปัน (ปาริชาติ) — ดู [student_learner.md](./personas/student_learner.md)<br>
**เอกสาร scenarios ฉบับขยาย:** [scenarios.md](./scenarios.md)<br>
**เอกสาร user stories ฉบับ canonical:** [user-stories.md](./user-stories.md)

---

## เรื่องเล่าหลัก

ปันปันกำลังทบทวนเรื่อง “โมเมนตัมและการชน” ก่อนสอบฟิสิกส์ในอีกสามวัน เธอลองทำโจทย์ท้ายบทแล้วติดอยู่ที่การชนแบบไม่ยืดหยุ่น จึงพิมพ์คำถามลงใน SynapseSync แทนการค้นหาคลิปหลายแหล่ง ระบบตรวจว่าบริบทยังไม่พอและถามกลับว่าเธอติดที่นิยาม สูตร หรือการประยุกต์ใช้ เมื่อเธอเติมบริบท ระบบอธิบายทีละขั้นพร้อมตัวอย่างที่ใกล้กับโจทย์เดิม

เมื่อเข้าใจแนวคิดแล้ว ปันปันขอแบบฝึกหัดที่สัมพันธ์กับหัวข้อ ระบบสร้างโจทย์ให้ทำและตรวจคำตอบทีละข้อ หลังส่งคำตอบครบ ระบบบันทึกหัวข้อ เวลา และผลการฝึกไว้ในประวัติ เพื่อให้เธอกลับมาทบทวนได้ก่อนสอบ หากบริการ AI ไม่พร้อม ระบบเก็บคำถามเดิมไว้และแจ้งให้ลองใหม่โดยไม่แสดงคำตอบที่ไม่สมบูรณ์

ในฝั่งครูสมชาย Dashboard แสดงเฉพาะสรุปของกลุ่มที่เขารับผิดชอบ พร้อม timestamp ของการ sync ครูใช้แนวโน้มการติดขัดและผลการฝึกเพื่อวางแผนสอนเสริม โดยไม่เห็นข้อมูลส่วนตัวเกินสิทธิ์ ส่วนพี่เอิร์ธซึ่งมีเวลาตามตารางกะ สามารถตั้ง Reminder เปิดดู Progress และกลับไปทำแบบฝึกหัดต่อจากจุดเดิมได้

---

## Traceability: GitHub Issue → User Story → Scenario

ตารางนี้จัดตาม Issue ที่สร้างจริงบน GitHub เพื่อให้เปิดจาก Issue ไปยัง Story และ Scenario ต้นทางได้ทันที

| GitHub Issue | User Story | Scenario ต้นทาง | ขอบเขต / edge case |
|---|---|---|---|
| [#43](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/43) | [US-01](./user-stories.md#us-01--ถามคำถามเมื่อไม่เข้าใจ) | [S-01](./scenarios.md#s-01--แยกจุดที่ไม่เข้าใจก่อนอธิบาย) | คำถามว่างและบริการ AI ไม่พร้อมต้องไม่ทำให้ข้อความสูญหาย |
| [#60](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/60) | [US-02](./user-stories.md#us-02--ระบุ-learning-gap-ก่อนอธิบาย) | [S-01](./scenarios.md#s-01--แยกจุดที่ไม่เข้าใจก่อนอธิบาย) | คำถามกำกวมต้องถามกลับก่อนอธิบาย |
| [#44](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/44) | [US-03](./user-stories.md#us-03--สร้างแบบฝึกหัดที่สัมพันธ์กับหัวข้อ) | [S-02](./scenarios.md#s-02--ฝึกโจทย์และบันทึกความเข้าใจ) | สร้างโจทย์ที่สัมพันธ์กับหัวข้อและแจ้งเมื่อ provider ล้มเหลว |
| [#45](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/45) | [US-04](./user-stories.md#us-04--บันทึกผลการฝึก) | [S-02](./scenarios.md#s-02--ฝึกโจทย์และบันทึกความเข้าใจ) | งานที่ยังส่งไม่ครบต้องไม่ถูกบันทึกเป็นผลสำเร็จ |
| [#46](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/46) | [US-05](./user-stories.md#us-05--ดูหัวข้อที่นักเรียนติดขัด) | [S-04](./scenarios.md#s-04--ครูค้นหาหัวข้อที่นักเรียนติดขัด) | Dashboard ต้องมี filter และ empty state ของกลุ่มเรียน |
| [#61](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/61) | [US-06](./user-stories.md#us-06--ตรวจความสดใหม่และสิทธิ์ของข้อมูล) | [S-05](./scenarios.md#s-05--ครูตรวจความสดใหม่และสิทธิ์ข้อมูล) | แสดง timestamp และปฏิเสธ 401/403 เมื่อไม่มีสิทธิ์ |
| [#65](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/65) | [US-10](./user-stories.md#us-10--วางแผนสอนเสริมจากหลักฐาน) | [S-06](./scenarios.md#s-06--ครูวางแผนสอนเสริมจากหลักฐาน) | ใช้แนวโน้มและหลักฐานโดยไม่สรุปเกินข้อมูล |
| [#62](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/62) | [US-07](./user-stories.md#us-07--รับ-reminder-เพื่อกลับมาทบทวน) | [S-07](./scenarios.md#s-07--ผู้เรียนวัยทำงานกลับมาเรียนจาก-reminder) | ตั้งเวลา เปิด/ปิด และกลับไปยังจุดที่ค้าง |
| [#63](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/63) | [US-08](./user-stories.md#us-08--ดูภาพรวมความก้าวหน้า) | [S-08](./scenarios.md#s-08--ผู้เรียนเปิด-progress-โดยยังไม่มีประวัติ) | แยก empty state ออกจากคะแนนศูนย์ |
| [#64](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/issues/64) | [US-09](./user-stories.md#us-09--ทำแบบฝึกหัดต่อหลังถูกขัดจังหวะ) | [S-09](./scenarios.md#s-09--ผู้เรียนทำต่อหลังถูกขัดจังหวะ) | บันทึกสถานะค้างและไม่สร้างผลสำเร็จซ้ำ |

> Persona ผู้ปกครองใน [`personas.md`](./personas.md) เป็น supporting research artifact สำหรับ consent/privacy เท่านั้น จึงยังไม่ถูกนับเป็น User Story ของ MVP ใน Lab 03 จนกว่าทีมจะอนุมัติขอบเขตดังกล่าว
