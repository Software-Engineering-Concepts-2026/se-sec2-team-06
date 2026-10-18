// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderDocumentReaderPage } from '../src/pages/DocumentReaderPage.js';

const documentItem = {
  id: 4,
  title: 'บทเรียนเรื่องเซต',
  original_filename: 'sets.md',
  file_type: 'md',
  size_bytes: 512,
  created_at: '2026-10-10T08:00:00Z',
  updated_at: '2026-10-10T08:00:00Z',
  last_page: null,
  scroll_ratio: null,
  tags: [],
};

const catalog = {
  tags: [
    { id: 1, name: 'คณิตศาสตร์', is_builtin: true, color: 'blue', parent_id: null },
    { id: 8, name: 'เซต', parent_id: 1, is_builtin: false, color: 'pink' },
  ],
};

async function flushPromises() {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

function renderPage(options = {}) {
  return renderDocumentReaderPage({
    documentId: 4,
    loadDocument: async () => ({ ...documentItem }),
    loadDocumentContent: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    loadDocumentText: async () => ({ text: '# Set theory', text_truncated: false, search_text_truncated: false, search_available: true }),
    saveProgress: vi.fn().mockResolvedValue({}),
    updateTitle: vi.fn().mockResolvedValue({ ...documentItem, title: 'New title' }),
    loadTags: async () => catalog,
    createTag: vi.fn(),
    replaceDocumentTags: vi.fn().mockResolvedValue({ ...documentItem, tags: [] }),
    deleteDocument: vi.fn().mockResolvedValue(null),
    confirmDelete: vi.fn().mockReturnValue(true),
    navigate: vi.fn(),
    ...options,
  });
}

describe('document reader page', () => {
  beforeEach(() => document.body.replaceChildren());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows loading, then reader title and a working back-to-library action', async () => {
    let finish;
    const page = renderPage({ loadDocument: () => new Promise((resolve) => { finish = resolve; }) });
    document.body.append(page);
    expect(page.querySelector('[role="status"]')?.textContent).toContain('กำลังโหลด');

    finish({ ...documentItem, title: 'Reader title' });
    await flushPromises();
    expect(page.querySelector('h1')?.textContent).toBe('Reader title');
    page.querySelector('[data-route="/documents"]')?.click();
    expect(page.querySelector('[data-route="/documents"]')).not.toBeNull();
  });

  it('shows a safe not-found state without exposing private details', async () => {
    const page = renderPage({
      loadDocument: async () => { throw new Error('ไม่พบเอกสารนี้'); },
    });
    document.body.append(page);
    await flushPromises();
    expect(page.querySelector('[role="alert"]')?.textContent).toBe('ไม่พบเอกสารนี้');
    expect(page.querySelector('[data-role="reader-content"]')).toBeNull();
  });

  it('renders Markdown as safe HTML and announces truncated extracted text', async () => {
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'md' }),
      loadDocumentText: async () => ({
        text: '# Sets\n\n- union\n\n<script>window.__xss = true</script>',
        text_truncated: true,
        search_text_truncated: true,
        search_available: true,
      }),
    });
    document.body.append(page);
    await flushPromises();

    const readingArea = page.querySelector('[data-role="reader-content"]');
    expect(readingArea.querySelector('h1')?.textContent).toBe('Sets');
    expect(readingArea.querySelector('li')?.textContent).toBe('union');
    expect(readingArea.querySelector('script')).toBeNull();
    expect(page.textContent).toContain('แสดงข้อความได้บางส่วน');
  });

  it('uses the same left reader sidebar for Markdown without showing PDF controls', async () => {
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'md' }),
    });
    document.body.append(page);
    await flushPromises();

    const shell = page.querySelector('.document-reader-shell--split');
    const sidebar = page.querySelector('.document-reader-sidebar');
    const contentPanel = page.querySelector('.document-reader-panel');

    expect(shell).not.toBeNull();
    expect(sidebar?.tagName).toBe('ASIDE');
    expect(sidebar?.contains(page.querySelector('#document-reader-title'))).toBe(true);
    expect(sidebar?.querySelector('[data-route="/documents"]')?.getAttribute('aria-label')).toBe('กลับคลังเอกสาร');
    expect(contentPanel?.contains(page.querySelector('.document-reader-markdown'))).toBe(true);
    expect(sidebar?.querySelector('[data-role="pdf-controls"]')).toBeNull();
    expect(page.querySelector('.pdf-viewer__toolbar')).toBeNull();
  });

  it('centers the reading column and uses a larger single-page-scroll reading area', async () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.document-reader-content\s*\{[^}]*font-size:\s*clamp\(/);
    expect(styles).toMatch(/\.document-reader-content\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible/s);
    expect(styles).toMatch(/\.document-reader-markdown\s*\{[^}]*max-width:\s*76ch;[^}]*margin-inline:\s*auto/s);
    expect(styles).toMatch(/\.document-reader-paragraph\s*\{[^}]*font-size:\s*inherit/);
  });

  it.each(['txt', 'docx'])('renders %s as safe readable paragraphs', async (file_type) => {
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type }),
      loadDocumentText: async () => ({
        text: 'First paragraph\ncontinues here\n\n<img src=x onerror=alert(1)>',
        text_truncated: false,
        search_text_truncated: false,
        search_available: true,
      }),
    });
    document.body.append(page);
    await flushPromises();

    const readingArea = page.querySelector('[data-role="reader-content"]');
    expect(readingArea.querySelectorAll('p')).toHaveLength(2);
    expect(readingArea.querySelector('img')).toBeNull();
    expect(readingArea.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('opens PDFs directly in the page viewer without a separate extracted-text or search panel', async () => {
    const pdfjs = {
      getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => ({ promise: Promise.resolve() }),
      }) }) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const loadDocumentText = vi.fn(async () => ({
      text: 'This must remain inside the real PDF viewer.',
      text_truncated: false,
      search_text_truncated: false,
      search_available: true,
    }));
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'pdf' }),
      loadDocumentText,
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    expect(loadDocumentText).not.toHaveBeenCalled();
    expect(page.querySelector('[data-role="pdf-page-status"]')).not.toBeNull();
    expect(page.querySelector('[data-role="pdf-page-canvas"]')).not.toBeNull();
    expect(page.querySelector('[data-role="pdf-text-alternative"]')).toBeNull();
    expect(page.querySelector('[data-role="pdf-search-unavailable"]')).toBeNull();
    expect(page.textContent).not.toContain('This must remain inside the real PDF viewer.');
  });

  it('fits the first PDF page to the available reader width on load', async () => {
    const pdfjs = {
      getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }) }) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'pdf' }),
      loadDocumentContent: async () => {
        const area = document.querySelector('[data-role="reader-content"]');
        Object.defineProperty(area, 'clientWidth', { configurable: true, value: 820 });
        return new Blob(['pdf'], { type: 'application/pdf' });
      },
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    expect(page.querySelector('[data-role="pdf-page-canvas"]').style.width).toBe('820px');
  });

  it('offers the original PDF download while keeping the existing library return action', async () => {
    const pdfjs = {
      getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }) }) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'pdf', original_filename: 'บทเรียน เซต.pdf' }),
      getDocumentDownloadUrl: (id) => `/api/documents/${id}/download`,
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    const download = page.querySelector('[data-action="download-pdf"]');
    expect(download?.tagName).toBe('A');
    expect(download?.getAttribute('href')).toBe('/api/documents/4/download');
    expect(download?.getAttribute('download')).toBe('บทเรียน เซต.pdf');
    expect(download?.textContent).toContain('ดาวน์โหลด PDF');
    const back = page.querySelector('[data-route="/documents"]');
    expect(back?.getAttribute('aria-label')).toBe('กลับคลังเอกสาร');
  });

  it('does not show a PDF download action for non-PDF documents', async () => {
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'txt' }),
      loadDocumentText: async () => ({ text: 'Readable text', text_truncated: false, search_text_truncated: false, search_available: true }),
    });
    document.body.append(page);
    await flushPromises();

    expect(page.querySelector('[data-action="download-pdf"]')).toBeNull();
  });

  it('uses the approved persistent left sidebar for PDF details and reader controls', async () => {
    const pdfjs = {
      getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }) }) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'pdf' }),
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    const shell = page.querySelector('.document-reader-shell--pdf');
    const sidebar = page.querySelector('.document-reader-sidebar');
    const contentPanel = page.querySelector('.document-reader-panel');
    const controls = sidebar?.querySelector('.pdf-viewer__toolbar');
    const back = sidebar?.querySelector('[data-route="/documents"]');

    expect(shell).not.toBeNull();
    expect(sidebar?.tagName).toBe('ASIDE');
    expect(sidebar?.contains(page.querySelector('#document-reader-title'))).toBe(true);
    expect(sidebar?.contains(page.querySelector('[data-action="download-pdf"]'))).toBe(true);
    expect(sidebar?.contains(page.querySelector('[data-action="delete-document"]'))).toBe(true);
    expect(sidebar?.querySelector('[data-role="pdf-controls"]')).toBe(controls?.parentElement);
    expect(back?.textContent.trim()).toBe('');
    expect(back?.getAttribute('aria-label')).toBe('กลับคลังเอกสาร');
    expect(contentPanel?.querySelector('.pdf-viewer__toolbar')).toBeNull();
    expect(contentPanel?.querySelector('[data-role="pdf-pages"]')).not.toBeNull();
  });

  it('keeps the PDF reader sidebar sticky and the reading surface centered', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.document-reader-shell--split\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(/\.document-reader-shell--split \.document-reader-sidebar\s*\{[^}]*position:\s*sticky/s);
    expect(styles).toMatch(/\.document-reader-sidebar \.pdf-viewer__toolbar\s*\{[^}]*display:\s*grid/s);
    expect(styles).toMatch(/\.pdf-viewer\s*\{[^}]*margin-inline:\s*auto/s);
    expect(styles).toMatch(/\.pdf-viewer__pages\s*\{[^}]*margin-inline:\s*auto/s);
    expect(styles).toMatch(/\.document-reader-shell--pdf:fullscreen,\s*\.document-reader-shell--fullscreen\s*\{[^}]*position:\s*fixed/s);
  });

  it('keeps PDF pages on the browser scroll and leaves one scroll area in fullscreen', async () => {
    const styles = document.createElement('style');
    styles.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(styles);
    const pdfjs = {
      getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }) }) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'pdf' }),
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    const readingArea = page.querySelector('[data-role="reader-content"]');
    const contentPanel = readingArea.closest('.document-reader-panel');
    const viewer = page.querySelector('.pdf-viewer');
    const pageFrame = page.querySelector('[data-role="pdf-page-frame"]');
    const pdfPage = page.querySelector('[data-role="pdf-page"]');
    expect(readingArea.dataset.documentType).toBe('pdf');
    expect(getComputedStyle(readingArea).overflow).toBe('visible');
    expect(getComputedStyle(readingArea).maxHeight).toBe('none');
    expect(contentPanel.dataset.documentType).toBe('pdf');
    expect(getComputedStyle(contentPanel).overflow).toBe('visible');
    expect(getComputedStyle(pageFrame).overflow).toBe('visible');
    expect(getComputedStyle(pdfPage).overflow).toBe('visible');
    viewer.classList.add('pdf-viewer--fullscreen');
    expect(getComputedStyle(pageFrame).overflow).toBe('auto');
    expect(getComputedStyle(pdfPage).overflow).toBe('visible');
    viewer.classList.remove('pdf-viewer--fullscreen');
    styles.remove();
    await page.destroy();
  });

  it('debounces text reading progress and clamps malformed saved positions when restoring', async () => {
    vi.useFakeTimers();
    let currentScrollY = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => currentScrollY });
    vi.stubGlobal('scrollTo', vi.fn(({ top }) => { currentScrollY = top; }));
    let restoreFrame;
    vi.stubGlobal('requestAnimationFrame', (callback) => { restoreFrame = callback; return 1; });
    const saveProgress = vi.fn().mockResolvedValue({});
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'txt', scroll_ratio: 3 }),
      loadDocumentText: async () => ({ text: 'A long passage.\n\n'.repeat(30), text_truncated: false, search_text_truncated: false, search_available: true }),
      saveProgress,
    });
    document.body.append(page);
    await flushPromises();
    const readingArea = page.querySelector('[data-role="reader-content"]');
    Object.defineProperty(readingArea, 'scrollHeight', { configurable: true, value: 1000 });
    readingArea.getBoundingClientRect = () => ({ top: 100 - currentScrollY });
    restoreFrame();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'auto' });
    expect(readingArea.dataset.restoredProgress).toBe('1');

    currentScrollY = 500;
    window.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(400);
    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(saveProgress).toHaveBeenCalledWith(4, { scroll_ratio: 0.5 });
    vi.unstubAllGlobals();
  });

  it('flushes the latest debounced reading position when leaving the reader', async () => {
    vi.useFakeTimers();
    let currentScrollY = 500;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => currentScrollY });
    const saveProgress = vi.fn().mockResolvedValue({});
    const page = renderPage({
      loadDocument: async () => ({ ...documentItem, file_type: 'txt' }),
      loadDocumentText: async () => ({ text: 'A long passage.', text_truncated: false, search_text_truncated: false, search_available: true }),
      saveProgress,
    });
    document.body.append(page);
    await flushPromises();

    const readingArea = page.querySelector('[data-role="reader-content"]');
    Object.defineProperty(readingArea, 'scrollHeight', { configurable: true, value: 1000 });
    readingArea.getBoundingClientRect = () => ({ top: 100 - currentScrollY });
    window.dispatchEvent(new Event('scroll'));

    await page.destroy();

    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(saveProgress).toHaveBeenCalledWith(4, { scroll_ratio: 0.5 });
  });

  it('keeps title editing compact beside the name and makes deletion visibly destructive', async () => {
    const page = renderPage();
    document.body.append(page);
    await flushPromises();

    const title = page.querySelector('#document-reader-title');
    const editButton = page.querySelector('[data-action="edit-title"]');
    const deleteButton = page.querySelector('[data-action="delete-document"]');

    expect(editButton.parentElement).toBe(title.parentElement);
    expect(editButton.getAttribute('aria-label')).toBe('แก้ชื่อเอกสาร');
    expect(editButton.textContent.trim()).toBe('');
    expect(editButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(deleteButton.classList.contains('button-danger')).toBe(true);
    expect(deleteButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(deleteButton.textContent).toContain('ลบเอกสาร');
  });

  it('renames, edits tags immediately, and confirms deletion back to the library', async () => {
    const updateTitle = vi.fn().mockResolvedValue({ ...documentItem, title: 'New title' });
    const updateTags = vi.fn().mockResolvedValue({
      ...documentItem,
      tags: [catalog.tags[0], catalog.tags[1]],
    });
    const remove = vi.fn().mockResolvedValue(null);
    const navigate = vi.fn();
    const page = renderPage({ updateTitle, replaceDocumentTags: updateTags, deleteDocument: remove, navigate });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="edit-title"]').click();
    const titleInput = page.querySelector('[data-role="title-input"]');
    titleInput.value = 'New title';
    titleInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(updateTitle).toHaveBeenCalledWith(4, { title: 'New title' });

    page.querySelector('[data-action="manage-tags"]').click();
    page.querySelector('[data-role="tag-picker"] button[data-tag-id="1"]').click();
    await flushPromises();
    expect(updateTags).toHaveBeenCalledWith(4, { tag_ids: [1] });

    page.querySelector('[data-action="delete-document"]').click();
    await flushPromises();
    expect(remove).toHaveBeenCalledWith(4);
    expect(navigate).toHaveBeenCalledWith('/documents');
  });
});
