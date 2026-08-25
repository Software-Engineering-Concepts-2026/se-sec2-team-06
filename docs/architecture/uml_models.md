# System Modeling & UML Notes

เอกสารนี้เป็น supporting note ของ Lab 5 ไม่ใช่ source of truth แทน C4 โดยใช้ชื่อ actor และ capability ให้สอดคล้องกับ [C4 Level 1](./c4-context.md), [C4 Level 2](./c4-container.md) และ requirements

## 1. Use Case Overview

| Use Case | Primary Actor | Supporting Capability | Result |
|---|---|---|---|
| Ask and explain | Student Learner | Learning Assistant + LLM Provider adapter | คำอธิบายที่ตรวจผลแล้วและ learning session |
| Generate practice | Student Learner | Practice/Quiz + Document Context | ชุดแบบฝึกหัดที่สัมพันธ์กับเนื้อหา |
| Record attempt | Student Learner | Practice/Quiz + PostgreSQL | attempt และคะแนนที่ตรวจสอบได้ |
| Review progress | Student Learner, Teacher Mentor | Progress + Authentication | สรุปความก้าวหน้าตามสิทธิ์ |
| Manage document context | Student Learner | Document Context + Object Storage | metadata และ object key ที่ปลอดภัย |

### Main Success Scenario — Ask and Practice

1. Student Learner ส่งคำถามหรือเลือกเอกสารผ่าน Web Application
2. Backend ตรวจ identity, input และสิทธิ์ผ่าน Authentication
3. Learning Assistant อ่าน context ที่จำเป็นและเรียก LLM Provider ผ่าน adapter
4. Backend ตรวจผลลัพธ์และส่งคำอธิบายกลับผ่าน HTTPS/JSON
5. Student ขอชุดฝึก; Practice/Quiz สร้างโจทย์และบันทึก attempt ใน PostgreSQL
6. Progress สรุปผลให้ Student หรือ Teacher Mentor ตาม authorization

## 2. Domain/Class Sketch

```text
User 1 ──< LearningSession
User 1 ──< PracticeAttempt >── 1 PracticeSet
PracticeSet 1 ──< Question
User 1 ──< ProgressRecord
User 1 ──< DocumentMetadata ──> ObjectKey

Authentication ──> authenticated principal
LearningAssistant ──> LLMProviderAdapter
PracticeQuiz ──> LearningAssistant, Progress
DocumentContext ──> ObjectStorageAdapter
```

### Boundary rules

- Domain modules สื่อสารผ่าน service interface ไม่ import repository/storage implementation ของ module อื่นโดยตรง
- PostgreSQL เป็นเจ้าของ relational constraints; Object Storage เป็นเจ้าของ binary object
- LLM Provider response ต้องผ่าน validation/error mapping ก่อนกลายเป็น domain result
- รายละเอียด component/class ที่ implement จริงให้เพิ่มเมื่อ MVP codebase มี stable interfaces; จนกว่านั้น C4/ADR คือเอกสารอ้างอิงหลัก

## Related Artifacts

- [C4 Level 1 — System Context](./c4-context.md)
- [C4 Level 2 — Container](./c4-container.md)
- [Technology Stack](./tech_stack.md)
- [Software Requirements Specification](../requirements/srs.md)
