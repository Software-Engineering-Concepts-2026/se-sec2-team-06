# Lab 12B — Safety-net evidence record

- วันที่บันทึก: 2026-10-11
- Repository: `Software-Engineering-Concepts-2026/se-sec2-team-06`
- Pull request: [#73 — test(lab12b): demonstrate required-check blocking](https://github.com/Software-Engineering-Concepts-2026/se-sec2-team-06/pull/73)
- Branch: `feature/safety-net` → `main`

## ผลที่หลักฐานยืนยัน

PR #73 ใช้ assertion ที่ทำให้ test fail ชั่วคราว เพื่อพิสูจน์ว่ากฎของ branch ป้องกันการ merge เมื่อ required check ไม่ผ่าน หลังบันทึกภาพแล้ว assertion ชั่วคราวถูกเอาออกจาก `WebApp/tests/lab12b/test_thakorn_quiz_view_model.test.cjs`; การเปลี่ยนแปลงนี้เตรียมเผยแพร่ใน branch เดิม ไม่ได้แก้หรือ push ไป `main`.

ภาพ PR แสดง `lint` ผ่าน, `test` ไม่ผ่านทั้ง check ที่มาจาก `pull_request` และ `push`, และข้อความ **Merging is blocked**. ในหน้าเดียวกัน GitHub ยังแสดงว่าต้องมี approving review อย่างน้อย 1 คนด้วย ดังนั้นภาพนี้ยืนยันว่าการ merge ถูกป้องกันในสถานะทดสอบนั้น ไม่ได้ยืนยันว่า CI หลัง cleanup ผ่านแล้ว.

หลักฐานภาพ: [PR #73 แสดง `Merging is blocked`](./07-pr-merging-blocked.png)

## หลักฐานประกอบ

| ไฟล์ | สิ่งที่แสดง |
|---|---|
| [01-local-test-coverage.png](./01-local-test-coverage.png) | ผล lint/tests/coverage ในเครื่องก่อนการทดลอง fail |
| [02-github-actions-green.png](./02-github-actions-green.png) | GitHub Actions run ก่อนการทดลอง safety-net |
| [03-github-actions-green-pr72.png](./03-github-actions-green-pr72.png) | GitHub Actions ผ่านบน PR #72 |
| [04-main-branch-protection.png](./04-main-branch-protection.png) | Ruleset `Protect main - Lab 12B` active และ target `main` |
| [05-main-branch-approval.png](./05-main-branch-approval.png) | กำหนดให้ PR ต้องมี approval อย่างน้อย 1 คน |
| [06-required-checks-lint-test.png](./06-required-checks-lint-test.png) | required status checks คือ `lint` และ `test` |
| [07-pr-merging-blocked.png](./07-pr-merging-blocked.png) | PR #73 ถูกบล็อกขณะ `test` fail และยังไม่มี approval |

## สถานะหลังการทดลอง

- PR #72 ถูก merge แล้ว; PR #73 เป็น PR สำหรับเก็บหลักฐานการบล็อกและยังไม่ควร merge จนกว่า cleanup จะผ่านการตรวจ
- assertion ที่ทำให้ test fail ถูกลบออกจาก test file หลังถ่ายภาพหลักฐาน
- หลัง cleanup การตรวจ local ผ่าน: `npm run lint`, `npm run test:all` (Vitest 3 tests และ Jest 7 tests; Jest coverage statements/lines 96.29%, branches 89.47%, functions 100%) และ `npm run build`.
- หลัง push cleanup ให้ตรวจ GitHub Actions run ใหม่บน PR #73 ว่า `lint` และ `test` ผ่าน แล้วจึงขอ reviewer approval; ภาพนี้เป็นหลักฐานของ run ที่ตั้งใจให้ fail ไม่ใช่หลักฐานของ run หลัง cleanup
- Ruleset มี target เป็น `main`, require pull request, approval อย่างน้อย 1 คน และ require checks `lint`/`test` ตามภาพประกอบ

## ขอบเขต

การทดลองทำบน `feature/safety-net` เท่านั้น ไม่มีการแก้หรือ push ไป `main`; ไม่มีการ merge PR #73 ในขั้นตอนเก็บหลักฐานนี้.
