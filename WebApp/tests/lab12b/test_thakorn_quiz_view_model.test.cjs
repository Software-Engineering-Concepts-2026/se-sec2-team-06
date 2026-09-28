const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulePath = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'prototypes',
  'sprint1',
  'Thakorn',
  'thakorn_quizgenerator_view_model.js'
);
const source = fs.readFileSync(modulePath, 'utf8');
const { buildQuestionViewModel } = require(modulePath);

const question = {
  question: 'ข้อใดเป็นสีหลัก?',
  choices: ['แดง', 'เขียว', 'น้ำเงิน'],
  correctIndex: 2,
  explanation: 'สีน้ำเงินเป็นหนึ่งในสีหลัก'
};

describe('buildQuestionViewModel — Lab 12B safety net', () => {
  test('shows correct-answer feedback and result navigation on the final question', () => {
    const view = buildQuestionViewModel(question, 2, 3, 2);

    expect(view).toEqual({
      label: 'ข้อ 3 จาก 3',
      progressPercent: 100,
      questionText: 'ข้อใดเป็นสีหลัก?',
      choices: [
        { index: 0, label: 'A. แดง', classes: [] },
        { index: 1, label: 'B. เขียว', classes: [] },
        { index: 2, label: 'C. น้ำเงิน', classes: ['selected', 'correct'] }
      ],
      feedback: { visible: true, text: 'ถูกต้อง!' },
      explanation: 'สีน้ำเงินเป็นหนึ่งในสีหลัก',
      previousDisabled: false,
      nextLabel: 'ดูผลคะแนน'
    });
  });

  test('marks a wrong saved answer and keeps ordinary next-question navigation', () => {
    const view = buildQuestionViewModel(question, 1, 4, 0);

    expect(view.progressPercent).toBe(50);
    expect(view.choices).toEqual([
      { index: 0, label: 'A. แดง', classes: ['selected', 'incorrect'] },
      { index: 1, label: 'B. เขียว', classes: [] },
      { index: 2, label: 'C. น้ำเงิน', classes: ['correct'] }
    ]);
    expect(view.feedback).toEqual({
      visible: true,
      text: 'ยังไม่ถูก ลองดูคำอธิบายด้านล่าง'
    });
    expect(view.previousDisabled).toBe(false);
    expect(view.nextLabel).toBe('ถัดไป →');
  });

  test('hides feedback before an answer while keeping the first question controls correct', () => {
    const view = buildQuestionViewModel(question, 0, 3, null);

    expect(view.progressPercent).toBeCloseTo(33.3333, 3);
    expect(view.feedback).toEqual({ visible: false, text: '' });
    expect(view.choices[2].classes).toEqual(['correct']);
    expect(view.previousDisabled).toBe(true);
    expect(view.nextLabel).toBe('ถัดไป →');
  });

  test('reports zero progress when the question count is empty', () => {
    const view = buildQuestionViewModel(question, 0, 0, null);

    expect(view.progressPercent).toBe(0);
  });

  test('throws for malformed question data instead of returning a partial view model', () => {
    const malformedQuestion = { ...question, choices: null };

    expect(() => buildQuestionViewModel(malformedQuestion, 0, 1, null))
      .toThrow(TypeError);
  });

  test('exposes the view-model API to a browser global without CommonJS', () => {
    const browserContext = {};

    vm.runInNewContext(source, browserContext);

    const view = browserContext.QuizViewModel.buildQuestionViewModel(
      question,
      2,
      3,
      2
    );
    expect(view.feedback).toEqual({ visible: true, text: 'ถูกต้อง!' });
  });

  test('falls back to the script global when globalThis is unavailable', () => {
    const browserContext = { globalThis: undefined };

    vm.runInNewContext(source, browserContext);

    expect(typeof browserContext.QuizViewModel.buildQuestionViewModel)
      .toBe('function');
  });
});
