// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderQuizAttemptReviewPage } from '../src/pages/QuizAttemptReviewPage.js';
import { renderQuizTakePage } from '../src/pages/QuizTakePage.js';

const quizWithAnswerKey = {
  id: 12,
  title: 'Set theory basics',
  question_count: 3,
  questions: [
    {
      id: 101,
      position: 1,
      kind: 'multiple_choice',
      prompt: 'Which choice is the empty set?',
      choices: ['The natural numbers', 'The set with no members', 'All integers', 'The real numbers'],
      correct_answer: 1,
      explanation: 'An empty set contains no members.',
      evidence: 'The source defines an empty set as having no members.',
    },
    {
      id: 102,
      position: 2,
      kind: 'true_false',
      prompt: 'A set is a collection of distinct objects.',
      choices: null,
      correct_answer: true,
      explanation: 'This is the basic definition of a set.',
      evidence: 'Sets contain distinct objects.',
    },
    {
      id: 103,
      position: 3,
      kind: 'true_false',
      prompt: 'An empty set contains one member.',
      choices: null,
      correct_answer: false,
      explanation: 'An empty set contains no members.',
      evidence: 'The set is empty.',
    },
  ],
};

const review = {
  attempt_id: 7,
  quiz_id: 12,
  quiz_title: 'Set theory basics',
  score: 1,
  total_questions: 3,
  submitted_at: '2026-10-11T08:00:00Z',
  questions: [
    {
      question_id: 101,
      position: 1,
      kind: 'multiple_choice',
      prompt: 'Which choice is the empty set?',
      choices: ['The natural numbers', 'The set with no members', 'All integers', 'The real numbers'],
      submitted_answer: 2,
      is_correct: false,
      correct_answer: 1,
      explanation: 'An empty set contains no members.',
      evidence: 'The source defines an empty set as having no members.',
      source_locator: 'Section 1',
    },
    {
      question_id: 102,
      position: 2,
      kind: 'true_false',
      prompt: 'A set is a collection of distinct objects.',
      choices: null,
      submitted_answer: true,
      is_correct: true,
      correct_answer: true,
      explanation: 'This is the basic definition of a set.',
      evidence: 'Sets contain distinct objects.',
      source_locator: null,
    },
  ],
};

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('quiz taking and attempt review pages', () => {
  beforeEach(() => document.body.replaceChildren());

  it('renders both question types without exposing answer keys before submission', async () => {
    const page = renderQuizTakePage({ quizId: 12, loadQuiz: async () => quizWithAnswerKey });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelectorAll('[data-question-id]')).toHaveLength(3));

    expect(page.querySelector('h1').textContent).toBe('Set theory basics');
    expect(page.querySelectorAll('input[type="radio"]')).toHaveLength(8);
    expect(page.textContent).toContain('Which choice is the empty set?');
    expect(page.textContent).not.toContain('An empty set contains no members.');
    expect(page.textContent).not.toContain('The source defines an empty set as having no members.');
    expect(page.textContent).not.toContain('correct_answer');
    expect([...page.querySelectorAll('input[type="radio"]')].every((input) => !input.checked)).toBe(true);
  });

  it('submits selected choice indexes and booleans, omits unanswered questions, then opens saved review', async () => {
    const submitAttempt = vi.fn().mockResolvedValue({ attempt_id: 35 });
    const navigate = vi.fn();
    const page = renderQuizTakePage({
      quizId: 12,
      loadQuiz: async () => quizWithAnswerKey,
      submitAttempt,
      navigate,
    });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelectorAll('[data-question-id]')).toHaveLength(3));

    page.querySelector('input[name="question-101"][value="2"]').checked = true;
    page.querySelector('input[name="question-102"][value="true"]').checked = true;
    submit(page.querySelector('[data-role="take-form"]'));
    await vi.waitFor(() => expect(submitAttempt).toHaveBeenCalledOnce());

    expect(submitAttempt).toHaveBeenCalledWith(12, {
      answers: [
        { question_id: 101, selected_choice_index: 2 },
        { question_id: 102, selected_boolean: true },
      ],
    });
    expect(navigate).toHaveBeenCalledWith('/quizzes/12/attempts/35');
  });

  it('loads the persisted historical attempt and displays answers, correctness, explanations and evidence', async () => {
    const loadReview = vi.fn().mockResolvedValue(review);
    const navigate = vi.fn();
    const page = renderQuizAttemptReviewPage({ quizId: 12, attemptId: 7, loadReview, navigate });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelectorAll('[data-question-id]')).toHaveLength(2));

    expect(loadReview).toHaveBeenCalledWith(12, 7);
    expect(page.querySelector('h1').textContent).toBe('Set theory basics');
    expect(page.textContent).toContain('1 / 3');
    expect(page.textContent).toContain('คำตอบของคุณ: All integers');
    expect(page.textContent).toContain('เฉลย: The set with no members');
    expect(page.textContent).toContain('ไม่ถูกต้อง');
    expect(page.textContent).toContain('อธิบาย: An empty set contains no members.');
    expect(page.textContent).toContain('จากเอกสาร: The source defines an empty set as having no members.');
    expect(page.textContent).toContain('Section 1');
    expect(page.textContent).toContain('คำตอบของคุณ: ถูก');
    expect(page.querySelector('[data-route="/quizzes/12/take"]')?.textContent).toContain('ทำซ้ำ');
    page.querySelector('[data-route="/quizzes/12/take"]').click();
    expect(navigate).toHaveBeenCalledWith('/quizzes/12/take');
  });

  it('shows load and submit failures as accessible status messages', async () => {
    const loadFailure = renderQuizTakePage({
      quizId: 12,
      loadQuiz: async () => { throw new Error('โหลดข้อสอบไม่สำเร็จ'); },
    });
    document.body.append(loadFailure);
    await vi.waitFor(() => expect(loadFailure.querySelector('[role="alert"]')?.textContent).toContain('โหลดข้อสอบไม่สำเร็จ'));

    document.body.replaceChildren();
    const submitFailure = renderQuizTakePage({
      quizId: 12,
      loadQuiz: async () => ({ ...quizWithAnswerKey, questions: quizWithAnswerKey.questions.slice(0, 1) }),
      submitAttempt: async () => { throw new Error('ส่งคำตอบไม่สำเร็จ'); },
    });
    document.body.append(submitFailure);
    await vi.waitFor(() => expect(submitFailure.querySelectorAll('[data-question-id]')).toHaveLength(1));
    submit(submitFailure.querySelector('[data-role="take-form"]'));
    await vi.waitFor(() => expect(submitFailure.querySelector('[role="alert"]')?.textContent).toContain('ส่งคำตอบไม่สำเร็จ'));
  });

  it('shows a persisted-review load error accessibly', async () => {
    const page = renderQuizAttemptReviewPage({
      quizId: 12,
      attemptId: 7,
      loadReview: async () => { throw new Error('โหลดเฉลยไม่สำเร็จ'); },
    });
    document.body.append(page);

    await vi.waitFor(() => expect(page.querySelector('[role="alert"]')?.textContent).toContain('โหลดเฉลยไม่สำเร็จ'));
  });
});
