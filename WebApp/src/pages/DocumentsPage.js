import {
  createTag as createTagRequest,
  deleteDocument as deleteDocumentRequest,
  getDocumentContent as getDocumentContentRequest,
  listDocuments as listDocumentsRequest,
  listTags as listTagsRequest,
  renameDocument as renameDocumentRequest,
  replaceDocumentTags as replaceDocumentTagsRequest,
  uploadDocument as uploadDocumentRequest,
} from '../api/client.js';
import { renderTagChips, renderTagPicker } from '../tags/tag-components.js';
import { createTagAssignmentQueue } from '../tags/tag-assignment-queue.js';
import { nextDocumentTagSelection } from '../tags/document-tag-selection.js';
import { mountPdfPreview } from '../documents/pdf-viewer.js';

function getDocumentPageSize(width) {
  if (width <= 480) return 6;
  if (width <= 1079) return 12;
  return 24;
}
const FILE_BADGES = { pdf: 'PDF', docx: 'DOCX', md: 'MD', txt: 'TXT' };

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

function normalizeDocumentTitle(value) {
  return String(value ?? '').trim().replace(/\.(pdf|docx?|md|txt)$/i, '').trim();
}

function displayDocumentTitle(documentItem) {
  return normalizeDocumentTitle(documentItem.title || documentItem.original_filename) || 'เอกสารไม่มีชื่อ';
}

function showDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}

function observePdfPreview(preview, documentItem, loadDocumentContent, pdfjs) {
  let cancelled = false;
  let observer;

  const renderPreview = async () => {
    try {
      const blob = await loadDocumentContent(documentItem.id);
      if (cancelled || !preview.isConnected) return;
      await mountPdfPreview({ container: preview, blob, pdfjs });
    } catch {
      if (cancelled || !preview.isConnected) return;
      preview.replaceChildren(element('span', 'document-library-card__preview-error', 'แสดงตัวอย่าง PDF ไม่ได้'));
    }
  };

  if (typeof IntersectionObserver !== 'function') {
    void renderPreview();
  } else {
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void renderPreview();
    }, { rootMargin: '180px 0px' });
    observer.observe(preview);
  }

  return () => {
    cancelled = true;
    observer?.disconnect();
  };
}

function flattenTags(catalog) {
  return Array.isArray(catalog?.tags) ? catalog.tags : [];
}

function renderTagFilter(catalog, selectedTagId, onSelect) {
  const select = element('select', 'document-library-filter themed-select');
  select.dataset.role = 'document-tag-filter';
  select.setAttribute('aria-label', 'กรองเอกสารตามวิชาหรือแท็ก');
  setTagFilterOptions(select, catalog, selectedTagId);
  select.addEventListener('change', () => {
    const value = select.value;
    onSelect(value ? Number(value) : null);
  });
  return select;
}

function setTagFilterOptions(select, catalog, selectedTagId) {
  const options = [element('option', '', 'หมวดทั้งหมด')];
  options[0].value = '';
  for (const tag of flattenTags(catalog)) {
    const label = tag.parent_id ? `↳ ${tag.name}` : tag.name;
    const option = element('option', '', label);
    option.value = String(tag.id);
    options.push(option);
  }
  select.replaceChildren(...options);
  select.value = selectedTagId === null ? '' : String(selectedTagId);
}

function makeDocumentCard(documentItem, {
  getTagCatalog,
  getTagAssignment,
  refreshTagCatalog,
  createTag,
  updateTitle,
  updateTags,
  removeDocument,
  confirmDelete,
  navigate,
  setMessage,
  loadDocumentContent,
  pdfjs,
}) {
  const card = element('article', 'document-library-card');
  card.dataset.documentId = String(documentItem.id);
  const initialTitle = displayDocumentTitle(documentItem);
  const fileTypeLabel = FILE_BADGES[documentItem.file_type] || 'FILE';
  const openLink = routeLink('', `/documents/${documentItem.id}`, navigate, 'document-library-card__open-link');
  openLink.setAttribute('aria-label', `เปิดอ่าน ${initialTitle} (${fileTypeLabel})`);
  openLink.title = 'เปิดอ่านเอกสาร';

  const hasRenderedPreview = documentItem.file_type === 'pdf';
  const preview = element(
    'div',
    `document-library-card__preview${hasRenderedPreview ? '' : ' document-library-card__preview--placeholder'}`,
  );
  if (hasRenderedPreview) {
    preview.dataset.role = 'document-preview';
    preview.setAttribute('aria-label', `ตัวอย่างหน้าแรกของ ${initialTitle}`);
  } else {
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', `ไม่มีภาพตัวอย่างสำหรับไฟล์ ${fileTypeLabel}`);
    const placeholderIcon = element('span', 'document-library-card__preview-placeholder-icon');
    placeholderIcon.setAttribute('aria-hidden', 'true');
    preview.append(placeholderIcon);
  }

  const fileIcon = element('span', 'document-library-card__file-icon');
  const fileType = element('span', 'document-library-card__file-type', fileTypeLabel);
  if (documentItem.file_type === 'pdf') fileType.classList.add('document-library-card__file-type--pdf');
  fileType.dataset.role = 'document-file-type';
  fileIcon.append(fileType);
  fileIcon.setAttribute('aria-hidden', 'true');

  const headingRow = element('div', 'document-library-card__heading');
  const heading = element('h2', '', initialTitle);
  headingRow.append(fileIcon, heading);

  const editTitleButton = element('button', 'icon-button document-library-card__action document-library-card__edit-title', '✎');
  editTitleButton.type = 'button';
  editTitleButton.dataset.action = 'edit-title';
  editTitleButton.setAttribute('aria-label', `แก้ชื่อ ${initialTitle}`);
  editTitleButton.title = 'แก้ชื่อ';

  const deleteButton = element('button', 'icon-button document-library-card__action document-library-card__delete');
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete-document';
  deleteButton.setAttribute('aria-label', `ลบ ${initialTitle}`);
  deleteButton.title = 'ลบเอกสาร';
  const trashIcon = element('span', 'document-library-card__trash-icon');
  trashIcon.setAttribute('aria-hidden', 'true');
  deleteButton.append(trashIcon);

  const titleDialog = element('dialog', 'document-title-dialog');
  titleDialog.dataset.role = 'title-dialog';
  titleDialog.setAttribute('aria-labelledby', `document-title-dialog-heading-${documentItem.id}`);
  const titleForm = element('form', 'document-title-edit');
  titleForm.dataset.role = 'title-form';
  const titleDialogHeader = element('div', 'document-title-edit__header');
  const titleDialogHeading = element('h3', '', 'เปลี่ยนชื่อเอกสาร');
  titleDialogHeading.id = `document-title-dialog-heading-${documentItem.id}`;
  const closeTitleDialog = element('button', 'icon-button', '×');
  closeTitleDialog.type = 'button';
  closeTitleDialog.dataset.action = 'cancel-title';
  closeTitleDialog.setAttribute('aria-label', 'ปิดหน้าต่างแก้ชื่อ');
  titleDialogHeader.append(titleDialogHeading, closeTitleDialog);
  const titleLabel = element('label', '', 'ชื่อเอกสาร');
  const titleInput = element('input', 'document-title-edit__input');
  titleInput.type = 'text';
  titleInput.maxLength = 160;
  titleInput.required = true;
  titleInput.value = initialTitle;
  titleInput.dataset.role = 'title-input';
  titleLabel.htmlFor = `document-title-input-${documentItem.id}`;
  titleInput.id = titleLabel.htmlFor;
  const titleActions = element('div', 'document-title-edit__actions');
  const saveTitle = element('button', 'button button-primary', 'บันทึกชื่อ');
  saveTitle.type = 'submit';
  const cancelTitle = element('button', 'button button-quiet', 'ยกเลิก');
  cancelTitle.type = 'button';
  cancelTitle.dataset.action = 'cancel-title';
  titleActions.append(saveTitle, cancelTitle);
  titleForm.append(titleDialogHeader, titleLabel, titleInput, titleActions);
  titleDialog.append(titleForm);

  editTitleButton.addEventListener('click', () => {
    titleInput.value = displayDocumentTitle(documentItem);
    showDialog(titleDialog);
    titleInput.focus();
    titleInput.select();
  });
  cancelTitle.addEventListener('click', () => {
    titleInput.value = displayDocumentTitle(documentItem);
    closeDialog(titleDialog);
    setMessage('');
  });
  titleDialog.addEventListener('click', (event) => {
    if (event.target === titleDialog) closeDialog(titleDialog);
  });
  titleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = normalizeDocumentTitle(titleInput.value);
    if (!title) {
      setMessage('กรุณากรอกชื่อเอกสาร', true);
      titleInput.focus();
      return;
    }
    saveTitle.disabled = true;
    try {
      const updated = await updateTitle(documentItem.id, { title });
      documentItem.title = updated?.title || title;
      const nextTitle = displayDocumentTitle(documentItem);
      heading.textContent = nextTitle;
      openLink.setAttribute('aria-label', `เปิดอ่าน ${nextTitle} (${fileTypeLabel})`);
      editTitleButton.setAttribute('aria-label', `แก้ชื่อ ${nextTitle}`);
      deleteButton.setAttribute('aria-label', `ลบ ${nextTitle}`);
      tagSection.setAttribute('aria-label', `แท็กของ ${nextTitle}`);
      manageTags.setAttribute('aria-label', `แก้แท็กของ ${nextTitle}`);
      closeDialog(titleDialog);
      setMessage('ชื่อเอกสารอัปเดตแล้ว');
    } catch (error) {
      setMessage(error?.message || 'เปลี่ยนชื่อเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      saveTitle.disabled = false;
    }
  });

  const tagSection = element('section', 'document-library-card__tag-section');
  tagSection.setAttribute('aria-label', `แท็กของ ${initialTitle}`);
  const tagSummary = element('div', 'document-library-card__tag-summary');
  tagSummary.dataset.role = 'tag-summary';
  const manageTags = element('button', 'icon-button document-library-card__tag-edit', '+');
  manageTags.type = 'button';
  manageTags.dataset.action = 'manage-tags';
  manageTags.setAttribute('aria-expanded', 'false');
  manageTags.setAttribute('aria-label', `แก้แท็กของ ${initialTitle}`);
  manageTags.title = 'แก้แท็ก';
  const pickerContainer = element('div', 'document-library-card__picker-container');
  pickerContainer.hidden = true;

  const assignment = getTagAssignment(documentItem, tagSummary, pickerContainer);
  assignment.syncTagSelection(assignment.queue.getTagIds());
  manageTags.addEventListener('click', () => {
    const isOpening = pickerContainer.hidden;
    pickerContainer.hidden = !isOpening;
    manageTags.setAttribute('aria-expanded', String(isOpening));
    if (isOpening && !assignment.picker) {
      const picker = renderTagPicker({
        catalog: getTagCatalog(),
        selectedTagIds: assignment.queue.getTagIds(),
        onToggle: (tagId) => {
          assignment.queue.replace(nextDocumentTagSelection(assignment.queue.getTagIds(), tagId, getTagCatalog()));
        },
        onCreate: async (payload) => {
          setMessage('กำลังสร้างแท็ก…');
          let created;
          try {
            created = await createTag(payload);
          } catch (error) {
            setMessage(error?.message || 'สร้างแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true);
            throw error;
          }
          const createdId = Number(created?.id);
          if (!Number.isInteger(createdId) || createdId <= 0) {
            const error = new Error('สร้างแท็กแล้ว แต่ไม่ได้รับรหัสแท็กที่ใช้งานได้');
            setMessage(error.message, true);
            throw error;
          }
          try {
            await refreshTagCatalog();
          } catch {
            const tags = getTagCatalog()?.tags ?? [];
            if (!tags.some((item) => Number(item.id) === createdId)) {
              tagCatalog = { tags: [...tags, created] };
              assignment.picker?.setCatalog?.(getTagCatalog());
            }
          }
          assignment.queue.include(createdId);
          setMessage('แท็กใหม่ถูกเพิ่มลงในเอกสารแล้ว');
        },
      });
      picker.dataset.role = 'tag-picker';
      assignment.picker = picker;
      pickerContainer.replaceChildren(picker);
    }
    if (isOpening && assignment.picker && !pickerContainer.contains(assignment.picker)) {
      pickerContainer.replaceChildren(assignment.picker);
    }
  });

  const tagInfo = element('div', 'document-library-card__tag-info');
  tagInfo.append(tagSummary);
  tagSection.append(tagInfo, manageTags, pickerContainer);

  const truncationNotice = element('p', 'document-library-card__search-notice');
  truncationNotice.textContent = 'ค้นหาได้บางส่วน เนื่องจากเอกสารมีเนื้อหายาว';
  truncationNotice.hidden = !documentItem.search_text_truncated;

  deleteButton.addEventListener('click', async () => {
    if (!confirmDelete({ ...documentItem, title: displayDocumentTitle(documentItem) })) return;
    deleteButton.disabled = true;
    try {
      await removeDocument(documentItem.id);
      card.remove();
      setMessage('ลบเอกสารแล้ว');
      documentItem.onDeleted?.();
    } catch (error) {
      deleteButton.disabled = false;
      setMessage(error?.message || 'ลบเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    }
  });
  card.append(openLink, editTitleButton, deleteButton);
  card.append(preview);
  card.append(headingRow, tagSection, truncationNotice, titleDialog);
  return card;
}

export function renderDocumentsPage({
  loadDocuments = listDocumentsRequest,
  loadTags = listTagsRequest,
  uploadDocument = uploadDocumentRequest,
  createTag = createTagRequest,
  renameDocument = renameDocumentRequest,
  replaceDocumentTags = replaceDocumentTagsRequest,
  loadDocumentContent = getDocumentContentRequest,
  pdfjs,
  deleteDocument = deleteDocumentRequest,
  confirmDelete = (item) => window.confirm(`ต้องการลบ “${item.title}” หรือไม่?`),
  navigate,
} = {}) {
  const page = element('section', 'page document-library-page');
  page.setAttribute('aria-labelledby', 'document-library-title');
  let tagCatalog = { tags: [] };
  let selectedTagId = null;
  const header = element('header', 'document-page-heading');
  const title = element('h1', '', 'คลังเอกสาร');
  title.id = 'document-library-title';
  header.append(
    element('p', 'eyebrow', 'YOUR READING LIBRARY'),
    title,
    element('p', 'page-intro', 'จัดเก็บเอกสารสำหรับอ่านและทบทวน ค้นหาได้จากชื่อไฟล์หรือเนื้อหา'),
  );

  const message = element('p', 'document-page-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const uploadPanel = element('section', 'document-upload-panel');
  uploadPanel.setAttribute('aria-label', 'เพิ่มเอกสารเข้าคลัง');
  const fileInput = element('input', 'document-upload__input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.md,.txt,application/pdf,text/markdown,text/plain';
  fileInput.dataset.role = 'file-input';
  fileInput.setAttribute('aria-label', 'เลือกเอกสารสำหรับอ่าน');
  const uploadCopy = element('div', 'document-upload-panel__copy');
  const uploadIcon = element('span', 'document-upload-panel__icon', '↑');
  uploadIcon.setAttribute('aria-hidden', 'true');
  uploadCopy.append(
    element('h2', '', 'วางไฟล์ที่นี่ หรือเลือกจากอุปกรณ์'),
    element('p', '', 'รองรับ PDF, Markdown และ TXT · ไฟล์ละไม่เกิน 20 MB'),
  );
  const chooseFiles = element('button', 'button button-primary', 'เลือกไฟล์');
  chooseFiles.type = 'button';
  chooseFiles.dataset.action = 'choose-files';
  chooseFiles.addEventListener('click', () => fileInput.click());
  const uploadResults = element('div', 'document-upload-results');
  uploadResults.dataset.role = 'upload-results';
  uploadPanel.append(uploadIcon, uploadCopy, chooseFiles, fileInput, uploadResults);

  const searchForm = element('form', 'document-library-search');
  searchForm.dataset.role = 'document-search-form';
  const searchInput = element('input', 'document-library-search__input');
  searchInput.type = 'search';
  searchInput.placeholder = 'ค้นหาชื่อเอกสาร ชื่อไฟล์ หรือเนื้อหา';
  searchInput.setAttribute('aria-label', 'ค้นหาเอกสาร');
  searchInput.dataset.role = 'document-search-input';
  const tagFilter = renderTagFilter(tagCatalog, selectedTagId, (tagId) => {
    selectedTagId = tagId;
    activeTagId = tagId;
    hasSubmittedFilters = true;
    void loadDocumentsPage();
  });
  const searchButton = element('button', 'button button-primary', 'ค้นหา');
  searchButton.type = 'submit';
  searchForm.append(searchInput, tagFilter, searchButton);

  const list = element('div', 'document-library-list');
  list.dataset.role = 'document-list';
  const pagination = element('nav', 'document-library-pagination');
  pagination.dataset.role = 'pagination';
  pagination.setAttribute('aria-label', 'การแบ่งหน้าคลังเอกสาร');
  pagination.hidden = true;
  const previousPageButton = element('button', 'button button-secondary', 'ก่อนหน้า');
  previousPageButton.type = 'button';
  previousPageButton.dataset.action = 'previous-page';
  const pageStatus = element('span', 'document-library-pagination__status', 'หน้า 1');
  pageStatus.dataset.role = 'page-status';
  const nextPageButton = element('button', 'button button-secondary', 'ถัดไป');
  nextPageButton.type = 'button';
  nextPageButton.dataset.action = 'next-page';
  pagination.append(previousPageButton, pageStatus, nextPageButton);
  const clearButton = element('button', 'button button-secondary document-library-clear-filters', 'ล้างตัวกรอง');
  clearButton.type = 'button';
  clearButton.dataset.action = 'clear-filters';
  clearButton.hidden = true;
  page.append(header, uploadPanel, searchForm, message, list, clearButton, pagination);

  let activeTagId = null;
  let activeQuery = '';
  let hasSubmittedFilters = false;
  let pageSize = getDocumentPageSize(window.innerWidth);
  let pageIndex = 0;
  let hasNextPage = false;
  let isLoading = false;
  let reloadAfterResize = false;
  const assignments = new Map();
  const previewCleanups = new Set();
  let destroyed = false;

  function clearCardPreviews() {
    for (const cleanup of previewCleanups) cleanup();
    previewCleanups.clear();
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) message.dataset.state = 'error';
    else delete message.dataset.state;
  }

  function updatePagination() {
    pageStatus.textContent = `หน้า ${pageIndex + 1}`;
    previousPageButton.disabled = isLoading || pageIndex === 0;
    nextPageButton.disabled = isLoading || !hasNextPage;
    pagination.hidden = pageIndex === 0 && !hasNextPage;
  }

  function selectedTags(tagIds) {
    const selected = new Set(tagIds.map(Number));
    return flattenTags(tagCatalog).filter((tag) => selected.has(Number(tag.id)));
  }

  function getTagAssignment(item, tagSummary, pickerContainer) {
    const key = String(item.id);
    let assignment = assignments.get(key);
    if (assignment) {
      assignment.tagSummary = tagSummary;
      assignment.pickerContainer = pickerContainer;
      return assignment;
    }

    assignment = {
      picker: null,
      tagSummary,
      pickerContainer,
      syncTagSelection: null,
      queue: null,
    };
    assignment.syncTagSelection = (tagIds) => {
      item.tags = selectedTags(tagIds);
      const chips = renderTagChips(item.tags);
      chips.setAttribute('aria-label', `แท็กของ ${displayDocumentTitle(item)}`);
      if (item.tags.length === 0) {
        chips.append(element('span', 'document-library-card__untagged', 'ยังไม่ได้เลือกวิชา'));
      }
      assignment.tagSummary.replaceChildren(chips);
      assignment.picker?.setSelectedTagIds?.(tagIds);
    };
    assignment.queue = createTagAssignmentQueue({
      initialTagIds: (item.tags ?? []).map((tag) => tag.id),
      save: async (tagIds) => {
        setMessage('กำลังบันทึกแท็ก…');
        const updated = await replaceDocumentTags(item.id, { tag_ids: tagIds });
        item.tags = updated?.tags ?? item.tags;
        if (JSON.stringify(assignment.queue.getTagIds()) === JSON.stringify(tagIds)) {
          setMessage('บันทึกแท็กแล้ว');
        }
        return updated;
      },
      onChange: (tagIds) => assignment.syncTagSelection(tagIds),
      onError: (error) => setMessage(error?.message || 'บันทึกแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true),
    });
    assignments.set(key, assignment);
    return assignment;
  }

  function renderFilters() {
    setTagFilterOptions(tagFilter, tagCatalog, selectedTagId);
    tagFilter.disabled = isLoading;
  }

  function setTagCatalog(catalog) {
    tagCatalog = catalog && Array.isArray(catalog.tags) ? catalog : { tags: [] };
    renderFilters();
    for (const assignment of assignments.values()) {
      assignment.syncTagSelection(assignment.queue.getTagIds());
      assignment.picker?.setCatalog?.(tagCatalog);
    }
  }

  async function reloadTagCatalog() {
    const catalog = await loadTags();
    setTagCatalog(catalog);
    return tagCatalog;
  }

  function showEmptyState(isNoMatch) {
    const empty = element('section', isNoMatch ? 'document-empty-state document-no-matches' : 'document-empty-state');
    empty.append(
      element('h2', '', isNoMatch ? 'ไม่พบเอกสารที่ตรงกับการค้นหา' : 'ยังไม่มีเอกสาร'),
      element(
        'p',
        '',
        isNoMatch
          ? 'ลองเปลี่ยนคำค้นหาหรือเลือกแท็กวิชาอื่น'
          : 'เพิ่มเอกสารประกอบการเรียน แล้วเปิดอ่านต่อได้จากคลังนี้',
      ),
    );
    if (isNoMatch) {
      clearButton.hidden = false;
    } else {
      const chooseLink = element('button', 'button button-primary', 'เพิ่มเอกสาร');
      chooseLink.type = 'button';
      chooseLink.addEventListener('click', () => fileInput.click());
      empty.append(chooseLink);
    }
    list.append(empty);
  }

  function createCard(item) {
    item.onDeleted = () => {
      assignments.delete(String(item.id));
      const visibleDocuments = list.querySelectorAll('[data-document-id]');
      if (visibleDocuments.length === 0 && pageIndex > 0) {
        void loadDocumentsPage({ targetPage: pageIndex - 1 });
      } else if (visibleDocuments.length === 0) {
        showEmptyState(Boolean(activeQuery || activeTagId));
      }
    };
    return makeDocumentCard(item, {
      getTagCatalog: () => tagCatalog,
      getTagAssignment,
      refreshTagCatalog: reloadTagCatalog,
      createTag,
      updateTitle: renameDocument,
      removeDocument: deleteDocument,
      confirmDelete,
      navigate,
      setMessage,
      loadDocumentContent,
      pdfjs,
    });
  }

  async function loadDocumentsPage({ targetPage = 0 } = {}) {
    if (isLoading) return;
    isLoading = true;
    searchInput.disabled = true;
    searchButton.disabled = true;
    pageIndex = targetPage;
    hasNextPage = false;
    updatePagination();
    clearCardPreviews();
    list.replaceChildren();
    clearButton.hidden = true;
    renderFilters();
    setMessage('กำลังโหลดคลังเอกสาร…');
    try {
      const requestedPageIndex = pageIndex;
      const requestedPageSize = pageSize;
      const params = { limit: requestedPageSize + 1, offset: requestedPageIndex * requestedPageSize };
      if (hasSubmittedFilters) {
        params.q = activeQuery;
        if (activeTagId !== null) params.tagId = activeTagId;
      }
      const response = await loadDocuments(params);
      if (destroyed) return;
      if (requestedPageSize !== pageSize) {
        reloadAfterResize = true;
        return;
      }
      const items = Array.isArray(response) ? response : [];
      if (items.length === 0) {
        showEmptyState(Boolean(activeQuery || activeTagId));
        setMessage('');
        hasNextPage = false;
        return;
      }
      setMessage('');
      const visibleItems = items.slice(0, requestedPageSize);
      hasNextPage = items.length > requestedPageSize;
      const cards = visibleItems.map(createCard);
      list.replaceChildren(...cards);
      cards.forEach((card, index) => {
        const preview = card.querySelector('[data-role="document-preview"]');
        if (preview) previewCleanups.add(observePdfPreview(preview, visibleItems[index], loadDocumentContent, pdfjs));
      });
    } catch (error) {
      setMessage(error?.message || 'โหลดคลังเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      isLoading = false;
      searchInput.disabled = false;
      searchButton.disabled = false;
      updatePagination();
      renderFilters();
      if (reloadAfterResize && !destroyed) {
        reloadAfterResize = false;
        void loadDocumentsPage();
      }
    }
  }

  async function processFiles(files) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    uploadResults.replaceChildren();
    setMessage(`กำลังเพิ่มเอกสาร ${selectedFiles.length} ไฟล์…`);
    const outcomes = [];
    for (const file of selectedFiles) {
      const result = element('p', 'document-upload-result');
      result.dataset.uploadResult = 'pending';
      result.textContent = `${file.name} · กำลังอัปโหลด`;
      uploadResults.append(result);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const created = await uploadDocument(formData);
        result.dataset.uploadResult = 'success';
        result.textContent = `${file.name} · เพิ่มแล้ว · ยังไม่ได้เลือกวิชา`;
        outcomes.push({ success: true, created });
      } catch (error) {
        result.dataset.uploadResult = 'error';
        result.textContent = `${file.name} · ${error?.message || 'เพิ่มไม่สำเร็จ'}`;
        outcomes.push({ success: false, error });
      }
    }
    const successes = outcomes.filter((item) => item.success).length;
    setMessage(successes ? `เพิ่มเอกสารสำเร็จ ${successes} จาก ${outcomes.length} ไฟล์` : 'เพิ่มเอกสารไม่สำเร็จ', successes === 0);
    if (successes) await loadDocumentsPage();
    fileInput.value = '';
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    activeQuery = searchInput.value.trim();
    selectedTagId = activeTagId;
    hasSubmittedFilters = true;
    renderFilters();
    void loadDocumentsPage();
  });
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    activeQuery = '';
    activeTagId = null;
    selectedTagId = null;
    hasSubmittedFilters = true;
    renderFilters();
    void loadDocumentsPage();
  });
  previousPageButton.addEventListener('click', () => {
    if (pageIndex > 0) void loadDocumentsPage({ targetPage: pageIndex - 1 });
  });
  nextPageButton.addEventListener('click', () => {
    if (hasNextPage) void loadDocumentsPage({ targetPage: pageIndex + 1 });
  });
  const handleResize = () => {
    if (destroyed || !page.isConnected) return;
    const nextPageSize = getDocumentPageSize(window.innerWidth);
    if (nextPageSize === pageSize) return;
    pageSize = nextPageSize;
    pageIndex = 0;
    if (isLoading) {
      reloadAfterResize = true;
      return;
    }
    void loadDocumentsPage();
  };
  window.addEventListener('resize', handleResize);
  fileInput.addEventListener('change', () => { void processFiles(fileInput.files); });
  uploadPanel.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadPanel.dataset.dragging = 'true';
  });
  uploadPanel.addEventListener('dragleave', () => { delete uploadPanel.dataset.dragging; });
  uploadPanel.addEventListener('drop', (event) => {
    event.preventDefault();
    delete uploadPanel.dataset.dragging;
    void processFiles(event.dataTransfer?.files);
  });

  renderFilters();
  const catalogPromise = reloadTagCatalog().catch((error) => error);
  void loadDocumentsPage();
  void catalogPromise.then((error) => {
    if (error) setMessage(error?.message || 'โหลดรายการแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true);
  });
  page.destroy = () => {
    destroyed = true;
    window.removeEventListener('resize', handleResize);
    clearCardPreviews();
  };
  return page;
}
