import { createAtomVisual } from '../components/AtomVisual.js';
import { renderDashboardCharts } from '../dashboard/dashboard-charts.js';
import { normalizeTagColor } from '../tags/tag-colors.js';

function element(tagName, className = '', text) {
  const value = document.createElement(tagName);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function createAction(label, path, onNavigate, primary = false) {
  const link = element('a', primary ? 'button button-primary' : 'button button-secondary', label);
  link.href = path;
  link.dataset.route = path;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(path);
  });
  return link;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุวันส่ง'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderGuestHome(onNavigate) {
  const page = element('section', 'page home-page home-hero');
  page.setAttribute('aria-labelledby', 'home-title');

  const content = element('div', 'home-hero__content');
  const eyebrow = element('p', 'eyebrow', 'YOUR LEARNING WORKSPACE');
  const title = element('h1', '', 'SynapseSync');
  title.id = 'home-title';
  const description = element('p', 'home-description', 'พื้นที่สำหรับวางแผนและทบทวนการเรียนรู้ เริ่มต้นได้ง่ายในแบบของคุณ');
  const actions = element('div', 'home-actions');
  actions.append(
    createAction('สร้างข้อสอบ', '/quizzes/create', onNavigate, true),
    createAction('สร้างบัญชี', '/register', onNavigate),
    createAction('เข้าสู่ระบบ', '/login', onNavigate),
  );
  content.append(eyebrow, title, description, actions);
  page.append(content, createAtomVisual());
  page.ready = Promise.resolve();
  return page;
}

function createPanel(title, description, role) {
  const panel = element('section', 'home-panel');
  panel.setAttribute('aria-labelledby', `${role}-heading`);
  panel.dataset.section = role;
  const heading = element('div', 'home-panel__heading');
  const copy = element('div', 'home-panel__copy');
  const titleElement = element('h2', '', title);
  titleElement.id = `${role}-heading`;
  copy.append(titleElement);
  if (description) copy.append(element('p', '', description));
  heading.append(copy);
  panel.append(heading);
  return panel;
}

function sectionError(panel, role, error) {
  const message = element('p', 'home-section-message home-section-message--error', error?.message || 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
  message.dataset.role = role;
  message.setAttribute('role', 'status');
  panel.append(message);
}

function renderDeadlineList(panel, deadlines = [], navigate, tagColorsById = new Map(), tagColorsByName = new Map()) {
  const now = Date.now();
  const upcoming = asArray(deadlines)
    .filter((deadline) => deadline?.status !== 'completed' && deadline?.is_completed !== true)
    .sort((left, right) => {
      const leftDue = new Date(left?.due_at).getTime();
      const rightDue = new Date(right?.due_at).getTime();
      return (Number.isFinite(leftDue) ? leftDue : Number.POSITIVE_INFINITY)
        - (Number.isFinite(rightDue) ? rightDue : Number.POSITIVE_INFINITY);
    })
    .slice(0, 4);

  if (!upcoming.length) {
    panel.append(element('p', 'home-section-message', 'ยังไม่มีงานที่กำลังทำ ลองเพิ่มกำหนดส่งงานเพื่อวางแผนการเรียน'));
    return;
  }
  const list = element('ul', 'home-upcoming-list');
  for (const deadline of upcoming) {
    const item = element('li', 'home-upcoming-item');
    item.dataset.role = 'home-upcoming-task';
    item.dataset.deadlineId = String(deadline.id);
    const subjectKey = String(deadline?.subject || '').trim().toLocaleLowerCase();
    const hasTagId = deadline?.tag_id !== undefined && deadline?.tag_id !== null && deadline?.tag_id !== '';
    const tagColor = tagColorsById.get(String(deadline.tag_id))
      || (!hasTagId ? tagColorsByName.get(subjectKey) : null)
      || 'violet';
    item.dataset.color = tagColor;
    const details = element('div', 'home-upcoming-item__details');
    const subject = element('span', 'tag-chip home-upcoming-item__subject', deadline.subject || 'วิชาอื่น');
    subject.dataset.color = tagColor;
    details.append(
      element('strong', '', deadline.title || 'งานที่ยังไม่มีชื่อ'),
      subject,
    );
    const time = element('time', 'home-upcoming-item__time', formatDateTime(deadline.due_at));
    if (deadline.due_at) time.dateTime = deadline.due_at;
    if (new Date(deadline.due_at).getTime() < now) item.dataset.overdue = 'true';
    item.append(details, time);
    list.append(item);
  }
  panel.append(list, createAction('ดูงานทั้งหมด', '/deadlines', navigate));
}

function renderRecentList(panel, items, { pathFor, titleFor, detailFor, iconText, emptyMessage, navigate }) {
  const rows = asArray(items);
  if (!rows.length) {
    panel.append(element('p', 'home-section-message', emptyMessage));
    return;
  }
  const list = element('ul', 'home-recent-list');
  for (const item of rows.slice(0, 3)) {
    const title = titleFor(item) || 'รายการที่ไม่มีชื่อ';
    const link = element('a', 'home-recent-item');
    const path = pathFor(item);
    link.href = path;
    link.dataset.route = path;
    if (item?.kind) link.dataset.kind = item.kind;
    link.setAttribute('aria-label', `${title} · ${detailFor(item)}`);
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate?.(path);
    });
    const icon = element('span', 'home-recent-item__icon', typeof iconText === 'function' ? iconText(item) : iconText);
    icon.setAttribute('aria-hidden', 'true');
    const details = element('span', 'home-recent-item__details');
    details.append(
      element('strong', 'home-recent-item__title', title),
      element('span', 'home-recent-item__meta', detailFor(item)),
    );
    const tags = asArray(item?.tags).filter((tag) => tag?.name).slice(0, 1);
    if (tags.length) {
      const tagRow = element('span', 'home-recent-item__tags');
      for (const tag of tags) {
        const chip = element('span', 'tag-chip home-recent-item__tag', tag.name);
        chip.dataset.color = normalizeTagColor(tag.color);
        tagRow.append(chip);
      }
      details.append(tagRow);
    }
    const arrow = element('span', 'home-recent-item__arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(icon, details, arrow);
    list.append(link);
  }
  panel.append(list);
}

function createFeatureCards(navigate) {
  const items = [
    ['✦', 'AI ติวเตอร์', 'ถามข้อสงสัยและทบทวนแนวคิด', '/tutor'],
    ['▤', 'คลังข้อสอบ', 'ทำซ้ำและติดตามคะแนน', '/quizzes'],
    ['▧', 'คลังเอกสาร', 'เก็บและอ่านเอกสารประกอบ', '/documents'],
    ['◷', 'กำหนดส่งงาน', 'วางแผนงานที่ใกล้ถึงกำหนด', '/deadlines'],
    ['↗', 'ความก้าวหน้า', 'ดูผลการฝึกและหัวข้อที่ควรทบทวน', '/progress'],
  ];
  const grid = element('nav', 'home-feature-grid');
  grid.setAttribute('aria-label', 'ทางลัดไปยังพื้นที่เรียนรู้');
  for (const [iconText, title, description, path] of items) {
    const link = element('a', 'home-feature-card');
    link.href = path;
    link.dataset.route = path;
    link.setAttribute('aria-label', `${title}: ${description}`);
    link.title = description;
    const icon = element('span', 'home-feature-card__icon', iconText);
    icon.setAttribute('aria-hidden', 'true');
    link.append(icon, element('strong', '', title));
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate?.(path);
    });
    grid.append(link);
  }
  return grid;
}

export function renderHomePage({
  user,
  onNavigate,
  loadOverview,
  loadDeadlines,
  loadTags,
  loadProgress,
  loadQuizzes,
  loadDocuments,
} = {}) {
  if (!user) return renderGuestHome(onNavigate);

  const page = element('section', 'page home-page home-dashboard-page');
  page.setAttribute('aria-labelledby', 'home-title');
  const heading = element('header', 'home-dashboard-heading');
  const title = element('h1', '', `สวัสดี ${user.display_name || 'ผู้เรียน'}`);
  title.id = 'home-title';
  heading.append(
    element('p', 'eyebrow', 'YOUR LEARNING DASHBOARD'),
    title,
    element('p', 'home-description', 'ภาพรวมการทำข้อสอบ งานที่ใกล้ถึงกำหนด และเอกสารสำหรับการเรียนของคุณ'),
  );
  const headingActions = element('div', 'home-actions home-dashboard-heading__actions');
  headingActions.append(
    createAction('สร้างข้อสอบ', '/quizzes/create', onNavigate, true),
    createAction('ถาม AI Tutor', '/tutor', onNavigate),
  );
  heading.append(headingActions);

  const chartPanel = createPanel('ภาพรวมการเรียน', 'ข้อมูลจากข้อสอบ งาน และเอกสารในบัญชีของคุณ', 'home-analytics');
  const periodControl = element('label', 'home-period-control');
  periodControl.append(element('span', '', 'แสดงผลตาม'));
  const period = element('select', 'themed-select');
  period.setAttribute('aria-label', 'ช่วงเวลาแสดงกราฟ');
  period.innerHTML = '<option value="day">รายวัน</option><option value="week">รายสัปดาห์</option>';
  period.dataset.role = 'home-period';
  periodControl.append(period);
  chartPanel.querySelector('.home-panel__heading').append(periodControl);
  const chartContent = element('div', 'home-dashboard-charts');
  chartContent.dataset.role = 'home-charts';
  chartContent.setAttribute('aria-live', 'polite');
  chartContent.append(element('p', 'home-section-message', 'กำลังโหลดภาพรวม…'));
  chartPanel.append(chartContent);

  const overviewPanel = element('div', 'home-dashboard-content');
  const tasksPanel = createPanel('งานใกล้ถึงกำหนด', 'เรียงจากกำหนดส่งที่ใกล้ที่สุด', 'home-upcoming');
  const latestPanel = createPanel('ผลการฝึกล่าสุด', 'คะแนนล่าสุดจากประวัติการทำข้อสอบ', 'home-progress');
  const recentPanel = createPanel('รายการล่าสุด', 'ข้อสอบและเอกสารที่ใช้ล่าสุด', 'home-recent');
  const recentPanelHeading = recentPanel.querySelector('.home-panel__heading');
  let recentQuizzes = null;
  let recentDocuments = null;
  let recentQuizError = null;
  let recentDocumentError = null;
  const updateRecentPanel = () => {
    recentPanel.replaceChildren(recentPanelHeading);
    const items = [
      ...asArray(recentQuizzes).slice(0, 1).map((item) => ({ ...item, kind: 'quiz' })),
      ...asArray(recentDocuments).slice(0, 1).map((item) => ({ ...item, kind: 'document' })),
    ];
    if (items.length) {
      renderRecentList(recentPanel, items, {
        pathFor: (item) => item.kind === 'quiz' ? `/quizzes/${item.id}` : `/documents/${item.id}`,
        titleFor: (item) => item.title || item.original_filename,
        detailFor: (item) => item.kind === 'quiz'
          ? 'ข้อสอบล่าสุด · คลังข้อสอบ'
          : `เอกสารล่าสุด · ${String(item.file_type || 'เอกสาร').toUpperCase()}`,
        iconText: (item) => item.kind === 'quiz' ? '▤' : '▧',
        emptyMessage: 'ยังไม่มีรายการล่าสุด',
        navigate: onNavigate,
      });
      return;
    }
    if (recentQuizzes === null || recentDocuments === null) {
      recentPanel.append(element('p', 'home-section-message', 'กำลังโหลดรายการล่าสุด…'));
      return;
    }
    const error = recentQuizError || recentDocumentError;
    if (error) {
      sectionError(recentPanel, 'home-recent-error', error);
      return;
    }
    recentPanel.append(element('p', 'home-section-message', 'ยังไม่มีข้อสอบหรือเอกสารที่ใช้ล่าสุด'));
  };
  tasksPanel.append(element('p', 'home-section-message', 'กำลังโหลดงาน…'));
  latestPanel.append(element('p', 'home-section-message', 'กำลังโหลดผลการฝึก…'));
  recentPanel.append(element('p', 'home-section-message', 'กำลังโหลดรายการล่าสุด…'));

  const shortcutsPanel = createPanel('ทางลัด', 'เปิดส่วนที่คุณต้องการได้ทันที', 'home-shortcuts');
  shortcutsPanel.append(createFeatureCards(onNavigate));
  overviewPanel.append(tasksPanel, latestPanel, recentPanel, shortcutsPanel);
  page.append(heading, chartPanel, overviewPanel);

  let chartRequest = 0;
  async function refreshCharts(selectedPeriod) {
    const requestId = ++chartRequest;
    period.disabled = true;
    chartContent.replaceChildren(element('p', 'home-section-message', 'กำลังโหลดกราฟ…'));
    try {
      if (typeof loadOverview !== 'function') throw new Error('ยังไม่ได้เชื่อมต่อข้อมูล Dashboard');
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const data = await loadOverview({ period: selectedPeriod, timeZone });
      if (requestId !== chartRequest) return;
      chartContent.replaceChildren(renderDashboardCharts(data));
    } catch (error) {
      if (requestId !== chartRequest) return;
      chartContent.replaceChildren();
      const message = element('p', 'home-section-message home-section-message--error', error?.message || 'โหลดข้อมูลกราฟไม่สำเร็จ กรุณาลองใหม่');
      message.dataset.role = 'home-chart-error';
      message.setAttribute('role', 'status');
      chartContent.append(message);
    } finally {
      if (requestId === chartRequest) period.disabled = false;
    }
  }

  period.addEventListener('change', () => {
    page.ready = refreshCharts(period.value);
  });

  async function loadPanel(loader, args, fallback, update) {
    try {
      const data = typeof loader === 'function' ? await loader(...args) : fallback;
      update(data, null);
    } catch (error) {
      update(fallback, error);
    }
  }

  async function refreshPage() {
    const loadDeadlinesWithTagColors = async () => {
      const deadlinesRequest = typeof loadDeadlines === 'function'
        ? Promise.resolve().then(() => loadDeadlines())
        : Promise.resolve([]);
      const tagsRequest = typeof loadTags === 'function'
        ? Promise.resolve().then(() => loadTags()).catch(() => ({ tags: [] }))
        : Promise.resolve({ tags: [] });
      const [deadlines, catalog] = await Promise.all([deadlinesRequest, tagsRequest]);
      const tagColorsById = new Map();
      const tagColorsByName = new Map();
      for (const tag of asArray(catalog?.tags)) {
        const name = String(tag?.name || '').trim().toLocaleLowerCase();
        if (name) tagColorsByName.set(name, normalizeTagColor(tag.color));
        const id = Number(tag?.id);
        if (Number.isSafeInteger(id) && id > 0) {
          tagColorsById.set(String(id), normalizeTagColor(tag.color));
        }
      }
      return { deadlines, tagColorsById, tagColorsByName };
    };

    page.ready = Promise.all([
      refreshCharts('day'),
      loadPanel(loadDeadlinesWithTagColors, [], { deadlines: [], tagColorsById: new Map(), tagColorsByName: new Map() }, (data, error) => {
        tasksPanel.replaceChildren(tasksPanel.querySelector('.home-panel__heading'));
        if (error) return sectionError(tasksPanel, 'home-deadlines-error', error);
        renderDeadlineList(tasksPanel, data.deadlines, onNavigate, data.tagColorsById, data.tagColorsByName);
      }),
      loadPanel(loadProgress, [{}], {}, (data, error) => {
        latestPanel.replaceChildren(latestPanel.querySelector('.home-panel__heading'));
        if (error) return sectionError(latestPanel, 'home-progress-error', error);
        const latest = data?.latest_attempt || data?.recent_attempts?.[0];
        const recentAttempts = Array.isArray(data?.recent_attempts)
          ? data.recent_attempts
          : (latest ? [latest] : []);
        if (!latest) {
          latestPanel.append(element('p', 'home-section-message', 'ยังไม่มีประวัติการทำข้อสอบ'));
          latestPanel.append(createAction('เริ่มทำข้อสอบ', '/quizzes', onNavigate));
          return;
        }
        const practiceSummary = element(
          'p',
          'home-practice-summary',
          `ฝึกแล้ว ${Math.max(0, Number(data?.topics_practiced) || 0)} หัวข้อ · ทำข้อสอบ ${recentAttempts.length} ครั้ง`,
        );
        practiceSummary.dataset.role = 'home-practice-summary';
        const summary = element('div', 'home-latest-result');
        const score = Number(latest.score);
        const total = Number(latest.total_questions);
        summary.append(
          element('span', 'home-latest-result__title', latest.quiz_title || 'แบบทดสอบ'),
          element('strong', 'home-latest-result__score', Number.isFinite(score) && Number.isFinite(total) ? `${score} / ${total}` : 'ไม่ระบุคะแนน'),
        );
        const latestScore = summary.querySelector('strong');
        latestScore.dataset.role = 'home-latest-score';
        const latestDate = element('time', 'home-latest-result__date', formatDateTime(latest.submitted_at));
        latestDate.dateTime = latest.submitted_at || '';
        latestPanel.append(summary, practiceSummary, latestDate, createAction('ดูความก้าวหน้า', '/progress', onNavigate));
      }),
      loadPanel(loadQuizzes, [{ limit: 1, offset: 0 }], [], (data, error) => {
        recentQuizzes = asArray(data);
        recentQuizError = error;
        updateRecentPanel();
      }),
      loadPanel(loadDocuments, [{ limit: 1, offset: 0 }], [], (data, error) => {
        recentDocuments = asArray(data);
        recentDocumentError = error;
        updateRecentPanel();
      }),
    ]);
    return page.ready;
  }

  void refreshPage();
  return page;
}
