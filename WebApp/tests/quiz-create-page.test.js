// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderQuizCreatePage } from '../src/pages/QuizCreatePage.js';

describe('quiz creation page', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('test_quiz_create_selects_keep_labels_and_selected_values', async () => {
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({
        providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }],
      }),
    });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('#quiz-provider').options).toHaveLength(1));

    const selects = ['#quiz-provider', '#quiz-model', '#quiz-language', '#quiz-difficulty']
      .map((selector) => page.querySelector(selector));
    for (const select of selects) {
      expect(select.tagName).toBe('SELECT');
      expect(select.classList.contains('themed-select')).toBe(true);
      expect(select.labels[0]?.textContent.trim()).not.toBe('');
    }
    expect(selects.map(({ value }) => value)).toEqual(['openai', 'gpt-5-mini', 'th', 'intermediate']);
  });

  it('lets a learner choose a provider/model and submits the quiz options', async () => {
    const loadProviders = vi.fn().mockResolvedValue({
      providers: [
        { id: 'gemini', name: 'Gemini', models: [{ id: 'gemini-2.5-flash-lite', name: 'Gemini Flash Lite' }] },
        { id: 'claude', name: 'Claude', models: [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }] },
      ],
    });
    const submitQuiz = vi.fn().mockResolvedValue({ id: 12, title: 'Network Security', question_count: 5 });
    const navigate = vi.fn();
    const page = renderQuizCreatePage({ loadProviders, submitQuiz, navigate });
    document.body.append(page);

    const provider = page.querySelector('#quiz-provider');
    const model = page.querySelector('#quiz-model');
    await vi.waitFor(() => expect(provider.options).toHaveLength(2));
    expect(provider.value).toBe('gemini');
    expect(model.options[0].value).toBe('gemini-2.5-flash-lite');

    provider.value = 'claude';
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(model.options[0].value).toBe('claude-sonnet-5');

    const fileInput = page.querySelector('#quiz-source-file');
    const file = new File(['course notes'], 'notes.md', { type: 'text/markdown' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    page.querySelector('#quiz-question-count').value = '5';
    page.querySelector('#quiz-language').value = 'en';
    page.querySelector('#quiz-difficulty').value = 'advanced';

    page.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(submitQuiz).toHaveBeenCalledOnce());

    const submitted = submitQuiz.mock.calls[0][0];
    expect(submitted).toBeInstanceOf(FormData);
    expect(submitted.get('provider')).toBe('claude');
    expect(submitted.get('model')).toBe('claude-sonnet-5');
    expect(submitted.get('question_count')).toBe('5');
    expect(submitted.get('language')).toBe('en');
    expect(submitted.get('difficulty')).toBe('advanced');
    expect(page.querySelector('[data-quiz-result]').textContent).toContain('Network Security');
    expect(page.querySelector('[data-quiz-result]').textContent).toContain('5');
    const startLink = page.querySelector('[data-route="/quizzes/12/take"]');
    const libraryLink = page.querySelector('[data-route="/quizzes"]');
    expect(startLink?.textContent).toContain('เริ่มทำข้อสอบ');
    expect(libraryLink?.textContent).toContain('ไปคลังข้อสอบ');
    startLink.click();
    libraryLink.click();
    expect(navigate).toHaveBeenNthCalledWith(1, '/quizzes/12/take');
    expect(navigate).toHaveBeenNthCalledWith(2, '/quizzes');
  });

  it('shows a quota response without retrying with another provider', async () => {
    const loadProviders = vi.fn().mockResolvedValue({
      providers: [{ id: 'gemini', name: 'Gemini', models: [{ id: 'gemini-2.5-flash-lite', name: 'Gemini Flash Lite' }] }],
    });
    const submitQuiz = vi.fn().mockRejectedValue(new Error('โควตาของ Gemini เต็มแล้ว กรุณาเลือก Provider อื่น'));
    const page = renderQuizCreatePage({ loadProviders, submitQuiz });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('#quiz-provider').options).toHaveLength(1));

    const fileInput = page.querySelector('#quiz-source-file');
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['course notes'], 'notes.md', { type: 'text/markdown' })],
    });
    page.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(page.querySelector('[data-quiz-message]').textContent).toContain('โควตาของ Gemini เต็มแล้ว'));

    expect(submitQuiz).toHaveBeenCalledOnce();
    expect(page.querySelector('[data-quiz-message]').dataset.state).toBe('error');
  });
});
