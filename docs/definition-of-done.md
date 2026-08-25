# Definition of Done — SynapseSync

เกณฑ์สำหรับตรวจ Product Backlog Item หรือ User Story ของ Lab 2 ก่อนย้ายเป็น `Done`:

- [ ] ผลลัพธ์ตรงกับ User Story และ Acceptance Criteria ที่ทีมอนุมัติ โดยไม่มี acceptance criterion ที่ยังไม่ผ่าน
- [ ] ไม่มี placeholder, secret, credential หรือข้อมูลส่วนบุคคลจริงอยู่ใน source code, เอกสาร หรือภาพประกอบ
- [ ] ผู้พัฒนาทดสอบ happy path และ edge cases ที่ระบุไว้ พร้อมบันทึกผลหรือหลักฐานที่ตรวจสอบย้อนหลังได้
- [ ] Automated checks ที่เกี่ยวข้อง เช่น test, lint หรือ validation ผ่านทั้งหมด หรือบันทึกข้อจำกัดพร้อมเหตุผลที่ทีมยอมรับ
- [ ] มีสมาชิกทีมอย่างน้อย 1 คน review การเปลี่ยนแปลง และข้อคิดเห็นที่เป็น blocker ได้รับการแก้ไขแล้ว
- [ ] เอกสาร Requirement, Prototype หรือ Architecture ที่ได้รับผลกระทบถูกปรับให้สอดคล้องกัน และ link ภายใน repository ใช้งานได้
- [ ] การใช้ AI ถูกเปิดเผยใน `AI_USAGE.md` หรือ PR description โดยระบุเครื่องมือ ลักษณะ prompt และส่วนที่นำมาใช้
- [ ] การเปลี่ยนแปลงอยู่ใน branch ที่เหมาะสมและเข้าสู่ branch เป้าหมายผ่าน Pull Request ไม่ push ตรงเข้า `main`
- [ ] ไม่มีการเพิ่ม feature นอก MoSCoW scope โดยไม่ได้รับการตกลงจากทีม
- [ ] สมาชิกทีมสามารถอธิบายสิ่งที่ส่งมอบ วิธีตรวจสอบ และข้อจำกัดที่ยังเหลืออยู่ได้

> ทีมต้องอ่านทบทวนและปรับ checklist ให้ตรงกับ workflow ที่ใช้งานจริงก่อนนำเข้า repository
