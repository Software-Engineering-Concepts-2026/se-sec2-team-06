import { getQuiz, submitQuizAttempt } from '../api/client.js';

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

function answerOption(questionId, value, label) {
  const option = element('label', 'quiz-answer-option');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = `question-${questionId}`;
  input.value = String(value);
  option.append(input, element('span', '', label));
  return option;
}

function renderQuestion(question) {
  const fieldset = element('fieldset', 'quiz-take-question');
  fieldset.dataset.questionId = String(question.id);
  const legend = element('legend', 'quiz-take-question__prompt');
  const position = element('span', 'quiz-take-question__number', `ข้อ ${question.position}`);
  legend.append(position, document.createTextNode(' '), document.createTextNode(question.prompt));
  fieldset.append(legend);

  if (question.kind === 'multiple_choice') {
    if (!Array.isArray(question.choices) || question.choices.length === 0) {
      throw new Error('ข้อมูลตัวเลือกของข้อสอบไม่ถูกต้อง');
    }
    const choices = element('div', 'quiz-take-question__choices');
    question.choices.forEach((choice, index) => choices.append(answerOption(question.id, index, choice)));
    fieldset.append(choices);
  } else if (question.kind === 'true_false') {
    const choices = element('div', 'quiz-take-question__choices quiz-take-question__choices--boolean');
    choices.append(answerOption(question.id, 'true', 'ถูก'), answerOption(question.id, 'false', 'ผิด'));
    fieldset.append(choices);
  } else {
    throw new Error('พบประเภทข้อสอบที่ยังไม่รองรับ');
  }

  return fieldset;
}

export function renderQuizTakePage({
  quizId,
  loadQuiz = getQuiz,
  submitAttempt = submitQuizAttempt,
  navigate,
} = {}) {
  const page = element('section', 'page quiz-take-page');
  page.setAttribute('aria-labelledby', 'quiz-take-title');
  const message = element('p', 'quiz-page-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const content = element('div', 'quiz-take-content');
  page.append(message, content);

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) message.dataset.state = 'error';
    else delete message.dataset.state;
  }

  async function load() {
    setMessage('กำลังโหลดข้อสอบ…');
    try {
      const quiz = await loadQuiz(quizId);
      if (!Array.isArray(quiz?.questions) || quiz.questions.length === 0) {
        throw new Error('ข้อสอบชุดนี้ยังไม่มีคำถาม');
      }
      const header = element('header', 'quiz-page-heading');
      header.append(
        element('p', 'eyebrow', 'TAKE A QUIZ'),
        element('h1', '', quiz.title || 'ข้อสอบ'),
        element('p', 'page-intro', `${quiz.questions.length} ข้อ · เลือกคำตอบแล้วกดส่งเพื่อดูคะแนนและเฉลย`),
      );
      header.querySelector('h1').id = 'quiz-take-title';

      const form = element('form', 'quiz-take-form glass-panel');
      form.dataset.role = 'take-form';
      for (const question of quiz.questions) form.append(renderQuestion(question));
      const actions = element('div', 'quiz-take-actions');
      actions.append(
        routeLink('กลับไปหน้าข้อสอบ', `/quizzes/${quizId}`, navigate),
      );
      const submitButton = element('button', 'button button-primary', 'ส่งคำตอบและดูคะแนน');
      submitButton.type = 'submit';
      submitButton.dataset.role = 'submit-button';
      actions.append(submitButton);
      form.append(actions);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');
        const answers = [];
        for (const question of quiz.questions) {
          const selected = form.querySelector(`input[name="question-${question.id}"]:checked`);
          if (!selected) continue;
          answers.push(question.kind === 'multiple_choice'
            ? { question_id: question.id, selected_choice_index: Number(selected.value) }
            : { question_id: question.id, selected_boolean: selected.value === 'true' });
        }

        submitButton.disabled = true;
        submitButton.textContent = 'กำลังตรวจคำตอบ…';
        try {
          const result = await submitAttempt(quizId, { answers });
          const attemptId = Number(result?.attempt_id);
          if (!Number.isSafeInteger(attemptId) || attemptId < 1) {
            throw new Error('ระบบไม่ได้รับเลขที่ผลการทำข้อสอบ กรุณาตรวจสอบประวัติ');
          }
          navigate?.(`/quizzes/${quizId}/attempts/${attemptId}`);
        } catch (error) {
          setMessage(error?.message || 'ส่งคำตอบไม่สำเร็จ กรุณาลองอีกครั้ง', true);
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'ส่งคำตอบและดูคะแนน';
        }
      });

      setMessage('');
      content.replaceChildren(header, form);
    } catch (error) {
      content.replaceChildren();
      setMessage(error?.message || 'โหลดข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    }
  }

  void load();
  return page;
}
