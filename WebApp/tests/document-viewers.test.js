// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMarkdown } from '../src/documents/markdown-reader.js';
import { mountPdfViewer } from '../src/documents/pdf-viewer.js';

describe('safe Markdown rendering', () => {
  it('renders headings, lists, and code while removing script, event-handler, and unsafe-link markup', () => {
    const html = renderMarkdown([
      '# Set theory',
      '',
      '- union',
      '- intersection',
      '',
      '```js',
      'const set = new Set();',
      '```',
      '',
      '<script>window.__xss = true</script>',
      '<img src="x" onerror="window.__xss = true">',
      '[unsafe](javascript:alert(1))',
    ].join('\n'));
    const container = document.createElement('article');
    container.innerHTML = html;

    expect(container.querySelector('h1')?.textContent).toBe('Set theory');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('pre code')?.textContent).toContain('new Set');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    const link = container.querySelector('a');
    expect(link === null || !/^javascript:/i.test(link.getAttribute('href') || '')).toBe(true);
  });
});

describe('PDF.js page viewer', () => {
  let container;
  let context;
  let originalScrollY;
  let originalInnerHeight;

  beforeEach(() => {
    originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    container = document.createElement('section');
    document.body.replaceChildren(container);
    context = { clearRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    else delete window.scrollY;
    if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
    else delete window.innerHeight;
    for (const key of ['fullscreenElement', 'exitFullscreen']) {
      const descriptor = Object.getOwnPropertyDescriptor(document, key);
      if (descriptor) delete document[key];
    }
  });

  function createTextLayerHarness() {
    const instances = [];
    class FakeTextLayer {
      constructor({ textContentSource, container: layerContainer, viewport }) {
        this.textContentSource = textContentSource;
        this.container = layerContainer;
        this.viewport = viewport;
        this.cancelled = false;
        instances.push(this);
      }

      async render() {
        const { value } = await this.textContentSource.getReader().read();
        for (const item of value.items) {
          const span = document.createElement('span');
          span.textContent = item.str;
          this.container.append(span);
        }
      }

      cancel() {
        this.cancelled = true;
      }
    }

    return { TextLayer: FakeTextLayer, instances };
  }

  it('renders selectable PDF.js text on the same viewport as its canvas', async () => {
    const textLayerHarness = createTextLayerHarness();
    const pdfPage = {
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale, rotation: 0 }),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
      streamTextContent: vi.fn(() => new ReadableStream({
        start(controller) {
          controller.enqueue({ items: [{ str: 'Selectable source PDF text' }], styles: {} });
          controller.close();
        },
      })),
    };
    const pdfDocument = { numPages: 1, getPage: vi.fn(async () => pdfPage), destroy: vi.fn() };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: {
        ...textLayerHarness,
        getDocument: () => ({ promise: Promise.resolve(pdfDocument) }),
      },
    });

    const textLayer = container.querySelector('[data-role="pdf-page-text-layer"]');
    const canvasViewport = pdfPage.render.mock.calls[0][0].viewport;
    expect(textLayer).not.toBeNull();
    expect(textLayer.textContent).toContain('Selectable source PDF text');
    expect(textLayerHarness.instances[0].viewport).toBe(canvasViewport);
    expect(textLayer.style.getPropertyValue('--scale-factor')).toBe(String(canvasViewport.scale));
    expect(pdfPage.streamTextContent).toHaveBeenCalledOnce();

    await viewer.destroy();
  });

  it('replaces text layers on zoom and cancels the active layer on destroy', async () => {
    const textLayerHarness = createTextLayerHarness();
    const pdfPage = {
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale, rotation: 0 }),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
      streamTextContent: () => new ReadableStream({
        start(controller) {
          controller.enqueue({ items: [{ str: 'Text page' }], styles: {} });
          controller.close();
        },
      }),
    };
    const pdfDocument = { numPages: 1, getPage: vi.fn(async () => pdfPage), destroy: vi.fn() };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: {
        ...textLayerHarness,
        getDocument: () => ({ promise: Promise.resolve(pdfDocument) }),
      },
    });

    container.querySelector('[data-action="zoom-in"]').click();
    await viewer.whenIdle();
    expect(textLayerHarness.instances).toHaveLength(2);
    expect(textLayerHarness.instances[0].cancelled).toBe(true);
    expect(container.querySelectorAll('[data-role="pdf-page-text-layer"]')).toHaveLength(1);

    await viewer.destroy();
    expect(textLayerHarness.instances[1].cancelled).toBe(true);
    expect(container.querySelector('[data-role="pdf-page-text-layer"]')).toBeNull();
  });

  it('uses the page scroll for PDFs and updates page progress as the reader scrolls', async () => {
    const pdfDocument = {
      numPages: 3,
      getPage: vi.fn(async (pageNumber) => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
        pageNumber,
      })),
      destroy: vi.fn(),
    };
    const onPageChange = vi.fn();
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
      onPageChange,
    });

    const pages = [...container.querySelectorAll('[data-role="pdf-page"]')];
    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.dataset.pageNumber)).toEqual(['1', '2', '3']);

    let scrollTop = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollTop });
    vi.spyOn(window, 'scrollTo').mockImplementation((position, y) => {
      scrollTop = typeof position === 'object' ? position.top : y;
      window.dispatchEvent(new Event('scroll'));
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    pages.forEach((page, index) => {
      vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() => {
        const top = index * 600 - scrollTop;
        return { top, bottom: top + 600, left: 0, right: 600, width: 600, height: 600 };
      });
    });

    scrollTop = 650;
    window.dispatchEvent(new Event('scroll'));
    await viewer.whenIdle();
    expect(container.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 2 / 3');
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    container.querySelector('[data-action="next-page"]').click();
    await viewer.whenIdle();
    expect(scrollTop).toBe(1200);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'smooth' });
    expect(container.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 3 / 3');
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await viewer.destroy();
  });

  it('restores the saved page into view instead of only restoring the toolbar label', async () => {
    const pdfDocument = {
      numPages: 3,
      getPage: vi.fn(async (pageNumber) => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
        pageNumber,
      })),
      destroy: vi.fn(),
    };
    let scrollTop = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollTop });
    vi.spyOn(window, 'scrollTo').mockImplementation((position, y) => {
      scrollTop = typeof position === 'object' ? position.top : y;
      window.dispatchEvent(new Event('scroll'));
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect() {
      if (this.dataset.role === 'pdf-page') {
        const top = (Number(this.dataset.pageNumber) - 1) * 800 - scrollTop;
        return { top, bottom: top + 800, left: 0, right: 600, width: 600, height: 800 };
      }
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    });

    await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
      initialPage: 2,
    });

    expect(scrollTop).toBe(800);
    expect(container.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 2 / 3');
    expect(pdfDocument.getPage).toHaveBeenCalledWith(2);
  });

  it('enters and exits browser fullscreen from the reader toolbar', async () => {
    const pdfDocument = {
      numPages: 1,
      getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }),
      destroy: vi.fn(),
    };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });
    const viewerElement = container.querySelector('.pdf-viewer');
    const fullscreenButton = container.querySelector('[data-action="fullscreen"]');
    expect(fullscreenButton).not.toBeNull();
    let activeElement = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => activeElement });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn(async () => {
        activeElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      }),
    });
    viewerElement.requestFullscreen = vi.fn(async () => {
      activeElement = viewerElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    fullscreenButton.click();
    await Promise.resolve();
    expect(viewerElement.requestFullscreen).toHaveBeenCalledOnce();
    expect(fullscreenButton.textContent).toBe('ออกจากเต็มจอ');

    fullscreenButton.click();
    await Promise.resolve();
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(fullscreenButton.textContent).toBe('เต็มหน้าจอ');
    await viewer.destroy();
  });

  it('docks compact controls in the reader sidebar and fullscreens the whole reader shell', async () => {
    const shell = document.createElement('section');
    const toolbarContainer = document.createElement('aside');
    const pageContainer = document.createElement('main');
    shell.append(toolbarContainer, pageContainer);
    document.body.replaceChildren(shell);
    const pdfDocument = {
      numPages: 2,
      getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }),
      destroy: vi.fn(),
    };
    const viewer = await mountPdfViewer({
      container: pageContainer,
      toolbarContainer,
      fullscreenTarget: shell,
      compactToolbar: true,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });

    const toolbar = toolbarContainer.querySelector('.pdf-viewer__toolbar');
    const nextButton = toolbarContainer.querySelector('[data-action="next-page"]');
    const fullscreenButton = toolbarContainer.querySelector('[data-action="fullscreen"]');
    expect(toolbar).not.toBeNull();
    expect(pageContainer.querySelector('.pdf-viewer__toolbar')).toBeNull();
    expect(nextButton.textContent.trim()).toBe('');
    expect(nextButton.getAttribute('aria-label')).toBe('หน้าถัดไป');
    expect(nextButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    nextButton.click();
    await viewer.whenIdle();
    expect(toolbarContainer.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 2 / 2');

    let activeElement = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => activeElement });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn(async () => {
        activeElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      }),
    });
    shell.requestFullscreen = vi.fn(async () => {
      activeElement = shell;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    fullscreenButton.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(shell.requestFullscreen).toHaveBeenCalledOnce();
    expect(fullscreenButton.getAttribute('aria-pressed')).toBe('true');

    await viewer.destroy();
    expect(toolbarContainer.querySelector('.pdf-viewer__toolbar')).toBeNull();
  });

  it('renders newly visible pages when the fullscreen viewport grows', async () => {
    const pdfDocument = {
      numPages: 2,
      getPage: vi.fn(async (pageNumber) => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
        pageNumber,
      })),
      destroy: vi.fn(),
    };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });
    let frameHeight = 400;
    const pageFrame = container.querySelector('[data-role="pdf-page-frame"]');
    const pages = [...container.querySelectorAll('[data-role="pdf-page"]')];
    Object.defineProperty(pageFrame, 'clientHeight', { configurable: true, get: () => frameHeight });
    vi.spyOn(pageFrame, 'getBoundingClientRect').mockImplementation(() => ({
      top: 0, bottom: frameHeight, left: 0, right: 600, width: 600, height: frameHeight,
    }));
    pages.forEach((page, index) => {
      vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() => {
        const top = index * 800 - pageFrame.scrollTop;
        return { top, bottom: top + 800, left: 0, right: 600, width: 600, height: 800 };
      });
    });
    let activeElement = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => activeElement });

    expect(pdfDocument.getPage).not.toHaveBeenCalledWith(2);
    frameHeight = 1000;
    activeElement = container.querySelector('.pdf-viewer');
    document.dispatchEvent(new Event('fullscreenchange'));
    await viewer.whenIdle();

    expect(pdfDocument.getPage).toHaveBeenCalledWith(2);
    await viewer.destroy();
  });

  it('renders newly visible pages after the regular reader viewport grows', async () => {
    const pdfDocument = {
      numPages: 2,
      getPage: vi.fn(async (pageNumber) => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
        pageNumber,
      })),
      destroy: vi.fn(),
    };
    let viewportHeight = 400;
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewportHeight });
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });
    const pages = [...container.querySelectorAll('[data-role="pdf-page"]')];
    pages.forEach((page, index) => {
      vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() => {
        const top = index * 800;
        return { top, bottom: top + 800, left: 0, right: 600, width: 600, height: 800 };
      });
    });

    expect(pdfDocument.getPage).not.toHaveBeenCalledWith(2);
    viewportHeight = 1000;
    window.dispatchEvent(new Event('resize'));
    await viewer.whenIdle();

    expect(pdfDocument.getPage).toHaveBeenCalledWith(2);
    await viewer.destroy();
  });

  it('removes fullscreen and resize listeners when the initial page render fails', async () => {
    const pdfDocument = {
      numPages: 1,
      getPage: vi.fn()
        .mockRejectedValueOnce(new Error('render failed'))
        .mockResolvedValue({
          getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
          render: vi.fn(() => ({ promise: Promise.resolve() })),
        }),
      destroy: vi.fn(),
    };
    await expect(mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    })).rejects.toThrow('render failed');

    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('fullscreenchange'));
    await Promise.resolve();
    await Promise.resolve();

    expect(pdfDocument.getPage).toHaveBeenCalledOnce();
    expect(container.querySelector('.pdf-viewer')).toBeNull();
    expect(pdfDocument.destroy).toHaveBeenCalledOnce();
  });

  it('uses a CSS fullscreen fallback that closes with Escape when fullscreen is unavailable', async () => {
    const pdfDocument = {
      numPages: 1,
      getPage: async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }),
      destroy: vi.fn(),
    };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });
    const viewerElement = container.querySelector('.pdf-viewer');
    const fullscreenButton = container.querySelector('[data-action="fullscreen"]');
    expect(fullscreenButton).not.toBeNull();
    const panel = document.createElement('div');
    panel.className = 'document-reader-panel';
    panel.style.backdropFilter = 'blur(16px)';
    panel.style.overflow = 'hidden';
    container.replaceWith(panel);
    panel.append(container);

    fullscreenButton.click();
    expect(viewerElement.classList.contains('pdf-viewer--fullscreen')).toBe(true);
    expect(viewerElement.parentElement).toBe(document.body);
    expect(fullscreenButton.textContent).toBe('ออกจากเต็มจอ');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(viewerElement.classList.contains('pdf-viewer--fullscreen')).toBe(false);
    expect(viewerElement.parentElement).toBe(container);
    expect(fullscreenButton.textContent).toBe('เต็มหน้าจอ');
    await viewer.destroy();
  });

  it('renders PDF pages, shows total count, clamps restored page, navigates, zooms, and reports progress', async () => {
    const pdfDocument = {
      numPages: 3,
      getPage: vi.fn(async (pageNumber) => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
        pageNumber,
      })),
      destroy: vi.fn(),
    };
    const pdfjs = { getDocument: vi.fn(() => ({ promise: Promise.resolve(pdfDocument) })) };
    const onPageChange = vi.fn();
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs,
      initialPage: 99,
      onPageChange,
    });

    expect(pdfjs.getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array) }));
    expect(container.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 3 / 3');
    expect(pdfDocument.getPage).toHaveBeenNthCalledWith(1, 3);
    expect(container.querySelector('[data-action="next-page"]').disabled).toBe(true);

    container.querySelector('[data-action="previous-page"]').click();
    await viewer.whenIdle();
    expect(container.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 2 / 3');
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    const initialScale = container.querySelector('[data-page-number="2"] canvas').dataset.scale;
    container.querySelector('[data-action="zoom-in"]').click();
    await viewer.whenIdle();
    expect(Number(container.querySelector('[data-page-number="2"] canvas').dataset.scale)).toBeGreaterThan(Number(initialScale));
    expect(container.querySelector('[data-page-number="2"] canvas').style.maxWidth).toBe('none');
    expect(container.querySelector('[data-page-number="2"]').style.width).toBe('750px');
    expect(container.querySelector('[data-page-number="2"]').style.maxWidth).toBe('none');
    expect(container.querySelector('[data-role="pdf-zoom-status"]').textContent).toContain('%');

    await viewer.destroy();
    expect(pdfDocument.destroy).toHaveBeenCalled();
  });

  it('cancels or serializes active canvas rendering when page and zoom change rapidly', async () => {
    let activeRenders = 0;
    let maximumActiveRenders = 0;
    const pdfDocument = {
      numPages: 3,
      getPage: vi.fn(async () => ({
        getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
        render: vi.fn(() => {
          activeRenders += 1;
          maximumActiveRenders = Math.max(maximumActiveRenders, activeRenders);
          let active = true;
          let timeout;
          let rejectRender;
          const promise = new Promise((resolve, reject) => {
            rejectRender = reject;
            timeout = setTimeout(() => {
              if (!active) return;
              active = false;
              activeRenders -= 1;
              resolve();
            }, 12);
          });
          return {
            promise,
            cancel: () => {
              if (!active) return;
              active = false;
              clearTimeout(timeout);
              activeRenders -= 1;
              const error = new Error('Rendering cancelled');
              error.name = 'RenderingCancelledException';
              rejectRender(error);
            },
          };
        }),
      })),
      destroy: vi.fn(),
    };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });

    container.querySelector('[data-action="next-page"]').click();
    container.querySelector('[data-action="zoom-in"]').click();
    await viewer.whenIdle();

    expect(maximumActiveRenders).toBe(1);
    expect(container.querySelector('[data-role="pdf-page-status"]').textContent).toBe('หน้า 2 / 3');
    await viewer.destroy();
  });

  it('bounds canvas memory for PDFs with unusually large page dimensions', async () => {
    const pdfDocument = {
      numPages: 1,
      getPage: vi.fn(async () => ({
        getViewport: ({ scale }) => ({ width: 1e200 * scale, height: 1e200 * scale }),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
      })),
      destroy: vi.fn(),
    };
    const viewer = await mountPdfViewer({
      container,
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdfDocument) }) },
    });

    const canvas = container.querySelector('canvas');
    expect(canvas.width).toBeLessThanOrEqual(8192);
    expect(canvas.height).toBeLessThanOrEqual(8192);
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(16_000_000);
    expect(container.querySelector('[data-role="pdf-scale-notice"]').hidden).toBe(false);
    expect(container.querySelector('[data-role="pdf-zoom-status"]').textContent).not.toBe('100%');

    await viewer.destroy();
  });
});
