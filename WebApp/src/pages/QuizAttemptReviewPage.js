import { getQuizAttempt } from '../api/client.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function routeLink(label, path, navigate, className = 'button button-secondary') {
  const link = element('a', className, label);
  link.href = path;
  link.dataset.route = path;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate?.(path);
  });
  return link;
}

function displayAnswer(question, value) {
  if (value === null || value === undefined) return 'ไม่ได้ตอบ';
  if (question.kind === 'multiple_choice') {
    return question.choices?.[value] ?? `ตัวเลือกที่ ${Number(value) + 1}`;
  }
  return value ? 'ถูก' : 'ผิด';
}

function renderReviewQuestion(question) {
  const card = element('article', 'quiz-review-question');
  card.dataset.questionId = String(question.question_id);
  const heading = element('h2', 'quiz-review-question__heading');
  heading.append(
    element('span', 'quiz-review-question__number', `ข้อ ${question.position}`),
    document.createTextNode(' '),
    document.createTextNode(question.prompt),
  );
  const userAnswer = element('p', 'quiz-review-question__answer', `คำตอบของคุณ: ${displayAnswer(question, question.submitted_answer)}`);
  const correctness = element(
    'p',
    question.is_correct ? 'quiz-review-question__correctness is-correct' : 'quiz-review-question__correctness is-incorrect',
    question.is_correct ? 'ถูกต้อง' : 'ไม่ถูกต้อง',
  );
  const correctAnswer = element('p', 'quiz-review-question__answer', `เฉลย: ${displayAnswer(question, question.correct_answer)}`);
  const explanation = element('p', 'quiz-review-question__explanation', `อธิบาย: ${question.explanation}`);
  const evidence = element('blockquote', 'quiz-review-question__evidence', `จากเอกสาร: ${question.evidence}`);
  card.append(heading, userAnswer, correctness, correctAnswer, explanation, evidence);
  if (question.source_locator) {
    card.append(element('p', 'quiz-review-question__locator', `ตำแหน่งในเอกสาร: ${question.source_locator}`));
  }
  return card;
}

export function renderQuizAttemptReviewPage({
  quizId,
  attemptId,
  loadReview = getQuizAttempt,
  navigate,
} = {}) {
  const page = element('section', 'page quiz-review-page');
  page.setAttribute('aria-labelledby', 'quiz-review-title');
  const message = element('p', 'quiz-page-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const content = element('div', 'quiz-review-content');
  page.append(message, content);

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) message.dataset.state = 'error';
    else delete message.dataset.state;
  }

  async function load() {
    setMessage('กำลังโหลดผลการทำข้อสอบ…');
    try {
      const review = await loadReview(quizId, attemptId);
      const header = element('header', 'quiz-page-heading');
      header.append(
        element('p', 'eyebrow', 'ATTEMPT REVIEW'),
        element('h1', '', review.quiz_title || 'ผลการทำข้อสอบ'),
        element('p', 'page-intro', 'ทบทวนคำตอบและเฉลยที่บันทึกไว้สำหรับการทำครั้งนี้'),
      );
      header.querySelector('h1').id = 'quiz-review-title';

      const score = element(
        'p',
        'quiz-review-score glass-panel',
        `คะแนน ${review.score} / ${review.total_questions}`,
      );
      score.dataset.role = 'attempt-score';
      const actions = element('div', 'quiz-review-actions');
      actions.append(
        routeLink('ทำซ้ำ', `/quizzes/${quizId}/take`, navigate, 'button button-primary'),
        routeLink('กลับไปประวัติข้อสอบ', `/quizzes/${quizId}`, navigate),
      );
      const questionList = element('div', 'quiz-review-questions');
      for (const question of review.questions || []) questionList.append(renderReviewQuestion(question));
      setMessage('');
      content.replaceChildren(header, score, actions, questionList);
    } catch (error) {
      content.replaceChildren();
      setMessage(error?.message || 'โหลดเฉลยไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    }
  }

  void load();
  return page;
}
