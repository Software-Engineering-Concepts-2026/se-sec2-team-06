import { generateQuiz, getQuizProviders, listDocuments } from '../api/client.js';

const MAX_QUIZ_UPLOAD_BYTES = 40_000_000;
const DOCUMENT_PAGE_SIZE = 10;
const QUIZ_SOURCE_TYPES = new Set(['pdf', 'md', 'txt']);

function addOptions(select, options) {
  select.replaceChildren();
  for (const item of options) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.append(option);
  }
}

function createSelectDropdown(select) {
  const field = select.closest('.field');
  const dropdownGroup = select.closest('.quiz-create-grid');
  const label = field.querySelector('label');
  const labelId = label.id || `${select.id}-label`;
  label.id = labelId;

  const triggerId = `${select.id}-trigger`;
  const menuId = `${select.id}-options`;
  const valueId = `${select.id}-selected-value`;
  select.classList.add('quiz-native-select');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  const dropdown = document.createElement('div');
  dropdown.className = 'quiz-dropdown';
  dropdown.dataset.quizDropdown = select.id;

  const trigger = document.createElement('button');
  trigger.className = 'quiz-dropdown__trigger';
  trigger.id = triggerId;
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', menuId);
  trigger.setAttribute('aria-labelledby', `${labelId} ${valueId}`);
  trigger.innerHTML = `<span class="quiz-dropdown__value" id="${valueId}"></span><span class="quiz-dropdown__caret" aria-hidden="true"></span>`;

  const menu = document.createElement('div');
  menu.className = 'quiz-dropdown__menu';
  menu.id = menuId;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-labelledby', labelId);
  menu.hidden = true;
  dropdown.append(trigger, menu);
  field.append(dropdown);

  function refresh() {
    const selectedOption = select.options[select.selectedIndex];
    trigger.querySelector('.quiz-dropdown__value').textContent = selectedOption?.textContent || 'เลือก';
    trigger.disabled = select.disabled || select.options.length === 0;
    menu.replaceChildren();
    for (const option of select.options) {
      const item = document.createElement('button');
      item.className = 'quiz-dropdown__option';
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.value === select.value));
      item.textContent = option.textContent;
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close(false);
        trigger.focus();
      });
      menu.append(item);
    }
  }

  function close(returnFocus) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  trigger.addEventListener('click', () => {
    const shouldOpen = menu.hidden;
    for (const other of dropdownGroup.querySelectorAll('.quiz-dropdown')) {
      const otherMenu = other.querySelector('.quiz-dropdown__menu');
      const otherTrigger = other.querySelector('.quiz-dropdown__trigger');
      otherMenu.hidden = true;
      otherTrigger.setAttribute('aria-expanded', 'false');
    }
    if (shouldOpen && !trigger.disabled) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (menu.hidden) {
      trigger.click();
      const options = menu.querySelectorAll('[role="option"]');
      options[event.key === 'ArrowUp' ? options.length - 1 : 0]?.focus();
    }
  });

  menu.addEventListener('keydown', (event) => {
    const options = [...menu.querySelectorAll('[role="option"]')];
    const current = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      options[(current + direction + options.length) % options.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
    }
  });

  select.addEventListener('change', refresh);
  refresh();
  return { dropdown, trigger, menu, refresh, close };
}

function routeLink(label, path, navigate, className = 'button button-secondary') {
  const link = document.createElement('a');
  link.className = className;
  link.href = path;
  link.dataset.route = path;
  link.textContent = label;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate?.(path);
  });
  return link;
}

export function renderQuizCreatePage({
  loadProviders = getQuizProviders,
  loadDocuments = listDocuments,
  submitQuiz = generateQuiz,
  navigate,
} = {}) {
  const page = document.createElement('section');
  page.className = 'page quiz-create-page';
  page.setAttribute('aria-labelledby', 'quiz-create-title');
  page.innerHTML = `
    <header class="quiz-create-intro">
      <p class="eyebrow">AI-POWERED STUDY TOOL</p>
      <h1 id="quiz-create-title">สร้างข้อสอบจากเอกสาร</h1>
      <p>เลือกเนื้อหาและรูปแบบที่ต้องการ ระบบจะสร้างข้อสอบจากเอกสารของคุณ</p>
    </header>
    <form class="form-card quiz-create-form" novalidate>
      <div class="field quiz-source-field" data-quiz-source-field>
        <label for="quiz-source-trigger">เอกสารสำหรับสร้างข้อสอบ</label>
        <button class="quiz-source-trigger" id="quiz-source-trigger" type="button" data-action="open-source-dialog" aria-haspopup="dialog" aria-expanded="false">
          <span data-source-trigger-label>เลือกไฟล์</span>
          <span class="quiz-source-trigger__icon" aria-hidden="true"></span>
        </button>
        <p class="quiz-source-field__selection" data-selected-document hidden></p>
        <p class="quiz-source-field__selection" data-selected-file hidden></p>
        <input class="quiz-source-file-input visually-hidden" id="quiz-source-file" name="file" type="file" accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" required aria-hidden="true" tabindex="-1" />
        <small>รองรับ Markdown, TXT และ PDF · ไม่เกิน 40 MB</small>
      </div>

      <div class="quiz-create-grid">
        <div class="field">
          <label for="quiz-provider">Provider</label>
          <select id="quiz-provider" class="themed-select" name="provider" disabled required></select>
        </div>
        <div class="field">
          <label for="quiz-model">โมเดล</label>
          <select id="quiz-model" class="themed-select" name="model" disabled required></select>
        </div>
        <div class="field">
          <label for="quiz-question-count">จำนวนข้อ (5–20)</label>
          <input id="quiz-question-count" name="question_count" type="number" min="5" max="20" value="10" required />
        </div>
        <div class="field">
          <label for="quiz-language">ภาษา</label>
          <select id="quiz-language" class="themed-select" name="language">
            <option value="th">ภาษาไทย</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="field">
          <label for="quiz-difficulty">ระดับความยาก</label>
          <select id="quiz-difficulty" class="themed-select" name="difficulty">
            <option value="basic">พื้นฐาน</option>
            <option value="intermediate" selected>ปานกลาง</option>
            <option value="advanced">ขั้นสูง</option>
          </select>
        </div>
      </div>

      <fieldset class="quiz-question-types">
        <legend>รูปแบบข้อสอบ <span>· เลือกได้ 1 แบบ</span></legend>
        <label class="quiz-question-choice"><input type="radio" name="question_types" value="multiple_choice" checked /><span>ปรนัย 4 ตัวเลือก</span></label>
        <label class="quiz-question-choice"><input type="radio" name="question_types" value="true_false" /><span>ถูกหรือผิด</span></label>
      </fieldset>

      <p class="form-message" data-quiz-message role="status" aria-live="polite"></p>
      <button class="button button-primary button-wide" type="submit" disabled>กำลังโหลด Provider…</button>

      <section class="quiz-create-result" data-quiz-result hidden aria-labelledby="quiz-result-title">
        <p class="quiz-create-result__eyebrow">สร้างข้อสอบสำเร็จ</p>
        <h2 id="quiz-result-title" data-quiz-result-title></h2>
        <p data-quiz-result-count></p>
        <div class="quiz-create-result__actions" data-quiz-result-actions></div>
      </section>
    </form>

    <div class="quiz-source-dialog-backdrop" data-quiz-source-dialog hidden>
      <section class="quiz-source-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="quiz-source-dialog-title" tabindex="-1">
        <header class="quiz-source-dialog__header">
          <h2 id="quiz-source-dialog-title">เลือกแหล่งที่มาของเอกสาร</h2>
          <button class="quiz-source-dialog__close" type="button" data-action="close-source-dialog" aria-label="ปิดหน้าต่าง">×</button>
        </header>
        <div class="quiz-source-options">
          <button class="quiz-source-option" type="button" data-action="choose-upload">
            <strong>อัปโหลดไฟล์</strong>
            <small>เลือก PDF, Markdown หรือ TXT จากอุปกรณ์</small>
          </button>
          <button class="quiz-source-option" type="button" data-action="choose-library" aria-expanded="false">
            <strong>เลือกจากคลังเอกสาร</strong>
            <small>ใช้เอกสารที่บันทึกไว้แล้ว</small>
          </button>
        </div>
        <section class="quiz-document-picker" data-quiz-document-picker hidden aria-labelledby="quiz-document-picker-title">
          <h3 id="quiz-document-picker-title">เลือกเอกสารจากคลัง</h3>
          <div class="quiz-document-search" data-document-search-form role="search" aria-label="ค้นหาเอกสารในคลัง">
            <label class="visually-hidden" for="quiz-document-search">ค้นหาเอกสาร</label>
            <input id="quiz-document-search" type="search" placeholder="ค้นหาชื่อเอกสารหรือไฟล์" />
            <button class="button button-secondary" type="button" data-action="search-documents">ค้นหา</button>
          </div>
          <p class="quiz-document-picker__message" data-document-message role="status" aria-live="polite"></p>
          <div class="quiz-document-list" data-document-list role="list" aria-label="เอกสารที่เลือกได้" tabindex="0"></div>
          <p class="quiz-document-picker__selected" data-selected-document-label hidden></p>
          <button class="button button-quiet quiz-document-picker__clear" type="button" data-action="clear-document" hidden>ยกเลิกการเลือก</button>
        </section>
      </section>
    </div>
  `;

  const form = page.querySelector('form');
  const providerSelect = page.querySelector('#quiz-provider');
  const modelSelect = page.querySelector('#quiz-model');
  const fileInput = page.querySelector('#quiz-source-file');
  const sourceTrigger = page.querySelector('[data-action="open-source-dialog"]');
  const sourceDialog = page.querySelector('[data-quiz-source-dialog]');
  const sourceDialogClose = page.querySelector('[data-action="close-source-dialog"]');
  const chooseUploadButton = page.querySelector('[data-action="choose-upload"]');
  const chooseLibraryButton = page.querySelector('[data-action="choose-library"]');
  const documentPicker = page.querySelector('[data-quiz-document-picker]');
  const documentSearch = page.querySelector('#quiz-document-search');
  const documentSearchControls = page.querySelector('[data-document-search-form]');
  const documentList = page.querySelector('[data-document-list]');
  const documentMessage = page.querySelector('[data-document-message]');
  const selectedDocumentSummary = page.querySelector('[data-selected-document]');
  const selectedFileSummary = page.querySelector('[data-selected-file]');
  const selectedDocumentLabel = page.querySelector('[data-selected-document-label]');
  const clearDocumentButton = page.querySelector('[data-action="clear-document"]');
  const submitButton = form.querySelector('[type="submit"]');
  const message = page.querySelector('[data-quiz-message]');
  const result = page.querySelector('[data-quiz-result]');
  let providers = [];
  let selectedDocument = null;
  let nextDocumentOffset = 0;
  let hasNextDocumentPage = false;
  let isLoadingDocuments = false;
  let hasLoadedDocuments = false;
  const selectDropdowns = new Map(
    [...page.querySelectorAll('.quiz-create-grid select')].map((select) => [select, createSelectDropdown(select)]),
  );

  function setMessage(text, state = '') {
    message.textContent = text;
    if (state) message.dataset.state = state;
    else delete message.dataset.state;
  }

  function setDocumentMessage(text, state = '') {
    documentMessage.textContent = text;
    if (state) documentMessage.dataset.state = state;
    else delete documentMessage.dataset.state;
  }

  function updateSelectedDocument() {
    selectedDocumentSummary.hidden = !selectedDocument;
    selectedDocumentSummary.textContent = selectedDocument
      ? `เลือกจากคลัง: ${selectedDocument.title || selectedDocument.original_filename}`
      : '';
    selectedDocumentLabel.hidden = !selectedDocument;
    selectedDocumentLabel.textContent = selectedDocument
      ? `เลือกแล้ว: ${selectedDocument.title || selectedDocument.original_filename}`
      : '';
    clearDocumentButton.hidden = !selectedDocument;
    for (const option of documentList.querySelectorAll('[data-document-id]')) {
      option.setAttribute('aria-pressed', String(Number(option.dataset.documentId) === selectedDocument?.id));
    }
  }

  function updateSelectedFile() {
    const sourceFile = fileInput.files?.[0];
    selectedFileSummary.hidden = !sourceFile;
    selectedFileSummary.textContent = sourceFile ? `เลือกไฟล์: ${sourceFile.name}` : '';
  }

  function renderLibraryDocuments(documents, { append = false } = {}) {
    if (!append) documentList.replaceChildren();
    const supportedDocuments = documents.filter((item) => (
      Number.isSafeInteger(Number(item?.id))
      && Number(item.id) > 0
      && QUIZ_SOURCE_TYPES.has(String(item.file_type || '').toLowerCase())
    ));

    for (const item of supportedDocuments) {
      const row = document.createElement('div');
      row.className = 'quiz-document-option__row';
      row.setAttribute('role', 'listitem');
      const option = document.createElement('button');
      option.className = 'quiz-document-option';
      option.type = 'button';
      option.dataset.documentId = String(Number(item.id));
      option.setAttribute('aria-pressed', String(Number(item.id) === selectedDocument?.id));
      const details = document.createElement('span');
      details.className = 'quiz-document-option__details';
      const title = document.createElement('strong');
      title.textContent = item.title || item.original_filename || 'เอกสารไม่มีชื่อ';
      const filename = document.createElement('small');
      filename.textContent = item.original_filename || 'ไม่ทราบชื่อไฟล์';
      details.append(title, filename);
      const type = document.createElement('span');
      type.className = 'quiz-document-option__type';
      type.textContent = String(item.file_type).toUpperCase();
      option.append(details, type);
      option.addEventListener('click', () => {
        selectedDocument = {
          id: Number(item.id),
          title: item.title || item.original_filename || 'เอกสารไม่มีชื่อ',
        };
        fileInput.value = '';
        updateSelectedFile();
        updateSelectedDocument();
        setMessage('');
        closeSourceDialog();
      });
      row.append(option);
      documentList.append(row);
    }

    updateSelectedDocument();
    return supportedDocuments.length;
  }

  async function loadLibraryDocuments({ offset = 0, query = documentSearch.value.trim(), append = false } = {}) {
    if (isLoadingDocuments) return;
    isLoadingDocuments = true;
    hasLoadedDocuments = true;
    if (!append) {
      nextDocumentOffset = 0;
      hasNextDocumentPage = false;
      documentList.replaceChildren();
      setDocumentMessage('กำลังโหลดเอกสารในคลัง…');
    } else {
      setDocumentMessage('กำลังโหลดเอกสารเพิ่มเติม…');
    }
    try {
      let requestOffset = offset;
      let documents = [];
      let pageDocuments = [];
      let supportedCount = 0;
      let hasMore = false;
      do {
        const response = await loadDocuments({
          limit: DOCUMENT_PAGE_SIZE + 1,
          offset: requestOffset,
          q: query,
        });
        documents = Array.isArray(response) ? response : [];
        pageDocuments = documents.slice(0, DOCUMENT_PAGE_SIZE);
        hasMore = documents.length > DOCUMENT_PAGE_SIZE;
        supportedCount = pageDocuments.filter((item) => (
          Number.isSafeInteger(Number(item?.id))
          && Number(item.id) > 0
          && QUIZ_SOURCE_TYPES.has(String(item.file_type || '').toLowerCase())
        )).length;
        if (supportedCount === 0 && hasMore) requestOffset += DOCUMENT_PAGE_SIZE;
        else break;
      } while (true);

      const addedCount = renderLibraryDocuments(pageDocuments, { append });
      nextDocumentOffset = requestOffset + pageDocuments.length;
      hasNextDocumentPage = hasMore;
      if (addedCount > 0) {
        setDocumentMessage('เลือกเอกสารหนึ่งรายการเพื่อใช้สร้างข้อสอบ');
      } else if (documentList.childElementCount > 0) {
        setDocumentMessage('ไม่มีเอกสารที่รองรับเพิ่มเติม');
      } else {
        setDocumentMessage(pageDocuments.length
          ? 'ไม่พบเอกสาร PDF, Markdown หรือ TXT ในคลัง'
          : 'ไม่พบเอกสารในคลัง ลองค้นหาคำอื่นหรืออัปโหลดเอกสารก่อน');
      }
    } catch (error) {
      setDocumentMessage(error?.message || 'โหลดเอกสารจากคลังไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
    } finally {
      isLoadingDocuments = false;
    }
  }

  function openSourceDialog() {
    documentPicker.hidden = true;
    chooseLibraryButton.setAttribute('aria-expanded', 'false');
    sourceDialog.hidden = false;
    sourceTrigger.setAttribute('aria-expanded', 'true');
    sourceDialogClose.focus();
  }

  function closeSourceDialog() {
    sourceDialog.hidden = true;
    sourceTrigger.setAttribute('aria-expanded', 'false');
    sourceTrigger.focus();
  }

  sourceTrigger.addEventListener('click', openSourceDialog);
  sourceDialogClose.addEventListener('click', closeSourceDialog);
  sourceDialog.addEventListener('click', (event) => {
    if (event.target === sourceDialog) closeSourceDialog();
  });
  chooseUploadButton.addEventListener('click', () => {
    selectedDocument = null;
    fileInput.value = '';
    updateSelectedDocument();
    updateSelectedFile();
    closeSourceDialog();
    fileInput.click();
  });
  chooseLibraryButton.addEventListener('click', () => {
    const shouldExpand = documentPicker.hidden;
    documentPicker.hidden = !shouldExpand;
    chooseLibraryButton.setAttribute('aria-expanded', String(shouldExpand));
    if (!shouldExpand) return;

    fileInput.value = '';
    updateSelectedFile();
    if (!hasLoadedDocuments || (documentList.childElementCount === 0 && documentMessage.dataset.state === 'error')) {
      void loadLibraryDocuments();
    }
    documentSearch.focus();
  });
  documentSearchControls.querySelector('[data-action="search-documents"]').addEventListener('click', () => {
    void loadLibraryDocuments({ offset: 0, query: documentSearch.value.trim() });
  });
  documentSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void loadLibraryDocuments({ offset: 0, query: documentSearch.value.trim() });
  });
  documentList.addEventListener('scroll', () => {
    const atListEnd = documentList.scrollTop + documentList.clientHeight >= documentList.scrollHeight - 48;
    if (atListEnd && hasNextDocumentPage && !isLoadingDocuments) {
      void loadLibraryDocuments({ offset: nextDocumentOffset, query: documentSearch.value.trim(), append: true });
    }
  });
  clearDocumentButton.addEventListener('click', () => {
    selectedDocument = null;
    updateSelectedDocument();
    setMessage('');
  });
  fileInput.addEventListener('change', updateSelectedFile);

  function updateModels() {
    const selectedProvider = providers.find(({ id }) => id === providerSelect.value);
    const models = selectedProvider?.models || [];
    addOptions(modelSelect, models);
    modelSelect.disabled = models.length === 0;
    selectDropdowns.get(modelSelect)?.refresh();
    submitButton.disabled = models.length === 0;
    submitButton.textContent = models.length ? 'สร้างข้อสอบ' : 'ไม่มีโมเดลให้เลือก';
  }

  providerSelect.addEventListener('change', updateModels);
  page.addEventListener('click', (event) => {
    if (event.target.closest('.quiz-dropdown')) return;
    for (const dropdown of selectDropdowns.values()) dropdown.close(false);
  });
  page.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sourceDialog.hidden) {
      event.preventDefault();
      closeSourceDialog();
      return;
    }
    if (event.key !== 'Escape') return;
    for (const dropdown of selectDropdowns.values()) {
      if (!dropdown.menu.hidden) {
        event.preventDefault();
        dropdown.close(true);
        break;
      }
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    result.hidden = true;
    setMessage('');

    const isLibraryMode = Boolean(selectedDocument);
    if (!isLibraryMode) {
      const sourceFile = fileInput.files?.[0];
      if (!sourceFile) {
        setMessage('กรุณาเลือกไฟล์เอกสารก่อนสร้างข้อสอบ', 'error');
        fileInput.focus();
        return;
      }
      if (!/\.(md|txt|pdf)$/i.test(sourceFile.name)) {
        setMessage('รองรับเฉพาะไฟล์ PDF, Markdown หรือ TXT', 'error');
        fileInput.focus();
        return;
      }
      if (sourceFile.size > MAX_QUIZ_UPLOAD_BYTES) {
        setMessage('ไฟล์มีขนาดเกิน 40 MB', 'error');
        fileInput.focus();
        return;
      }
    }
    if (!form.querySelector('[name="question_types"]:checked')) {
      setMessage('เลือกประเภทข้อสอบอย่างน้อย 1 รูปแบบ', 'error');
      return;
    }
    if (Number(form.elements.question_count.value) < 5 || Number(form.elements.question_count.value) > 20) {
      setMessage('จำนวนข้อสอบต้องอยู่ระหว่าง 5 ถึง 20 ข้อ', 'error');
      form.elements.question_count.focus();
      return;
    }

    const formData = new FormData(form);
    if (isLibraryMode) {
      formData.delete('file');
      formData.set('source_document_id', String(selectedDocument.id));
    }
    submitButton.disabled = true;
    submitButton.textContent = 'กำลังสร้างข้อสอบ…';
    try {
      const quiz = await submitQuiz(formData);
      page.querySelector('[data-quiz-result-title]').textContent = quiz.title || 'ข้อสอบชุดใหม่';
      const count = quiz.question_count ?? quiz.questions?.length ?? 0;
      page.querySelector('[data-quiz-result-count]').textContent = `บันทึกข้อสอบ ${count} ข้อไว้ในบัญชีของคุณแล้ว`;
      const quizId = Number(quiz.id);
      const resultActions = page.querySelector('[data-quiz-result-actions]');
      resultActions.replaceChildren();
      if (Number.isSafeInteger(quizId) && quizId > 0) {
        resultActions.append(
          routeLink('เริ่มทำข้อสอบ', `/quizzes/${quizId}/take`, navigate, 'button button-primary'),
          routeLink('ไปคลังข้อสอบ', '/quizzes', navigate),
        );
      }
      result.hidden = false;
      setMessage('สร้างข้อสอบสำเร็จ', 'success');
    } catch (error) {
      setMessage(error?.message || 'สร้างข้อสอบไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
    } finally {
      submitButton.disabled = modelSelect.disabled;
      submitButton.textContent = modelSelect.disabled ? 'ไม่มีโมเดลให้เลือก' : 'สร้างข้อสอบ';
    }
  });

  async function loadCatalog() {
    try {
      const catalog = await loadProviders();
      providers = Array.isArray(catalog?.providers) ? catalog.providers : [];
      if (providers.length === 0) throw new Error('ยังไม่มี Provider หรือโมเดลที่พร้อมใช้งาน');
      addOptions(providerSelect, providers);
      providerSelect.disabled = false;
      selectDropdowns.get(providerSelect)?.refresh();
      updateModels();
      setMessage('');
    } catch (error) {
      providerSelect.disabled = true;
      modelSelect.disabled = true;
      selectDropdowns.get(providerSelect)?.refresh();
      selectDropdowns.get(modelSelect)?.refresh();
      submitButton.disabled = true;
      submitButton.textContent = 'ยังไม่พร้อมสร้างข้อสอบ';
      setMessage(error?.message || 'โหลดรายการ Provider ไม่สำเร็จ', 'error');
    }
  }

  void loadCatalog();
  return page;
}
