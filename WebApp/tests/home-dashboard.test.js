// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { renderDashboardCharts } from '../src/dashboard/dashboard-charts.js';
import { renderHomePage } from '../src/pages/HomePage.js';

const overview = {
  quiz_activity: [
    { label: '2026-10-06', count: 0 },
    { label: '2026-10-07', count: 0 },
    { label: '2026-10-08', count: 1 },
    { label: '2026-10-09', count: 0 },
    { label: '2026-10-10', count: 2 },
    { label: '2026-10-11', count: 0 },
    { label: '2026-10-12', count: 3 },
  ],
  task_status: { not_started: 2, in_progress: 1, completed: 1 },
  documents_by_tag: [
    { tag_id: 1, tag_name: 'คณิตศาสตร์', color: 'blue', count: 4 },
    { tag_id: 2, tag_name: 'ภาษาอังกฤษ', color: 'rose', count: 1 },
  ],
  topics_to_review: [
    { tag_id: 1, tag_name: 'คณิตศาสตร์', color: 'blue', average_percent: 0, attempt_count: 2 },
  ],
};

function dashboardLoaders(overrides = {}) {
  return {
    loadOverview: vi.fn().mockResolvedValue(overview),
    loadDeadlines: vi.fn().mockResolvedValue([
      { id: 1, title: 'ส่งชิ้นงาน', subject: 'คณิตศาสตร์', tag_id: 1, due_at: '2026-10-14T09:00:00Z', status: 'not_started' },
      { id: 2, title: 'อ่านบทที่ 2', subject: 'ภาษาอังกฤษ', tag_id: 2, due_at: '2026-10-13T09:00:00Z', status: 'in_progress' },
      { id: 3, title: 'ทำเสร็จแล้ว', subject: 'ชีววิทยา', due_at: '2026-10-12T09:00:00Z', status: 'completed' },
    ]),
    loadTags: vi.fn().mockResolvedValue({
      tags: [
        { id: 1, name: 'คณิตศาสตร์', color: 'blue', parent_id: null, is_builtin: true },
        { id: 2, name: 'ภาษาอังกฤษ', color: 'violet', parent_id: null, is_builtin: true },
      ],
    }),
    loadProgress: vi.fn().mockResolvedValue({
      topics_practiced: 1,
      latest_attempt: { quiz_title: 'เซตเบื้องต้น', score: 0, total_questions: 10, submitted_at: '2026-10-12T09:00:00Z' },
      recent_attempts: [
        { quiz_title: 'เซตเบื้องต้น', score: 0, total_questions: 10, submitted_at: '2026-10-12T09:00:00Z' },
        { quiz_title: 'ภาษาอังกฤษ', score: 3, total_questions: 5, submitted_at: '2026-10-11T09:00:00Z' },
      ],
      topics: [],
    }),
    loadQuizzes: vi.fn().mockResolvedValue([
      { id: 8, title: 'แบบทดสอบเรื่องเซต', question_count: 5, tags: [{ id: 1, name: 'คณิตศาสตร์', color: 'blue' }] },
    ]),
    loadDocuments: vi.fn().mockResolvedValue([
      { id: 9, title: 'สรุปเรื่องเซต', original_filename: 'sets.pdf', file_type: 'pdf', tags: [{ id: 2, name: 'ภาษาอังกฤษ', color: 'rose' }] },
    ]),
    ...overrides,
  };
}

describe('Home dashboard', () => {
  afterEach(() => document.body.replaceChildren());

  it('keeps the public Home atom and does not request private dashboard data', () => {
    const loaders = dashboardLoaders();
    const page = renderHomePage({ user: null, onNavigate: vi.fn(), ...loaders });
    document.body.append(page);

    expect(page.querySelector('.atom-stage')).not.toBeNull();
    expect(page.querySelector('[data-route="/quizzes/create"]')).not.toBeNull();
    expect(loaders.loadOverview).not.toHaveBeenCalled();
    expect(loaders.loadDeadlines).not.toHaveBeenCalled();
    expect(loaders.loadProgress).not.toHaveBeenCalled();
    expect(loaders.loadTags).not.toHaveBeenCalled();
  });

  it('sorts open deadlines by nearest due date and excludes completed tasks', async () => {
    const page = renderHomePage({ user: { id: 3, display_name: 'Learner' }, ...dashboardLoaders() });
    await page.ready;

    const tasks = [...page.querySelectorAll('[data-role="home-upcoming-task"]')];
    expect(tasks.map((task) => task.dataset.deadlineId)).toEqual(['2', '1']);
    expect(tasks[0].textContent).toContain('อ่านบทที่ 2');
  });

  it('colors each upcoming task and subject chip from the matching tag', async () => {
    const page = renderHomePage({
      user: { id: 3, display_name: 'Learner' },
      ...dashboardLoaders({
        loadDeadlines: vi.fn().mockResolvedValue([
          { id: 15, title: 'รายงานฟิสิกส์', subject: 'ฟิสิกส์', tag_id: 30, due_at: '2026-10-20T09:00:00Z', status: 'not_started' },
          { id: 16, title: 'สรุปสังคม', subject: 'สังคมศึกษา', tag_id: 31, due_at: '2026-10-21T09:00:00Z', status: 'not_started' },
          { id: 17, title: 'แท็กเก่าที่ไม่รู้จัก', subject: 'ภาษาไทย', tag_id: 999, due_at: '2026-10-22T09:00:00Z', status: 'not_started' },
          { id: 18, title: 'วรรณคดี', subject: 'ภาษาไทย', tag_id: null, due_at: '2026-10-23T09:00:00Z', status: 'not_started' },
        ]),
        loadTags: vi.fn().mockResolvedValue({
          tags: [
            { id: 30, name: 'ฟิสิกส์', color: 'cyan', parent_id: null, slug: 'physics', owner_id: null, is_builtin: true },
            { id: 31, name: 'สังคมศึกษา', color: 'amber', parent_id: null, slug: 'social-studies', owner_id: null, is_builtin: true },
            { id: 32, name: 'ภาษาไทย', color: 'rose', parent_id: null, slug: 'thai', owner_id: null, is_builtin: true },
          ],
        }),
      }),
    });
    await page.ready;

    const physics = page.querySelector('[data-deadline-id="15"]');
    const socialStudies = page.querySelector('[data-deadline-id="16"]');
    const unknownTagWithKnownSubject = page.querySelector('[data-deadline-id="17"]');
    const legacySubject = page.querySelector('[data-deadline-id="18"]');
    expect(physics.dataset.color).toBe('cyan');
    expect(physics.querySelector('.home-upcoming-item__subject').dataset.color).toBe('cyan');
    expect(socialStudies.dataset.color).toBe('amber');
    expect(socialStudies.querySelector('.home-upcoming-item__subject').dataset.color).toBe('amber');
    expect(unknownTagWithKnownSubject.dataset.color).toBe('violet');
    expect(legacySubject.dataset.color).toBe('rose');
  });

  it('shows a latest zero score as a real result', async () => {
    const page = renderHomePage({ user: { id: 3, display_name: 'Learner' }, ...dashboardLoaders() });
    await page.ready;

    expect(page.querySelector('[data-role="home-latest-score"]').textContent).toBe('0 / 10');
    expect(page.textContent).not.toContain('ยังไม่มีคะแนน');
    expect(page.querySelector('[data-role="home-practice-summary"]')?.textContent).toContain('ฝึกแล้ว 1 หัวข้อ');
    expect(page.querySelector('[data-role="home-practice-summary"]')?.textContent).toContain('ทำข้อสอบ 2 ครั้ง');
    const progressContent = [...page.querySelector('[data-section="home-progress"]').children];
    expect(progressContent.indexOf(page.querySelector('.home-latest-result')))
      .toBeLessThan(progressContent.indexOf(page.querySelector('[data-role="home-practice-summary"]')));
    expect(progressContent.indexOf(page.querySelector('.home-latest-result__date')))
      .toBeGreaterThan(progressContent.indexOf(page.querySelector('[data-role="home-practice-summary"]')));
  });

  it('links recent quizzes, documents and all core study features', async () => {
    const onNavigate = vi.fn();
    const page = renderHomePage({ user: { id: 3, display_name: 'Learner' }, onNavigate, ...dashboardLoaders() });
    await page.ready;

    expect(page.querySelector('[data-route="/quizzes/8"]')?.textContent).toContain('แบบทดสอบเรื่องเซต');
    expect(page.querySelector('[data-route="/documents/9"]')?.textContent).toContain('สรุปเรื่องเซต');
    for (const path of ['/tutor', '/quizzes', '/documents', '/deadlines', '/progress']) {
      expect(page.querySelector(`[data-route="${path}"]`)).not.toBeNull();
    }
  });

  it('keeps a clear dashboard hierarchy with real activity, next steps, recents, and feature shortcuts', async () => {
    const page = renderHomePage({ user: { id: 3, display_name: 'Learner' }, ...dashboardLoaders() });
    await page.ready;

    expect(page.firstElementChild.classList.contains('home-dashboard-heading')).toBe(true);
    expect(page.querySelector('[data-section="home-analytics"]')).not.toBeNull();
    expect([...page.querySelector('.home-dashboard-content').children].map((panel) => panel.dataset.section))
      .toEqual(['home-upcoming', 'home-progress', 'home-recent', 'home-shortcuts']);
    expect(page.querySelectorAll('.home-recent-group')).toHaveLength(0);
    expect(page.querySelectorAll('[data-section="home-recent"] .home-recent-item')).toHaveLength(2);
    expect(page.querySelector('[data-section="home-recent"] [data-route="/quizzes"]')).toBeNull();
    expect(page.querySelector('[data-section="home-recent"] [data-route="/documents"]')).toBeNull();
    expect(page.querySelector('[data-route="/quizzes/8"]')?.textContent).toContain('แบบทดสอบเรื่องเซต');
    expect(page.querySelector('[data-route="/documents/9"]')?.textContent).toContain('สรุปเรื่องเซต');
    expect(page.querySelector('[data-route="/quizzes/8"] .home-recent-item__tag')?.dataset.color).toBe('blue');
    expect(page.querySelector('[data-route="/documents/9"] .home-recent-item__tag')?.dataset.color).toBe('rose');
    expect(page.querySelectorAll('.dashboard-chart')).toHaveLength(4);
    expect(page.querySelectorAll('.home-feature-card')).toHaveLength(5);
  });

  it('uses a compact theme-token dashboard grid that reflows for tablet and phone', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/main:has\(> \.home-dashboard-page\)\s*\{[^}]*2400px/s);
    expect(styles).toMatch(/\.home-dashboard-content\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/s);
    expect(styles).toMatch(/\.dashboard-chart-grid\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/s);
    expect(styles).toMatch(/\.dashboard-chart\[data-chart="quiz-activity"\],\s*\.dashboard-chart\[data-chart="task-status"\],\s*\.dashboard-chart\[data-chart="document-tags"\],\s*\.dashboard-chart\[data-chart="weak-topics"\]\s*\{[^}]*grid-column:\s*span\s+3/s);
    expect(styles).toMatch(/\.home-dashboard-content\s+\[data-section="home-upcoming"\],\s*\.home-dashboard-content\s+\[data-section="home-recent"\]\s*\{[^}]*grid-column:\s*span\s+8/s);
    expect(styles).toMatch(/\.home-dashboard-content\s+\[data-section="home-progress"\],\s*\.home-dashboard-content\s+\[data-section="home-shortcuts"\]\s*\{[^}]*grid-column:\s*span\s+4/s);
    expect(styles).toMatch(/\.home-upcoming-item__details\s*\{[^}]*display:\s*flex/s);
    expect(styles).toMatch(/\.home-upcoming-item\s*\{[^}]*padding:\s*0\.52rem\s+0\.72rem/s);
    expect(styles).toMatch(/\.home-dashboard-content\s+\[data-section="home-recent"\]\s*\{[^}]*grid-column:\s*span\s+8/s);
    expect(styles).toMatch(/\.home-dashboard-content\s+\[data-section="home-shortcuts"\]\s*\{[^}]*grid-column:\s*span\s+4/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*700px\)[\s\S]*?\.home-dashboard-content,\s*\.dashboard-chart-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    expect(styles).toMatch(/\.home-panel\s*\{[^}]*background:\s*linear-gradient\([^}]*var\(--glass\)/s);
    expect(styles).toMatch(/\.dashboard-chart\s*\{[^}]*background:\s*var\(--surface\)/s);
    expect(styles).toMatch(/\.home-dashboard-heading\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s);
  });

  it('renders all four dashboard chart cards at the same width on desktop', () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync('src/styles.css', 'utf8');
    const charts = renderDashboardCharts(overview);
    document.body.append(stylesheet, charts);

    const widths = [...charts.querySelectorAll('.dashboard-chart')]
      .map((card) => window.getComputedStyle(card).gridColumn);

    expect(widths).toEqual(['span 3', 'span 3', 'span 3', 'span 3']);
  });

  it('uses tag accents for assignment cards and preserves chart tag colors with readable text edges', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.home-upcoming-item\[data-color="cyan"\]\s*\{[^}]*--home-task-accent:\s*#72dced/s);
    expect(styles).toMatch(/\.home-upcoming-item\s*\{[^}]*border-left:\s*3px solid var\(--home-task-accent\)/s);
    expect(styles).toMatch(/\.dashboard-chart__bar--weak:not\(\[data-color\]\)\s*\{[^}]*fill:\s*var\(--success\)/s);
    expect(styles).toMatch(/\.home-dashboard-page[^{}]*\{[^}]*-webkit-text-stroke:/s);
  });

  it('renders four data charts with useful accessible names and visible values', () => {
    const charts = renderDashboardCharts(overview);

    expect(charts.querySelectorAll('.dashboard-chart')).toHaveLength(4);
    expect(charts.querySelectorAll('svg[role="img"]')).toHaveLength(4);
    const activityChart = charts.querySelector('[data-chart="quiz-activity"]');
    expect(activityChart.querySelector('.dashboard-chart__summary')?.textContent).toContain('ครั้ง');
    expect(activityChart.querySelector('.dashboard-chart__data-list')?.classList.contains('visually-hidden')).toBe(true);
    expect([...activityChart.querySelectorAll('.dashboard-chart__axis-label')].map((label) => label.textContent))
      .toEqual(['6', '7', '8', '9', '10', '11', '12']);
    expect(charts.textContent).toContain('จำนวนทำข้อสอบ');
    expect(charts.textContent).toContain('สถานะงาน');
    expect(charts.textContent).toContain('คลังเอกสารตามแท็ก');
    expect(charts.textContent).toContain('หัวข้อที่ควรทบทวน');
    expect(charts.textContent).toContain('คณิตศาสตร์');
    expect(charts.textContent).toContain('0%');
    expect(charts.textContent).toContain('2 ครั้ง');
    expect(charts.querySelectorAll('svg desc')).toHaveLength(4);
    const weakTopicsChart = charts.querySelector('[data-chart="weak-topics"]');
    expect(weakTopicsChart.querySelector('svg desc')?.textContent).toContain('รายการอ่านหน้าจอ');
    expect(weakTopicsChart.querySelector('.dashboard-chart__data-list li')?.textContent).toContain('0% · 2 ครั้ง');
    expect(weakTopicsChart.querySelector('svg desc')?.textContent).not.toContain('0%');
    expect(charts.querySelector('[data-chart="document-tags"] .dashboard-chart__data-list')?.classList.contains('visually-hidden')).toBe(true);
  });

  it('shows a focused activity total, the selected date range, active days, and visible values for each bar', () => {
    const activityChart = renderDashboardCharts(overview).querySelector('[data-chart="quiz-activity"]');

    expect(activityChart.querySelector('[data-role="quiz-activity-total"]')?.textContent).toBe('6');
    expect(activityChart.querySelector('[data-role="quiz-activity-period"]')?.textContent).toBe('6–12 ต.ค. 2569');
    expect(activityChart.querySelector('[data-role="quiz-activity-active-days"]')?.textContent).toBe('ทำข้อสอบ 3 จาก 7 วัน');
    expect([...activityChart.querySelectorAll('[data-role="quiz-activity-bar-value"]')].map((value) => value.textContent))
      .toEqual(['1', '2', '3']);
  });

  it('labels weekly activity periods as Thai week numbers', () => {
    const activityChart = renderDashboardCharts({
      quiz_activity: [
        { label: '2026-W40', count: 1 },
        { label: '2026-W41', count: 2 },
        { label: '2026-W42', count: 3 },
      ],
    }).querySelector('[data-chart="quiz-activity"]');

    expect(activityChart.querySelector('[data-role="quiz-activity-period"]')?.textContent).toBe('สัปดาห์ 40–42 · 2569');
  });

  it('keeps status labels and counts visually grouped in the donut legend', () => {
    const charts = renderDashboardCharts(overview);
    const statusChart = charts.querySelector('[data-chart="task-status"]');
    const items = [...statusChart.querySelectorAll('.dashboard-chart__legend-item')];
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(items.map((item) => `${item.querySelector('span:nth-child(2)')?.textContent} ${item.querySelector('strong')?.textContent}`))
      .toEqual(['ยังไม่เริ่ม 2', 'กำลังทำ 1', 'เสร็จแล้ว 1']);
    expect(styles).toMatch(/\.dashboard-chart__legend\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*justify-content:\s*center/s);
    expect(styles).toMatch(/\.dashboard-chart__legend-item\s*\{[^}]*gap:\s*0\.28rem[^}]*font-size:\s*0\.82rem[^}]*white-space:\s*nowrap/s);
    expect(styles).toMatch(/\.dashboard-chart__legend-item\s+strong\s*\{[^}]*margin-left:\s*0/s);
  });

  it('centers the task-status donut and its labels on the chart canvas', () => {
    const charts = renderDashboardCharts(overview);
    const svg = charts.querySelector('[data-chart="task-status"] svg');
    const centerX = Number(svg.getAttribute('viewBox').split(' ')[2]) / 2;

    expect(svg.querySelector('.dashboard-chart__donut-track').getAttribute('cx')).toBe(String(centerX));
    expect([...svg.querySelectorAll('.dashboard-chart__donut-segment')].every((segment) => segment.getAttribute('cx') === String(centerX))).toBe(true);
    expect(svg.querySelector('.dashboard-chart__donut-total').getAttribute('x')).toBe(String(centerX));
    expect(svg.querySelector('.dashboard-chart__donut-caption').getAttribute('x')).toBe(String(centerX));
  });

  it('shows distinct empty states without inventing chart values', () => {
    const charts = renderDashboardCharts({
      quiz_activity: Array.from({ length: 7 }, (_, index) => ({ label: `day-${index}`, count: 0 })),
      task_status: { not_started: 0, in_progress: 0, completed: 0 },
      documents_by_tag: [],
      topics_to_review: [],
    });

    expect(charts.querySelectorAll('[data-role="chart-empty"]')).toHaveLength(4);
    expect(charts.querySelectorAll('[data-role="chart-data-value"]')).toHaveLength(0);
  });

  it('uses a shared themed period control and refreshes only the charts for the selected period', async () => {
    const loadOverview = vi.fn().mockResolvedValue(overview);
    const loaders = dashboardLoaders({ loadOverview });
    const page = renderHomePage({ user: { id: 3, display_name: 'Learner' }, ...loaders });
    await page.ready;
    const period = page.querySelector('[aria-label="ช่วงเวลาแสดงกราฟ"]');
    expect(period.classList.contains('themed-select')).toBe(true);
    expect(loadOverview).toHaveBeenCalledWith(expect.objectContaining({ period: 'day', timeZone: expect.any(String) }));

    period.value = 'week';
    period.dispatchEvent(new Event('change', { bubbles: true }));
    await page.ready;
    expect(loadOverview).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'week' }));
    expect(loaders.loadDeadlines).toHaveBeenCalledTimes(1);
  });

  it('shows per-section API failure messages while preserving the rest of the dashboard', async () => {
    const page = renderHomePage({
      user: { id: 3, display_name: 'Learner' },
      ...dashboardLoaders({ loadProgress: vi.fn().mockRejectedValue(new Error('network')) }),
    });
    await page.ready;

    expect(page.querySelector('[data-role="home-progress-error"]')).not.toBeNull();
    expect(page.querySelector('[data-role="home-upcoming-task"]')).not.toBeNull();
  });
});
