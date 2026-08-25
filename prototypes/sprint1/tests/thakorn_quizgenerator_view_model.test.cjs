const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { buildQuestionViewModel } = require(path.resolve(
  __dirname,
  '..',
  'Thakorn',
  'thakorn_quizgenerator_view_model.js'
));

test('buildQuestionViewModel keeps saved answer feedback and navigation state', () => {
  const view = buildQuestionViewModel(
    {
      question: 'ข้อใดเป็นสีหลัก?',
      choices: ['แดง', 'เขียว', 'น้ำเงิน'],
      correctIndex: 2,
      explanation: 'สีน้ำเงินเป็นหนึ่งในสีหลัก'
    },
    1,
    3,
    0
  );

  assert.deepEqual(view, {
    label: 'ข้อ 2 จาก 3',
    progressPercent: 66.66666666666666,
    questionText: 'ข้อใดเป็นสีหลัก?',
    choices: [
      { index: 0, label: 'A. แดง', classes: ['selected', 'incorrect'] },
      { index: 1, label: 'B. เขียว', classes: [] },
      { index: 2, label: 'C. น้ำเงิน', classes: ['correct'] }
    ],
    feedback: {
      visible: true,
      text: 'ยังไม่ถูก ลองดูคำอธิบายด้านล่าง'
    },
    explanation: 'สีน้ำเงินเป็นหนึ่งในสีหลัก',
    previousDisabled: false,
    nextLabel: 'ถัดไป →'
  });
});
