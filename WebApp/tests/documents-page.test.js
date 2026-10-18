// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderDocumentsPage } from '../src/pages/DocumentsPage.js';

const catalog = {
  tags: [
    { id: 1, name: 'คณิตศาสตร์', is_builtin: true, color: 'blue', parent_id: null },
    { id: 2, name: 'ภาษาอังกฤษ', is_builtin: true, color: 'violet', parent_id: null },
    { id: 8, name: 'เซต', parent_id: 1, is_builtin: false, color: 'pink' },
    { id: 9, name: 'คำศัพท์', parent_id: 2, is_builtin: false, color: 'amber' },
  ],
};

const documentItem = {
  id: 4,
  title: 'ทฤษฎีเซต',
  original_filename: 'sets.md',
  file_type: 'md',
  size_bytes: 1024,
  created_at: '2026-10-10T08:00:00Z',
  updated_at: '2026-10-10T08:00:00Z',
  last_page: null,
  scroll_ratio: null,
  search_text_truncated: false,
  tags: [],
};

async function flushPromises() {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function renderPage(options = {}) {
  const page = renderDocumentsPage({
    loadDocuments: async () => [],
    loadTags: async () => catalog,
    loadDocumentContent: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
    loadDocumentText: vi.fn().mockResolvedValue({ text: 'A sample document excerpt.', text_truncated: false }),
    uploadDocument: vi.fn().mockResolvedValue(documentItem),
    createTag: vi.fn(),
    renameDocument: vi.fn().mockResolvedValue(documentItem),
    replaceDocumentTags: vi.fn().mockResolvedValue(documentItem),
    deleteDocument: vi.fn().mockResolvedValue(null),
    confirmDelete: vi.fn().mockReturnValue(true),
    ...options,
  });
  mountedPages.push(page);
  return page;
}

const mountedPages = [];

describe('document library page', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  });
  afterEach(() => {
    mountedPages.splice(0).forEach((page) => page.destroy?.());
    document.head.querySelectorAll('[data-test-styles="document-library-preview-overlay"]').forEach((style) => style.remove());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a loading state and then a useful empty-library action', async () => {
    const pending = deferred();
    const page = renderPage({ loadDocuments: () => pending.promise });
    document.body.append(page);

    expect(page.querySelector('[role="status"]')?.textContent).toContain('กำลังโหลด');
    pending.resolve([]);
    await flushPromises();

    expect(page.textContent).toContain('ยังไม่มีเอกสาร');
    expect(page.querySelector('[data-role="file-input"]')).not.toBeNull();
  });

  it('presents the upload-first library header with one accessible category filter', async () => {
    const page = renderPage();
    document.body.append(page);
    await flushPromises();

    expect(page.querySelector('.document-upload-panel__copy h2').textContent).toContain('วางไฟล์');
    const uploadInput = page.querySelector('[data-role="file-input"]');
    expect(page.querySelector('.document-upload-panel__copy p').textContent).toContain('PDF, Markdown และ TXT');
    expect(page.querySelector('.document-upload-panel__copy p').textContent).not.toContain('DOCX');
    expect(uploadInput.accept).not.toContain('.docx');
    expect(uploadInput.accept).not.toContain('wordprocessingml');
    expect(page.querySelector('[data-role="document-search-form"] .document-library-filter')).not.toBeNull();
    expect(page.querySelector('[data-role="document-search-form"] [data-role="document-tag-filter"]')).not.toBeNull();
    expect(page.querySelectorAll('.document-tag-filter')).toHaveLength(0);
    expect(page.querySelector('[data-role="document-tag-filter"] option[value="8"]')?.textContent).toContain('เซต');
  });

  it('uploads each selected file independently and shows an outcome for every file', async () => {
    const loadDocuments = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([documentItem]);
    const uploadDocument = vi.fn(async (formData) => {
      const file = formData.get('file');
      if (file.name === 'bad.doc') throw new Error('รองรับ PDF, Markdown และ TXT');
      return { ...documentItem, original_filename: file.name };
    });
    const page = renderPage({ loadDocuments, uploadDocument });
    document.body.append(page);
    await flushPromises();

    const input = page.querySelector('[data-role="file-input"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['notes'], 'notes.md', { type: 'text/markdown' }), new File(['old'], 'bad.doc')],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    expect(uploadDocument).toHaveBeenCalledTimes(2);
    expect(uploadDocument.mock.calls[0][0].get('file').name).toBe('notes.md');
    expect(uploadDocument.mock.calls[1][0].get('file').name).toBe('bad.doc');
    expect(page.querySelectorAll('[data-upload-result]')).toHaveLength(2);
    expect(page.textContent).toContain('notes.md');
    expect(page.textContent).toContain('bad.doc');
    expect(page.textContent).toContain('ยังไม่ได้เลือกวิชา');
  });

  it('persists independent tag chips immediately when selected', async () => {
    const saveTags = vi.fn(async (_id, { tag_ids }) => ({
      ...documentItem,
      tags: catalog.tags
        .filter((tag) => tag_ids.includes(tag.id)),
    }));
    const page = renderPage({ loadDocuments: async () => [{ ...documentItem }], replaceDocumentTags: saveTags });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-action="manage-tags"]').click();

    const picker = page.querySelector('[data-role="tag-picker"]');
    picker.querySelector('button[data-tag-id="1"]').click();
    await flushPromises();
    picker.querySelector('button[data-tag-id="8"]').click();
    await flushPromises();

    expect(saveTags).toHaveBeenNthCalledWith(1, 4, { tag_ids: [1] });
    expect(saveTags).toHaveBeenNthCalledWith(2, 4, { tag_ids: [1, 8] });
    expect(page.querySelector('[data-role="tag-summary"]').textContent).toContain('คณิตศาสตร์');
    expect(page.querySelector('[data-role="tag-summary"]').textContent).toContain('เซต');
    expect(picker.querySelector('button[data-tag-id="1"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('lets unrelated built-in and custom tags remain selected together', async () => {
    const saveTags = vi.fn(async (_id, { tag_ids }) => ({
      ...documentItem,
      tags: catalog.tags
        .filter((tag) => tag_ids.includes(tag.id)),
    }));
    const page = renderPage({
      loadDocuments: async () => [{ ...documentItem, tags: [catalog.tags[0], catalog.tags[2]] }],
      replaceDocumentTags: saveTags,
    });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-action="manage-tags"]').click();
    page.querySelector('[data-role="tag-picker"] button[data-tag-id="2"]').click();
    await flushPromises();

    expect(saveTags).toHaveBeenCalledWith(4, { tag_ids: [1, 8, 2] });
    expect(page.querySelector('[data-role="tag-picker"] button[data-tag-id="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(page.querySelector('[data-role="tag-picker"] button[data-tag-id="8"]').getAttribute('aria-pressed')).toBe('true');
    expect(page.querySelector('[data-role="tag-picker"] button[data-tag-id="2"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('searches case-insensitively through the API and combines query with active tag', async () => {
    const loadDocuments = vi.fn().mockResolvedValue([]);
    const page = renderPage({ loadDocuments });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-role="document-search-input"]').value = '  SETS  ';
    submit(page.querySelector('[data-role="document-search-form"]'));
    await flushPromises();
    expect(loadDocuments).toHaveBeenLastCalledWith({ limit: 25, offset: 0, q: 'SETS' });

    const tagFilter = page.querySelector('[data-role="document-tag-filter"]');
    tagFilter.value = '1';
    tagFilter.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(loadDocuments).toHaveBeenLastCalledWith({ limit: 25, offset: 0, q: 'SETS', tagId: 1 });
  });

  it('shows indexed-text truncation notices and keeps theme styling token based', async () => {
    const page = renderPage({ loadDocuments: async () => [{ ...documentItem, search_text_truncated: true }] });
    document.body.append(page);
    await flushPromises();

    expect(page.textContent).toContain('ค้นหาได้บางส่วน');
    expect(page.classList.contains('document-library-page')).toBe(true);
    const styles = readFileSync('src/styles.css', 'utf8');
    const libraryStyles = styles.slice(styles.indexOf('.document-library-page'));
    expect(libraryStyles).toMatch(/var\(--(?:surface|glass|line|ink|muted|accent)/);
  });

  it('lays out compact document cards in a responsive grid with open links and file-type markers', async () => {
    const styles = document.createElement('style');
    styles.dataset.testStyles = 'document-library-grid';
    styles.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(styles);
    const page = renderPage({
      loadDocuments: async () => [
        { ...documentItem, id: 4 },
        { ...documentItem, id: 5, title: 'English notes', original_filename: 'english.txt' },
      ],
    });
    document.body.append(page);
    await flushPromises();

    const list = page.querySelector('[data-role="document-list"]');
    expect(getComputedStyle(list).display).toBe('grid');
    expect(getComputedStyle(list).gridTemplateColumns).toContain('repeat(4');
    expect(list.querySelectorAll('.document-library-card')).toHaveLength(2);
    expect(list.querySelectorAll('.document-library-card__preview')).toHaveLength(2);
    expect(list.querySelectorAll('.document-library-card__preview--placeholder')).toHaveLength(2);
    expect(list.querySelector('[data-document-id="4"] [data-role="document-file-type"]').textContent).toBe('MD');
    expect(list.querySelectorAll('a[data-route^="/documents/"]')).toHaveLength(2);
    styles.remove();
  });

  it('opens a document through the full-card link and keeps rename controls separate', async () => {
    const navigate = vi.fn();
    const page = renderPage({ loadDocuments: async () => [{ ...documentItem }], navigate });
    document.body.append(page);
    await flushPromises();

    const card = page.querySelector('[data-document-id="4"]');
    const openLink = card.querySelector('.document-library-card__open-link');
    expect(openLink.getAttribute('aria-label')).toContain('เปิดอ่าน ทฤษฎีเซต');
    openLink.click();
    expect(navigate).toHaveBeenCalledWith('/documents/4');

    card.querySelector('[data-action="edit-title"]').click();
    expect(card.querySelector('[data-role="title-dialog"]').hasAttribute('open')).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it.each([
    [480, 7, 6],
    [481, 13, 12],
    [1079, 13, 12],
    [1080, 25, 24],
  ])('uses six rows at viewport width %s', async (width, responseSize, visibleSize) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const loadDocuments = vi.fn().mockResolvedValue(
      Array.from({ length: responseSize }, (_, index) => ({ ...documentItem, id: index + 1 })),
    );
    const page = renderPage({ loadDocuments });
    document.body.append(page);
    await flushPromises();

    expect(loadDocuments).toHaveBeenCalledWith({ limit: responseSize, offset: 0 });
    expect(page.querySelectorAll('[data-document-id]')).toHaveLength(visibleSize);
  });

  it('uses four columns on wide screens, two on medium screens, and one on narrow screens', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.document-library-list\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
    expect(styles).toMatch(/@media \(max-width:\s*1079px\)\s*\{\s*\.document-library-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    expect(styles).toMatch(/@media \(max-width:\s*480px\)[\s\S]*?\.document-library-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('shows at most 24 documents per desktop page and navigates between pages', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({
      ...documentItem,
      id: index + 1,
      title: `Document ${index + 1}`,
    }));
    const loadDocuments = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ ...documentItem, id: 26, title: 'Document 26' }]);
    const page = renderPage({ loadDocuments });
    document.body.append(page);
    await flushPromises();

    expect(loadDocuments).toHaveBeenNthCalledWith(1, { limit: 25, offset: 0 });
    expect(page.querySelectorAll('[data-document-id]')).toHaveLength(24);
    expect(page.querySelector('[data-role="pagination"]').hidden).toBe(false);

    page.querySelector('[data-action="next-page"]').click();
    await flushPromises();

    expect(loadDocuments).toHaveBeenNthCalledWith(2, { limit: 25, offset: 24 });
    expect(page.querySelectorAll('[data-document-id]')).toHaveLength(1);
    expect(page.querySelector('[data-document-id="26"] h2').textContent).toBe('Document 26');
    expect(page.querySelector('[data-action="previous-page"]').disabled).toBe(false);
    expect(page.querySelector('[data-action="next-page"]').disabled).toBe(true);
  });

  it('reduces document page size when the viewport moves from desktop to medium', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const loadDocuments = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 25 }, (_, index) => ({ ...documentItem, id: index + 1 })))
      .mockResolvedValueOnce(Array.from({ length: 13 }, (_, index) => ({ ...documentItem, id: index + 40 })));
    const page = renderPage({ loadDocuments });
    document.body.append(page);
    await flushPromises();
    expect(page.querySelectorAll('[data-document-id]')).toHaveLength(24);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    window.dispatchEvent(new Event('resize'));
    await flushPromises();

    expect(loadDocuments).toHaveBeenNthCalledWith(2, { limit: 13, offset: 0 });
    expect(page.querySelectorAll('[data-document-id]')).toHaveLength(12);
  });

  it('disables stale next-page navigation after a page request fails', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({ ...documentItem, id: index + 1 }));
    const loadDocuments = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error('โหลดเอกสารไม่สำเร็จ'))
      .mockResolvedValueOnce(firstPage);
    const page = renderPage({ loadDocuments });
    document.body.append(page);
    await flushPromises();

    page.querySelector('[data-action="next-page"]').click();
    await flushPromises();

    expect(page.querySelector('[role="alert"]').textContent).toContain('โหลดเอกสารไม่สำเร็จ');
    expect(page.querySelector('[data-action="next-page"]').disabled).toBe(true);
    expect(page.querySelector('[data-action="previous-page"]').disabled).toBe(false);

    page.querySelector('[data-action="previous-page"]').click();
    await flushPromises();
    expect(page.querySelectorAll('[data-document-id]')).toHaveLength(24);
    expect(page.querySelector('[data-action="next-page"]').disabled).toBe(false);
  });

  it('uses a shared glass-style dropdown and route-only page entrance animation', () => {
    const styles = document.createElement('style');
    styles.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(styles);
    const createForm = document.createElement('form');
    createForm.className = 'quiz-create-form';
    const field = document.createElement('div');
    field.className = 'field';
    const select = document.createElement('select');
    select.className = 'tutor-model-select';
    field.append(select);
    createForm.append(field);
    const page = document.createElement('section');
    page.className = 'page';
    document.body.append(createForm, page);

    expect(getComputedStyle(select).appearance).toBe('none');
    expect(getComputedStyle(select).backgroundImage).toContain('linear-gradient');
    expect(getComputedStyle(select).paddingRight).not.toBe('');
    const pageMotion = [...styles.sheet.cssRules].find((rule) => (
      rule.selectorText === '.page-enter' && rule.style.getPropertyValue('animation')
    ));
    expect(pageMotion?.style.getPropertyValue('animation')).toContain('page-enter');
    expect(pageMotion?.style.getPropertyValue('animation')).not.toContain('both');
    expect([...styles.sheet.cssRules].some((rule) => (
      rule.selectorText === '.page' && rule.style.getPropertyValue('animation')
    ))).toBe(false);
    styles.remove();
  });

  it('shows a rendered first-page PDF preview without extracting document text', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const loadDocumentContent = vi.fn().mockResolvedValue(new Blob(['pdf-bytes'], { type: 'application/pdf' }));
    const loadDocumentText = vi.fn().mockResolvedValue({
      text: '# Set theory\n\nA set is a collection of distinct objects.\nThe empty set has no elements.',
      text_truncated: false,
      search_available: true,
    });
    const pdfPage = {
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    };
    const pdfDocument = { numPages: 1, getPage: vi.fn().mockResolvedValue(pdfPage), destroy: vi.fn() };
    const pdfjs = { getDocument: vi.fn(() => ({ promise: Promise.resolve(pdfDocument), destroy: vi.fn() })) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const page = renderPage({
      loadDocuments: async () => [{
        ...documentItem,
        title: 'set-theory-notes.pdf',
        original_filename: 'set-theory-notes.pdf',
        file_type: 'pdf',
      }],
      loadDocumentContent,
      loadDocumentText,
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    const card = page.querySelector('[data-document-id="4"]');
    expect(card.querySelector('h2').textContent).toBe('set-theory-notes');
    expect(card.querySelector('[data-role="document-file-type"]').textContent).toBe('PDF');
    expect(card.querySelector('.document-library-card__file-icon')).not.toBeNull();
    expect(card.querySelector('.document-library-card__source')).toBeNull();
    expect(card.querySelector('[data-role="document-preview"]')).not.toBeNull();
    expect(card.querySelector('[data-role="document-pdf-preview"]')).not.toBeNull();
    expect(loadDocumentContent).toHaveBeenCalledWith(4);
    expect(pdfPage.render).toHaveBeenCalledOnce();
    expect(loadDocumentText).not.toHaveBeenCalled();
  });

  it('shows a blank gray document preview for text files without loading PDF content', async () => {
    const loadDocumentContent = vi.fn();
    const styles = document.createElement('style');
    styles.dataset.testStyles = 'document-library-preview-overlay';
    styles.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(styles);
    const page = renderPage({
      loadDocuments: async () => [{
        ...documentItem,
        title: 'study-notes.txt',
        original_filename: 'study-notes.txt',
        file_type: 'txt',
      }],
      loadDocumentContent,
    });
    document.body.append(page);
    await flushPromises();

    const card = page.querySelector('[data-document-id="4"]');
    const preview = card.querySelector('.document-library-card__preview');
    expect(preview).not.toBeNull();
    expect(preview.classList.contains('document-library-card__preview--placeholder')).toBe(true);
    expect(preview.hasAttribute('data-role')).toBe(false);
    expect(preview.querySelector('[data-role="document-pdf-preview"]')).toBeNull();
    expect(preview.querySelector('.document-library-card__preview-placeholder-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(preview).height).toBe('12rem');
    expect(getComputedStyle(preview).background).toContain('var(--surface-muted)');
    const iconRule = Array.from(styles.sheet.cssRules).find(({ selectorText }) => (
      selectorText === '.document-library-page .document-library-card__preview-placeholder-icon'
    ));
    expect(iconRule.style.getPropertyValue('border')).toContain('var(--line-strong)');
    expect(card.querySelector('[data-role="document-file-type"]').textContent).toBe('TXT');
    expect(loadDocumentContent).not.toHaveBeenCalled();
    styles.remove();
  });

  it('uses a plus control for tag management and omits the added date from document cards', async () => {
    const page = renderPage({ loadDocuments: async () => [{ ...documentItem }] });
    document.body.append(page);
    await flushPromises();

    const card = page.querySelector('[data-document-id="4"]');
    const manageTags = card.querySelector('[data-action="manage-tags"]');
    expect(manageTags.textContent).toBe('+');
    expect(manageTags.getAttribute('aria-label')).toBe('แก้แท็กของ ทฤษฎีเซต');
    expect(card.textContent).not.toContain('เพิ่มเมื่อ');
  });

  it('extends the PDF preview beneath the rename and delete controls and colors its file badge red', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    const styles = document.createElement('style');
    styles.dataset.testStyles = 'document-library-preview-overlay';
    styles.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(styles);
    const pdfPage = {
      getViewport: ({ scale }) => ({ width: 200 * scale, height: 280 * scale }),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    };
    const pdfjs = {
      getDocument: () => ({
        promise: Promise.resolve({ numPages: 1, getPage: async () => pdfPage, destroy: vi.fn() }),
        destroy: vi.fn(),
      }),
    };
    const page = renderPage({
      loadDocuments: async () => [{ ...documentItem, file_type: 'pdf', original_filename: 'set-theory.pdf' }],
      pdfjs,
    });
    document.body.append(page);
    await flushPromises();

    const card = page.querySelector('[data-document-id="4"]');
    const preview = card.querySelector('[data-role="document-preview"]');
    const rename = card.querySelector('[data-action="edit-title"]');
    const remove = card.querySelector('[data-action="delete-document"]');
    const pdfBadge = card.querySelector('[data-role="document-file-type"]');
    const previewCanvas = card.querySelector('[data-role="document-pdf-preview"]');
    expect(getComputedStyle(card).paddingTop).toBe('0.9rem');
    expect(parseFloat(getComputedStyle(preview).height)).toBeGreaterThanOrEqual(11);
    expect(getComputedStyle(preview).paddingTop).toBe('0px');
    expect(getComputedStyle(preview).borderTopWidth).toBe('5px');
    expect(getComputedStyle(preview).borderTopStyle).toBe('solid');
    const previewRule = Array.from(styles.sheet.cssRules).find(({ selectorText }) => selectorText === '.document-library-page .document-library-card__preview');
    const cardRule = Array.from(styles.sheet.cssRules).find(({ selectorText }) => selectorText === '.document-library-page .document-library-card');
    const previewBorderColor = previewRule.style.getPropertyValue('border-color');
    expect(previewBorderColor).toBe('inherit');
    expect(cardRule.style.getPropertyValue('border')).toContain('var(--line)');
    expect(getComputedStyle(preview).marginTop).toBe('-0.9rem');
    expect(getComputedStyle(preview).marginLeft).toBe('-0.9rem');
    expect(getComputedStyle(previewCanvas).borderTopWidth).toBe('0px');
    expect(getComputedStyle(previewCanvas).borderTopStyle).toBe('none');
    expect(getComputedStyle(rename).zIndex).toBe('3');
    expect(getComputedStyle(remove).zIndex).toBe('3');
    expect(pdfBadge.classList.contains('document-library-card__file-type--pdf')).toBe(true);
    expect(getComputedStyle(pdfBadge).backgroundColor).toBe('rgb(220, 38, 38)');
    expect(getComputedStyle(previewCanvas).width).toBe('100%');
    expect(getComputedStyle(previewCanvas).height).toBe('100%');
    expect(getComputedStyle(previewCanvas).objectFit).toBe('cover');
  });

  it('places hidden fullscreen notices before the bounded page-frame grid row', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.pdf-viewer--fullscreen\s*\{[^}]*grid-template-rows:\s*auto auto auto minmax\(0, 1fr\)/);
    expect(styles).toMatch(/\.pdf-viewer--fullscreen \.pdf-viewer__toolbar\s*\{[^}]*grid-row:\s*1;/);
    expect(styles).toMatch(/\.pdf-viewer--fullscreen \.pdf-viewer__scale-note\s*\{[^}]*grid-row:\s*2;/);
    expect(styles).toMatch(/\.pdf-viewer--fullscreen \.pdf-viewer__error\s*\{[^}]*grid-row:\s*3;/);
    expect(styles).toMatch(/\.pdf-viewer--fullscreen \.pdf-viewer__page-frame\s*\{[^}]*grid-row:\s*4;[^}]*min-height:\s*0;[^}]*max-height:\s*none/);
  });

  it('renames documents and provides confirm/cancel behavior for deletion', async () => {
    const renameDocument = vi.fn().mockResolvedValue({ ...documentItem, title: 'ชื่อใหม่' });
    const deleteDocument = vi.fn().mockResolvedValue(null);
    const confirmDelete = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const page = renderPage({
      loadDocuments: async () => [{ ...documentItem }],
      renameDocument,
      deleteDocument,
      confirmDelete,
    });
    document.body.append(page);
    await flushPromises();

    const titleDialog = page.querySelector('[data-role="title-dialog"]');
    page.querySelector('[data-action="edit-title"]').click();
    expect(titleDialog.hasAttribute('open')).toBe(true);
    const titleInput = page.querySelector('[data-role="title-input"]');
    titleInput.value = '  ชื่อใหม่.pdf  ';
    submit(page.querySelector('[data-role="title-form"]'));
    await flushPromises();
    expect(renameDocument).toHaveBeenCalledWith(4, { title: 'ชื่อใหม่' });
    expect(page.querySelector('[data-document-id="4"] h2').textContent).toBe('ชื่อใหม่');
    expect(titleDialog.hasAttribute('open')).toBe(false);

    page.querySelector('[data-action="delete-document"]').click();
    expect(deleteDocument).not.toHaveBeenCalled();
    page.querySelector('[data-action="delete-document"]').click();
    await flushPromises();
    expect(deleteDocument).toHaveBeenCalledWith(4);
  });

  it('shows no-match, load-error, and tag-save error states accessibly', async () => {
    const loadDocuments = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('โหลดเอกสารไม่ได้'));
    const page = renderPage({ loadDocuments, loadTags: async () => catalog });
    document.body.append(page);
    await flushPromises();
    page.querySelector('[data-role="document-search-input"]').value = 'missing';
    submit(page.querySelector('[data-role="document-search-form"]'));
    await flushPromises();
    expect(page.textContent).toContain('ไม่พบเอกสารที่ตรงกับการค้นหา');

    page.querySelector('[data-action="clear-filters"]').click();
    await flushPromises();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('โหลดเอกสารไม่ได้');
  });
});
