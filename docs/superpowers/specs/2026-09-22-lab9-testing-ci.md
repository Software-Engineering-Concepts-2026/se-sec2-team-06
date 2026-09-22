# Lab 09 — Testing and CI Design

## Goal

ทำให้ repository มีหลักฐานการทดสอบที่ตรวจสอบซ้ำได้ตาม Lab 09: unit tests แบบ
equivalence partitioning และ boundary values, TDD FizzBuzz, property-based tests,
GitHub Actions CI, และบันทึก Saboteur/AI usage โดยไม่แก้ไฟล์ใน `prototypes/`.

## Approved scope

- ทดสอบฟังก์ชัน `normalize_contributors()` ใน `scripts/generate_repo_contributors.py`
  ซึ่งเป็น logic ที่มีอยู่จริงและมีผลต่อ contributor graph ใน README
- เพิ่ม FizzBuzz kata แยกใน `src/fizzbuzz.py` เพื่อแสดง Red → Green → Refactor
- เพิ่ม tests ที่ root `tests/` และใช้ Python + pytest + Hypothesis
- เพิ่ม workflow `.github/workflows/test.yml` ให้รันบน `push` และ `pull_request`
- อัปเดต `services/api/requirements-dev.txt`, `AI_USAGE.md`, `reflect.md`
  และสร้าง `docs/saboteur-journal.md`
- ลบ placeholder workflow `.github/workflows/ci.yml` ที่มีเพียง `....` ซึ่งไม่ใช่
  workflow ที่ใช้งานได้ เพื่อไม่ให้ GitHub Actions โหลดไฟล์ผิดรูปแบบ

## Non-goals

- ไม่แก้ ย้าย ลบ หรือ import runtime จาก `prototypes/`
- ไม่สร้างระบบ AI provider, database, authentication หรือ upload ใหม่
- ไม่ตั้งค่า branch protection บน GitHub แทนผู้ใช้ เพราะเป็น repository setting
  ภายนอกและต้องตรวจสอบจาก GitHub UI
- ไม่ทำ mutation testing แบบบังคับ; `mutmut-results.txt` เป็น optional stretch goal

## Quality requirements

1. `tests/test_unit.py` มีอย่างน้อย 5 behavior tests และครอบคลุม input partition,
   boundary, empty/deleted author, allow-list และ limit validation
2. `tests/test_fizzbuzz.py` ครอบคลุม 1, 3, 5, 15, 7 และมี commit history แยก
   RED → Green → Refactor ใน local branch
3. `tests/test_property.py` มี Hypothesis properties อย่างน้อย 3 ข้อ โดยตรวจ
   output limit, week limit/order และ non-negative aggregates
4. CI ติดตั้ง `services/api/requirements-dev.txt`, ตั้ง `PYTHONPATH=services/api`,
   รัน API/root/scripts tests พร้อม coverage และล้มเหลวเมื่อ coverage ต่ำกว่า 90%
5. `docs/saboteur-journal.md` บันทึก mutation ที่จงใจทำให้ test fail และผลหลัง revert
6. `AI_USAGE.md` ระบุเครื่องมือ, prompts อย่างน้อย 3 ข้อ และสิ่งที่รับจาก AI
   พร้อม human verification
