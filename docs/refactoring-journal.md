# Refactoring Journal — Lab 7

## Scope

- Branch: `feature/lab7-refactor-render-question`
- Owner: Thakorn
- Target: `prototypes/sprint1/Thakorn/`
- Goal: ลดความซับซ้อนของการ render คำถามโดยคง flow และหน้าตาของ prototype เดิม

## Smell — Long Method

ก่อน refactor ฟังก์ชัน `renderQuestion()` ทำหลายหน้าที่ในที่เดียว ได้แก่ คำนวณ progress, เขียนหัวข้อ, สร้าง choice button, ใส่ class ของคำตอบ, แสดง feedback, reset explanation และกำหนดปุ่มนำทาง ฟังก์ชันยาวและต้องรู้ทั้งกติกาคำตอบกับรายละเอียด DOM จึงอ่านยากและแก้ไขยากเมื่อมีการเปลี่ยน UI

## AI usage

ผมใช้ ChatGPT/Codex เป็นผู้ช่วยในขั้นตอนต่อไปนี้:

1. ช่วยอ่าน smell จากโค้ดและอธิบายว่าทำไม `renderQuestion()` จึงเป็น Long Method โดยไม่เปลี่ยน requirement
2. ช่วยเสนอทางเลือกในการแยก pure view model ออกจาก DOM rendering พร้อมระบุความเสี่ยงด้าน behavior regression
3. ช่วยตรวจชื่อ helper และออกแบบ test fixture ที่ตรวจ feedback, choice state และ navigation state ได้
4. ช่วยตรวจ wording ของ journal และ reflection หลังจากผมรัน test และตรวจ diff เอง

AI ไม่ได้ตัดสินใจ scope, ไม่ได้แก้ไฟล์งานสมาชิก และไม่ได้สร้าง test ที่เปลี่ยน requirement แทนทีม ผมเป็นผู้เลือก refactor แบบ view model + rendering helpers และตรวจผลลัพธ์ทุกครั้ง

## Before / After

### Before

`renderQuestion()` อ่าน state ของ quiz แล้วคำนวณและแก้ DOM ทุกส่วนเองในฟังก์ชันเดียว ทำให้ logic ของ choice state ปะปนกับการสร้าง element และการตั้งค่าปุ่มนำทาง

### After

- เพิ่ม `thakorn_quizgenerator_view_model.js` ซึ่งมี `buildQuestionViewModel()` เป็น pure function สำหรับแปลง question/state เป็นข้อมูลที่ UI ต้องใช้
- แยก DOM responsibilities ใน script เป็น `renderQuestionHeader()`, `renderChoiceList()`, `renderFeedback()`, `renderExplanation()` และ `renderQuestionNavigation()`
- `renderQuestion()` เหลือเพียง orchestration ของ view model และ helper ย่อย จึงอ่าน flow หลักได้ในระดับเดียว
- คง label ภาษาไทย, CSS classes (`correct`, `incorrect`, `selected`), progress, feedback และปุ่ม navigation เดิมไว้

ไม่มี feature ใหม่และไม่มีการเปลี่ยน persistence หรือ backend behavior

## Test-first evidence

1. เพิ่ม `thakorn_quizgenerator_view_model.test.cjs` ก่อนเขียน implementation แล้วรันในรอบ RED ได้ failure จาก `MODULE_NOT_FOUND` เพราะ view model ยังไม่มี
2. เพิ่ม implementation ขั้นต่ำให้ test ผ่านในรอบ GREEN
3. รัน unit test ของ view model และ browser tests ของ prototype/navbar รวม 15 tests ผ่านทั้งหมด
4. ตรวจด้วย browser flow เดิมตั้งแต่ upload, generate, เลือกคำตอบ และไปหน้าผลคะแนน เพื่อยืนยันว่า refactor ไม่เปลี่ยน external behavior

## Lesson learned

การแยก logic ที่คำนวณข้อมูลออกจาก DOM ทำให้เขียน test ที่เร็วและ deterministic ได้ โดยไม่ต้องจำลอง browser ทั้งชุดทุกครั้ง ส่วน browser test ยังคงมีไว้ตรวจ integration จริง การทำ test-first ก่อน refactor ช่วยยืนยันว่า contract ของข้อมูลคำถามชัดเจน และทำให้การเปลี่ยนโครงสร้างไม่กลายเป็นการแก้ feature โดยไม่ตั้งใจ
