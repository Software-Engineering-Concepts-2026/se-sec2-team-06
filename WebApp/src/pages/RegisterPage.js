import {
  getPasswordPolicyErrors,
  getPasswordRequirements,
  getPasswordStrength,
} from '../auth/password-policy.js';

function createRouteLink(label, path, onNavigate) {
  const link = document.createElement('a');
  link.href = path;
  link.dataset.route = path;
  link.textContent = label;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(path);
  });
  return link;
}

function bindPasswordToggle(input, button) {
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    button.querySelector('[data-toggle-label]').textContent = visible ? 'ซ่อน' : 'แสดง';
  });
}

export function renderRegisterPage({ onRegister, onNavigate } = {}) {
  const page = document.createElement('section');
  page.className = 'page auth-page auth-shell register-page';
  page.setAttribute('aria-labelledby', 'register-title');

  const intro = document.createElement('section');
  intro.className = 'auth-intro';
  intro.setAttribute('aria-label', 'เกี่ยวกับ SynapseSync');
  intro.innerHTML = `
    <span class="auth-badge">บัญชีส่วนตัว</span>
    <p class="auth-kicker">เริ่มต้นเส้นทางการเรียนรู้</p>
    <h1 id="register-title">สร้างพื้นที่เรียนรู้ที่เข้าใจคุณมากขึ้น</h1>
    <p class="auth-lead">จัดการบัญชีและพื้นที่เรียนรู้ของคุณได้ในที่เดียว เริ่มต้นใช้งานง่ายและกลับมาเรียนต่อได้ทุกเมื่อ</p>
    <aside class="privacy-card">
      <span class="privacy-card__icon" aria-hidden="true">◇</span>
      <div>
        <strong>ข้อมูลบัญชีได้รับการปกป้อง</strong>
        <p>รหัสผ่านถูกจัดเก็บเป็นค่าแฮช ไม่เก็บเป็นข้อความธรรมดา และจะไม่แสดงกลับหลังสมัคร</p>
      </div>
    </aside>
  `;

  const card = document.createElement('section');
  card.className = 'auth-card';
  card.setAttribute('aria-label', 'แบบฟอร์มสมัครสมาชิก');
  card.innerHTML = `
    <div class="auth-card__heading">
      <p>Join SynapseSync</p>
      <h2>สมัครสมาชิก</h2>
      <span>กรอกข้อมูลเพื่อสร้างบัญชีของคุณ</span>
    </div>
    <form class="form-card auth-form" novalidate>
      <div class="field">
        <label for="register-name">ชื่อที่ใช้แสดง</label>
        <input id="register-name" name="display_name" type="text" autocomplete="name" maxlength="80" placeholder="เช่น ปันปัน ใจดี" required />
      </div>
      <div class="field">
        <label for="register-email">อีเมล</label>
        <input id="register-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="name@university.ac.th" required />
      </div>
      <div class="field">
        <label for="register-password">รหัสผ่าน</label>
        <div class="password-input">
          <input id="register-password" name="password" type="password" autocomplete="new-password" maxlength="128" aria-describedby="password-guidance password-strength-label" required />
          <button class="password-toggle" type="button" data-action="toggle-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.25-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.25 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>
            <span data-toggle-label>แสดง</span>
          </button>
        </div>
        <small id="password-guidance">ใช้ 8 ตัวขึ้นไป มีตัวอักษรอย่างน้อย 1 ตัว และมีตัวเลขอย่างน้อย 1 ตัว</small>
        <div class="password-feedback">
          <ul class="password-requirements" data-password-requirements aria-label="ข้อกำหนดรหัสผ่าน"></ul>
          <div class="password-strength">
            <div class="password-strength__caption">
              <span>ความแข็งแรงของรหัสผ่าน</span>
              <output id="password-strength-label" data-password-strength-label>เริ่มพิมพ์รหัสผ่าน</output>
            </div>
            <div class="password-strength__meter" role="meter" aria-label="ความแข็งแรงของรหัสผ่าน" aria-valuemin="0" aria-valuemax="6" aria-valuenow="0" aria-valuetext="เริ่มพิมพ์รหัสผ่าน" data-tone="neutral">
              <span class="password-strength__fill" data-strength-fill></span>
            </div>
          </div>
        </div>
      </div>
      <div class="field">
        <label for="register-password-confirm">ยืนยันรหัสผ่าน</label>
        <div class="password-input">
          <input id="register-password-confirm" name="password_confirm" type="password" autocomplete="new-password" maxlength="128" required />
          <button class="password-toggle" type="button" data-action="toggle-confirm-password" aria-label="แสดงรหัสผ่านที่ยืนยัน" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.25-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.25 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>
            <span data-toggle-label>แสดง</span>
          </button>
        </div>
      </div>
      <p class="form-message" role="status" aria-live="polite"></p>
      <button class="button button-primary button-wide" type="submit">สร้างบัญชี <span aria-hidden="true">→</span></button>
    </form>
    <p class="switch-link">มีบัญชีอยู่แล้ว? <span class="auth-link-placeholder"></span></p>
  `;

  const form = card.querySelector('form');
  const passwordInput = form.elements.password;
  const confirmationInput = form.elements.password_confirm;
  const passwordRequirementList = card.querySelector('[data-password-requirements]');
  const strengthMeter = card.querySelector('[role="meter"]');
  const strengthLabel = card.querySelector('[data-password-strength-label]');
  const strengthFill = card.querySelector('[data-strength-fill]');
  const message = form.querySelector('.form-message');

  for (const requirement of getPasswordRequirements('')) {
    const item = document.createElement('li');
    item.className = 'password-requirement';
    item.dataset.requirementId = requirement.id;
    item.dataset.state = 'pending';
    item.innerHTML = `
      <span class="password-requirement__marker" aria-hidden="true">·</span>
      <span class="password-requirement__label">${requirement.label}</span>
      <span class="password-requirement__state" data-requirement-status>รอกรอก</span>
    `;
    passwordRequirementList.append(item);
  }

  function updatePasswordFeedback() {
    const value = passwordInput.value;
    const hasInput = value.length > 0;
    for (const requirement of getPasswordRequirements(value)) {
      const item = passwordRequirementList.querySelector(`[data-requirement-id="${requirement.id}"]`);
      const state = !hasInput ? 'pending' : requirement.valid ? 'valid' : 'invalid';
      item.dataset.state = state;
      item.querySelector('.password-requirement__marker').textContent = state === 'valid' ? '✓' : state === 'invalid' ? '×' : '·';
      item.querySelector('[data-requirement-status]').textContent = state === 'valid' ? 'ผ่าน' : state === 'invalid' ? 'ยังไม่ผ่าน' : 'รอกรอก';
    }

    const strength = getPasswordStrength(value);
    strengthLabel.textContent = strength.label;
    strengthLabel.dataset.tone = strength.tone;
    strengthMeter.dataset.tone = strength.tone;
    strengthMeter.setAttribute('aria-valuenow', String(strength.score));
    strengthMeter.setAttribute('aria-valuetext', `${strength.label} (${strength.score} จาก ${strength.maxScore})`);
    strengthFill.style.width = `${(strength.score / strength.maxScore) * 100}%`;
  }

  passwordInput.addEventListener('input', updatePasswordFeedback);
  bindPasswordToggle(passwordInput, card.querySelector('[data-action="toggle-password"]'));
  bindPasswordToggle(confirmationInput, card.querySelector('[data-action="toggle-confirm-password"]'));

  const loginLink = createRouteLink('เข้าสู่ระบบ', '/login', onNavigate);
  card.querySelector('.auth-link-placeholder').replaceWith(loginLink);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayName = form.elements.display_name.value.trim();
    const email = form.elements.email.value.trim();
    const password = passwordInput.value;
    const confirmation = confirmationInput.value;
    const errors = getPasswordPolicyErrors(password);
    updatePasswordFeedback();
    if (password !== confirmation) errors.push('รหัสผ่านไม่ตรงกัน');
    if (!displayName) errors.push('กรุณากรอกชื่อที่ใช้แสดง');
    if (!form.elements.email.validity.valid) errors.push('กรุณากรอกอีเมลให้ถูกต้อง');
    if (errors.length) {
      message.dataset.state = 'error';
      message.textContent = errors.join(' ');
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    message.textContent = '';
    try {
      await onRegister?.({ display_name: displayName, email, password });
    } catch (error) {
      message.dataset.state = 'error';
      message.textContent = error?.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally {
      submitButton.disabled = false;
    }
  });

  page.append(intro, card);
  return page;
}
