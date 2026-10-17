import { getProgress as getProgressRequest, getProgressTopic as getProgressTopicRequest, listTags as listTagsRequest } from '../api/client.js';
import { renderTagChips, renderTagFilter } from '../tags/tag-components.js';

function element(tagName, className = '', text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุวันและเวลา'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function newestFirst(attempts = []) {
  return [...attempts].sort((left, right) => {
    const leftTime = new Date(left?.submitted_at).getTime();
    const rightTime = new Date(right?.submitted_at).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function scoreText(attempt) {
  const score = Number(attempt?.score);
  const total = Number(attempt?.total_questions);
  return Number.isFinite(score) && Number.isFinite(total) ? `${score} / ${total}` : 'ไม่มีคะแนน';
}

function routeLink(label, path, navigate) {
  const link = element('a', 'button button-secondary', label);
  link.href = path;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate?.(path);
  });
  return link;
}

function emptyState(title, description, action) {
  const state = element('section', 'progress-empty-state');
  state.dataset.role = 'progress-empty-state';
  state.append(element('h3', '', title), element('p', '', description));
  if (action) state.append(action);
  return state;
}

function renderAttempt(attempt, role, navigate) {
  const row = element('article', 'progress-attempt');
  row.dataset.role = role;
  row.dataset.attemptId = String(attempt.attempt_id);

  const heading = element('div', 'progress-attempt__heading');
  const score = element('span', 'progress-attempt__score', scoreText(attempt));
  score.dataset.role = role === 'progress-attempt' ? 'progress-score' : 'topic-progress-score';
  heading.append(element('h3', '', attempt.quiz_title || 'แบบทดสอบ'), score);
  row.append(heading, element('time', 'progress-attempt__date', formatDateTime(attempt.submitted_at)));
  if (attempt.submitted_at) row.querySelector('time').dateTime = attempt.submitted_at;

  if (attempt.tags?.length) {
    const tags = renderTagChips(attempt.tags);
    tags.classList.add('progress-attempt__tags');
    row.append(tags);
  }

  const quizId = Number(attempt.quiz_id);
  const attemptId = Number(attempt.attempt_id);
  if (Number.isSafeInteger(quizId) && quizId > 0 && Number.isSafeInteger(attemptId) && attemptId > 0) {
    row.append(routeLink('ดูเฉลยและผล', `/quizzes/${quizId}/attempts/${attemptId}`, navigate));
  }
  return row;
}

export function renderProgressPage({
  loadProgress = getProgressRequest,
  loadTopic = getProgressTopicRequest,
  loadTags = listTagsRequest,
  navigate,
} = {}) {
  const page = element('section', 'page progress-page');
  page.setAttribute('aria-labelledby', 'progress-title');

  const header = element('header', 'progress-heading');
  header.append(
    element('p', 'eyebrow', 'YOUR LEARNING PROGRESS'),
    element('h1', '', 'ความก้าวหน้าของฉัน'),
    element('p', 'page-intro', 'ติดตามผลการทำข้อสอบและย้อนดูการฝึกในแต่ละหัวข้อ'),
  );
  header.querySelector('h1').id = 'progress-title';
  const headerActions = element('div', 'progress-heading__actions');
  headerActions.append(routeLink('คลังข้อสอบ', '/quizzes', navigate));
  header.append(headerActions);

  const message = element('p', 'progress-message');
  message.dataset.role = 'progress-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');

  const searchForm = element('form', 'progress-search');
  searchForm.dataset.role = 'progress-search-form';
  const searchInput = element('input', 'progress-search__input');
  searchInput.type = 'search';
  searchInput.placeholder = 'ค้นหาชื่อข้อสอบหรือหัวข้อ';
  searchInput.setAttribute('aria-label', 'ค้นหาความก้าวหน้า');
  searchInput.dataset.role = 'progress-search';

  let tagCatalog = { tags: [] };
  let activeQuery = '';
  let activeTagId = null;
  let selectedTopicId = null;
  let overview = null;

  const filterContainer = element('div', 'progress-search__filter');
  const searchControls = element('div', 'progress-search__controls');
  const filter = renderTagFilter(tagCatalog, activeTagId, (tagId) => {
    activeTagId = tagId;
  });
  filter.classList.add('themed-select');
  filter.dataset.role = 'progress-tag-filter';
  filter.setAttribute('aria-label', 'กรองความก้าวหน้าตามวิชาหรือแท็ก');
  filterContainer.append(filter);
  const searchButton = element('button', 'button button-primary', 'ค้นหา');
  searchButton.type = 'submit';
  searchControls.append(searchButton);
  searchForm.append(searchInput, filterContainer, searchControls);

  const summary = element('section', 'progress-summary');
  summary.setAttribute('aria-label', 'สรุปความก้าวหน้า');
  const topicCount = element('article', 'progress-summary-card');
  topicCount.append(element('span', 'progress-summary-card__label', 'หัวข้อที่ฝึกแล้ว'));
  const topicCountValue = element('strong', 'progress-summary-card__value', '—');
  topicCountValue.dataset.role = 'progress-topic-count';
  topicCount.append(topicCountValue);

  const latestCard = element('article', 'progress-summary-card progress-summary-card--latest');
  latestCard.append(element('span', 'progress-summary-card__label', 'ผลการฝึกล่าสุด'));
  const latestContent = element('div', 'progress-latest');
  latestContent.dataset.role = 'progress-latest';
  latestCard.append(latestContent);
  summary.append(topicCount, latestCard);

  const contentLayout = element('div', 'progress-layout');
  const activityPanel = element('section', 'progress-panel progress-activity');
  activityPanel.setAttribute('aria-labelledby', 'progress-activity-title');
  activityPanel.append(element('h2', '', 'ประวัติการทำข้อสอบ'));
  activityPanel.querySelector('h2').id = 'progress-activity-title';
  const attemptList = element('div', 'progress-attempt-list');
  attemptList.dataset.role = 'progress-attempt-list';
  activityPanel.append(attemptList);

  const topicPanel = element('section', 'progress-panel progress-topics');
  topicPanel.setAttribute('aria-labelledby', 'progress-topics-title');
  topicPanel.append(element('h2', '', 'ฝึกตามหัวข้อ'));
  topicPanel.querySelector('h2').id = 'progress-topics-title';
  const topicList = element('div', 'progress-topic-list');
  topicList.dataset.role = 'progress-topic-list';
  const topicDetail = element('section', 'progress-topic-detail');
  topicDetail.dataset.role = 'progress-topic-detail';
  topicDetail.setAttribute('aria-live', 'polite');
  topicDetail.append(element('p', 'progress-topic-detail__placeholder', 'เลือกหัวข้อเพื่อดูประวัติการฝึก'));
  topicPanel.append(topicList, topicDetail);
  contentLayout.append(activityPanel, topicPanel);

  function setMessage(text = '', isError = false) {
    message.textContent = text;
    message.dataset.state = isError ? 'error' : 'info';
  }

  function renderTopics(items = []) {
    topicList.replaceChildren();
    if (!items.length) {
      topicList.append(emptyState('ยังไม่มีหัวข้อที่ฝึก', 'เมื่อทำข้อสอบที่มีแท็ก วิชาและหัวข้อที่ฝึกจะปรากฏตรงนี้'));
      return;
    }
    for (const topic of items) {
      const button = element('button', 'progress-topic');
      button.type = 'button';
      button.dataset.topicId = String(topic.tag_id);
      button.dataset.color = topic.color || 'violet';
      button.setAttribute('aria-pressed', String(Number(topic.tag_id) === selectedTopicId));
      button.append(
        element('span', 'progress-topic__name', topic.name || 'หัวข้อ'),
        element('span', 'progress-topic__count', `${topic.attempt_count ?? 0} ครั้ง`),
      );
      if (topic.latest_attempt) {
        button.append(element('span', 'progress-topic__date', `ล่าสุด ${formatDateTime(topic.latest_attempt.submitted_at)}`));
      }
      button.addEventListener('click', () => openTopic(topic.tag_id));
      topicList.append(button);
    }
  }

  async function openTopic(tagId) {
    const id = Number(tagId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    selectedTopicId = id;
    for (const button of topicList.querySelectorAll('[data-topic-id]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.topicId) === id));
    }
    topicDetail.replaceChildren(element('p', 'progress-loading', 'กำลังโหลดประวัติหัวข้อ…'));
    try {
      const detail = await loadTopic(id);
      topicDetail.replaceChildren();
      topicDetail.append(element('h3', 'progress-topic-detail__title', detail?.name || 'ประวัติหัวข้อ'));
      const attempts = newestFirst(detail?.attempts || []);
      if (!attempts.length) {
        topicDetail.append(emptyState('ยังไม่มีประวัติในหัวข้อนี้', 'ลองทำข้อสอบที่ติดแท็กหัวข้อนี้ แล้วผลจะมาแสดงที่นี่'));
        return;
      }
      const list = element('div', 'progress-attempt-list progress-attempt-list--topic');
      for (const attempt of attempts) list.append(renderAttempt(attempt, 'topic-attempt', navigate));
      topicDetail.append(list);
    } catch (error) {
      topicDetail.replaceChildren(emptyState('โหลดประวัติไม่สำเร็จ', error?.message || 'กรุณาลองใหม่อีกครั้ง'));
    }
  }

  function renderOverview(data) {
    overview = data || { topics_practiced: 0, latest_attempt: null, recent_attempts: [], topics: [] };
    const attempts = newestFirst(overview.recent_attempts || []);
    const topics = Array.isArray(overview.topics) ? overview.topics : [];
    topicCountValue.textContent = String(overview.topics_practiced ?? topics.length ?? 0);
    latestContent.replaceChildren();

    const latest = overview.latest_attempt || attempts[0] || null;
    if (latest) {
      latestContent.append(
        element('strong', 'progress-latest__title', latest.quiz_title || 'แบบทดสอบ'),
        element('span', 'progress-latest__score', scoreText(latest)),
        element('time', 'progress-latest__date', formatDateTime(latest.submitted_at)),
      );
      if (latest.submitted_at) latestContent.querySelector('time').dateTime = latest.submitted_at;
    } else {
      latestContent.append(element('span', 'progress-latest__empty', 'ยังไม่มีผลการฝึก'));
    }

    attemptList.replaceChildren();
    if (!attempts.length) {
      const hasFilter = Boolean(activeQuery || activeTagId !== null);
      if (!hasFilter && (overview.topics_practiced ?? 0) === 0) {
        attemptList.append(emptyState(
          'ยังไม่มีประวัติการฝึก',
          'เริ่มทำข้อสอบ แล้วคะแนนและหัวข้อที่ฝึกจะถูกรวบรวมไว้ที่นี่',
          routeLink('เริ่มทำข้อสอบ', '/quizzes/create', navigate),
        ));
      } else {
        attemptList.append(emptyState('ไม่พบประวัติที่ตรงกัน', 'ลองเปลี่ยนคำค้นหาหรือตัวกรองวิชาและหัวข้อ'));
      }
    } else {
      for (const attempt of attempts) attemptList.append(renderAttempt(attempt, 'progress-attempt', navigate));
    }

    renderTopics(topics);
    if (selectedTopicId && !topics.some((topic) => Number(topic.tag_id) === selectedTopicId)) {
      selectedTopicId = null;
      topicDetail.replaceChildren(element('p', 'progress-topic-detail__placeholder', 'เลือกหัวข้อเพื่อดูประวัติการฝึก'));
    }
  }

  let overviewRequest = 0;
  async function refreshOverview() {
    const requestId = ++overviewRequest;
    setMessage('กำลังโหลดประวัติการฝึก…');
    searchButton.disabled = true;
    try {
      const data = await loadProgress({ q: activeQuery, tagId: activeTagId });
      if (requestId !== overviewRequest) return;
      renderOverview(data);
      setMessage('');
    } catch (error) {
      if (requestId !== overviewRequest) return;
      renderOverview({ topics_practiced: 0, latest_attempt: null, recent_attempts: [], topics: [] });
      attemptList.replaceChildren(emptyState('โหลดความก้าวหน้าไม่สำเร็จ', error?.message || 'กรุณาลองใหม่อีกครั้ง'));
      setMessage('โหลดข้อมูลไม่สำเร็จ', true);
    } finally {
      if (requestId === overviewRequest) searchButton.disabled = false;
    }
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    activeQuery = searchInput.value.trim();
    void refreshOverview();
  });

  filter.addEventListener('change', () => {
    activeTagId = filter.value === '' ? null : Number(filter.value);
  });

  page.append(header, message, searchForm, summary, contentLayout);

  Promise.allSettled([loadTags(), loadProgress({ q: '', tagId: null })]).then(([tagsResult, progressResult]) => {
    if (tagsResult.status === 'fulfilled') {
      tagCatalog = tagsResult.value && Array.isArray(tagsResult.value.tags) ? tagsResult.value : { tags: [] };
      const nextFilter = renderTagFilter(tagCatalog, activeTagId, (tagId) => {
        activeTagId = tagId;
      });
      nextFilter.dataset.role = 'progress-tag-filter';
      nextFilter.setAttribute('aria-label', 'กรองความก้าวหน้าตามวิชาหรือแท็ก');
      filter.replaceWith(nextFilter);
    }
    if (progressResult.status === 'fulfilled') {
      renderOverview(progressResult.value);
      setMessage('');
    } else {
      renderOverview({ topics_practiced: 0, latest_attempt: null, recent_attempts: [], topics: [] });
      attemptList.replaceChildren(emptyState('โหลดความก้าวหน้าไม่สำเร็จ', progressResult.reason?.message || 'กรุณาลองใหม่อีกครั้ง'));
      setMessage('โหลดข้อมูลไม่สำเร็จ', true);
    }
  });

  return page;
}
