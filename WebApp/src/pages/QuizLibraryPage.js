import {
  createTag as createTagRequest,
  deleteQuiz as deleteQuizRequest,
  listQuizzes,
  listTags,
  renameQuiz,
  replaceQuizTags,
} from '../api/client.js';
import { renderTagChips, renderTagFilter, renderTagPicker } from '../tags/tag-components.js';
import { createTagAssignmentQueue } from '../tags/tag-assignment-queue.js';

const SOURCE_LABELS = { md: 'Markdown', txt: 'Text', docx: 'DOCX', pdf: 'PDF' };
const DIFFICULTY_LABELS = { basic: 'พื้นฐาน', intermediate: 'ปานกลาง', advanced: 'ขั้นสูง' };
const LANGUAGE_LABELS = { th: 'ภาษาไทย', en: 'English' };
function getQuizPageSize(width) {
  return width <= 640 ? 6 : 12;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุวันที่'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(date);
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

function trashIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of ['M4 7h16', 'M9 7V4h6v3', 'M6.5 7l1 13h9l1-13', 'M10 11v5', 'M14 11v5']) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function openDeleteDialog(quiz, { onConfirm, onError, onCancel, returnFocus }) {
  const overlay = element('div', 'quiz-delete-layer');
  const dialog = element('section', 'quiz-delete-dialog');
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `quiz-delete-title-${quiz.id}`);
  dialog.setAttribute('aria-describedby', `quiz-delete-description-${quiz.id}`);
  dialog.tabIndex = -1;

  const title = element('h2', '', 'ยืนยันการลบข้อสอบ');
  title.id = `quiz-delete-title-${quiz.id}`;
  const description = element('p', '', `ต้องการลบ “${quiz.title || 'ข้อสอบไม่มีชื่อ'}” ใช่หรือไม่?`);
  description.id = `quiz-delete-description-${quiz.id}`;
  const warning = element('p', 'quiz-delete-dialog__warning', 'ข้อสอบ ประวัติการทำ คะแนน และเฉลยทั้งหมดจะถูกลบถาวร');
  const error = element('p', 'quiz-delete-dialog__error');
  error.setAttribute('role', 'alert');
  const actions = element('div', 'quiz-delete-dialog__actions');
  const cancel = element('button', 'button button-secondary', 'ยกเลิก');
  cancel.type = 'button';
  const confirm = element('button', 'button button-danger', 'ลบข้อสอบ');
  confirm.type = 'button';
  actions.append(cancel, confirm);
  dialog.append(title, description, warning, error, actions);
  overlay.append(dialog);
  document.body.append(overlay);

  let busy = false;
  const close = (restore = true) => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (restore && returnFocus?.isConnected) returnFocus.focus();
  };
  const onKeydown = (event) => {
    if (event.key !== 'Escape' || busy) return;
    event.preventDefault();
    close();
    onCancel?.();
  };
  cancel.addEventListener('click', () => {
    close();
    onCancel?.();
  });
  confirm.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    confirm.disabled = true;
    cancel.disabled = true;
    confirm.textContent = 'กำลังลบ…';
    error.textContent = '';
    try {
      await onConfirm();
      close();
    } catch (reason) {
      error.textContent = reason?.message || 'ลบข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง';
      onError?.(reason);
      busy = false;
      confirm.disabled = false;
      cancel.disabled = false;
      confirm.textContent = 'ลองอีกครั้ง';
    }
  });
  document.addEventListener('keydown', onKeydown);
  cancel.focus();
  return overlay;
}

function createQuizCard(quiz, {
  updateTitle,
  navigate,
  setMessage,
  getTagCatalog,
  reloadTagCatalog,
  createTag,
  getTagAssignment,
  registerTagPicker,
  refreshTagPickers,
  onDelete,
  createQuizLink,
}) {
  const card = element('article', 'quiz-library-card');
  card.dataset.quizId = String(quiz.id);

  const headingRow = element('div', 'quiz-library-card__heading');
  const heading = element('h2', '', quiz.title || 'ข้อสอบไม่มีชื่อ');
  const editButton = element('button', 'button button-quiet', 'แก้ชื่อ');
  editButton.type = 'button';
  editButton.dataset.action = 'edit-title';
  editButton.setAttribute('aria-label', `แก้ชื่อ ${quiz.title || 'ข้อสอบ'}`);
  const deleteButton = element('button', 'button quiz-library-card__delete', '');
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete-quiz';
  deleteButton.setAttribute('aria-label', `ลบข้อสอบ ${quiz.title || 'ข้อสอบไม่มีชื่อ'}`);
  deleteButton.append(trashIcon());
  deleteButton.addEventListener('click', () => onDelete?.(quiz, card, deleteButton, createQuizLink));
  const headingActions = element('div', 'quiz-library-card__heading-actions');
  headingActions.append(editButton, deleteButton);
  headingRow.append(heading, headingActions);

  const titleForm = element('form', 'quiz-title-edit');
  titleForm.dataset.role = 'title-form';
  titleForm.hidden = true;
  const label = element('label', '', 'ชื่อข้อสอบ');
  const input = element('input', 'quiz-title-edit__input');
  input.type = 'text';
  input.maxLength = 160;
  input.required = true;
  input.value = quiz.title || '';
  input.dataset.role = 'title-input';
  const actions = element('div', 'quiz-title-edit__actions');
  const saveButton = element('button', 'button button-primary', 'บันทึกชื่อ');
  saveButton.type = 'submit';
  const cancelButton = element('button', 'button button-quiet', 'ยกเลิก');
  cancelButton.type = 'button';
  cancelButton.dataset.action = 'cancel-title';
  actions.append(saveButton, cancelButton);
  label.htmlFor = `quiz-title-${quiz.id}`;
  input.id = label.htmlFor;
  titleForm.append(label, input, actions);

  editButton.addEventListener('click', () => {
    titleForm.hidden = false;
    heading.hidden = true;
    editButton.hidden = true;
    input.value = quiz.title || '';
    input.focus();
  });
  cancelButton.addEventListener('click', () => {
    titleForm.hidden = true;
    heading.hidden = false;
    editButton.hidden = false;
    input.value = quiz.title || '';
    setMessage('');
  });
  titleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) {
      setMessage('กรุณากรอกชื่อข้อสอบ', true);
      input.focus();
      return;
    }
    saveButton.disabled = true;
    setMessage('กำลังบันทึกชื่อข้อสอบ…');
    try {
      const updated = await updateTitle(quiz.id, { title });
      quiz.title = updated?.title || title;
      heading.textContent = quiz.title;
      editButton.setAttribute('aria-label', `แก้ชื่อ ${quiz.title}`);
      titleForm.hidden = true;
      heading.hidden = false;
      editButton.hidden = false;
      setMessage('ชื่อข้อสอบอัปเดตแล้ว');
    } catch (error) {
      setMessage(error?.message || 'เปลี่ยนชื่อข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      saveButton.disabled = false;
    }
  });

  const source = element('p', 'quiz-library-card__source');
  source.append(
    element('span', '', quiz.source_filename || 'ไม่ระบุชื่อไฟล์'),
    element('span', 'quiz-library-card__separator', '·'),
    element('span', '', SOURCE_LABELS[quiz.source_type] || quiz.source_type || 'เอกสาร'),
  );

  const metadata = element('dl', 'quiz-library-card__metadata');
  const facts = [
    ['จำนวนข้อ', `${quiz.question_count} ข้อ`],
    ['ภาษา', LANGUAGE_LABELS[quiz.language] || quiz.language || '—'],
    ['ระดับ', DIFFICULTY_LABELS[quiz.difficulty] || quiz.difficulty || '—'],
    ['สร้างเมื่อ', formatDate(quiz.created_at)],
  ];
  for (const [term, value] of facts) {
    metadata.append(element('dt', '', term), element('dd', '', value));
  }

  const stats = element('div', 'quiz-library-card__stats');
  stats.append(element('span', '', `ทำแล้ว ${quiz.attempt_count ?? 0} ครั้ง`));
  if (quiz.latest_attempt) {
    stats.append(element(
      'span',
      '',
      `ล่าสุด ${quiz.latest_attempt.score} / ${quiz.latest_attempt.total_questions} · ${formatDate(quiz.latest_attempt.submitted_at)}`,
    ));
  } else {
    stats.append(element('span', '', 'ยังไม่เคยทำ'));
  }
  const bestScore = quiz.best_score !== null && quiz.best_score !== undefined
    ? element('span', 'quiz-library-card__best-score', `ดีที่สุด ${quiz.best_score} / ${quiz.question_count}`)
    : null;

  const tagSection = element('section', 'quiz-library-card__tag-section');
  tagSection.setAttribute('aria-label', `แท็กของ ${quiz.title || 'ข้อสอบ'}`);
  const tagHeading = element('h3', 'quiz-library-card__tag-heading', 'แท็กวิชาและหัวข้อ');
  const tagSummary = element('div', 'quiz-library-card__tag-summary');
  tagSummary.dataset.role = 'tag-summary';
  tagSummary.append(renderTagChips(quiz.tags ?? []));
  const manageTagsButton = element('button', 'button button-quiet', 'จัดการแท็ก');
  manageTagsButton.type = 'button';
  manageTagsButton.dataset.action = 'manage-tags';
  manageTagsButton.setAttribute('aria-label', `จัดการแท็ก ${quiz.title || 'ข้อสอบ'}`);
  manageTagsButton.setAttribute('aria-expanded', 'false');
  const tagPickerContainer = element('div', 'quiz-library-card__picker-container');
  tagPickerContainer.hidden = true;
  let tagPicker;
  const tagAssignment = getTagAssignment(quiz);
  const tagQueue = tagAssignment.queue;

  function syncTagSelection(tagIds) {
    const selected = new Set(tagIds.map(Number));
    const catalogTags = getTagCatalog()?.tags ?? [];
    quiz.tags = catalogTags.filter((tag) => selected.has(Number(tag.id)));
    tagSummary.replaceChildren(renderTagChips(quiz.tags));
    tagPicker?.setSelectedTagIds?.(tagIds);
  }

  tagAssignment.onChange = syncTagSelection;
  tagAssignment.onError = (error) => {
    if (tagAssignment.pendingCreatedTagId !== null) {
      tagAssignment.pendingCreatedTagId = null;
      setMessage('สร้างแท็กแล้ว แต่แนบกับข้อสอบไม่สำเร็จ กรุณาลองกดแท็กอีกครั้ง', true);
      return;
    }
    setMessage(error?.message || 'บันทึกแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true);
  };
  syncTagSelection(tagQueue.getTagIds());

  function mountTagPicker() {
    tagPicker = renderTagPicker({
      catalog: getTagCatalog(),
      selectedTagIds: tagQueue.getTagIds(),
      onToggle: (tagId) => tagQueue.toggle(tagId),
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
          await reloadTagCatalog();
        } catch {
          const catalog = getTagCatalog();
          const tags = catalog?.tags ?? [];
          if (!tags.some((tag) => Number(tag.id) === createdId)) {
            tagCatalog = { tags: [...tags, created] };
            refreshTagPickers?.();
          }
        }

        tagAssignment.pendingCreatedTagId = createdId;
        setMessage('สร้างแท็กแล้ว กำลังเพิ่มลงในข้อสอบ…');
        tagQueue.include(createdId);
      },
    });
    tagPicker.dataset.role = 'tag-picker';
    tagPickerContainer.replaceChildren(tagPicker);
    registerTagPicker?.(tagPicker);
  }

  manageTagsButton.addEventListener('click', () => {
    const isOpening = tagPickerContainer.hidden;
    tagPickerContainer.hidden = !isOpening;
    manageTagsButton.setAttribute('aria-expanded', String(isOpening));
    if (isOpening && !tagPicker) mountTagPicker();
  });
  tagSection.append(tagHeading, tagSummary, manageTagsButton, tagPickerContainer);

  const cardActions = element('div', 'quiz-library-card__actions');
  cardActions.append(
    routeLink('ดูประวัติ', `/quizzes/${quiz.id}`, navigate),
    routeLink(quiz.attempt_count ? 'ทำซ้ำ' : 'เริ่มทำข้อสอบ', `/quizzes/${quiz.id}/take`, navigate, 'button button-primary'),
  );
  if (bestScore) cardActions.append(bestScore);
  card.append(headingRow, titleForm, source, metadata, stats, tagSection, cardActions);
  return card;
}

export function renderQuizLibraryPage({
  loadQuizzes = listQuizzes,
  loadTags = listTags,
  createTag = createTagRequest,
  saveQuizTags = replaceQuizTags,
  updateTitle = renameQuiz,
  deleteQuiz = deleteQuizRequest,
  confirmDelete,
  navigate,
} = {}) {
  const page = element('section', 'page quiz-library-page');
  page.setAttribute('aria-labelledby', 'quiz-library-title');
  const header = element('header', 'quiz-page-heading quiz-library-heading');
  const headingCopy = element('div', 'quiz-library-heading__copy');
  headingCopy.append(
    element('p', 'eyebrow', 'YOUR STUDY LIBRARY'),
    element('h1', '', 'คลังข้อสอบ'),
    element('p', 'page-intro', 'ข้อสอบจากเอกสารของคุณ พร้อมคะแนนและประวัติทุกครั้งที่ทำ'),
  );
  headingCopy.querySelector('h1').id = 'quiz-library-title';
  const createQuizLink = routeLink('สร้างข้อสอบ', '/quizzes/create', navigate, 'button button-primary quiz-library-create');
  header.append(headingCopy, createQuizLink);
  const message = element('p', 'quiz-page-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const searchForm = element('form', 'quiz-library-search');
  searchForm.dataset.role = 'quiz-search-form';
  const searchInput = element('input', 'quiz-library-search__input');
  searchInput.type = 'search';
  searchInput.placeholder = 'ค้นหาชื่อข้อสอบหรือ tag';
  searchInput.setAttribute('aria-label', 'ค้นหาชื่อข้อสอบหรือ tag');
  searchInput.disabled = true;
  const filterWrapper = element('div', 'quiz-library-search__filter');
  let tagCatalog = { tags: [] };
  let selectedTagId = null;
  let activeTagId = null;
  let activeQuery = '';
  let hasSubmittedFilters = false;
  let tagFilter = renderTagFilter(tagCatalog, selectedTagId, (value) => {
    selectedTagId = value;
  });
  tagFilter.disabled = true;
  filterWrapper.append(tagFilter);
  const searchButton = element('button', 'button button-primary', 'ค้นหา');
  searchButton.type = 'submit';
  searchButton.disabled = true;
  searchForm.append(searchInput, filterWrapper, searchButton);
  const list = element('div', 'quiz-library-list');
  list.dataset.role = 'quiz-list';
  const pagination = element('nav', 'quiz-library-pagination');
  pagination.dataset.role = 'pagination';
  pagination.setAttribute('aria-label', 'การแบ่งหน้าคลังข้อสอบ');
  pagination.hidden = true;
  const previousPageButton = element('button', 'button button-secondary', 'ก่อนหน้า');
  previousPageButton.type = 'button';
  previousPageButton.dataset.action = 'previous-page';
  const pageStatus = element('span', 'quiz-library-pagination__status', 'หน้า 1');
  pageStatus.dataset.role = 'page-status';
  const nextPageButton = element('button', 'button button-secondary', 'ถัดไป');
  nextPageButton.type = 'button';
  nextPageButton.dataset.action = 'next-page';
  pagination.append(previousPageButton, pageStatus, nextPageButton);
  page.append(header, searchForm, message, list, pagination);

  let pageSize = getQuizPageSize(window.innerWidth);
  let pageIndex = 0;
  let hasNextPage = false;
  let isLoading = false;
  let isInitialized = false;
  let destroyed = false;
  let reloadAfterResize = false;
  const tagAssignments = new Map();
  const mountedTagPickers = new Set();

  async function performDelete(quiz, card, deleteButton) {
    deleteButton.disabled = true;
    try {
      await deleteQuiz(quiz.id);
      const isLastCard = list.querySelectorAll('[data-quiz-id]').length <= 1;
      const targetPage = isLastCard && pageIndex > 0 ? pageIndex - 1 : pageIndex;
      await load({ targetPage });
    } catch (error) {
      if (card.isConnected) deleteButton.disabled = false;
      throw error;
    }
  }

  function requestQuizDelete(quiz, card, deleteButton) {
    if (typeof confirmDelete === 'function') {
      void Promise.resolve(confirmDelete(quiz)).then((confirmed) => {
        if (!confirmed) return;
        return performDelete(quiz, card, deleteButton);
      }).catch((error) => setMessage(error?.message || 'ลบข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', true));
      return;
    }
    openDeleteDialog(quiz, {
      onConfirm: () => performDelete(quiz, card, deleteButton),
      onError: (error) => setMessage(error?.message || 'ลบข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', true),
      returnFocus: createQuizLink,
    });
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.setAttribute('role', isError ? 'alert' : 'status');
    if (isError) message.dataset.state = 'error';
    else delete message.dataset.state;
  }

  function getTagAssignment(quiz) {
    const key = String(quiz.id);
    let assignment = tagAssignments.get(key);
    if (assignment) return assignment;

    assignment = {
      onChange: null,
      onError: null,
      pendingCreatedTagId: null,
      queue: null,
    };
    let queue;
    queue = createTagAssignmentQueue({
      initialTagIds: (quiz.tags ?? []).map((tag) => tag.id),
      save: async (tagIds) => {
        setMessage('กำลังบันทึกแท็ก…');
        const updated = await saveQuizTags(quiz.id, { tag_ids: tagIds });
        if (assignment.pendingCreatedTagId !== null && tagIds.includes(assignment.pendingCreatedTagId)) {
          assignment.pendingCreatedTagId = null;
        }
        if (JSON.stringify(queue.getTagIds()) === JSON.stringify(tagIds)) {
          setMessage('บันทึกแท็กแล้ว');
        }
        return updated;
      },
      onChange: (tagIds) => assignment.onChange?.(tagIds),
      onError: (error) => assignment.onError?.(error),
    });
    assignment.queue = queue;
    tagAssignments.set(key, assignment);
    return assignment;
  }

  function refreshTagPickers() {
    for (const picker of mountedTagPickers) {
      if (!list.contains(picker)) {
        mountedTagPickers.delete(picker);
        continue;
      }
      picker.setCatalog?.(tagCatalog);
    }
  }

  function setTagCatalog(catalog) {
    tagCatalog = catalog && Array.isArray(catalog.tags) ? catalog : { tags: [] };
    const replacement = renderTagFilter(tagCatalog, selectedTagId, (value) => {
      selectedTagId = value;
    });
    replacement.disabled = searchInput.disabled;
    tagFilter.replaceWith(replacement);
    tagFilter = replacement;
    for (const assignment of tagAssignments.values()) {
      assignment.onChange?.(assignment.queue.getTagIds());
    }
    refreshTagPickers();
  }

  async function reloadTagCatalog() {
    const catalog = await loadTags();
    setTagCatalog(catalog);
    return tagCatalog;
  }

  function clearFilters() {
    searchInput.value = '';
    selectedTagId = null;
    activeQuery = '';
    activeTagId = null;
    hasSubmittedFilters = true;
    tagFilter.value = '';
    void load();
  }

  function showEmptyState(isNoMatch) {
    const emptyState = element('section', isNoMatch ? 'quiz-empty-state quiz-no-matches' : 'quiz-empty-state');
    if (isNoMatch) {
      emptyState.append(
        element('h2', '', 'ไม่พบข้อสอบที่ตรงกับการค้นหา'),
        element('p', '', 'ลองเปลี่ยนคำค้นหาหรือเลือกแท็กวิชาอื่น'),
      );
      const clearButton = element('button', 'button button-secondary', 'ล้างตัวกรอง');
      clearButton.type = 'button';
      clearButton.dataset.action = 'clear-filters';
      clearButton.addEventListener('click', clearFilters);
      emptyState.append(clearButton);
    } else {
      emptyState.append(
        element('h2', '', 'ยังไม่มีข้อสอบ'),
        element('p', '', 'สร้างข้อสอบจากเอกสารของคุณ แล้วข้อสอบจะมาอยู่ที่นี่'),
      );
    }
    list.append(emptyState);
  }

  function updatePagination() {
    pageStatus.textContent = `หน้า ${pageIndex + 1}`;
    previousPageButton.disabled = isLoading || pageIndex === 0;
    nextPageButton.disabled = isLoading || !hasNextPage;
    pagination.hidden = pageIndex === 0 && !hasNextPage;
  }

  async function load({ targetPage = 0 } = {}) {
    if (isLoading) return;
    isLoading = true;
    searchInput.disabled = true;
    tagFilter.disabled = true;
    searchButton.disabled = true;
    pageIndex = targetPage;
    hasNextPage = false;
    updatePagination();
    setMessage('กำลังโหลดคลังข้อสอบ…');
    list.replaceChildren();
    mountedTagPickers.clear();
    try {
      const requestedPageIndex = pageIndex;
      const requestedPageSize = pageSize;
      const params = { limit: requestedPageSize + 1, offset: requestedPageIndex * requestedPageSize };
      if (hasSubmittedFilters) {
        params.q = activeQuery;
        params.tagId = activeTagId;
      }
      const response = await loadQuizzes(params);
      if (destroyed) return;
      if (requestedPageSize !== pageSize) {
        reloadAfterResize = true;
        return;
      }
      const quizzes = Array.isArray(response) ? response : [];
      if (!Array.isArray(quizzes) || quizzes.length === 0) {
        setMessage('');
        showEmptyState(Boolean(activeQuery || activeTagId));
        hasNextPage = false;
        return;
      }
      setMessage('');
      const visibleQuizzes = quizzes.slice(0, requestedPageSize);
      hasNextPage = quizzes.length > requestedPageSize;
      list.append(...visibleQuizzes.map((item) => createQuizCard(item, {
        updateTitle,
        navigate,
        setMessage,
        getTagCatalog: () => tagCatalog,
        reloadTagCatalog,
        createTag,
        saveQuizTags,
        getTagAssignment,
        registerTagPicker: (picker) => mountedTagPickers.add(picker),
        refreshTagPickers,
        onDelete: requestQuizDelete,
        createQuizLink,
      })));
    } catch (error) {
      if (!destroyed) setMessage(error?.message || 'โหลดคลังข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      isLoading = false;
      searchInput.disabled = !isInitialized;
      tagFilter.disabled = !isInitialized;
      searchButton.disabled = !isInitialized;
      updatePagination();
      if (reloadAfterResize && !destroyed) {
        reloadAfterResize = false;
        void load();
      }
    }
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    activeQuery = searchInput.value.trim();
    selectedTagId = tagFilter.value === '' ? null : Number(tagFilter.value);
    activeTagId = selectedTagId;
    hasSubmittedFilters = true;
    void load();
  });

  previousPageButton.addEventListener('click', () => {
    if (pageIndex > 0) void load({ targetPage: pageIndex - 1 });
  });
  nextPageButton.addEventListener('click', () => {
    if (hasNextPage) void load({ targetPage: pageIndex + 1 });
  });
  const handleResize = () => {
    if (destroyed || !page.isConnected) return;
    const nextPageSize = getQuizPageSize(window.innerWidth);
    if (nextPageSize === pageSize) return;
    pageSize = nextPageSize;
    pageIndex = 0;
    if (isLoading) {
      reloadAfterResize = true;
      return;
    }
    void load();
  };
  window.addEventListener('resize', handleResize);
  async function initialize() {
    setMessage('กำลังโหลดคลังข้อสอบ…');
    const catalogPromise = reloadTagCatalog().then(() => null).catch((error) => error);
    await load();
    const catalogError = await catalogPromise;
    isInitialized = true;
    searchInput.disabled = false;
    tagFilter.disabled = false;
    searchButton.disabled = false;
    if (catalogError) {
      setMessage(catalogError?.message || 'โหลดรายการแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    }
  }
  void initialize();
  page.destroy = () => {
    destroyed = true;
    window.removeEventListener('resize', handleResize);
  };
  return page;
}
