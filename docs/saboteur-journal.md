# Lab 9 — Saboteur Journal

## จุดประสงค์

การทดลองนี้จำลองการทำงานแบบ saboteur เพื่อยืนยันว่า test ของ Lab 9 สามารถจับ regression ที่เกิดจากการแก้ logic ผิดได้จริง โดยการเปลี่ยนแปลงถูกทำชั่วคราวและไม่ถูก commit เข้า branch

## Mutation ที่ทดลอง

ก่อนทดลอง `tests/test_fizzbuzz.py` ผ่านครบ 5 tests และ `src/fizzbuzz.py` คืนค่า `FizzBuzz` สำหรับเลข 15 ตาม contract

ผมแก้เงื่อนไขใน `fizzbuzz()` ชั่วคราวจาก

```python
if _is_multiple(number, 15):
```

เป็น

```python
if _is_multiple(number, 15) and number != 15:
```

การเปลี่ยนนี้เป็น bug ที่ทำให้เลข 15 ตกไปเข้าเงื่อนไขหารด้วย 3 และคืนค่า `Fizz` แทน `FizzBuzz`

## ผลการรันทดสอบขณะมี bug

คำสั่งที่ใช้:

```powershell
& .\services\api\.venv\Scripts\python.exe -m pytest tests/test_fizzbuzz.py -q
```

ผลลัพธ์คือ `1 failed, 4 passed` โดย `test_fizzbuzz_fifteen_returns_fizzbuzz` ตรวจพบว่าได้ `'Fizz'` แต่ค่าที่คาดหวังคือ `'FizzBuzz'`

## การ restore และผลหลังแก้กลับ

ผมคืนเงื่อนไขเป็น `_is_multiple(number, 15)` แล้วรันคำสั่งเดิมอีกครั้ง ผลลัพธ์คือ `5 passed` จากนั้นจึงตรวจชุดทดสอบทั้งหมดและ coverage ต่อ โดยไม่มี commit ของ mutation ที่ผิดพลาด

## บทเรียนและข้อจำกัด

- Test ที่ระบุ boundary และ equivalence partition ของ FizzBuzz จับ regression ที่สำคัญได้ทันที
- การทำ saboteur เป็นหลักฐานว่าชุด test ตรวจ behavior ไม่ได้ตรวจเพียงว่า module import ได้
- Branch protection และ required status check ต้องตั้งค่าด้วยตนเองใน GitHub repository settings หลัง push และหลังตรวจชื่อ branch ตามกติกาของทีม
- ในรอบนี้ยังไม่เปิดใช้งาน remote CI เพราะทำงานในเครื่องและยังไม่ได้ push ตามขอบเขตที่อนุมัติ
