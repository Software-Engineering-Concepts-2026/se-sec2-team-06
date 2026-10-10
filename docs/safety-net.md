# Lab 12B — Safety Net Sprint

## 1. ฟังก์ชันที่เลือกทดสอบ

`buildQuestionViewModel(question, index, total, savedAnswer)` ใน [`prototypes/sprint1/Thakorn/thakorn_quizgenerator_view_model.js`](../prototypes/sprint1/Thakorn/thakorn_quizgenerator_view_model.js) แปลงสถานะคำถามและคำตอบเป็นข้อมูล feedback, choice classes, progress และ navigation เลือกเพราะผลลัพธ์ตรวจซ้ำได้และไม่พึ่ง DB/API/ไฟล์/เวลาปัจจุบัน การทดสอบแยกอยู่ใน `WebApp/tests/lab12b/`; ไม่แก้ runtime file ใน `prototypes/`.

## 2. Test cases (7 tests)

| # | ประเภท | กรณีและสิ่งที่ยืนยัน |
|---:|---|---|
| 1 | Happy | ตอบถูกข้อสุดท้าย: feedback ถูก, choice selected/correct, ไปดูผลคะแนน |
| 2 | Happy | คำตอบผิด: feedback ผิด, ระบุ choice ที่ผิดและ choice ที่ถูก, ไปข้อถัดไป |
| 3 | Edge | ยังไม่ตอบข้อแรก: ซ่อน feedback, แสดง choice ที่ถูก, ปิดย้อนกลับ |
| 4 | Edge | จำนวนข้อเป็นศูนย์: progress เท่ากับ 0 |
| 5 | Error | `choices: null`: โยน `TypeError` แทนการคืน view model บางส่วน |
| 6 | Compatibility | ไม่มี CommonJS: API ใช้ได้ผ่าน browser global `QuizViewModel` |
| 7 | Compatibility | ไม่มี `globalThis`: API fallback ไปยัง script global |

ขั้นต่ำ rubric ครบ: 2 happy, 2 edge และ 1 error; อีก 2 tests ตรวจ module compatibility. ผลล่าสุด: Jest 7 tests ผ่าน.

## 3. Coverage และการตีความ

| Metric | ผล local | Threshold |
|---|---:|---:|
| Statements / Lines | 96.29% / 96.29% | ≥ 95% |
| Branches | 89.47% | ≥ 85% |
| Functions | 100% | 100% |

Coverage ผ่าน threshold ใน `WebApp/jest.config.cjs`. Report ระบุ lines 7–8 ซึ่งเป็นทาง export ไป browser global ว่า uncovered; compatibility tests ตรวจพฤติกรรมผ่าน VM โดยตรง แต่ coverage report นี้ไม่บันทึก execution จาก VM context จึงอ่านตัวเลขควบคู่กับ test results ไม่ไล่ให้ถึง 100%. ภาพ local lint/tests/coverage: [01-local-test-coverage.png](./evidence/lab12b/01-local-test-coverage.png) (ไม่ใช่หลักฐาน GitHub Actions).

## 4. CI และการบล็อก merge

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) รันเมื่อ push ไป `feature/safety-net` และ PR เข้า `main`: job `lint` รัน `npm run lint`; job `test` รัน `npm run test:all` ใน `WebApp`. Local lint และ tests ผ่าน แต่ GitHub Actions ล่าสุด, Branch Protection และการบล็อก merge ยังต้องตรวจยืนยันบน GitHub.

หลักฐานที่ rubric ระบุ: แนบภาพ PR ซึ่งแสดง **“Merging is blocked”** ในคอมเมนต์ PR หลังตั้ง `main` ให้ require PR และ checks `lint`/`test` แล้วทดลองให้ test fail ชั่วคราวบน `feature/safety-net`. จากนั้น restore test, push และยืนยันว่า checks กลับมาเขียว ห้ามทดลองบน `main`.

## 5. บทเรียนที่ได้

> ร่างจาก test matrix และ coverage — ผู้จัดทำโปรดทบทวนและปรับให้ตรงกับความเข้าใจของตนก่อนส่ง

การแยกกรณีคำตอบถูก/ผิด ยังไม่ตอบ และจำนวนข้อเป็นศูนย์ช่วยตรวจพฤติกรรมที่ happy path อย่างเดียวอาจไม่พบ Coverage ช่วยชี้จุดที่ควรตรวจต่อ แต่ต้องอ่านร่วมกับ test ที่ยืนยัน browser compatibility ด้วย Local tests ที่ผ่านยังไม่พิสูจน์ว่า merge ถูกป้องกัน จึงต้องตรวจ CI และ Branch Protection บน GitHub.

## สถานะก่อนส่ง

- [x] มีร่าง Post-quiz 12B ใน [`reflect.md`](../reflect.md); **ยังต้องให้ผู้จัดทำทบทวน/ปรับถ้อยคำ**
- [ ] ยืนยัน GitHub Actions ว่า `lint` และ `test` ผ่านทั้งคู่
- [ ] ตั้ง Branch Protection ของ `main`; ทดสอบและแนบภาพ “Merging is blocked” ใน PR comment แล้ว restore test ให้ CI เขียว
- [ ] ขอ reviewer อย่างน้อย 1 คน approve, merge PR เข้า `main` และย้ายการ์ด Project Board ไป `Done`
