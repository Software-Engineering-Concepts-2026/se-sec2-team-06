// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderQuizDetailPage } from '../src/pages/QuizDetailPage.js';
import { renderQuizLibraryPage } from '../src/pages/QuizLibraryPage.js';

const quiz = {
  id: 12,
  title: 'Set theory basics',
  source_filename: 'sets.md',
  source_type: 'md',
  language: 'th',
  difficulty: 'basic',
  question_count: 5,
  created_at: '2026-10-10T08:00:00Z',
  attempt_count: 2,
  latest_attempt: {
    id: 7,
    quiz_id: 12,
    score: 3,
    total_questions: 5,
    submitted_at: '2026-10-11T08:00:00Z',
  },
  best_score: 4,
};

const attempts = [
  { id: 7, quiz_id: 12, score: 3, total_questions: 5, submitted_at: '2026-10-11T08:00:00Z' },
  { id: 5, quiz_id: 12, score: 4, total_questions: 5, submitted_at: '2026-10-10T08:00:00Z' },
];

const tagCatalog = {
  tags: [
    { id: 1, name: 'Mathematics', is_builtin: true, color: 'blue', parent_id: null },
    { id: 8, name: 'Sets', parent_id: 1, is_builtin: false, color: 'pink' },
  ],
};

function renderLibrary(options = {}) {
  const page = renderQuizLibraryPage({
    loadTags: async () => tagCatalog,
    ...options,
  });
  mountedPages.push(page);
  return page;
}

const mountedPages = [];

async function flushPromises() {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('quiz library and detail pages', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  });
  afterEach(() => {
    mountedPages.splice(0).forEach((page) => page.destroy?.());
  });

  it('shows loading, then a helpful empty state linking to create a quiz', async () => {
    let finishLoading;
    const page = renderLibrary({
      loadQuizzes: () => new Promise((resolve) => { finishLoading = resolve; }),
      navigate: vi.fn(),
    });
    document.body.append(page);

    expect(page.querySelector('[role="status"]').textContent).toContain('กำลังโหลด');
    finishLoading([]);
    await flushPromises();

    expect(page.textContent).toContain('ยังไม่มีข้อสอบ');
    expect(page.querySelector('[data-route="/quizzes/create"]')?.getAttribute('href')).toBe('/quizzes/create');
  });

  it('keeps the create-quiz action visible when the library already has quizzes', async () => {
    const page = renderLibrary({ loadQuizzes: async () => [{ ...quiz }] });
    document.body.append(page);
    await flushPromises();

    const createLinks = page.querySelectorAll('[data-route="/quizzes/create"]');
    expect(createLinks).toHaveLength(1);
    expect(createLinks[0].textContent).toContain('สร้างข้อสอบ');
  });

  it('renders quiz metadata, attempt count, latest and best scores with safe text nodes', async () => {
    const page = renderLibrary({ loadQuizzes: vi.fn().mockResolvedValue([{
      ...quiz,
      title: '<img src=x onerror=alert(1)>',
    }]) });
    document.body.append(page);
    await flushPromises();

    const card = page.querySelector('[data-quiz-id="12"]');
    expect(card.querySelector('h2').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain('sets.md');
    expect(card.textContent).toContain('Markdown');
    expect(card.textContent).toContain('5 ข้อ');
    expect(card.textContent).toContain('ทำแล้ว 2 ครั้ง');
    expect(card.textContent).toContain('3 / 5');
    const bestScore = card.querySelector('.quiz-library-card__best-score');
    expect(bestScore?.textContent).toContain('ดีที่สุด 4 / 5');
    expect(card.querySelector('.quiz-library-card__actions')?.lastElementChild).toBe(bestScore);
    expect(card.querySelector('[data-action="delete-quiz"] svg')).not.toBeNull();
    expect(card.querySelector('[data-route="/quizzes/12"]')).not.toBeNull();
    expect(card.querySelector('[data-route="/quizzes/12/take"]')).not.toBeNull();
  });

  it('cancels quiz deletion without sending a request', async () => {
    const deleteQuiz = vi.fn();
    const page = renderLibrary({ loadQuizzes: async () => [{ ...quiz }], deleteQuiz });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="delete-quiz"]').click();
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain(quiz.title);
    expect(dialog?.textContent).toContain('ประวัติการทำ คะแนน และเฉลย');
    dialog.querySelector('button').click();
    await flushPromises();

    expect(deleteQuiz).not.toHaveBeenCalled();
    expect(page.querySelector('[data-quiz-id="12"]')).not.toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('confirms deletion of only the selected quiz and refreshes the current page', async () => {
    const deleteQuiz = vi.fn().mockResolvedValue(null);
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce([{ ...quiz }, { ...quiz, id: 13, title: 'Other quiz' }])
      .mockResolvedValueOnce([{ ...quiz, id: 13, title: 'Other quiz' }]);
    const page = renderLibrary({ loadQuizzes, deleteQuiz });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-quiz-id="12"] [data-action="delete-quiz"]').click();
    document.querySelector('[role="alertdialog"] button.button-danger').click();
    await flushPromises();

    expect(deleteQuiz).toHaveBeenCalledOnce();
    expect(deleteQuiz).toHaveBeenCalledWith(12);
    expect(page.querySelector('[data-quiz-id="12"]')).toBeNull();
    expect(page.querySelector('[data-quiz-id="13"]')).not.toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('keeps the quiz after a failed deletion and announces the error', async () => {
    const deleteQuiz = vi.fn().mockRejectedValue(new Error('ลบข้อสอบไม่สำเร็จ'));
    const page = renderLibrary({ loadQuizzes: async () => [{ ...quiz }], deleteQuiz });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="delete-quiz"]').click();
    document.querySelector('[role="alertdialog"] button.button-danger').click();
    await flushPromises();

    expect(page.querySelector('[data-quiz-id="12"]')).not.toBeNull();
    expect(document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toContain('ลบข้อสอบไม่สำเร็จ');
    expect(document.querySelector('[role="alertdialog"] button.button-danger').disabled).toBe(false);
    document.querySelector('[role="alertdialog"] button.button-secondary').click();
  });

  it('returns to the previous filtered page when deleting its last quiz', async () => {
    const firstPage = Array.from({ length: 13 }, (_, index) => ({ ...quiz, id: index + 1, title: `Sets ${index + 1}` }));
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ ...quiz, id: 99, title: 'Filtered last quiz' }])
      .mockResolvedValueOnce(firstPage.slice(0, 12));
    const confirmDelete = vi.fn().mockResolvedValue(true);
    const deleteQuiz = vi.fn().mockResolvedValue(null);
    const page = renderLibrary({ loadQuizzes, confirmDelete, deleteQuiz });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[aria-label="ค้นหาชื่อข้อสอบหรือ tag"]').value = 'sets';
    page.querySelector('select').value = '1';
    submit(page.querySelector('[data-role="quiz-search-form"]'));
    await flushPromises();
    page.querySelector('[data-action="next-page"]').click();
    await flushPromises();
    page.querySelector('[data-action="delete-quiz"]').click();
    await flushPromises();

    expect(deleteQuiz).toHaveBeenCalledWith(99);
    expect(loadQuizzes).toHaveBeenLastCalledWith({ limit: 13, offset: 0, q: 'sets', tagId: 1 });
    expect(page.querySelectorAll('[data-quiz-id]')).toHaveLength(12);
    expect(page.querySelector('[data-role="page-status"]').textContent).toContain('1');
  });

  it('replaces the quiz cards when paging and never shows more than six rows', async () => {
    const firstPage = Array.from({ length: 13 }, (_, index) => ({
      ...quiz,
      id: index + 1,
      title: `Quiz ${index + 1}`,
    }));
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ ...quiz, id: 21, title: 'Quiz 21' }])
      .mockResolvedValueOnce(firstPage);
    const page = renderLibrary({ loadQuizzes });
    document.body.append(page);
    await flushPromises();

    const pagination = page.querySelector('[data-role="pagination"]');
    const next = page.querySelector('[data-action="next-page"]');
    expect(loadQuizzes).toHaveBeenNthCalledWith(1, { limit: 13, offset: 0 });
    expect(page.querySelectorAll('[data-quiz-id]')).toHaveLength(12);
    expect(pagination.hidden).toBe(false);
    expect(page.querySelector('[data-role="page-status"]').textContent).toContain('1');

    next.click();
    await flushPromises();

    expect(loadQuizzes).toHaveBeenNthCalledWith(2, { limit: 13, offset: 12 });
    expect(page.querySelectorAll('[data-quiz-id]')).toHaveLength(1);
    expect(page.querySelector('[data-quiz-id="21"] h2').textContent).toBe('Quiz 21');
    expect(page.querySelector('[data-action="previous-page"]').disabled).toBe(false);
    expect(next.disabled).toBe(true);
    expect(page.querySelector('[data-role="page-status"]').textContent).toContain('2');

    page.querySelector('[data-action="previous-page"]').click();
    await flushPromises();
    expect(loadQuizzes).toHaveBeenNthCalledWith(3, { limit: 13, offset: 0 });
    expect(page.querySelectorAll('[data-quiz-id]')).toHaveLength(12);
  });

  it('adapts quiz page size when the viewport changes from desktop to mobile', async () => {
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 13 }, (_, index) => ({ ...quiz, id: index + 1 })))
      .mockResolvedValueOnce(Array.from({ length: 7 }, (_, index) => ({ ...quiz, id: index + 30 })));
    const page = renderLibrary({ loadQuizzes });
    document.body.append(page);
    await flushPromises();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    window.dispatchEvent(new Event('resize'));
    await flushPromises();

    expect(loadQuizzes).toHaveBeenNthCalledWith(2, { limit: 7, offset: 0 });
    expect(page.querySelectorAll('[data-quiz-id]')).toHaveLength(6);
  });

  it('does not leave a stale next-page action enabled after a page request fails', async () => {
    const firstPage = Array.from({ length: 13 }, (_, index) => ({ ...quiz, id: index + 1 }));
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error('โหลดไม่สำเร็จ'))
      .mockResolvedValueOnce(firstPage);
    const page = renderLibrary({ loadQuizzes });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="next-page"]').click();
    await flushPromises();

    expect(page.querySelector('[role="alert"]').textContent).toContain('โหลดไม่สำเร็จ');
    expect(page.querySelector('[data-action="next-page"]').disabled).toBe(true);
    expect(page.querySelector('[data-action="previous-page"]').disabled).toBe(false);

    page.querySelector('[data-action="previous-page"]').click();
    await flushPromises();
    expect(page.querySelectorAll('[data-quiz-id]')).toHaveLength(12);
    expect(page.querySelector('[data-action="next-page"]').disabled).toBe(false);
  });

  it('saves a trimmed edited title and announces success', async () => {
    const updateTitle = vi.fn().mockResolvedValue({ ...quiz, title: 'New title' });
    const page = renderLibrary({ loadQuizzes: async () => [{ ...quiz }], updateTitle });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="edit-title"]').click();
    const input = page.querySelector('[data-role="title-input"]');
    input.value = '  New title  ';
    submit(page.querySelector('[data-role="title-form"]'));
    await flushPromises();

    expect(updateTitle).toHaveBeenCalledWith(12, { title: 'New title' });
    expect(page.querySelector('h2').textContent).toBe('New title');
    expect(page.querySelector('[role="status"]').textContent).toContain('อัปเดตแล้ว');
  });

  it('keeps the title and announces a rename error', async () => {
    const updateTitle = vi.fn().mockRejectedValue(new Error('เปลี่ยนชื่อไม่สำเร็จ'));
    const page = renderLibrary({ loadQuizzes: async () => [{ ...quiz }], updateTitle });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="edit-title"]').click();
    page.querySelector('[data-role="title-input"]').value = 'New title';
    submit(page.querySelector('[data-role="title-form"]'));
    await flushPromises();

    expect(page.querySelector('h2').textContent).toBe('Set theory basics');
    expect(page.querySelector('[role="alert"]').textContent).toContain('เปลี่ยนชื่อไม่สำเร็จ');
  });

  it('announces library request errors accessibly', async () => {
    const page = renderLibrary({ loadQuizzes: async () => { throw new Error('โหลดคลังไม่สำเร็จ'); } });
    document.body.append(page);
    await flushPromises();

    expect(page.querySelector('[role="alert"]').textContent).toContain('โหลดคลังไม่สำเร็จ');
  });

  it('renders accessible search/filter controls and attached tag chips', async () => {
    const page = renderLibrary({
      loadQuizzes: async () => [{
        ...quiz,
        tags: [{ id: 8, name: 'Sets', parent_id: 1, is_builtin: false }],
      }],
    });
    document.body.append(page);
    await flushPromises();

    expect(page.querySelector('[aria-label="ค้นหาชื่อข้อสอบหรือ tag"]')).toBeTruthy();
    expect(page.querySelector('[aria-label="กรองตามวิชาและแท็ก"]')).toBeTruthy();
    expect(page.querySelector('[data-quiz-id="12"] .tag-chip-list').textContent).toContain('Sets');
  });

  it('submits title search explicitly and does not reload on each keystroke', async () => {
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce([{ ...quiz }])
      .mockResolvedValueOnce([{ ...quiz, id: 13, title: 'Sets and logic' }]);
    const page = renderLibrary({ loadQuizzes });
    document.body.append(page);
    await flushPromises();

    const search = page.querySelector('[aria-label="ค้นหาชื่อข้อสอบหรือ tag"]');
    search.value = '  sets  ';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();
    expect(loadQuizzes).toHaveBeenCalledTimes(1);

    submit(page.querySelector('[data-role="quiz-search-form"]'));
    await flushPromises();
    expect(loadQuizzes).toHaveBeenNthCalledWith(2, {
      limit: 13,
      offset: 0,
      q: 'sets',
      tagId: null,
    });
    expect(page.querySelector('[data-quiz-id="13"]')).toBeTruthy();
  });

  it('submits subject/topic filters and preserves them when moving to the next page', async () => {
    const firstPage = Array.from({ length: 13 }, (_, index) => ({
      ...quiz,
      id: index + 1,
      title: `Set quiz ${index + 1}`,
    }));
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ ...quiz, id: 21, title: 'More sets' }]);
    const page = renderLibrary({ loadQuizzes });
    document.body.append(page);
    await flushPromises();

    const search = page.querySelector('[aria-label="ค้นหาชื่อข้อสอบหรือ tag"]');
    const filter = page.querySelector('[aria-label="กรองตามวิชาและแท็ก"]');
    search.value = 'sets';
    filter.value = '1';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    submit(page.querySelector('[data-role="quiz-search-form"]'));
    await flushPromises();
    expect(loadQuizzes).toHaveBeenNthCalledWith(2, {
      limit: 13,
      offset: 0,
      q: 'sets',
      tagId: 1,
    });

    filter.value = '8';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    submit(page.querySelector('[data-role="quiz-search-form"]'));
    await flushPromises();
    expect(loadQuizzes).toHaveBeenNthCalledWith(3, {
      limit: 13,
      offset: 0,
      q: 'sets',
      tagId: 8,
    });

    page.querySelector('[data-action="next-page"]').click();
    await flushPromises();
    expect(loadQuizzes).toHaveBeenNthCalledWith(4, {
      limit: 13,
      offset: 12,
      q: 'sets',
      tagId: 8,
    });
  });

  it('shows a no-match state and clears filters back to the full library', async () => {
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce([{ ...quiz }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...quiz }]);
    const page = renderLibrary({ loadQuizzes });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[aria-label="ค้นหาชื่อข้อสอบหรือ tag"]').value = 'no match';
    submit(page.querySelector('[data-role="quiz-search-form"]'));
    await flushPromises();
    expect(page.textContent).toContain('ไม่พบข้อสอบที่ตรงกับการค้นหา');
    expect(page.querySelector('[data-action="clear-filters"]')).toBeTruthy();

    page.querySelector('[data-action="clear-filters"]').click();
    await flushPromises();
    expect(loadQuizzes).toHaveBeenNthCalledWith(3, {
      limit: 13,
      offset: 0,
      q: '',
      tagId: null,
    });
    expect(page.querySelector('[data-quiz-id="12"]')).toBeTruthy();
  });

  it('test_tag_pill_click_autosaves_add_and_remove_without_save_button', async () => {
    const saveQuizTags = vi.fn().mockResolvedValue({ tags: [{
      id: 1, name: 'Mathematics', parent_id: null, is_builtin: true, color: 'blue',
    }] });
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }],
      saveQuizTags,
    });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="manage-tags"]').click();
    const picker = page.querySelector('[data-role="tag-picker"]');
    const math = picker.querySelector('button[data-tag-id="1"]');
    expect(picker.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect([...picker.querySelectorAll('button')].some((button) => button.textContent === 'Save tags')).toBe(false);

    math.click();
    await flushPromises();
    expect(saveQuizTags).toHaveBeenNthCalledWith(1, 12, { tag_ids: [1] });
    expect(math.getAttribute('aria-pressed')).toBe('true');

    math.click();
    await flushPromises();
    expect(saveQuizTags).toHaveBeenNthCalledWith(2, 12, { tag_ids: [] });
    expect(page.querySelector('[data-quiz-id="12"] .tag-chip-list').textContent).toBe('');
  });

  it('keeps a quiz tag save queue across search refreshes', async () => {
    const requests = [];
    let serverTagIds = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const saveQuizTags = vi.fn((_quizId, { tag_ids: tagIds }) => {
      const request = deferred();
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      requests.push({
        tagIds: [...tagIds],
        resolve: () => {
          serverTagIds = [...tagIds];
          request.resolve({ tags: [] });
        },
      });
      return request.promise.finally(() => { inFlight -= 1; });
    });
    const loadQuizzes = vi.fn()
      .mockResolvedValueOnce([{ ...quiz, tags: [] }])
      .mockResolvedValueOnce([{ ...quiz, tags: [] }]);
    const page = renderLibrary({ loadQuizzes, saveQuizTags });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="manage-tags"]').click();
    page.querySelector('[data-role="tag-picker"] button[data-tag-id="1"]').click();
    page.querySelector('[aria-label="ค้นหาชื่อข้อสอบหรือ tag"]').value = 'sets';
    submit(page.querySelector('[data-role="quiz-search-form"]'));
    await flushPromises();

    page.querySelector('[data-action="manage-tags"]').click();
    const replacementPicker = page.querySelector('[data-role="tag-picker"]');
    replacementPicker.querySelector('button[data-tag-id="8"]').click();
    const requestsAfterReplacementToggle = requests.length;

    if (requestsAfterReplacementToggle > 1) {
      requests[1].resolve();
      await flushPromises();
      requests[0].resolve();
      await flushPromises();
    } else {
      requests[0].resolve();
      await flushPromises();
      if (requests.length > 1) {
        requests[1].resolve();
        await flushPromises();
      }
    }

    expect(requestsAfterReplacementToggle).toBe(1);
    expect(requests.map(({ tagIds }) => tagIds)).toEqual([[1], [1, 8]]);
    expect(maxInFlight).toBe(1);
    expect(serverTagIds).toEqual([1, 8]);
    expect(replacementPicker.querySelector('button[data-tag-id="1"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(replacementPicker.querySelector('button[data-tag-id="8"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('updates every mounted tag picker after a newly created tag enters the catalog', async () => {
    const refreshedCatalog = { tags: [...tagCatalog.tags, {
      id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink',
    }] };
    const loadTags = vi.fn().mockResolvedValueOnce(tagCatalog).mockResolvedValueOnce(refreshedCatalog);
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }, { ...quiz, id: 13, title: 'Another quiz', tags: [] }],
      loadTags,
      createTag: async () => ({ id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink' }),
      saveQuizTags: vi.fn().mockResolvedValue({ tags: [] }),
    });
    document.body.append(page);
    await flushPromises();

    const manageButtons = [...page.querySelectorAll('[data-action="manage-tags"]')];
    manageButtons[0].click();
    manageButtons[1].click();
    const firstPicker = page.querySelector('[data-quiz-id="12"] [data-role="tag-picker"]');
    const secondPicker = page.querySelector('[data-quiz-id="13"] [data-role="tag-picker"]');
    const secondSearch = secondPicker.querySelector('[aria-label="Search tags"]');
    secondSearch.value = 'algebra';
    secondSearch.dispatchEvent(new Event('input', { bubbles: true }));

    firstPicker.querySelector('[data-action="open-tag-create"]').click();
    const createDialog = document.querySelector('.tag-create-dialog');
    const firstPickerName = createDialog.querySelector('[aria-label="New topic tag name"]');
    firstPickerName.value = 'Algebra';
    createDialog.querySelector('[data-action="create-tag"]').click();
    await flushPromises();

    expect(secondPicker.querySelector('button[data-tag-id="9"]')?.textContent).toBe('Algebra');
    expect(secondSearch.value).toBe('algebra');
    expect(page.querySelector('[data-quiz-id="12"] [data-role="tag-picker"]')).toBe(firstPicker);
    expect(page.querySelector('[data-quiz-id="13"] [data-role="tag-picker"]')).toBe(secondPicker);
  });

  it('test_tag_save_failure_restores_confirmed_selection_accessibly', async () => {
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [{
        id: 1, name: 'Mathematics', parent_id: null, is_builtin: true, color: 'blue',
      }] }],
      saveQuizTags: async () => { throw new Error('บันทึกแท็กไม่สำเร็จ'); },
    });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-action="manage-tags"]').click();

    const picker = page.querySelector('[data-role="tag-picker"]');
    picker.querySelector('button[data-tag-id="8"]').click();
    await flushPromises();

    expect(picker.querySelector('button[data-tag-id="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(picker.querySelector('button[data-tag-id="8"]').getAttribute('aria-pressed')).toBe('false');
    expect(page.querySelector('[role="alert"]').textContent).toContain('บันทึกแท็กไม่สำเร็จ');
  });

  it('test_created_colored_tag_is_attached_immediately', async () => {
    const refreshedCatalog = { tags: [...tagCatalog.tags, {
      id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink',
    }] };
    const loadTags = vi.fn().mockResolvedValueOnce(tagCatalog).mockResolvedValueOnce(refreshedCatalog);
    const createTag = vi.fn().mockResolvedValue({
      id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink',
    });
    const saveQuizTags = vi.fn().mockResolvedValue({ tags: [{
      id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink',
    }] });
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }],
      loadTags,
      createTag,
      saveQuizTags,
    });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-action="manage-tags"]').click();
    let picker = page.querySelector('[data-role="tag-picker"]');
    picker.querySelector('[data-action="open-tag-create"]').click();
    const createDialog = document.querySelector('.tag-create-dialog');
    createDialog.querySelector('[aria-label="New topic tag name"]').value = ' Algebra ';
    const pink = createDialog.querySelector('.tag-color-palette input[value="pink"]');
    pink.checked = true;
    pink.dispatchEvent(new Event('change', { bubbles: true }));
    createDialog.querySelector('[data-action="create-tag"]').click();
    await flushPromises();

    expect(createTag).toHaveBeenCalledWith({ name: 'Algebra', color: 'pink' });
    expect(loadTags).toHaveBeenCalledTimes(2);
    expect(saveQuizTags).toHaveBeenCalledWith(12, { tag_ids: [9] });
    picker = page.querySelector('[data-role="tag-picker"]');
    expect(picker.querySelector('button[data-tag-id="9"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(page.querySelector('[data-quiz-id="12"] .tag-chip-list').textContent).toContain('Algebra');
  });

  it('test_create_then_attach_failure_keeps_tag_available_and_reports_attachment_error', async () => {
    const refreshedCatalog = { tags: [...tagCatalog.tags, {
      id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink',
    }] };
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }],
      loadTags: vi.fn().mockResolvedValueOnce(tagCatalog).mockResolvedValueOnce(refreshedCatalog),
      createTag: async () => ({ id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'pink' }),
      saveQuizTags: async () => { throw new Error('offline'); },
    });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-action="manage-tags"]').click();
    let picker = page.querySelector('[data-role="tag-picker"]');
    picker.querySelector('[data-action="open-tag-create"]').click();
    const createDialog = document.querySelector('.tag-create-dialog');
    createDialog.querySelector('[aria-label="New topic tag name"]').value = 'Algebra';
    createDialog.querySelector('[data-action="create-tag"]').click();
    await flushPromises();
    await flushPromises();

    picker = page.querySelector('[data-role="tag-picker"]');
    expect(picker.querySelector('button[data-tag-id="9"]')).toBeTruthy();
    expect(picker.querySelector('button[data-tag-id="9"]').getAttribute('aria-pressed')).toBe('false');
    expect(page.querySelector('[role="alert"]').textContent).toContain('สร้างแท็กแล้ว');
    expect(page.querySelector('[role="alert"]').textContent).toContain('แนบ');
  });

  it('announces tag catalog and save errors through an alert', async () => {
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }],
      loadTags: async () => { throw new Error('โหลดแท็กไม่สำเร็จ'); },
    });
    document.body.append(page);
    await flushPromises();
    expect(page.querySelector('[role="alert"]').textContent).toContain('โหลดแท็กไม่สำเร็จ');

    const retryPage = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }],
      saveQuizTags: async () => { throw new Error('บันทึกแท็กไม่สำเร็จ'); },
    });
    document.body.append(retryPage);
    await flushPromises();
    retryPage.querySelector('[data-action="manage-tags"]').click();
    retryPage.querySelector('[data-role="tag-picker"] button[data-tag-id="1"]').click();
    await flushPromises();
    expect(retryPage.querySelector('[role="alert"]').textContent).toContain('บันทึกแท็กไม่สำเร็จ');
  });

  it('announces child tag creation failures accessibly', async () => {
    const page = renderLibrary({
      loadQuizzes: async () => [{ ...quiz, tags: [] }],
      createTag: async () => { throw new Error('สร้างแท็กไม่สำเร็จ'); },
    });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-action="manage-tags"]').click();
    const picker = page.querySelector('[data-role="tag-picker"]');
    picker.querySelector('[data-action="open-tag-create"]').click();
    const createDialog = document.querySelector('.tag-create-dialog');
    createDialog.querySelector('[aria-label="New topic tag name"]').value = 'Algebra';
    createDialog.querySelector('[data-action="create-tag"]').click();
    await flushPromises();
    expect(page.querySelector('[role="alert"]').textContent).toContain('สร้างแท็กไม่สำเร็จ');
    document.querySelector('.tag-create-dialog [data-action="cancel-tag-create"]').click();
  });

  it('shows newest-first attempt history with scores and start/review navigation', async () => {
    const navigate = vi.fn();
    const page = renderQuizDetailPage({
      quizId: 12,
      loadQuiz: async () => ({ ...quiz }),
      loadAttempts: async () => attempts,
      navigate,
    });
    document.body.append(page);
    await flushPromises();

    const attemptRows = [...page.querySelectorAll('[data-attempt-id]')];
    expect(page.querySelector('h1').textContent).toBe('Set theory basics');
    expect(page.textContent).toContain('sets.md');
    expect(page.querySelector('.quiz-detail-back')?.textContent).toContain('กลับไปคลังข้อสอบ');
    expect(attemptRows.map((row) => row.dataset.attemptId)).toEqual(['7', '5']);
    expect(attemptRows[0].textContent).toContain('3 / 5');
    expect(attemptRows[1].textContent).toContain('4 / 5');
    expect(attemptRows[0].querySelector('[data-route="/quizzes/12/attempts/7"]')).not.toBeNull();

    page.querySelector('[data-route="/quizzes/12/take"]').click();
    attemptRows[0].querySelector('[data-route="/quizzes/12/attempts/7"]').click();
    expect(navigate).toHaveBeenNthCalledWith(1, '/quizzes/12/take');
    expect(navigate).toHaveBeenNthCalledWith(2, '/quizzes/12/attempts/7');
  });

  it('shows the no-attempt state and start action on quiz detail', async () => {
    const page = renderQuizDetailPage({
      quizId: 12,
      loadQuiz: async () => ({ ...quiz }),
      loadAttempts: async () => [],
    });
    document.body.append(page);
    await flushPromises();

    expect(page.textContent).toContain('ยังไม่มีประวัติการทำข้อสอบ');
    expect(page.querySelector('[data-route="/quizzes/12/take"]')?.textContent).toContain('เริ่มทำข้อสอบ');
  });

  it('announces detail loading failures accessibly', async () => {
    const page = renderQuizDetailPage({
      quizId: 12,
      loadQuiz: async () => { throw new Error('โหลดข้อสอบไม่สำเร็จ'); },
      loadAttempts: async () => [],
    });
    document.body.append(page);
    await flushPromises();

    expect(page.querySelector('[role="alert"]').textContent).toContain('โหลดข้อสอบไม่สำเร็จ');
  });
});
