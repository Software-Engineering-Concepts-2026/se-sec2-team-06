import { generateQuiz, getQuizProviders } from '../api/client.js';

const MAX_QUIZ_UPLOAD_BYTES = 40_000_000;

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
      <div class="field">
        <label for="quiz-source-file">เอกสารสำหรับสร้างข้อสอบ</label>
        <input id="quiz-source-file" name="file" type="file" accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" required />
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
  `;

  const form = page.querySelector('form');
  const providerSelect = page.querySelector('#quiz-provider');
  const modelSelect = page.querySelector('#quiz-model');
  const fileInput = page.querySelector('#quiz-source-file');
  const submitButton = form.querySelector('[type="submit"]');
  const message = page.querySelector('[data-quiz-message]');
  const result = page.querySelector('[data-quiz-result]');
  let providers = [];
  const selectDropdowns = new Map(
    [...page.querySelectorAll('.quiz-create-grid select')].map((select) => [select, createSelectDropdown(select)]),
  );

  function setMessage(text, state = '') {
    message.textContent = text;
    if (state) message.dataset.state = state;
    else delete message.dataset.state;
  }

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
