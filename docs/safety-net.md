# Lab 12B — Safety Net Sprint

## เป้าหมายและขอบเขต

ชุดทดสอบนี้ใช้ `buildQuestionViewModel()` ใน `prototypes/sprint1/Thakorn/thakorn_quizgenerator_view_model.js` เป็น business logic เป้าหมาย ฟังก์ชันรับคำถาม ลำดับ จำนวนข้อ และคำตอบที่บันทึกไว้ แล้วสร้างข้อมูลสำหรับแสดง feedback, สถานะ choices, progress และ navigation โดยเป็น logic แบบ deterministic ที่ไม่เรียก DB, API, ไฟล์ หรือเวลาปัจจุบัน

ไฟล์ runtime และ test เดิมใต้ `prototypes/` คงเดิมทั้งหมด ชุด Lab 12B เพิ่ม test แยกใน `WebApp/tests/lab12b/` เท่านั้น

## Test matrix

| ประเภท | กรณีที่ตรวจ | ผลที่คาดหวัง |
|---|---|---|
| Happy path | เลือกคำตอบถูกในข้อสุดท้าย | แสดง feedback ว่าถูก, ทำเครื่องหมาย selected/correct และแสดง “ดูผลคะแนน” |
| Happy path | เลือกคำตอบผิดระหว่างชุดข้อ | แสดง feedback ว่าผิด, ทำเครื่องหมายคำตอบที่เลือกและคำตอบที่ถูกแยกกัน และแสดง “ถัดไป” |
| Edge | ยังไม่เลือกคำตอบในข้อแรก | ซ่อน feedback, ยังแสดงคำตอบที่ถูก และปิด navigation ย้อนกลับ |
| Edge | จำนวนข้อเป็นศูนย์ | progress เป็น 0 โดยไม่หารด้วยศูนย์ |
| Error | `choices` เป็น `null` | ปฏิเสธข้อมูลคำถามที่ผิดรูปแบบด้วย `TypeError` ไม่คืน view model ที่ไม่สมบูรณ์ |
| Compatibility | โหลดโดยไม่มี CommonJS | เปิดให้ browser ใช้ API ผ่าน global `QuizViewModel` |
| Compatibility | สภาพแวดล้อมไม่มี `globalThis` | fallback ไปยัง script global ได้ |

ห้าแถวแรกตรงกับขั้นต่ำ 2 happy paths, 2 edge cases และ 1 error case; สองแถวสุดท้ายตรวจทางเลือกการ export ของ module

## วิธีรัน

```powershell
cd WebApp
npm ci
npm run lint
npm run test:all
npm run build
```

`test:all` รัน Vitest ของ WebApp เดิมก่อน แล้วจึงรัน Jest ของ Lab 12B พร้อม coverage ส่วน Vitest exclude `tests/lab12b/` เพราะไฟล์เหล่านั้นเป็น suite ของ Jest

## Coverage และ CI

ผล local ล่าสุดของ Jest: statements **96.29%**, branches **89.47%**, functions **100%**, lines **96.29%** โดย gate อยู่ที่ statements/lines อย่างน้อย 95%, branches อย่างน้อย 85% และ functions 100%. Branch ที่เหลือใน report มาจาก module wrapper path ซึ่ง Jest/V8 ไม่รวม execution counters จาก VM context ของ browser-compatibility tests; tests เหล่านั้นยังยืนยันผล export โดยตรง

GitHub Actions workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) มี job แยกสำหรับ lint และ tests บน push ไป `feature/safety-net` และ pull request เข้า `main`. การยืนยัน run สีเขียว, branch protection, reviewer approval และการย้าย Project Board เป็นขั้นตอนบน GitHub หลัง push

## งานที่ยังต้องเติมก่อนส่ง Lab 12B ให้ครบ

- เขียน Post-quiz 12 reflection ตามประสบการณ์จริงใน [`reflect.md`](../reflect.md); ไม่สร้าง reflection แทนผู้จัดทำ
- ตรวจผล GitHub Actions หลัง push
- ตั้ง branch protection/required check ตามสิทธิ์และ rubric ของทีม
- สร้าง PR, ขอ reviewer อย่างน้อยหนึ่งคน และย้าย card ไป Done หลัง merge
