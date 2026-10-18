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
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
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
  it('keeps subject tags visible and allows selecting one at a time', async () => {
    const { page } = renderPage();
    await flushPromises();

    const subjectOptions = page.querySelector('[data-role="subject-options"]');
    expect(subjectOptions.hidden).toBe(false);
    expect(page.querySelector('[data-action="toggle-subject-picker"]')).toBeNull();

    const mathematics = page.querySelector('[data-role="subject-option"][value="1"]');
    mathematics.click();
    expect(subjectOptions.hidden).toBe(false);
    expect(mathematics.checked).toBe(true);
    expect(page.querySelector('[data-action="create-subject-tag"]').hidden).toBe(false);
    expect(page.querySelector('[data-action="manage-subject-tags"]').hidden).toBe(false);

    const physics = page.querySelector('[data-role="subject-option"][value="4"]');
    physics.click();

    expect(subjectOptions.hidden).toBe(false);
    expect(physics.checked).toBe(true);
    expect(mathematics.checked).toBe(false);
  });

  it('renders subjects as accessible single-select tag chips', async () => {
    const { page } = renderPage();
    await flushPromises();
    const subjectGroup = page.querySelector('[data-role="subject-options"]');
    const subjects = [...subjectGroup.querySelectorAll('[data-role="subject-option"]')];
    const prioritySelect = page.querySelector('[data-role="priority-select"]');

    expect(subjectGroup.getAttribute('role')).toBe('radiogroup');
    expect(subjectGroup.getAttribute('aria-required')).toBe('true');
    expect(subjects).toHaveLength(9);
    expect(subjects[0].type).toBe('radio');
    expect(subjects[0].name).toBe('deadline-subject');
    expect(subjects[0].value).toBe('1');
    expect(subjects[0].labels[0]?.textContent).toContain('คณิตศาสตร์');
    expect(prioritySelect.tagName).toBe('SELECT');
    expect(prioritySelect.labels[0]?.textContent.trim()).not.toBe('');

    subjects[0].click();
    subjects[1].click();
    expect(subjects[0].checked).toBe(false);
    expect(subjects[1].checked).toBe(true);
  });

  it('opens a management dialog that lists custom tags only and supports a ten-tag scroll window', async () => {
    const additionalTags = Array.from({ length: 12 }, (_, index) => ({
      id: 100 + index,
      name: `แท็กเพิ่ม ${index + 1}`,
      is_builtin: false,
      color: 'violet',
      parent_id: null,
    }));
    const loadTags = vi.fn().mockResolvedValue({
      tags: [...defaultTagCatalog.tags, ...additionalTags],
    });
    const { page } = renderPage({ loadTags });
    await flushPromises();

    page.querySelector('[data-action="manage-subject-tags"]').click();

    const dialog = page.querySelector('[data-role="subject-tag-management"]');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.hidden).toBe(false);
    expect(dialog.querySelector('[aria-label="ปิดหน้าต่างแก้ไขแท็ก"]').classList.contains('icon-button--danger')).toBe(true);
    const tagList = dialog.querySelector('[data-role="subject-tag-management-list"]');
    expect(tagList.dataset.visibleLimit).toBe('10');
    expect(tagList.querySelectorAll('[data-action="edit-subject-tag"]')).toHaveLength(13);
    expect(tagList.querySelectorAll('[data-action="delete-subject-tag"]')).toHaveLength(13);
    expect(tagList.querySelector('[data-tag-id="1"]')).toBeNull();
  });

  it('stretches every subject-tag row to the same full list width', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(stylesheet);
    const { page } = renderPage();
    await flushPromises();

    page.querySelector('[data-action="manage-subject-tags"]').click();

    const list = page.querySelector('[data-role="subject-tag-management-list"]');
    const rows = [...list.querySelectorAll('[role="listitem"]')];
    expect(getComputedStyle(list).gridTemplateColumns).toBe('minmax(0, 1fr)');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => getComputedStyle(row).width === '100%')).toBe(true);
    stylesheet.remove();
  });

  it('does not leave a reserved scrollbar gap at the right edge of the tag strip', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(stylesheet);
    const { page } = renderPage();
    await flushPromises();

    page.querySelector('[data-action="manage-subject-tags"]').click();

    const tagList = page.querySelector('[data-role="subject-tag-management-list"]');
    expect(getComputedStyle(tagList).scrollbarGutter).toBe('auto');
    expect(getComputedStyle(tagList).paddingRight).toBe('0px');
    expect(getComputedStyle(tagList).overflowY).toBe('auto');
    stylesheet.remove();
  });

  it('shows a color marker and balanced action buttons for each managed tag', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(stylesheet);
    const { page } = renderPage();
    await flushPromises();

    page.querySelector('[data-action="manage-subject-tags"]').click();

    const row = page.querySelector('[data-role="subject-tag-management-list"] [data-tag-id="99"]');
    const chip = row.querySelector('.deadline-subject-management__chip');
    const swatch = chip.querySelector('[data-role="subject-tag-color-swatch"]');
    const editButton = row.querySelector('[data-action="edit-subject-tag"]');
    const deleteButton = row.querySelector('[data-action="delete-subject-tag"]');

    expect(chip.textContent.trim()).toBe('ทฤษฎีเซต');
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
    expect(swatch.dataset.color).toBe('cyan');
    expect(getComputedStyle(row).display).toBe('grid');
    expect(editButton.classList.contains('deadline-subject-management__button--edit')).toBe(true);
    expect(deleteButton.classList.contains('deadline-subject-management__button--delete')).toBe(true);
    expect(getComputedStyle(editButton).minWidth).toBe('4.25rem');
    expect(getComputedStyle(deleteButton).minWidth).toBe('4.25rem');
    stylesheet.remove();
  });

  it('closes the subject-tag management dialog with Escape and restores focus to its trigger', async () => {
    const { page } = renderPage();
    await flushPromises();

    const trigger = page.querySelector('[data-action="manage-subject-tags"]');
    trigger.click();
    const layer = page.querySelector('[data-role="subject-tag-management-layer"]');
    expect(layer.hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(layer.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('creates a subject tag from the picker and selects it for the new deadline', async () => {
    const newSubject = {
      id: 100,
      name: 'ดาราศาสตร์',
      parent_id: null,
      is_builtin: false,
      color: 'pink',
    };
    const refreshedCatalog = { tags: [...defaultTagCatalog.tags, newSubject] };
    const loadTags = vi.fn()
      .mockResolvedValueOnce(defaultTagCatalog)
      .mockResolvedValueOnce(refreshedCatalog);
    const createTag = vi.fn().mockResolvedValue(newSubject);
    const { page } = renderPage({ loadTags, createTag });
    await flushPromises();

    page.querySelector('[data-action="create-subject-tag"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    dialog.querySelector('[aria-label="New topic tag name"]').value = ' ดาราศาสตร์ ';
    const pink = dialog.querySelector('.tag-color-palette input[value="pink"]');
    pink.checked = true;
    pink.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.querySelector('[data-action="create-tag"]').click();
    await flushPromises();

    expect(createTag).toHaveBeenCalledWith({ name: 'ดาราศาสตร์', color: 'pink' });
    expect(loadTags).toHaveBeenCalledTimes(2);
    expect(page.querySelector('[data-role="subject-option"][value="100"]')?.checked).toBe(true);
    expect(page.querySelector('[data-role="subject-options"]').hidden).toBe(false);
    expect(page.querySelector('[data-role="subject-option"][value="100"]').nextElementSibling.textContent).toContain('ดาราศาสตร์');
    expect(document.querySelector('.tag-create-dialog')).toBeNull();
  });

  it('keeps the subject tag dialog open when the API rejects a duplicate tag', async () => {
    const createTag = vi.fn().mockRejectedValue(new Error('มีแท็กชื่อนี้แล้ว'));
    const { page } = renderPage({ createTag });
    await flushPromises();

    page.querySelector('[data-action="create-subject-tag"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    dialog.querySelector('[aria-label="New topic tag name"]').value = 'คณิตศาสตร์';
    dialog.querySelector('[data-action="create-tag"]').click();
    await flushPromises();

    expect(createTag).toHaveBeenCalledWith({ name: 'คณิตศาสตร์', color: 'violet' });
    expect(dialog.isConnected).toBe(true);
    expect(dialog.querySelector('[role="status"]').textContent).toContain('มีแท็กชื่อนี้แล้ว');
  });

  it('edits a custom subject tag name and color and keeps it selected', async () => {
    let catalog = defaultTagCatalog;
    const loadTags = vi.fn().mockImplementation(async () => catalog);
    const updateTag = vi.fn().mockImplementation(async (id, payload) => {
      const updated = { ...catalog.tags.find((tag) => tag.id === id), ...payload };
      catalog = { tags: catalog.tags.map((tag) => tag.id === id ? updated : tag) };
      return updated;
    });
    const { page } = renderPage({ loadTags, updateTag });
    await flushPromises();

    page.querySelector('[data-role="subject-option"][value="99"]').click();
    const manageButton = page.querySelector('[data-action="manage-subject-tags"]');
    expect(manageButton.parentElement).toBe(page.querySelector('[data-role="subject-picker-actions"]'));
    manageButton.click();

    const managePanel = page.querySelector('[data-role="subject-tag-management"]');
    expect(managePanel.hidden).toBe(false);
    expect(managePanel.querySelector('[data-tag-id="1"]')).toBeNull();
    managePanel.querySelector('[data-action="edit-subject-tag"][data-tag-id="99"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    expect(dialog.querySelector('h2').textContent).toBe('แก้ไขแท็ก');
    expect(dialog.querySelector('[aria-label="New topic tag name"]').value).toBe('ทฤษฎีเซต');
    expect(dialog.querySelector('.tag-color-palette input[value="cyan"]').checked).toBe(true);

    const name = dialog.querySelector('[aria-label="New topic tag name"]');
    name.value = 'เซตและความสัมพันธ์';
    const rose = dialog.querySelector('.tag-color-palette input[value="rose"]');
    rose.checked = true;
    rose.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.querySelector('[data-action="save-tag"]').click();
    await flushPromises();

    expect(updateTag).toHaveBeenCalledWith(99, { name: 'เซตและความสัมพันธ์', color: 'rose' });
    expect(loadTags).toHaveBeenCalledTimes(2);
    expect(page.querySelector('[data-role="subject-option"][value="99"]').checked).toBe(true);
    expect(page.querySelector('[data-role="subject-option"][value="99"]').nextElementSibling.textContent).toContain('เซตและความสัมพันธ์');
    expect(page.querySelector('[data-role="subject-tag-management"]').textContent).toContain('เซตและความสัมพันธ์');
    expect(document.querySelector('.tag-create-dialog')).toBeNull();
  });

  it('confirms custom tag deletion, detaches the tag, and keeps the deadline form data', async () => {
    let catalog = defaultTagCatalog;
    const loadTags = vi.fn().mockImplementation(async () => catalog);
    const deleteTag = vi.fn().mockImplementation(async (id) => {
      catalog = { tags: catalog.tags.filter((tag) => tag.id !== id) };
    });
    const confirmDelete = vi.fn().mockReturnValue(true);
    const { page } = renderPage({ loadTags, deleteTag, confirmDelete });
    await flushPromises();

    page.querySelector('[data-role="title-input"]').value = 'ส่งแบบฝึกหัด';
    page.querySelector('[data-role="subject-option"][value="99"]').click();
    const manageButton = page.querySelector('[data-action="manage-subject-tags"]');
    manageButton.click();
    page.querySelector('[data-action="delete-subject-tag"][data-tag-id="99"]').click();
    await flushPromises();

    expect(confirmDelete).toHaveBeenCalledWith(expect.stringContaining('ทฤษฎีเซต'));
    expect(confirmDelete.mock.calls[0][0]).toContain('จะไม่ลบเอกสาร ข้อสอบ บทสนทนา หรืองานกำหนดส่ง');
    expect(deleteTag).toHaveBeenCalledWith(99);
    expect(loadTags).toHaveBeenCalledTimes(2);
    expect(page.querySelector('[data-role="subject-option"][value="99"]')).toBeNull();
    expect(page.querySelector('[data-role="subject-option"]:checked')).toBeNull();
    expect(page.querySelector('[data-role="subject-options"]').hidden).toBe(false);
    expect(page.querySelector('[data-action="manage-subject-tags"]').hidden).toBe(false);
    expect(page.querySelector('[data-role="title-input"]').value).toBe('ส่งแบบฝึกหัด');
  });

  it('does not delete a subject tag when the confirmation is cancelled', async () => {
    const deleteTag = vi.fn();
    const confirmDelete = vi.fn().mockReturnValue(false);
    const { page } = renderPage({ deleteTag, confirmDelete });
    await flushPromises();

    page.querySelector('[data-action="manage-subject-tags"]').click();
    page.querySelector('[data-action="delete-subject-tag"][data-tag-id="99"]').click();

    expect(confirmDelete).toHaveBeenCalledOnce();
    expect(deleteTag).not.toHaveBeenCalled();
    expect(page.querySelector('[data-role="subject-option"][value="99"]')).not.toBeNull();
  });

  it('starts empty and never inserts sample tasks', async () => {
    const { page } = renderPage();
    await flushPromises();

    expect(page.querySelector('[data-role="deadline-empty-state"]')?.textContent).toContain('ยังไม่มีงาน');
    expect(page.querySelectorAll('.deadline-task')).toHaveLength(0);
  });

  it('requires a title, subject, date, time, and urgency before saving', async () => {
    const { page } = renderPage();
    await flushPromises();

    for (const selector of [
      '[data-role="title-input"]',
      '[data-role="due-date-input"]',
      '[data-role="due-time-input"]',
      '[data-role="priority-select"]',
    ]) {
      expect(page.querySelector(selector).required).toBe(true);
    }
    expect(page.querySelector('[data-role="subject-options"]').getAttribute('aria-required')).toBe('true');
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

    const options = [...page.querySelectorAll('[data-role="subject-option"]')];
    expect(loadTags).toHaveBeenCalledOnce();
    expect(options.map((option) => option.value)).toEqual(['1', '8', '99']);
    expect(options.map((option) => option.labels[0].textContent)).toEqual(['คณิตศาสตร์', 'วิชาอื่น', 'วิชาใหม่']);
  });

  it('creates a task with the selected fields and resets the form on success', async () => {
    const createDeadline = vi.fn().mockImplementation(async (payload) => task({ ...payload, id: 8 }));
    const onDeadlineCreated = vi.fn();
    const { page } = renderPage({ createDeadline, onDeadlineCreated });
    await flushPromises();

    page.querySelector('[data-role="title-input"]').value = '  เตรียมสอบกลางภาค  ';
    page.querySelector('[data-role="subject-option"][value="8"]').click();
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
    page.querySelector('[data-role="subject-option"][value="1"]').click();
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
    page.querySelector('[data-role="subject-option"][value="1"]').click();
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
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-subject-management__list\s*\{[^}]*max-height:\s*min\(33\.4rem,\s*calc\(100vh - 15rem\)\)[^}]*overflow-y:\s*auto/s);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-subject-management__row\s*\{[^}]*min-height:\s*2\.9rem;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/s);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-subject-picker__create\s*\{[^}]*color:\s*var\(--accent-ink\)/s);
    const managementDialogStyles = readFileSync('src/styles.css', 'utf8')
      .match(/\.deadline-subject-management\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(managementDialogStyles).toMatch(/border:\s*1px solid var\(--line-strong\)/);
    expect(managementDialogStyles).toMatch(/color:\s*var\(--ink\)/);
    expect(managementDialogStyles).toMatch(/background:\s*var\(--glass\)/);
    expect(managementDialogStyles).not.toMatch(/--ink:\s*#20212a|--muted:\s*#4f545e|background:\s*#c9cad0/i);
    expect(managementDialogStyles).toMatch(/box-shadow:\s*var\(--shadow\)/);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-subject-management__row\s*\{[^}]*background:\s*var\(--surface-raised\)/s);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.deadline-subject-management__row:hover\s*\{[^}]*var\(--surface-raised\)/s);
    expect(readFileSync('src/styles.css', 'utf8')).toMatch(/\.icon-button--danger\s*\{[^}]*color:\s*var\(--error\)[^}]*background:\s*var\(--error-soft\)/s);
    styles.remove();
  });
});
