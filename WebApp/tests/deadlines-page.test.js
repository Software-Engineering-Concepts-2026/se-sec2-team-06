// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderDeadlinesPage } from '../src/pages/DeadlinesPage.js';

const defaultNow = new Date(2026, 9, 12, 12, 0, 0);
const defaultTagCatalog = {
  tags: [
    { id: 1, name: 'คณิตศาสตร์', is_builtin: true, color: 'blue', parent_id: null },
    { id: 2, name: 'ภาษาอังกฤษ', is_builtin: true, color: 'violet', parent_id: null },
    { id: 3, name: 'ภาษาไทย', is_builtin: true, color: 'rose', parent_id: null },
    { id: 4, name: 'ฟิสิกส์', is_builtin: true, color: 'cyan', parent_id: null },
    { id: 5, name: 'เคมี', is_builtin: true, color: 'green', parent_id: null },
    { id: 6, name: 'ชีววิทยา', is_builtin: true, color: 'lime', parent_id: null },
    { id: 7, name: 'สังคมศึกษา', is_builtin: true, color: 'amber', parent_id: null },
    { id: 8, name: 'วิชาอื่น', is_builtin: true, color: 'teal', parent_id: null },
    { id: 99, name: 'ทฤษฎีเซต', is_builtin: false, color: 'cyan', parent_id: null },
  ],
};

function task(overrides = {}) {
  return {
    id: 1,
    title: 'Review set theory',
    subject: 'คณิตศาสตร์',
    due_at: '2026-10-13T02:30:00.000Z',
    priority: 'medium',
    is_completed: false,
    created_at: '2026-10-11T00:00:00Z',
    updated_at: '2026-10-11T00:00:00Z',
    ...overrides,
  };
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function renderPage(overrides = {}) {
  const dependencies = {
    loadDeadlines: vi.fn().mockResolvedValue([]),
    loadTags: vi.fn().mockResolvedValue(defaultTagCatalog),
    createDeadline: vi.fn(),
    updateDeadline: vi.fn(),
    deleteDeadline: vi.fn(),
    confirmDelete: vi.fn().mockReturnValue(true),
    now: () => new Date(defaultNow),
    ...overrides,
  };
  const page = renderDeadlinesPage(dependencies);
  document.body.replaceChildren(page);
  return { page, dependencies };
}

function taskIds(page) {
  return [...page.querySelectorAll('.deadline-task')].map((item) => Number(item.dataset.taskId));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('deadline planner page', () => {
  it('test_deadline_subject_and_priority_selects_keep_labels', async () => {
    const { page } = renderPage();
    await flushPromises();
    const selects = ['[data-role="subject-select"]', '[data-role="priority-select"]']
      .map((selector) => page.querySelector(selector));

    for (const select of selects) {
      expect(select.tagName).toBe('SELECT');
      expect(select.classList.contains('themed-select')).toBe(true);
      expect(select.labels[0]?.textContent.trim()).not.toBe('');
    }
    expect(selects[0].options[1].value).toBe('1');
    expect(selects[1].value).toBe('');
  });

  it('starts empty and never inserts sample tasks', async () => {
    const { page } = renderPage();
    await flushPromises();

    expect(page.querySelector('[data-role="deadline-empty-state"]')?.textContent).toContain('ยังไม่มีงาน');
    expect(page.querySelectorAll('.deadline-task')).toHaveLength(0);
  });

  it('requires a title, subject, date, time, and urgency before saving', () => {
    const { page } = renderPage();

    for (const selector of [
      '[data-role="title-input"]',
      '[data-role="subject-select"]',
      '[data-role="due-date-input"]',
      '[data-role="due-time-input"]',
      '[data-role="priority-select"]',
    ]) {
      expect(page.querySelector(selector).required).toBe(true);
    }
  });

  it('loads all flat tags, including owner-created subjects', async () => {
    const catalog = {
      tags: [
        { id: 1, name: 'คณิตศาสตร์', is_builtin: true, color: 'blue', parent_id: null },
        { id: 8, name: 'วิชาอื่น', is_builtin: true, color: 'teal', parent_id: null },
        { id: 99, name: 'วิชาใหม่', is_builtin: false, color: 'pink', parent_id: null },
      ],
    };
    const loadTags = vi.fn().mockResolvedValue(catalog);
    const { page } = renderPage({ loadTags });
    await flushPromises();

    const options = [...page.querySelector('[data-role="subject-select"]').options];
    expect(loadTags).toHaveBeenCalledOnce();
    expect(options.map((option) => option.value)).toEqual(['', '1', '8', '99']);
  });

  it('creates a task with the selected fields and resets the form on success', async () => {
    const createDeadline = vi.fn().mockImplementation(async (payload) => task({ ...payload, id: 8 }));
    const onDeadlineCreated = vi.fn();
    const { page } = renderPage({ createDeadline, onDeadlineCreated });
    await flushPromises();

    page.querySelector('[data-role="title-input"]').value = '  เตรียมสอบกลางภาค  ';
    page.querySelector('[data-role="subject-select"]').value = '8';
    page.querySelector('[data-role="due-date-input"]').value = '2026-10-15';
    page.querySelector('[data-role="due-time-input"]').value = '09:45';
    page.querySelector('[data-role="priority-select"]').value = 'high';
    submit(page.querySelector('[data-role="deadline-form"]'));
    await flushPromises();

    expect(createDeadline).toHaveBeenCalledWith({
      title: 'เตรียมสอบกลางภาค',
      tag_id: 8,
      due_at: new Date(2026, 9, 15, 9, 45).toISOString(),
      priority: 'high',
    });
    expect(page.querySelector('[data-role="title-input"]').value).toBe('');
    expect(taskIds(page)).toEqual([8]);
    expect(onDeadlineCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 8 }));
  });

  it.each([0, -3])('rejects a successful API response with invalid task ID %s', async (id) => {
    const { page } = renderPage({
      createDeadline: vi.fn().mockResolvedValue(task({ id })),
    });
    await flushPromises();

    page.querySelector('[data-role="title-input"]').value = 'Read chapter 1';
    page.querySelector('[data-role="subject-select"]').value = '1';
    page.querySelector('[data-role="due-date-input"]').value = '2026-10-15';
    page.querySelector('[data-role="due-time-input"]').value = '09:45';
    page.querySelector('[data-role="priority-select"]').value = 'medium';
    submit(page.querySelector('[data-role="deadline-form"]'));
    await flushPromises();

    expect(page.querySelectorAll('.deadline-task')).toHaveLength(0);
    expect(page.querySelector('[data-role="deadline-message"]').textContent).toContain('บันทึกงานไม่สำเร็จ');
  });

  it('shows load and create errors without inventing task cards', async () => {
    const { page } = renderPage({
      loadDeadlines: vi.fn().mockRejectedValue(new Error('โหลดรายการไม่ได้')),
      createDeadline: vi.fn().mockRejectedValue(new Error('บันทึกไม่ได้')),
    });
    await flushPromises();
    expect(page.querySelector('[data-role="deadline-message"]').textContent).toContain('โหลดรายการไม่ได้');
    expect(page.querySelectorAll('.deadline-task')).toHaveLength(0);

    page.querySelector('[data-role="title-input"]').value = 'Read chapter 1';
    page.querySelector('[data-role="subject-select"]').value = '1';
    page.querySelector('[data-role="due-date-input"]').value = '2026-10-15';
    page.querySelector('[data-role="due-time-input"]').value = '09:45';
    page.querySelector('[data-role="priority-select"]').value = 'medium';
    submit(page.querySelector('[data-role="deadline-form"]'));
    await flushPromises();

    expect(page.querySelector('[data-role="deadline-message"]').textContent).toContain('บันทึกไม่ได้');
    expect(page.querySelectorAll('.deadline-task')).toHaveLength(0);
  });

  it('shows each saved task title, subject, due time, and urgency badge', async () => {
    const { page } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue([task({ priority: 'high' })]) });
    await flushPromises();

    const card = page.querySelector('.deadline-task');
    expect(card.querySelector('[data-role="deadline-title"]').textContent).toBe('Review set theory');
    expect(card.querySelector('[data-role="deadline-subject"]').textContent).toBe('คณิตศาสตร์');
    expect(card.querySelector('[data-role="deadline-due-at"]').textContent).not.toBe('');
    expect(card.querySelector('[data-role="deadline-priority"]').textContent).toBe('ด่วน');
  });

  it('sorts tasks by newest creation time before rendering', async () => {
    const { page } = renderPage({
      loadDeadlines: vi.fn().mockResolvedValue([
        task({ id: 1, title: 'Newest', created_at: '2026-10-12T09:00:00Z', due_at: '2026-11-20T09:00:00Z' }),
        task({ id: 3, title: 'Oldest', created_at: '2026-10-08T09:00:00Z', due_at: '2026-10-09T09:00:00Z' }),
        task({ id: 2, title: 'Middle', created_at: '2026-10-10T09:00:00Z', due_at: '2026-10-10T09:00:00Z' }),
      ]),
    });
    await flushPromises();

    expect(taskIds(page)).toEqual([1, 2, 3]);
  });

  it('shows ten newest tasks per page and navigates through the remaining tasks', async () => {
    const tasks = Array.from({ length: 12 }, (_, index) => task({
      id: index + 1,
      title: `Assignment ${index + 1}`,
      created_at: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
    }));
    const { page } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue(tasks) });
    await flushPromises();

    expect(taskIds(page)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(page.querySelector('[data-role="deadline-pagination"]').textContent).toContain('หน้า 1 จาก 2');
    expect(page.querySelector('[data-action="previous-page"]').disabled).toBe(true);

    page.querySelector('[data-action="next-page"]').click();
    expect(taskIds(page)).toEqual([2, 1]);
    expect(page.querySelector('[data-role="deadline-pagination"]').textContent).toContain('หน้า 2 จาก 2');
    expect(page.querySelector('[data-action="next-page"]').disabled).toBe(true);

    page.querySelector('[data-action="previous-page"]').click();
    expect(taskIds(page)).toHaveLength(10);
    expect(page.querySelector('[data-role="deadline-pagination"]').textContent).toContain('หน้า 1 จาก 2');
  });

  it('resets pagination to the first page when the task filter changes', async () => {
    const tasks = Array.from({ length: 12 }, (_, index) => task({
      id: index + 1,
      created_at: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
      is_completed: index < 2,
    }));
    const { page } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue(tasks) });
    await flushPromises();

    page.querySelector('[data-action="next-page"]').click();
    expect(page.querySelector('[data-role="deadline-pagination"]').textContent).toContain('หน้า 2 จาก 2');

    page.querySelector('[data-filter="completed"]').click();
    expect(taskIds(page)).toEqual([2, 1]);
    expect(page.querySelector('[data-role="deadline-pagination"]')).toBeNull();

    page.querySelector('[data-filter="incomplete"]').click();
    expect(taskIds(page)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(page.querySelector('[data-role="deadline-pagination"]')).toBeNull();
  });

  it('filters all, incomplete, and completed tasks and shows a filter-specific empty state', async () => {
    const { page } = renderPage({
      loadDeadlines: vi.fn().mockResolvedValue([
        task({ id: 1, title: 'Not done' }),
        task({ id: 2, title: 'Done', is_completed: true }),
        task({ id: 3, title: 'Also not done', status: 'in_progress' }),
      ]),
    });
    await flushPromises();

    page.querySelector('[data-filter="incomplete"]').click();
    expect(taskIds(page)).toEqual([3, 1]);
    page.querySelector('[data-filter="completed"]').click();
    expect(taskIds(page)).toEqual([2]);
    page.querySelector('[data-filter="all"]').click();
    expect(taskIds(page)).toEqual([3, 2, 1]);

    const { page: noMatches } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue([task()]) });
    await flushPromises();
    noMatches.querySelector('[data-filter="completed"]').click();
    expect(noMatches.querySelector('[data-role="deadline-empty-state"]')?.textContent).toContain('ไม่มีงานที่เสร็จแล้ว');
  });

  it('updates completion for only the selected task', async () => {
    const first = task({ id: 1 });
    const second = task({ id: 2, title: 'Another assignment' });
    const third = task({ id: 3, title: 'In-progress assignment', status: 'in_progress' });
    const updateDeadline = vi.fn().mockImplementation(async (id, payload) => ({
      ...(id === 1 ? first : second),
      ...payload,
    }));
    const { page } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue([first, second, third]), updateDeadline });
    await flushPromises();

    page.querySelector('[data-task-id="1"] [data-action="toggle-completion"]').click();
    await flushPromises();

    expect(updateDeadline).toHaveBeenCalledWith(1, { status: 'completed' });
    expect(page.querySelector('[data-task-id="1"] [data-role="deadline-status"]').textContent).toContain('เสร็จแล้ว');
    expect(page.querySelector('[data-task-id="2"] [data-role="deadline-status"]').textContent).toContain('ยังไม่เริ่ม');
    expect(page.querySelector('[data-task-id="3"] [data-role="deadline-status"]').textContent).toContain('กำลังทำ');
  });

  it('restores completion state when the API update fails', async () => {
    const updateDeadline = vi.fn().mockRejectedValue(new Error('แก้สถานะไม่ได้'));
    const { page } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue([task()]), updateDeadline });
    await flushPromises();

    page.querySelector('[data-action="toggle-completion"]').click();
    await flushPromises();

    expect(page.querySelector('[data-role="deadline-status"]').textContent).toContain('ยังไม่เริ่ม');
    expect(page.querySelector('[data-role="deadline-message"]').textContent).toContain('แก้สถานะไม่ได้');
  });

  it('updates a task to in progress and keeps it inside the incomplete filter', async () => {
    const updateDeadline = vi.fn().mockImplementation(async (id, payload) => task({ id, ...payload }));
    const { page } = renderPage({
      loadDeadlines: vi.fn().mockResolvedValue([task({ id: 5, status: 'not_started' })]),
      updateDeadline,
    });
    await flushPromises();

    const select = page.querySelector('[data-task-id="5"] [data-action="change-status"]');
    select.value = 'in_progress';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    expect(updateDeadline).toHaveBeenCalledWith(5, { status: 'in_progress' });
    expect(page.querySelector('[data-task-id="5"] [data-role="deadline-status"]').textContent).toContain('กำลังทำ');
    page.querySelector('[data-filter="incomplete"]').click();
    expect(taskIds(page)).toEqual([5]);
  });

  it('preserves a task when deletion is cancelled and deletes it after confirmation', async () => {
    const confirmDelete = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const deleteDeadline = vi.fn().mockResolvedValue(null);
    const { page } = renderPage({ loadDeadlines: vi.fn().mockResolvedValue([task()]), confirmDelete, deleteDeadline });
    await flushPromises();

    page.querySelector('[data-action="delete-deadline"]').click();
    expect(taskIds(page)).toEqual([1]);
    expect(deleteDeadline).not.toHaveBeenCalled();

    page.querySelector('[data-action="delete-deadline"]').click();
    await flushPromises();
    expect(confirmDelete).toHaveBeenCalledTimes(2);
    expect(deleteDeadline).toHaveBeenCalledWith(1);
    expect(taskIds(page)).toEqual([]);
  });

  it('keeps all tasks visible when a confirmed delete request fails', async () => {
    const deleteDeadline = vi.fn().mockRejectedValue(new Error('ลบไม่ได้'));
    const { page } = renderPage({
      loadDeadlines: vi.fn().mockResolvedValue([task({ id: 1 }), task({ id: 2, title: 'Keep this' })]),
      deleteDeadline,
    });
    await flushPromises();

    page.querySelector('[data-task-id="1"] [data-action="delete-deadline"]').click();
    await flushPromises();

    expect(taskIds(page)).toEqual([2, 1]);
    expect(page.querySelector('[data-role="deadline-message"]').textContent).toContain('ลบไม่ได้');
  });

  it('shows a Monday-first seven-day overview populated only from saved tasks', async () => {
    const { page } = renderPage({
      now: () => new Date(2026, 9, 12, 12, 0, 0),
      loadDeadlines: vi.fn().mockResolvedValue([
        task({ id: 1, due_at: '2026-10-13T02:30:00Z' }),
        task({ id: 2, due_at: '2026-10-18T10:30:00Z' }),
        task({ id: 3, due_at: '2026-10-11T10:30:00Z' }),
      ]),
    });
    await flushPromises();

    const days = [...page.querySelectorAll('[data-role="week-day"]')];
    expect(days).toHaveLength(7);
    expect(days[0].dataset.date).toBe('2026-10-12');
    expect(days[6].dataset.date).toBe('2026-10-18');
    expect(days[1].querySelector('[data-role="week-count"]').textContent).toBe('1');
    expect(days[6].querySelector('[data-role="week-count"]').textContent).toBe('1');
    expect([...page.querySelectorAll('[data-role="week-count"]')]
      .reduce((total, item) => total + Number(item.textContent), 0)).toBe(2);
  });

  it('uses shared theme tokens and a responsive form/list layout', async () => {
    const styles = document.createElement('style');
    styles.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(styles);
    const { page } = renderPage();
    await flushPromises();

    expect(page.classList.contains('deadline-page')).toBe(true);
    const layout = page.querySelector('.deadline-layout');
    expect(getComputedStyle(layout).display).toBe('grid');
    expect(getComputedStyle(layout).gridTemplateColumns).toContain('minmax');
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-panel\s*\{[^}]*var\(--(?:surface|glass|line|ink|muted|accent)/s);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-task-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/@media \(max-width: 800px\)[\s\S]*?\.deadline-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    styles.remove();
  });
});
