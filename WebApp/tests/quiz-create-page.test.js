// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderQuizCreatePage } from '../src/pages/QuizCreatePage.js';

function chooseDropdownOption(page, selectId, optionLabel) {
  const trigger = page.querySelector(`#${selectId}-trigger`);
  trigger.click();
  const option = [...page.querySelectorAll(`#${selectId}-options [role="option"]`)]
    .find((item) => item.textContent.trim() === optionLabel);
  expect(option).toBeDefined();
  option.click();
}

describe('quiz creation page', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('keeps the source dialog outside the form so its fixed backdrop spans the page', () => {
    const page = renderQuizCreatePage({ loadProviders: vi.fn().mockResolvedValue({ providers: [] }) });
    const form = page.querySelector('form');
    const sourceDialog = page.querySelector('[data-quiz-source-dialog]');

    expect(sourceDialog.parentElement).toBe(page);
    expect(form.contains(sourceDialog)).toBe(false);
  });

  it('uses a CSS caret instead of a text glyph for the source selector icon', () => {
    const page = renderQuizCreatePage({ loadProviders: vi.fn().mockResolvedValue({ providers: [] }) });
    const caret = page.querySelector('.quiz-source-trigger__icon');

    expect(caret).not.toBeNull();
    expect(caret.textContent.trim()).toBe('');
    expect(caret.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a floating, accessible dropdown for every quiz select', async () => {
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
      const trigger = page.querySelector(`#${select.id}-trigger`);
      expect(trigger?.getAttribute('aria-haspopup')).toBe('listbox');
      expect(trigger?.getAttribute('aria-expanded')).toBe('false');
      expect(page.querySelector(`#${select.id}-options`)?.hidden).toBe(true);
    }
    expect(selects.map(({ value }) => value)).toEqual(['openai', 'gpt-5-mini', 'th', 'intermediate']);

    chooseDropdownOption(page, 'quiz-language', 'English');
    chooseDropdownOption(page, 'quiz-difficulty', 'ขั้นสูง');
    expect(page.querySelector('#quiz-language').value).toBe('en');
    expect(page.querySelector('#quiz-difficulty').value).toBe('advanced');
  });

  it('only offers PDF, Markdown and TXT files with a 40 MB limit', () => {
    const page = renderQuizCreatePage({ loadProviders: vi.fn().mockResolvedValue({ providers: [] }) });
    const fileInput = page.querySelector('#quiz-source-file');
    const fileHint = fileInput.parentElement.querySelector('small').textContent;

    expect(fileInput.accept).toBe('.md,.txt,.pdf,text/markdown,text/plain,application/pdf');
    expect(fileHint).toContain('Markdown, TXT และ PDF');
    expect(fileHint).toContain('40 MB');
    expect(fileHint).not.toContain('DOCX');
  });

  it('opens the device file picker from the upload choice and shows the selected file name', async () => {
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({
        providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }],
      }),
    });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('#quiz-provider').options).toHaveLength(1));

    const fileInput = page.querySelector('#quiz-source-file');
    const devicePicker = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    page.querySelector('[data-action="open-source-dialog"]').click();
    page.querySelector('[data-action="choose-upload"]').click();

    expect(devicePicker).toHaveBeenCalledOnce();
    expect(page.querySelector('[data-quiz-source-dialog]').hidden).toBe(true);
    expect(page.querySelector('[data-selected-document]').hidden).toBe(true);

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['notes'], 'lecture.pdf', { type: 'application/pdf' })],
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(page.querySelector('[data-selected-file]').textContent).toContain('lecture.pdf');
  });

  it('opens a source dialog and creates a quiz from one supported library document', async () => {
    const loadDocuments = vi.fn().mockResolvedValue([
      {
        id: 41,
        title: 'บทเรียนเรื่องเซต',
        original_filename: 'sets.md',
        file_type: 'md',
        size_bytes: 1024,
      },
      {
        id: 42,
        title: 'เอกสาร Word',
        original_filename: 'lesson.docx',
        file_type: 'docx',
        size_bytes: 2048,
      },
    ]);
    const submitQuiz = vi.fn().mockResolvedValue({ id: 31, title: 'แบบทดสอบเรื่องเซต', question_count: 5 });
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({
        providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }],
      }),
      loadDocuments,
      submitQuiz,
    });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('#quiz-provider').options).toHaveLength(1));

    const openSourceDialog = page.querySelector('[data-action="open-source-dialog"]');
    expect(openSourceDialog).not.toBeNull();
    expect(loadDocuments).not.toHaveBeenCalled();

    openSourceDialog.click();
    const sourceDialog = page.querySelector('[data-quiz-source-dialog]');
    expect(sourceDialog.hidden).toBe(false);
    const chooseLibrary = page.querySelector('[data-action="choose-library"]');
    expect(chooseLibrary).not.toBeNull();
    chooseLibrary.click();
    await vi.waitFor(() => expect(loadDocuments).toHaveBeenCalledOnce());
    const libraryPanel = page.querySelector('[data-quiz-document-picker]');
    expect(libraryPanel.hidden).toBe(false);
    expect(libraryPanel.textContent).toContain('บทเรียนเรื่องเซต');
    expect(libraryPanel.textContent).not.toContain('เอกสาร Word');

    page.querySelector('[data-document-id="41"]').click();
    expect(page.querySelector('[data-selected-document]').textContent).toContain('บทเรียนเรื่องเซต');
    expect(sourceDialog.hidden).toBe(true);
    page.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(submitQuiz).toHaveBeenCalledOnce());
    const submitted = submitQuiz.mock.calls[0][0];
    expect(submitted.get('source_document_id')).toBe('41');
    expect(submitted.get('file')).toBeNull();
    expect(page.querySelector('[data-quiz-result]').textContent).toContain('แบบทดสอบเรื่องเซต');
  });

  it('searches the document library and reports when no supported documents are available', async () => {
    const loadDocuments = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 43, title: 'Lecture notes', original_filename: 'lecture.txt', file_type: 'txt', size_bytes: 128 },
      ]);
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({
        providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }],
      }),
      loadDocuments,
    });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('#quiz-provider').options).toHaveLength(1));

    const openSourceDialog = page.querySelector('[data-action="open-source-dialog"]');
    expect(openSourceDialog).not.toBeNull();
    openSourceDialog.click();
    const chooseLibrary = page.querySelector('[data-action="choose-library"]');
    expect(chooseLibrary).not.toBeNull();
    chooseLibrary.click();
    await vi.waitFor(() => expect(loadDocuments).toHaveBeenCalledOnce());
    expect(page.querySelector('[data-document-message]').textContent).toContain('ไม่พบเอกสาร');

    const searchInput = page.querySelector('#quiz-document-search');
    searchInput.value = 'lecture';
    page.querySelector('[data-action="search-documents"]').click();
    await vi.waitFor(() => expect(loadDocuments).toHaveBeenCalledTimes(2));

    expect(loadDocuments).toHaveBeenLastCalledWith({ limit: 11, offset: 0, q: 'lecture' });
    expect(page.querySelector('[data-document-id="43"]')?.textContent).toContain('Lecture notes');
  });

  it('shows at most ten library files at once and loads more when the list is scrolled', async () => {
    const documents = Array.from({ length: 12 }, (_, index) => ({
      id: index + 51,
      title: `บทเรียน ${index + 1}`,
      original_filename: `lesson-${index + 1}.txt`,
      file_type: 'txt',
      size_bytes: 128,
    }));
    const loadDocuments = vi.fn()
      .mockResolvedValueOnce(documents.slice(0, 11))
      .mockResolvedValueOnce(documents.slice(10, 12));
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({
        providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }],
      }),
      loadDocuments,
    });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('#quiz-provider').options).toHaveLength(1));

    const openSourceDialog = page.querySelector('[data-action="open-source-dialog"]');
    expect(openSourceDialog).not.toBeNull();
    openSourceDialog.click();
    const chooseLibrary = page.querySelector('[data-action="choose-library"]');
    expect(chooseLibrary).not.toBeNull();
    chooseLibrary.click();
    await vi.waitFor(() => expect(page.querySelectorAll('[data-document-id]')).toHaveLength(10));

    const search = page.querySelector('#quiz-document-search');
    const list = page.querySelector('[data-document-list]');
    expect(search.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(loadDocuments).toHaveBeenLastCalledWith({ limit: 11, offset: 0, q: '' });

    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 150 },
    });
    list.dispatchEvent(new Event('scroll'));
    await vi.waitFor(() => expect(page.querySelectorAll('[data-document-id]')).toHaveLength(12));

    expect(loadDocuments).toHaveBeenLastCalledWith({ limit: 11, offset: 10, q: '' });
    expect(page.querySelector('[data-document-id="62"]')?.textContent).toContain('บทเรียน 12');
  });

  it('rejects DOCX files before sending them to quiz generation', async () => {
    const submitQuiz = vi.fn();
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({ providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }] }),
      submitQuiz,
    });
    document.body.append(page);
    const fileInput = page.querySelector('#quiz-source-file');
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['word document'], 'lesson.docx')],
    });

    page.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(page.querySelector('[data-quiz-message]').textContent).toContain('PDF, Markdown หรือ TXT'));

    expect(submitQuiz).not.toHaveBeenCalled();
  });

  it('rejects quiz source files larger than 40 MB before upload', async () => {
    const submitQuiz = vi.fn();
    const page = renderQuizCreatePage({
      loadProviders: vi.fn().mockResolvedValue({ providers: [{ id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5-mini', name: 'GPT 5 Mini' }] }] }),
      submitQuiz,
    });
    document.body.append(page);
    const fileInput = page.querySelector('#quiz-source-file');
    const oversizedFile = new File(['x'], 'large.md', { type: 'text/markdown' });
    Object.defineProperty(oversizedFile, 'size', { configurable: true, value: 40_000_001 });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [oversizedFile] });

    page.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(page.querySelector('[data-quiz-message]').textContent).toContain('40 MB'));

    expect(submitQuiz).not.toHaveBeenCalled();
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

    chooseDropdownOption(page, 'quiz-provider', 'Claude');
    expect(model.options[0].value).toBe('claude-sonnet-5');
    expect(page.querySelector('#quiz-provider-trigger').textContent).toContain('Claude');
    expect(page.querySelector('#quiz-provider-options').hidden).toBe(true);

    const fileInput = page.querySelector('#quiz-source-file');
    const file = new File(['course notes'], 'notes.md', { type: 'text/markdown' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    page.querySelector('#quiz-question-count').value = '5';
    chooseDropdownOption(page, 'quiz-language', 'English');
    chooseDropdownOption(page, 'quiz-difficulty', 'ขั้นสูง');
    page.querySelector('[name="question_types"][value="true_false"]').click();

    page.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(submitQuiz).toHaveBeenCalledOnce());

    const submitted = submitQuiz.mock.calls[0][0];
    expect(submitted).toBeInstanceOf(FormData);
    expect(submitted.get('provider')).toBe('claude');
    expect(submitted.get('model')).toBe('claude-sonnet-5');
    expect(submitted.get('question_count')).toBe('5');
    expect(submitted.get('language')).toBe('en');
    expect(submitted.get('difficulty')).toBe('advanced');
    expect(submitted.getAll('question_types')).toEqual(['true_false']);
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
