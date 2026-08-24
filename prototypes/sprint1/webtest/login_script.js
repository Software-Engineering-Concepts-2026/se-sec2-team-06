// Login prototype: the values are validated only in this page and are not stored.
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginStatus = document.getElementById('login-status');
const loginButton = document.getElementById('login-btn');

const loginFields = [loginEmail, loginPassword];
const loginEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clearLoginErrors() {
  loginFields.forEach((field) => {
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
  });
  loginStatus.textContent = '';
  loginStatus.removeAttribute('data-state');
}

function showLoginError(message, fields) {
  fields.forEach((field) => {
    field.classList.add('field-error');
    field.setAttribute('aria-invalid', 'true');
  });
  loginStatus.textContent = message;
  loginStatus.dataset.state = 'error';
  fields[0].focus();
}

loginFields.forEach((field) => {
  field.addEventListener('input', () => {
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
    loginStatus.textContent = '';
    loginStatus.removeAttribute('data-state');
  });
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearLoginErrors();

  const emptyFields = loginFields.filter((field) => field.value.trim() === '');
  if (emptyFields.length > 0) {
    showLoginError('กรุณากรอกอีเมลและรหัสผ่านให้ครบ', emptyFields);
    return;
  }

  if (!loginEmailPattern.test(loginEmail.value.trim())) {
    showLoginError('กรุณากรอกอีเมลในรูปแบบที่ถูกต้อง', [loginEmail]);
    return;
  }

  loginForm.reset();
  loginButton.disabled = true;
  loginStatus.textContent = 'เข้าสู่ระบบจำลองสำเร็จ กำลังเปิดหน้าหลัก…';
  loginStatus.dataset.state = 'success';

  window.setTimeout(() => {
    window.location.replace('home.html?v=20260824-5');
  }, 450);
});
