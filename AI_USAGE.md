# AI Usage — Lab 01

## Tools used

- GitHub Copilot
- ChatGPT / Codex Generative AI assistant

AI ถูกใช้เป็นผู้ช่วยระหว่างการทำงาน ไม่ได้เป็นผู้ตัดสินใจหรือผู้เขียนประสบการณ์ส่วนตัวแทนผู้จัดทำ

## Prompts used

1. “ช่วยตรวจข้อกำหนด Lab 01 และสรุป deliverables ที่ต้องส่งให้ครบตาม rubric”
2. “ช่วยตรวจโครงสร้างไฟล์ `team/Thakorn.md` ว่าครบ 4 sections และอยู่ในช่วง 200–500 คำหรือไม่”
3. “ช่วยตรวจภาษาและรูปแบบ `AI_USAGE.md` โดยคงความหมายและเสียงการเขียนของผู้จัดทำไว้”

## Direct AI-generated content

งานส่วนใหญ่ใน submission นี้จัดทำและตัดสินใจโดย Thakorn โดยใช้ AI เป็นผู้ช่วยในด้านต่อไปนี้:

- ตรวจความเข้าใจโจทย์และ checklist ของ Lab 01
- เสนอแนวทางจัดลำดับหัวข้อและรูปแบบ Markdown
- ช่วยตรวจภาษา การสะกด และความสอดคล้องของเอกสาร
- ช่วยตรวจ branch, file path, commit message และขั้นตอน Pull Request

เนื้อหา Identification, Pragmatic Promise, เหตุผลที่อยากเรียน SE และ Broken Window เป็นข้อมูลของ Thakorn ซึ่งผู้จัดทำเป็นผู้เลือก ตรวจสอบ และรับผิดชอบก่อนส่งงาน AI ไม่ได้สร้างประสบการณ์ส่วนตัวหรือการตัดสินใจแทนผู้จัดทำ

## Lab 1 — First Pragmatic Commit Usage

### Tools and tasks

- อ่านและทำความเข้าใจใบงานด้วยตนเอง แล้วใช้ ChatGPT/Codex ช่วยตรวจว่ารายการส่งงานไม่ตกหล่น
- ใช้ข้อมูลทีมและข้อมูลส่วนตัวที่มีอยู่จริงมาเขียน `team/Thakorn.md`
- ใช้ AI ช่วยตรวจความครบถ้วนของ Identification, Pragmatic Promise, เหตุผลที่อยากเรียน SE และ Broken Window
- ใช้ AI ช่วยตรวจจำนวนคำและรูปแบบ headings หลังจากเขียนเนื้อหาหลักแล้ว
- ผู้จัดทำเป็นผู้เลือกว่าจะรับหรือแก้คำแนะนำของ AI ทุกจุด

### Team verification and responsibility

- Thakorn เป็นผู้รับผิดชอบเนื้อหาและตรวจสอบชื่อเล่น เหตุผลที่อยากเรียน Software Engineering และประสบการณ์ Broken Window ด้วยตนเอง
- Pragmatic Promise ต้องสะท้อนพฤติกรรมที่ Thakorn ตั้งใจทำจริง ไม่ใช่ข้อความที่ AI แต่งขึ้นเพื่อส่งแทน
- ทีมเป็นผู้ตรวจเนื้อหา ความถูกต้องของ README, branch, commit message, Pull Request และ reviewer ก่อน merge
- ไม่มีการนำเนื้อหาจากไฟล์หรือโฟลเดอร์ที่เป็นงานของ Chaiwat และ shuwichada มาใช้หรือแก้ไข
- ไม่ส่งรหัสผ่าน ข้อมูลบัญชี secret หรือข้อมูลส่วนบุคคลของสมาชิกคนอื่นเข้าไปใน prompt

### Verification status

- Branch: `feature/lab1-intro-Thakorn` สร้างจาก `origin/main`
- `team/Thakorn.md` มี 4 sections และความยาวอยู่ในช่วง 200–500 คำ
- README มีคำอธิบายโปรเจกต์ รายชื่อสมาชิก และ Theme แล้ว
- ก่อนส่งงานยังต้อง commit ด้วย Conventional Commits, push branch, เปิด Pull Request, tag reviewer, ผ่าน review, merge เข้า `main` และย้าย Project Board ไป `Done`
