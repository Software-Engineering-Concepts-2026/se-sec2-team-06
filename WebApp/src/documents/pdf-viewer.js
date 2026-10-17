import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfjsPromise;
const MAX_CANVAS_PIXELS = 16_000_000;
const MAX_CANVAS_DIMENSION = 8192;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(paths) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function clampPage(value, pageCount) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(pageCount, Math.max(1, Math.trunc(parsed)));
}

function pixelScaleFactor(width, height) {
  return Math.sqrt(MAX_CANVAS_PIXELS) / Math.sqrt(width) / Math.sqrt(height);
}

function boundedViewport(pdfPage, requestedScale) {
  const desiredViewport = pdfPage.getViewport({ scale: requestedScale });
  const desiredWidth = Number(desiredViewport.width);
  const desiredHeight = Number(desiredViewport.height);
  if (!Number.isFinite(desiredWidth) || !Number.isFinite(desiredHeight) || desiredWidth <= 0 || desiredHeight <= 0) {
    throw new Error('ขนาดหน้า PDF ไม่ถูกต้อง');
  }

  let scaleFactor = Math.min(
    1,
    MAX_CANVAS_DIMENSION / Math.max(desiredWidth, desiredHeight),
    pixelScaleFactor(desiredWidth, desiredHeight),
  );
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    throw new Error('หน้านี้มีขนาดใหญ่เกินกว่าจะแสดงได้อย่างปลอดภัย');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const actualScale = requestedScale * scaleFactor;
    if (!Number.isFinite(actualScale) || actualScale <= 0) {
      throw new Error('หน้านี้มีขนาดใหญ่เกินกว่าจะแสดงได้อย่างปลอดภัย');
    }
    const viewport = pdfPage.getViewport({ scale: actualScale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    if (
      Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      && width <= MAX_CANVAS_DIMENSION && height <= MAX_CANVAS_DIMENSION
      && width * height <= MAX_CANVAS_PIXELS
    ) {
      return { viewport, actualScale, limited: scaleFactor < 0.9999 };
    }

    const correction = Math.min(
      MAX_CANVAS_DIMENSION / Math.max(width, height),
      pixelScaleFactor(width, height),
    );
    if (!Number.isFinite(correction) || correction <= 0) break;
    scaleFactor *= correction * 0.999;
  }
  throw new Error('ไม่สามารถลดขนาดหน้า PDF ให้อยู่ในขีดจำกัดที่ปลอดภัยได้');
}

export async function mountPdfPreview({ container, blob, pdfjs: injectedPdfJs, maxWidth = 420 } = {}) {
  if (!container || !blob || typeof blob.arrayBuffer !== 'function') {
    throw new TypeError('A PDF preview container and Blob are required');
  }

  const pdfjs = injectedPdfJs ?? await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  let pdfDocument;
  try {
    pdfDocument = await loadingTask.promise;
    if (!Number.isSafeInteger(pdfDocument.numPages) || pdfDocument.numPages < 1) {
      throw new Error('ไฟล์ PDF ไม่มีหน้าที่อ่านได้');
    }

    const pdfPage = await pdfDocument.getPage(1);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const pageWidth = Number(baseViewport.width);
    if (!Number.isFinite(pageWidth) || pageWidth <= 0) throw new Error('ขนาดหน้า PDF ไม่ถูกต้อง');
    const availableWidth = Math.max(1, Math.min(Number(container.clientWidth) || maxWidth, maxWidth));
    const requestedScale = Math.min(1, availableWidth / pageWidth);
    const { viewport } = boundedViewport(pdfPage, requestedScale);
    const canvas = element('canvas', 'document-library-card__preview-canvas');
    canvas.dataset.role = 'document-pdf-preview';
    canvas.setAttribute('aria-label', 'หน้าแรกของเอกสาร PDF');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = 'auto';
    canvas.style.maxWidth = '100%';

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('ไม่สามารถแสดงตัวอย่าง PDF ได้ในเบราว์เซอร์นี้');
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    container.replaceChildren(canvas);
    return canvas;
  } finally {
    await Promise.resolve(pdfDocument?.destroy?.()).catch(() => {});
    await Promise.resolve(loadingTask.destroy?.()).catch(() => {});
  }
}

export async function mountPdfViewer({
  container,
  toolbarContainer,
  fullscreenTarget,
  compactToolbar = false,
  blob,
  pdfjs: injectedPdfJs,
  initialPage = 1,
  onPageChange = () => {},
} = {}) {
  if (!container || !blob || typeof blob.arrayBuffer !== 'function') {
    throw new TypeError('A PDF container and Blob are required');
  }

  const pdfjs = injectedPdfJs ?? await loadPdfJs();
  const toolbar = element('div', 'pdf-viewer__toolbar');
  toolbar.dataset.role = 'pdf-toolbar';
  const iconButtonClass = compactToolbar ? 'button button-quiet pdf-viewer__icon-control' : 'button button-secondary';
  const previousButton = element('button', iconButtonClass, compactToolbar ? undefined : 'หน้าก่อน');
  previousButton.type = 'button';
  previousButton.dataset.action = 'previous-page';
  previousButton.setAttribute('aria-label', 'หน้าก่อน');
  previousButton.title = 'หน้าก่อน';
  if (compactToolbar) previousButton.append(icon(['m15 18-6-6 6-6']));
  const pageStatus = element('span', 'pdf-viewer__page-status');
  pageStatus.dataset.role = 'pdf-page-status';
  pageStatus.setAttribute('aria-live', 'polite');
  const nextButton = element('button', iconButtonClass, compactToolbar ? undefined : 'หน้าถัดไป');
  nextButton.type = 'button';
  nextButton.dataset.action = 'next-page';
  nextButton.setAttribute('aria-label', 'หน้าถัดไป');
  nextButton.title = 'หน้าถัดไป';
  if (compactToolbar) nextButton.append(icon(['m9 18 6-6-6-6']));
  const zoomOutButton = element('button', iconButtonClass, compactToolbar ? undefined : '−');
  zoomOutButton.type = 'button';
  zoomOutButton.dataset.action = 'zoom-out';
  zoomOutButton.setAttribute('aria-label', 'ย่อเอกสาร');
  zoomOutButton.title = 'ย่อเอกสาร';
  if (compactToolbar) zoomOutButton.append(icon(['M5 12h14']));
  const zoomStatus = element('span', 'pdf-viewer__zoom-status', '100%');
  zoomStatus.dataset.role = 'pdf-zoom-status';
  const zoomInButton = element('button', iconButtonClass, compactToolbar ? undefined : '+');
  zoomInButton.type = 'button';
  zoomInButton.dataset.action = 'zoom-in';
  zoomInButton.setAttribute('aria-label', 'ขยายเอกสาร');
  zoomInButton.title = 'ขยายเอกสาร';
  if (compactToolbar) zoomInButton.append(icon(['M12 5v14', 'M5 12h14']));
  const fullscreenButton = element('button', compactToolbar ? 'button button-primary pdf-viewer__fullscreen-control' : 'button button-secondary', compactToolbar ? 'เต็มจอ' : 'เต็มหน้าจอ');
  fullscreenButton.type = 'button';
  fullscreenButton.dataset.action = 'fullscreen';
  fullscreenButton.setAttribute('aria-label', 'เต็มหน้าจอ');
  toolbar.append(previousButton, pageStatus, nextButton, zoomOutButton, zoomStatus, zoomInButton, fullscreenButton);

  const scaleNotice = element('p', 'pdf-viewer__scale-note', 'ปรับขนาดหน้า PDF อัตโนมัติเพื่อให้เปิดอ่านได้อย่างปลอดภัย');
  scaleNotice.dataset.role = 'pdf-scale-notice';
  scaleNotice.setAttribute('role', 'status');
  scaleNotice.hidden = true;
  const pageFrame = element('div', 'pdf-viewer__page-frame');
  pageFrame.dataset.role = 'pdf-page-frame';
  pageFrame.tabIndex = 0;
  pageFrame.setAttribute('aria-label', 'หน้าทั้งหมดของเอกสาร PDF');
  const pageStack = element('div', 'pdf-viewer__pages');
  pageStack.dataset.role = 'pdf-pages';
  const renderError = element('p', 'pdf-viewer__error', 'ไม่สามารถแสดงหน้านี้ได้ กรุณาลองอีกครั้ง');
  renderError.setAttribute('role', 'alert');
  renderError.hidden = true;
  pageFrame.append(pageStack);
  const viewer = element('div', 'pdf-viewer');
  const fullscreenRoot = fullscreenTarget ?? viewer;
  const fallbackFullscreenClass = fullscreenTarget ? 'document-reader-shell--fullscreen' : 'pdf-viewer--fullscreen';
  viewer.append(scaleNotice, renderError, pageFrame);
  if (toolbarContainer) toolbarContainer.append(toolbar);
  else viewer.prepend(toolbar);
  container.replaceChildren(viewer);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  let pdfDocument;
  try {
    pdfDocument = await loadingTask.promise;
    if (!Number.isSafeInteger(pdfDocument.numPages) || pdfDocument.numPages < 1) {
      throw new Error('ไฟล์ PDF ไม่มีหน้าที่อ่านได้');
    }
  } catch (error) {
    toolbar.remove();
    viewer.remove();
    await Promise.resolve(loadingTask.destroy?.()).catch(() => {});
    throw error;
  }

  let currentPage = clampPage(initialPage, pdfDocument.numPages);
  let initialPdfPage;
  let pageWidth;
  try {
    initialPdfPage = await pdfDocument.getPage(currentPage);
    const initialViewport = initialPdfPage.getViewport({ scale: 1 });
    pageWidth = Number(initialViewport.width);
    if (!Number.isFinite(pageWidth) || pageWidth <= 0) throw new Error('ขนาดหน้า PDF ไม่ถูกต้อง');
  } catch (error) {
    await pdfDocument.destroy?.();
    await loadingTask.destroy?.();
    toolbar.remove();
    viewer.remove();
    throw error;
  }
  const availableWidth = Math.max(
    1,
    Number(viewer.clientWidth) || Number(container.clientWidth) || Number(container.getBoundingClientRect().width) || pageWidth,
  );
  let scale = Math.min(2.5, availableWidth / pageWidth);
  let currentRender = Promise.resolve();
  let renderQueue = Promise.resolve();
  let destroyed = false;
  let fallbackFullscreen = false;
  let fallbackPlaceholder = null;
  const pageStates = Array.from({ length: pdfDocument.numPages }, (_, index) => {
    const pageNumber = index + 1;
    const section = element('section', 'pdf-viewer__page');
    section.dataset.role = 'pdf-page';
    section.dataset.pageNumber = String(pageNumber);
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', `หน้า ${pageNumber}`);
    pageStack.append(section);
    return {
      pageNumber,
      section,
      pdfPage: pageNumber === currentPage ? initialPdfPage : null,
      canvas: null,
      textLayer: null,
      textLayerElement: null,
      renderTask: null,
      renderPromise: null,
      renderedScale: null,
      generation: 0,
    };
  });

  function updateToolbar() {
    pageStatus.textContent = `หน้า ${currentPage} / ${pdfDocument.numPages}`;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pdfDocument.numPages;
  }

  function isFullscreen() {
    return document.fullscreenElement === fullscreenRoot || fallbackFullscreen;
  }

  function updateFullscreenButton() {
    const label = isFullscreen() ? 'ออกจากเต็มจอ' : 'เต็มหน้าจอ';
    fullscreenButton.textContent = label;
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.setAttribute('aria-pressed', String(isFullscreen()));
  }

  function updateCurrentPage(pageNumber, notify = false) {
    const nextPageNumber = clampPage(pageNumber, pdfDocument.numPages);
    if (nextPageNumber === currentPage) {
      updateToolbar();
      return;
    }
    currentPage = nextPageNumber;
    updateToolbar();
    if (notify) onPageChange(currentPage);
  }

  function visiblePageStates() {
    const frameRect = pageFrame.getBoundingClientRect();
    const fullscreen = isFullscreen();
    const frameTop = fullscreen ? Number(frameRect.top) || 0 : 0;
    const frameHeight = fullscreen
      ? pageFrame.clientHeight || frameRect.height
      : window.innerHeight || document.documentElement.clientHeight;
    if (!Number.isFinite(frameHeight) || frameHeight <= 0) return [];
    const frameBottom = frameTop + frameHeight;
    return pageStates.map((state) => {
      const pageRect = state.section.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(pageRect.bottom, frameBottom) - Math.max(pageRect.top, frameTop));
      return { state, overlap };
    }).filter(({ overlap }) => overlap > 0)
      .sort((left, right) => right.overlap - left.overlap)
      .map(({ state }) => state);
  }

  function releaseOffscreenPages(visible) {
    const keep = new Set(visible);
    for (const state of pageStates) {
      if (keep.has(state) || state.pageNumber === currentPage || state.renderPromise || !state.canvas) continue;
      clearTextLayer(state);
      state.canvas.remove();
      state.canvas = null;
      state.renderedScale = null;
    }
  }

  function clearTextLayer(state) {
    state.textLayer?.cancel?.();
    state.textLayer = null;
    state.textLayerElement?.remove();
    state.textLayerElement = null;
  }

  async function renderPage(state) {
    if (destroyed || !state) return;
    if (state.renderPromise) return state.renderPromise;
    if (state.canvas && state.renderedScale === scale) return;

    const job = renderQueue.catch(() => {}).then(async () => {
      if (destroyed) return;
      const generation = ++state.generation;
      const requestedScale = scale;
      const pdfPage = state.pdfPage ?? await pdfDocument.getPage(state.pageNumber);
      state.pdfPage = null;
      if (destroyed || generation !== state.generation) return;
      const { viewport, actualScale, limited } = boundedViewport(pdfPage, requestedScale);
      const canvas = state.canvas ?? element('canvas', 'pdf-viewer__canvas');
      state.canvas = canvas;
      clearTextLayer(state);
      canvas.setAttribute('aria-label', `หน้า ${state.pageNumber} ของเอกสาร PDF`);
      canvas.dataset.role = 'pdf-page-canvas';
      state.section.replaceChildren(canvas);
      state.section.style.width = `${viewport.width}px`;
      state.section.style.maxWidth = requestedScale > 1 ? 'none' : '100%';
      state.section.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.dataset.scale = String(actualScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = 'auto';
      canvas.style.maxWidth = requestedScale > 1 ? 'none' : '100%';
      if (state.pageNumber === currentPage) {
        const actualZoomPercent = actualScale * 100;
        zoomStatus.textContent = actualZoomPercent < 1 ? '<1%' : `${Math.round(actualZoomPercent)}%`;
        scaleNotice.hidden = !limited;
        if (limited) {
          zoomStatus.title = `ปรับลดจาก ${Math.round(requestedScale * 100)}% เพื่อจำกัดการใช้หน่วยความจำ`;
        } else {
          zoomStatus.removeAttribute('title');
        }
      }
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('ไม่สามารถแสดงหน้า PDF ได้ในเบราว์เซอร์นี้');
      const task = pdfPage.render({ canvasContext: context, viewport });
      state.renderTask = task;
      try {
        await task.promise;
      } catch (error) {
        if (error?.name !== 'RenderingCancelledException') throw error;
      } finally {
        if (state.renderTask === task) state.renderTask = null;
      }
      if (!destroyed && generation === state.generation) {
        if (typeof pdfjs.TextLayer === 'function' && typeof pdfPage.streamTextContent === 'function') {
          const textLayerElement = element('div', 'pdf-viewer__text-layer textLayer');
          textLayerElement.dataset.role = 'pdf-page-text-layer';
          textLayerElement.setAttribute('aria-label', `ข้อความที่เลือกได้จากหน้า ${state.pageNumber}`);
          textLayerElement.style.setProperty('--scale-factor', String(actualScale));
          const textLayer = new pdfjs.TextLayer({
            textContentSource: pdfPage.streamTextContent({
              includeMarkedContent: true,
              disableNormalization: true,
            }),
            container: textLayerElement,
            viewport,
          });
          state.textLayer = textLayer;
          state.textLayerElement = textLayerElement;
          state.section.append(textLayerElement);
          try {
            await textLayer.render();
          } catch {
            clearTextLayer(state);
          }
          if (destroyed || generation !== state.generation) clearTextLayer(state);
        }
        state.renderedScale = requestedScale;
        renderError.hidden = true;
      }
    });
    let trackedJob;
    trackedJob = job.finally(() => {
      if (state.renderPromise === trackedJob) state.renderPromise = null;
    });
    state.renderPromise = trackedJob;
    renderQueue = trackedJob.catch(() => {});
    return trackedJob;
  }

  async function renderVisiblePages(preferredPage = currentPage) {
    const visible = visiblePageStates();
    const targets = [...new Set([
      pageStates[clampPage(preferredPage, pdfDocument.numPages) - 1],
      ...(visible.length ? visible : [pageStates[currentPage - 1]]),
    ])];
    for (const state of targets) {
      if (destroyed) break;
      await renderPage(state);
      while (!destroyed && state.canvas && state.renderedScale !== scale
        && (state.pageNumber === currentPage || visiblePageStates().includes(state))) {
        await renderPage(state);
      }
    }
    releaseOffscreenPages(visiblePageStates());
  }

  function requestRender(preferredPage = currentPage) {
    currentRender = renderVisiblePages(preferredPage).catch(() => {
      if (!destroyed) renderError.hidden = false;
    });
    return currentRender;
  }

  function handleFrameScroll() {
    if (destroyed) return;
    const visible = visiblePageStates();
    if (visible.length) {
      updateCurrentPage(visible[0].pageNumber, true);
      releaseOffscreenPages(visible);
      void requestRender(currentPage);
    }
  }

  function removeListeners() {
    pageFrame.removeEventListener('scroll', handleFrameScroll);
    window.removeEventListener('scroll', handleWindowScroll);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', handleViewportResize);
  }

  function scrollPageIntoView(state) {
    const pageTop = Number(state.section.getBoundingClientRect().top) || 0;
    if (isFullscreen()) {
      const frameTop = Number(pageFrame.getBoundingClientRect().top) || 0;
      const targetTop = Math.max(0, pageFrame.scrollTop + pageTop - frameTop);
      pageFrame.scrollTop = targetTop;
      handleFrameScroll();
      return;
    }

    const scrollTop = Number(window.scrollY ?? document.documentElement.scrollTop) || 0;
    const targetTop = Math.max(0, scrollTop + pageTop);
    if (targetTop !== scrollTop) window.scrollTo({ top: targetTop, behavior: 'smooth' });
    handleFrameScroll();
  }

  function navigateToPage(pageNumber) {
    const nextPageNumber = clampPage(pageNumber, pdfDocument.numPages);
    if (nextPageNumber !== currentPage) updateCurrentPage(nextPageNumber, true);
    scrollPageIntoView(pageStates[nextPageNumber - 1]);
    void requestRender(nextPageNumber);
  }

  function handleFullscreenChange() {
    updateFullscreenButton();
    scrollPageIntoView(pageStates[currentPage - 1]);
    void requestRender(currentPage);
  }

  function handleWindowScroll() {
    if (!isFullscreen()) handleFrameScroll();
  }

  function handleViewportResize() {
    void requestRender(currentPage);
  }

  function enterFallbackFullscreen() {
    if (!fallbackPlaceholder) {
      fallbackPlaceholder = document.createComment('pdf-viewer-placeholder');
      fullscreenRoot.before(fallbackPlaceholder);
      document.body.append(fullscreenRoot);
    }
    fallbackFullscreen = true;
    fullscreenRoot.classList.add(fallbackFullscreenClass);
  }

  function exitFallbackFullscreen() {
    fallbackFullscreen = false;
    fullscreenRoot.classList.remove(fallbackFullscreenClass);
    if (fallbackPlaceholder?.parentNode) fallbackPlaceholder.replaceWith(fullscreenRoot);
    fallbackPlaceholder = null;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && fallbackFullscreen) {
      exitFallbackFullscreen();
      updateFullscreenButton();
      void requestRender(currentPage);
    }
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement === fullscreenRoot) {
      try {
        await document.exitFullscreen?.();
      } catch {
        // Retain the current viewer if the browser refuses to exit fullscreen.
      }
    } else if (fallbackFullscreen) {
      exitFallbackFullscreen();
    } else if (typeof fullscreenRoot.requestFullscreen === 'function') {
      try {
        await fullscreenRoot.requestFullscreen();
      } catch {
        enterFallbackFullscreen();
      }
    } else {
      enterFallbackFullscreen();
    }
    updateFullscreenButton();
    scrollPageIntoView(pageStates[currentPage - 1]);
    void requestRender(currentPage);
  }

  previousButton.addEventListener('click', () => navigateToPage(currentPage - 1));
  nextButton.addEventListener('click', () => navigateToPage(currentPage + 1));
  zoomOutButton.addEventListener('click', () => {
    scale = Math.max(0.5, Math.round((scale - 0.25) * 100) / 100);
    void requestRender();
  });
  zoomInButton.addEventListener('click', () => {
    scale = Math.min(2.5, Math.round((scale + 0.25) * 100) / 100);
    void requestRender();
  });
  fullscreenButton.addEventListener('click', () => { void toggleFullscreen(); });
  pageFrame.addEventListener('scroll', handleFrameScroll, { passive: true });
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleViewportResize);
  updateToolbar();
  updateFullscreenButton();

  currentRender = renderVisiblePages(currentPage);
  try {
    await currentRender;
    scrollPageIntoView(pageStates[currentPage - 1]);
    await currentRender;
  } catch (error) {
    destroyed = true;
    removeListeners();
    if (fallbackFullscreen) exitFallbackFullscreen();
    fallbackPlaceholder?.remove();
    fallbackPlaceholder = null;
    for (const state of pageStates) state.renderTask?.cancel?.();
    for (const state of pageStates) clearTextLayer(state);
    await Promise.all(pageStates.map((state) => state.renderTask?.promise?.catch(() => {})));
    await renderQueue.catch(() => {});
    await pdfDocument.destroy?.();
    await loadingTask.destroy?.();
    viewer.remove();
    throw error;
  }
  return {
    get currentPage() { return currentPage; },
    get pageCount() { return pdfDocument.numPages; },
    whenIdle() { return currentRender; },
    async destroy() {
      destroyed = true;
      removeListeners();
      window.removeEventListener('resize', handleViewportResize);
      if (document.fullscreenElement === fullscreenRoot) {
        try {
          await document.exitFullscreen?.();
        } catch {
          // The reader can still be removed if the browser refuses to exit.
        }
      }
      if (fallbackFullscreen) exitFallbackFullscreen();
      fallbackPlaceholder?.remove();
      fallbackPlaceholder = null;
      for (const state of pageStates) state.renderTask?.cancel?.();
      for (const state of pageStates) clearTextLayer(state);
      await Promise.all(pageStates.map((state) => state.renderTask?.promise?.catch(() => {})));
      await currentRender.catch(() => {});
      await renderQueue.catch(() => {});
      await pdfDocument.destroy?.();
      await loadingTask.destroy?.();
      toolbar.remove();
      viewer.remove();
    },
  };
}
