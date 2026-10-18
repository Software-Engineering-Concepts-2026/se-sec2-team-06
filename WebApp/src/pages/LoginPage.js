import { createAtomVisual } from '../components/AtomVisual.js';

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

export function renderLoginPage({ onLogin, onNavigate } = {}) {
  const page = document.createElement('section');
  page.className = 'page auth-page auth-shell login-page';
  page.setAttribute('aria-labelledby', 'login-title');

  const intro = document.createElement('section');
  intro.className = 'auth-intro';
  intro.setAttribute('aria-label', 'ยินดีต้อนรับกลับ');
  intro.innerHTML = `
    <span class="auth-badge">Welcome back</span>
    <p class="auth-kicker">เรียนต่อจากจุดที่ค้างไว้</p>
    <h1 id="login-title">กลับเข้าสู่พื้นที่ฝึกและทบทวนของคุณ</h1>
    <p class="auth-lead">ลงชื่อเข้าใช้เพื่อกลับไปยังบัญชีและพื้นที่เรียนรู้ส่วนตัวของคุณ</p>
    <ol class="flow-list" aria-label="ขั้นตอนการใช้งาน">
      <li><span>01</span><p><strong>เข้าสู่ระบบ</strong>ใช้บัญชีที่คุณสร้างไว้</p></li>
      <li><span>02</span><p><strong>เปิดพื้นที่ของคุณ</strong>ไปต่อจากจุดที่เรียนค้างไว้</p></li>
      <li><span>03</span><p><strong>ทบทวนได้ทุกเวลา</strong>จัดการบัญชีและโปรไฟล์ได้เอง</p></li>
    </ol>
  `;

  const card = document.createElement('section');
  card.className = 'auth-card';
  card.setAttribute('aria-label', 'แบบฟอร์มเข้าสู่ระบบ');
  card.innerHTML = `
    <div class="auth-card__heading">
      <p>SynapseSync access</p>
      <h2>เข้าสู่ระบบ</h2>
      <span>กรอกอีเมลและรหัสผ่านของคุณ</span>
    </div>
    <form class="form-card auth-form" novalidate>
      <div class="field">
        <label for="login-email">อีเมล</label>
        <input id="login-email" name="email" type="email" autocomplete="username" inputmode="email" placeholder="name@university.ac.th" required />
      </div>
      <div class="field">
        <label for="login-password">รหัสผ่าน</label>
        <div class="password-input">
          <input id="login-password" name="password" type="password" autocomplete="current-password" required />
          <button class="password-toggle" type="button" data-action="toggle-login-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.25-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.25 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>
            <span data-toggle-label>แสดง</span>
          </button>
        </div>
      </div>
      <p class="form-message" role="status" aria-live="polite"></p>
      <button class="button button-primary button-wide" type="submit">เข้าสู่ระบบ <span aria-hidden="true">→</span></button>
    </form>
    <p class="switch-link">ยังไม่มีบัญชี? <span class="auth-link-placeholder"></span></p>
  `;

  const password = card.querySelector('#login-password');
  const toggle = card.querySelector('[data-action="toggle-login-password"]');
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    toggle.querySelector('[data-toggle-label]').textContent = visible ? 'ซ่อน' : 'แสดง';
  });
  card.querySelector('.auth-link-placeholder').replaceWith(createRouteLink('สมัครสมาชิก', '/register', onNavigate));

  const form = card.querySelector('form');
  const message = form.querySelector('.form-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    message.textContent = '';
    try {
      await onLogin?.({
        email: form.elements.email.value,
        password: form.elements.password.value,
      });
    } catch (error) {
      message.dataset.state = 'error';
      message.textContent = error?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally {
      submitButton.disabled = false;
    }
  });

  intro.append(createAtomVisual());
  page.append(intro, card);
  return page;
}
