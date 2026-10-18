import { getQuiz, getQuizAttempts } from '../api/client.js';

const SOURCE_LABELS = { md: 'Markdown', txt: 'Text', docx: 'DOCX', pdf: 'PDF' };
const DIFFICULTY_LABELS = { basic: 'พื้นฐาน', intermediate: 'ปานกลาง', advanced: 'ขั้นสูง' };
const LANGUAGE_LABELS = { th: 'ภาษาไทย', en: 'English' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุวันที่'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

function quizMetadata(quiz) {
  const metadata = element('dl', 'quiz-detail__metadata');
  const facts = [
    ['เอกสาร', quiz.source_filename || 'ไม่ระบุชื่อไฟล์'],
    ['รูปแบบไฟล์', SOURCE_LABELS[quiz.source_type] || quiz.source_type || '—'],
    ['จำนวนข้อ', `${quiz.question_count} ข้อ`],
    ['ภาษา', LANGUAGE_LABELS[quiz.language] || quiz.language || '—'],
    ['ระดับ', DIFFICULTY_LABELS[quiz.difficulty] || quiz.difficulty || '—'],
  ];
  for (const [term, value] of facts) {
    metadata.append(element('dt', '', term), element('dd', '', value));
  }
  return metadata;
}

export function renderQuizDetailPage({
  quizId,
  loadQuiz = getQuiz,
  loadAttempts = getQuizAttempts,
  navigate,
} = {}) {
  const page = element('section', 'page quiz-detail-page');
  page.setAttribute('aria-labelledby', 'quiz-detail-title');
  const message = element('p', 'quiz-page-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const content = element('div', 'quiz-detail-content');
  page.append(message, content);

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) message.dataset.state = 'error';
    else delete message.dataset.state;
  }

  async function load() {
    setMessage('กำลังโหลดข้อสอบและประวัติ…');
    try {
      const [quiz, attemptRows] = await Promise.all([loadQuiz(quizId), loadAttempts(quizId)]);
      const attempts = Array.isArray(attemptRows) ? attemptRows : [];
      setMessage('');

      const header = element('header', 'quiz-page-heading');
      header.append(
        element('p', 'eyebrow', 'QUIZ HISTORY'),
        element('h1', '', quiz.title || 'ข้อสอบไม่มีชื่อ'),
        element('p', 'page-intro', 'ดูคะแนนที่ผ่านมา หรือเริ่มทำข้อสอบชุดนี้อีกครั้ง'),
        routeLink('กลับไปคลังข้อสอบ', '/quizzes', navigate, 'button button-danger quiz-detail-back'),
      );
      header.querySelector('h1').id = 'quiz-detail-title';

      const summary = element('section', 'quiz-detail-summary glass-panel');
      summary.setAttribute('aria-label', 'รายละเอียดข้อสอบ');
      summary.append(quizMetadata(quiz));
      const summaryActions = element('div', 'quiz-detail__actions');
      summaryActions.append(
        routeLink(
          attempts.length ? 'ทำซ้ำ' : 'เริ่มทำข้อสอบ',
          `/quizzes/${quizId}/take`,
          navigate,
          'button button-primary',
        ),
      );
      summary.append(summaryActions);

      const history = element('section', 'quiz-history');
      history.setAttribute('aria-labelledby', 'quiz-history-title');
      history.append(element('h2', '', 'ประวัติการทำข้อสอบ'));
      history.querySelector('h2').id = 'quiz-history-title';
      const historyList = element('div', 'quiz-history-list');
      if (attempts.length === 0) {
        historyList.append(element('p', 'quiz-empty-inline', 'ยังไม่มีประวัติการทำข้อสอบ'));
      } else {
        for (const attempt of attempts) {
          const row = element('article', 'quiz-history-row');
          row.dataset.attemptId = String(attempt.id);
          const details = element('div', 'quiz-history-row__details');
          details.append(
            element('strong', '', `คะแนน ${attempt.score} / ${attempt.total_questions}`),
            element('span', '', formatDate(attempt.submitted_at)),
          );
          row.append(
            details,
            routeLink('ดูเฉลย', `/quizzes/${quizId}/attempts/${attempt.id}`, navigate),
          );
          historyList.append(row);
        }
      }
      history.append(historyList);
      content.replaceChildren(header, summary, history);
    } catch (error) {
      content.replaceChildren();
      setMessage(error?.message || 'โหลดข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    }
  }

  void load();
  return page;
}
