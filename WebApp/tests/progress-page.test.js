// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderProgressPage } from '../src/pages/ProgressPage.js';

const math = { id: 1, name: 'คณิตศาสตร์', color: 'blue', is_builtin: true, parent_id: null };
const tags = { tags: [
  math,
  { id: 2, name: 'ฟิสิกส์', color: 'cyan', is_builtin: true, parent_id: null },
  { id: 11, name: 'เซต', parent_id: 1, color: 'violet', is_builtin: false },
] };

function attempt(id, score, title, submittedAt) {
  return {
    attempt_id: id,
    quiz_id: 42,
    quiz_title: title,
    score,
    total_questions: 5,
    submitted_at: submittedAt,
    tags: [{ id: 11, name: 'เซต', color: 'violet', parent_id: 1 }],
  };
}

function overview(overrides = {}) {
  const latest = attempt(202, 4, 'ทฤษฎีเซต', '2026-10-12T10:00:00Z');
  return {
    topics_practiced: 1,
    latest_attempt: latest,
    recent_attempts: [latest],
    topics: [{
      tag_id: 11, name: 'เซต', color: 'violet', parent_id: 1,
      attempt_count: 1, latest_attempt: latest,
    }],
    ...overrides,
  };
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function mount(overrides = {}) {
  const dependencies = {
    loadProgress: vi.fn().mockResolvedValue(overview()),
    loadTopic: vi.fn().mockResolvedValue({
      tag_id: 11,
      name: 'เซต',
      color: 'violet',
      parent_id: 1,
      attempts: [attempt(202, 4, 'ทฤษฎีเซต', '2026-10-12T10:00:00Z')],
    }),
    loadTags: vi.fn().mockResolvedValue(tags),
    navigate: vi.fn(),
    ...overrides,
  };
  const page = renderProgressPage(dependencies);
  document.body.replaceChildren(page);
  return { page, dependencies };
}

afterEach(() => document.body.replaceChildren());

describe('Progress page', () => {
  it('test_progress_tag_filter_keeps_native_label', async () => {
    const { page } = mount();
    await flushPromises();
    const filter = page.querySelector('[data-role="progress-tag-filter"]');

    expect(filter.tagName).toBe('SELECT');
    expect(filter.classList.contains('themed-select')).toBe(true);
    expect(filter.getAttribute('aria-label')).toBe('กรองความก้าวหน้าตามวิชาหรือแท็ก');
    expect(filter.value).toBe('');
  });

  it('shows an empty state and a link to start a quiz when there are no submitted attempts', async () => {
    const { page } = mount({
      loadProgress: vi.fn().mockResolvedValue({
        topics_practiced: 0, latest_attempt: null, recent_attempts: [], topics: [],
      }),
    });
    await flushPromises();

    expect(page.querySelector('[data-role="progress-empty-state"]')?.textContent).toContain('ยังไม่มีประวัติ');
    expect(page.querySelector('a[href="/quizzes/create"]')?.textContent).toContain('เริ่มทำข้อสอบ');
    expect(page.querySelector('[data-role="progress-score"]')).toBeNull();
    expect(page.querySelectorAll('[data-role="progress-attempt"]')).toHaveLength(0);
  });

  it('renders a genuine zero score instead of the empty state', async () => {
    const zero = attempt(203, 0, 'แบบฝึกหัดเซต', '2026-10-12T11:00:00Z');
    const { page } = mount({ loadProgress: vi.fn().mockResolvedValue(overview({
      latest_attempt: zero,
      recent_attempts: [zero],
    })) });
    await flushPromises();

    expect(page.querySelector('[data-role="progress-score"]')?.textContent).toContain('0 / 5');
    expect(page.querySelector('[data-role="progress-empty-state"]')).toBeNull();
    expect(page.querySelector('[data-role="progress-attempt"]')?.textContent).toContain('0 / 5');
  });

  it('shows the latest attempt and keeps each retake newest first in topic history', async () => {
    const newer = attempt(202, 4, 'ทฤษฎีเซต', '2026-10-12T10:00:00Z');
    const older = attempt(201, 2, 'ทฤษฎีเซต', '2026-10-10T10:00:00Z');
    const { page, dependencies } = mount({
      loadProgress: vi.fn().mockResolvedValue(overview({
        latest_attempt: newer,
        recent_attempts: [newer, older],
        topics: [{ tag_id: 11, name: 'เซต', color: 'violet', parent_id: 1, attempt_count: 2, latest_attempt: newer }],
      })),
      loadTopic: vi.fn().mockResolvedValue({
        tag_id: 11, name: 'เซต', color: 'violet', parent_id: 1, attempts: [newer, older],
      }),
    });
    await flushPromises();

    expect(page.querySelector('[data-role="progress-latest"]')?.textContent).toContain('ทฤษฎีเซต');
    expect([...page.querySelectorAll('[data-role="progress-attempt"]')].map((row) => row.dataset.attemptId))
      .toEqual(['202', '201']);
    page.querySelector('[data-topic-id="11"]').click();
    await flushPromises();

    expect(dependencies.loadTopic).toHaveBeenCalledWith(11);
    expect([...page.querySelectorAll('[data-role="topic-attempt"]')].map((row) => row.dataset.attemptId))
      .toEqual(['202', '201']);
    expect(page.querySelector('[data-role="topic-attempt"] a[href="/quizzes/42/attempts/202"]')).not.toBeNull();
  });

  it('filters by a shared flat tag', async () => {
    const childAttempt = attempt(302, 5, 'การดำเนินการของเซต', '2026-10-12T10:00:00Z');
    const loadProgress = vi.fn()
      .mockResolvedValueOnce(overview())
      .mockResolvedValueOnce(overview({
        topics_practiced: 1,
        recent_attempts: [childAttempt],
        topics: [
          { tag_id: 11, name: 'เซต', color: 'violet', parent_id: 1, attempt_count: 1, latest_attempt: childAttempt },
        ],
      }));
    const { page, dependencies } = mount({ loadProgress });
    await flushPromises();

    const filter = page.querySelector('[data-role="progress-tag-filter"]');
    expect(filter.querySelector('option[value="11"]')?.textContent).toContain('เซต');
    filter.value = '11';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    submit(page.querySelector('[data-role="progress-search-form"]'));
    await flushPromises();

    expect(dependencies.loadProgress).toHaveBeenLastCalledWith({ q: '', tagId: 11 });
    expect([...page.querySelectorAll('[data-topic-id]')].map((item) => item.dataset.topicId)).toEqual(['11']);
    expect([...page.querySelectorAll('[data-role="progress-attempt"]')].map((item) => item.dataset.attemptId))
      .toEqual(['302']);
  });

  it('searches by quiz title and does not display elapsed duration', async () => {
    const { page, dependencies } = mount();
    await flushPromises();
    page.querySelector('[data-role="progress-search"]').value = 'เซต';
    submit(page.querySelector('[data-role="progress-search-form"]'));
    await flushPromises();

    expect(dependencies.loadProgress).toHaveBeenLastCalledWith({ q: 'เซต', tagId: null });
    expect(page.textContent).not.toMatch(/ระยะเวลา|นาที|ชั่วโมง/);
  });
});
