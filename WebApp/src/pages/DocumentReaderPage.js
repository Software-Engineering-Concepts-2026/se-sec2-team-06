import {
  createTag as createTagRequest,
  deleteDocument as deleteDocumentRequest,
  getDocument as getDocumentRequest,
  getDocumentContent as getDocumentContentRequest,
  getDocumentDownloadUrl as getDocumentDownloadUrlRequest,
  getDocumentText as getDocumentTextRequest,
  renameDocument as renameDocumentRequest,
  replaceDocumentTags as replaceDocumentTagsRequest,
  saveDocumentProgress as saveDocumentProgressRequest,
  listTags as listTagsRequest,
} from '../api/client.js';
import { mountPdfViewer } from '../documents/pdf-viewer.js';
import { renderMarkdown } from '../documents/markdown-reader.js';
import { renderTagChips, renderTagPicker } from '../tags/tag-components.js';
import { createTagAssignmentQueue } from '../tags/tag-assignment-queue.js';
import { nextDocumentTagSelection } from '../tags/document-tag-selection.js';

const PROGRESS_DEBOUNCE_MS = 350;

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function routeLink(label, path, navigate, className = 'button button-secondary') {
  const link = element('a', className, label);
  link.href = path;
  link.dataset.route = path;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate?.(path);
  });
  return link;
}

function svgIcon(paths) {
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

function pencilIcon() {
  return svgIcon(['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z']);
}

function trashIcon() {
  return svgIcon(['M4 7h16', 'M9 7V4h6v3', 'M6.5 7l1 13h9l1-13', 'M10 11v5', 'M14 11v5']);
}

function clampRatio(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0;
}

function renderPlainText(container, text) {
  const paragraphs = String(text ?? '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const node = element('p', 'document-reader-paragraph');
    node.textContent = paragraph;
    container.append(node);
  }
}

function renderReaderContent(container, fileType, text) {
  if (fileType === 'md') {
    const article = element('article', 'document-reader-markdown');
    article.innerHTML = renderMarkdown(text);
    container.append(article);
    return;
  }
  renderPlainText(container, text);
}

function tagIdsAfterToggle(currentTagIds, tagId, catalog) {
  return nextDocumentTagSelection(currentTagIds, tagId, catalog);
}

export function renderDocumentReaderPage({
  documentId,
  loadDocument = getDocumentRequest,
  loadDocumentContent = getDocumentContentRequest,
  getDocumentDownloadUrl = getDocumentDownloadUrlRequest,
  loadDocumentText = getDocumentTextRequest,
  saveProgress = saveDocumentProgressRequest,
  updateTitle = renameDocumentRequest,
  loadTags = listTagsRequest,
  createTag = createTagRequest,
  replaceDocumentTags = replaceDocumentTagsRequest,
  deleteDocument = deleteDocumentRequest,
  confirmDelete = (item) => window.confirm(`ต้องการลบ “${item.title}” หรือไม่?`),
  navigate,
  pdfjs,
} = {}) {
  const page = element('section', 'page document-reader-page');
  page.setAttribute('aria-labelledby', 'document-reader-title');
  const message = element('p', 'document-reader-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  page.append(message);

  let progressTimer = null;
  let pendingProgress = null;
  let progressSave = Promise.resolve();
  let pdfViewer = null;
  let readingArea = null;
  let documentItem = null;
  let textProgressListener = null;
  let destroyed = false;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) message.dataset.state = 'error';
    else delete message.dataset.state;
  }

  function flushProgress() {
    if (progressTimer !== null) {
      clearTimeout(progressTimer);
      progressTimer = null;
    }
    if (!pendingProgress || !documentItem) return progressSave;
    const latestProgress = pendingProgress;
    pendingProgress = null;
    progressSave = progressSave
      .catch(() => {})
      .then(() => saveProgress(documentItem.id, latestProgress));
    return progressSave;
  }

  function saveProgressSoon(payload) {
    pendingProgress = payload;
    if (progressTimer !== null) clearTimeout(progressTimer);
    progressTimer = setTimeout(() => {
      progressTimer = null;
      void flushProgress().catch((error) => {
        if (!destroyed) setMessage(error?.message || 'บันทึกตำแหน่งอ่านไม่สำเร็จ', true);
      });
    }, PROGRESS_DEBOUNCE_MS);
  }

  function makeTagPicker(tagCatalog, tagSummary, pickerContainer, manageButton) {
    let currentCatalog = tagCatalog;
    let picker = null;
    const queue = createTagAssignmentQueue({
      initialTagIds: (documentItem.tags ?? []).map((tag) => tag.id),
      save: async (tagIds) => {
        setMessage('กำลังบันทึกแท็ก…');
        const updated = await replaceDocumentTags(documentItem.id, { tag_ids: tagIds });
        documentItem.tags = updated?.tags ?? documentItem.tags;
        if (JSON.stringify(queue.getTagIds()) === JSON.stringify(tagIds)) setMessage('บันทึกแท็กแล้ว');
        return updated;
      },
      onChange: (tagIds) => {
        const selected = new Set(tagIds.map(Number));
        documentItem.tags = (currentCatalog.tags ?? [])
          .filter((tag) => selected.has(Number(tag.id)));
        const chips = renderTagChips(documentItem.tags);
        chips.setAttribute('aria-label', 'แท็กเอกสาร');
        if (documentItem.tags.length === 0) {
          chips.append(element('span', 'document-reader__untagged', 'ยังไม่ได้เลือกวิชา'));
        }
        tagSummary.replaceChildren(chips);
        picker?.setSelectedTagIds?.(tagIds);
      },
      onError: (error) => setMessage(error?.message || 'บันทึกแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true),
    });

    const manageTags = () => {
      const isOpening = pickerContainer.hidden;
      pickerContainer.hidden = !isOpening;
      manageButton.setAttribute('aria-expanded', String(isOpening));
      if (!isOpening) return;
      if (picker) {
        if (!pickerContainer.contains(picker)) pickerContainer.replaceChildren(picker);
        return;
      }

      picker = renderTagPicker({
        catalog: currentCatalog,
        selectedTagIds: queue.getTagIds(),
        onToggle: (tagId) => queue.replace(tagIdsAfterToggle(queue.getTagIds(), tagId, currentCatalog)),
        onCreate: async (payload) => {
          setMessage('กำลังสร้างแท็ก…');
          const created = await createTag(payload);
          try {
            currentCatalog = await loadTags();
          } catch {
            const tags = currentCatalog.tags ?? [];
            if (!tags.some((tag) => Number(tag.id) === Number(created?.id))) {
              currentCatalog = { tags: [...tags, created] };
            }
          }
          picker.setCatalog(currentCatalog);
          const createdId = Number(created?.id);
          if (!Number.isSafeInteger(createdId) || createdId <= 0) throw new Error('สร้างแท็กแล้วแต่รหัสแท็กไม่ถูกต้อง');
          queue.include(createdId);
        },
      });
      picker.dataset.role = 'tag-picker';
      pickerContainer.replaceChildren(picker);
    };
    manageButton.addEventListener('click', manageTags);
    return queue;
  }

  function buildReaderShell(tagCatalog) {
    const isPdf = documentItem.file_type === 'pdf';
    const shell = element('div', `document-reader-shell document-reader-shell--split${isPdf ? ' document-reader-shell--pdf' : ''}`);
    const header = element('aside', 'document-reader-header document-reader-sidebar');
    header.setAttribute('aria-label', isPdf ? 'ข้อมูลเอกสารและเครื่องมืออ่าน' : 'ข้อมูลเอกสาร');
    header.dataset.role = 'document-sidebar';
    const back = routeLink('', '/documents', navigate, 'button button-secondary document-reader-back document-reader-back--icon');
    back.append(svgIcon(['M19 12H5', 'm12 19-7-7 7-7']));
    back.setAttribute('aria-label', 'กลับคลังเอกสาร');
    back.title = 'กลับคลังเอกสาร';
    header.append(back);
    const titleRow = element('div', 'document-reader-header__title-row');
    const title = element('h1', '', documentItem.title || 'เอกสารไม่มีชื่อ');
    title.id = 'document-reader-title';
    const titleGroup = element('div', 'document-reader-header__title');
    const editButton = element('button', 'button document-reader-title-edit-trigger');
    editButton.type = 'button';
    editButton.dataset.action = 'edit-title';
    editButton.setAttribute('aria-label', 'แก้ชื่อเอกสาร');
    editButton.title = 'แก้ชื่อเอกสาร';
    editButton.append(pencilIcon());
    titleGroup.append(title, editButton);
    titleRow.append(titleGroup);
    const titleForm = element('form', 'document-reader-title-edit');
    titleForm.hidden = true;
    titleForm.dataset.role = 'title-form';
    const titleInput = element('input', 'document-reader-title-edit__input');
    titleInput.type = 'text';
    titleInput.maxLength = 160;
    titleInput.required = true;
    titleInput.value = documentItem.title || '';
    titleInput.dataset.role = 'title-input';
    titleInput.setAttribute('aria-label', 'ชื่อเอกสาร');
    const saveTitle = element('button', 'button button-primary', 'บันทึกชื่อ');
    saveTitle.type = 'submit';
    const cancelTitle = element('button', 'button button-quiet', 'ยกเลิก');
    cancelTitle.type = 'button';
    cancelTitle.dataset.action = 'cancel-title';
    titleForm.append(titleInput, saveTitle, cancelTitle);
    editButton.addEventListener('click', () => {
      titleInput.value = documentItem.title || '';
      title.hidden = true;
      editButton.hidden = true;
      titleForm.hidden = false;
      titleInput.focus();
    });
    cancelTitle.addEventListener('click', () => {
      title.hidden = false;
      editButton.hidden = false;
      titleForm.hidden = true;
      setMessage('');
    });
    titleForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nextTitle = titleInput.value.trim();
      if (!nextTitle) {
        setMessage('กรุณากรอกชื่อเอกสาร', true);
        titleInput.focus();
        return;
      }
      saveTitle.disabled = true;
      try {
        const updated = await updateTitle(documentItem.id, { title: nextTitle });
        documentItem.title = updated?.title || nextTitle;
        title.textContent = documentItem.title;
        title.hidden = false;
        editButton.hidden = false;
        titleForm.hidden = true;
        setMessage('ชื่อเอกสารอัปเดตแล้ว');
      } catch (error) {
        setMessage(error?.message || 'เปลี่ยนชื่อเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง', true);
      } finally {
        saveTitle.disabled = false;
      }
    });
    const documentActions = element('div', 'document-reader__document-actions');
    if (isPdf) {
      const downloadButton = element('a', 'button button-primary document-reader-download', 'ดาวน์โหลด PDF');
      downloadButton.href = getDocumentDownloadUrl(documentItem.id);
      downloadButton.download = documentItem.original_filename || 'document.pdf';
      downloadButton.dataset.action = 'download-pdf';
      downloadButton.setAttribute('aria-label', `ดาวน์โหลด PDF: ${documentItem.original_filename || documentItem.title}`);
      documentActions.append(downloadButton);
    }

    const metadata = element('p', 'document-reader-header__metadata', documentItem.original_filename || 'เอกสาร');
    const tagRow = element('div', 'document-reader-header__tags');
    const tagSummary = element('div', 'document-reader__tag-summary');
    const chips = renderTagChips(documentItem.tags ?? []);
    chips.setAttribute('aria-label', 'แท็กเอกสาร');
    if (!documentItem.tags?.length) chips.append(element('span', 'document-reader__untagged', 'ยังไม่ได้เลือกวิชา'));
    tagSummary.append(chips);
    const manageTags = element('button', 'button button-secondary', 'จัดการแท็ก');
    manageTags.type = 'button';
    manageTags.dataset.action = 'manage-tags';
    manageTags.setAttribute('aria-expanded', 'false');
    const pickerContainer = element('div', 'document-reader__picker-container');
    pickerContainer.hidden = true;
    makeTagPicker(tagCatalog, tagSummary, pickerContainer, manageTags);
    tagRow.append(tagSummary, manageTags, pickerContainer);
    const pdfControls = element('div', 'document-reader-pdf-controls');
    pdfControls.dataset.role = 'pdf-controls';

    const deleteButton = element('button', 'button button-danger document-reader__delete');
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete-document';
    deleteButton.append(trashIcon(), document.createTextNode('ลบเอกสาร'));
    deleteButton.addEventListener('click', async () => {
      if (!confirmDelete(documentItem)) return;
      deleteButton.disabled = true;
      try {
        await deleteDocument(documentItem.id);
        setMessage('ลบเอกสารแล้ว');
        navigate?.('/documents');
      } catch (error) {
        deleteButton.disabled = false;
        setMessage(error?.message || 'ลบเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง', true);
      }
    });
    if (isPdf) header.append(titleRow, titleForm, metadata, tagRow, documentActions, pdfControls, deleteButton);
    else header.append(titleRow, titleForm, metadata, tagRow, deleteButton);

    const contentPanel = element('section', 'document-reader-panel');
    contentPanel.setAttribute('aria-label', 'เนื้อหาเอกสาร');
    readingArea = element('div', 'document-reader-content');
    readingArea.dataset.role = 'reader-content';
    readingArea.tabIndex = 0;
    readingArea.setAttribute('aria-label', 'พื้นที่อ่านเอกสาร');
    contentPanel.append(readingArea);
    shell.append(header, contentPanel);
    return shell;
  }

  async function load() {
    setMessage('กำลังโหลดเอกสาร…');
    try {
      const [loadedDocument, loadedTags] = await Promise.all([
        loadDocument(documentId),
        loadTags().catch(() => ({ tags: [] })),
      ]);
      if (destroyed) return;
      documentItem = loadedDocument;
      const tagCatalog = loadedTags && Array.isArray(loadedTags.tags) ? loadedTags : { tags: [] };
      const shell = buildReaderShell(tagCatalog);
      page.replaceChildren(message, shell);
      setMessage('');

      if (documentItem.file_type === 'pdf') {
        readingArea.dataset.documentType = 'pdf';
        readingArea.closest('.document-reader-panel').dataset.documentType = 'pdf';
        const blob = await loadDocumentContent(documentItem.id);
        if (destroyed) return;
        const mountedViewer = await mountPdfViewer({
          container: readingArea,
          toolbarContainer: page.querySelector('[data-role="pdf-controls"]'),
          fullscreenTarget: shell,
          compactToolbar: true,
          blob,
          pdfjs,
          initialPage: documentItem.last_page,
          onPageChange: (pageNumber) => saveProgressSoon({ page: pageNumber }),
        });
        if (destroyed) await mountedViewer.destroy();
        else pdfViewer = mountedViewer;
      } else {
        const extracted = await loadDocumentText(documentItem.id);
        if (destroyed) return;
        if (extracted?.text_truncated) {
          const notice = element('p', 'document-reader__truncation-notice', 'แสดงข้อความได้บางส่วน เนื่องจากเอกสารมีเนื้อหายาว');
          notice.dataset.role = 'text-truncation-notice';
          readingArea.before(notice);
        }
        renderReaderContent(readingArea, documentItem.file_type, extracted?.text ?? '');
        const restoredRatio = clampRatio(documentItem.scroll_ratio);
        readingArea.dataset.restoredProgress = String(restoredRatio);
        const getReaderScrollMetrics = () => {
          const scrollTop = Number(window.scrollY ?? document.documentElement.scrollTop) || 0;
          const viewportHeight = Number(window.innerHeight) || document.documentElement.clientHeight || 0;
          const areaTop = scrollTop + readingArea.getBoundingClientRect().top;
          const maxScroll = Math.max(0, readingArea.scrollHeight - viewportHeight);
          return { scrollTop, areaTop, maxScroll };
        };
        const restore = () => {
          if (destroyed || !readingArea) return;
          if (restoredRatio <= 0) return;
          const { areaTop, maxScroll } = getReaderScrollMetrics();
          window.scrollTo({ top: Math.max(0, areaTop + maxScroll * restoredRatio), behavior: 'auto' });
        };
        if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restore);
        else setTimeout(restore, 0);
        textProgressListener = () => {
          const { scrollTop, areaTop, maxScroll } = getReaderScrollMetrics();
          const ratio = maxScroll > 0 ? clampRatio((scrollTop - areaTop) / maxScroll) : 0;
          saveProgressSoon({ scroll_ratio: ratio });
        };
        window.addEventListener('scroll', textProgressListener, { passive: true });
      }
    } catch (error) {
      if (pdfViewer) {
        await pdfViewer.destroy().catch(() => {});
        pdfViewer = null;
      }
      const detail = error?.status === 404 ? 'ไม่พบเอกสารนี้' : (error?.message || 'เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง');
      page.querySelector('.document-reader-shell')?.remove();
      setMessage(detail, true);
    }
  }

  page.destroy = async () => {
    destroyed = true;
    if (textProgressListener) window.removeEventListener('scroll', textProgressListener);
    await flushProgress().catch(() => {});
    await pdfViewer?.destroy().catch(() => {});
  };
  void load();
  return page;
}
