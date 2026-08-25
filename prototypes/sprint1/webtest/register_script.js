// Registration prototype: validate in memory, clear the form, then continue.
// No request, cookie, localStorage, sessionStorage, or account creation occurs.
const signupForm = document.getElementById('signup-form');
const fullName = document.getElementById('full-name');
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirm-password');
const registerStatus = document.getElementById('register-status');
const signupButton = document.getElementById('signup-btn');

const signupFields = [fullName, email, password, confirmPassword];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clearSignupErrors() {
  signupFields.forEach((field) => {
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
  });
  registerStatus.textContent = '';
  registerStatus.removeAttribute('data-state');
}

function showSignupError(message, fields) {
  fields.forEach((field) => {
    field.classList.add('field-error');
    field.setAttribute('aria-invalid', 'true');
  });
  registerStatus.textContent = message;
  registerStatus.dataset.state = 'error';
  fields[0].focus();
}

signupFields.forEach((field) => {
  field.addEventListener('input', () => {
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
    registerStatus.textContent = '';
    registerStatus.removeAttribute('data-state');
  });
});

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearSignupErrors();

  const emptyFields = signupFields.filter((field) => field.value.trim() === '');
  if (emptyFields.length > 0) {
    showSignupError('กรุณากรอกข้อมูลให้ครบทุกช่อง', emptyFields);
    return;
  }

  if (!emailPattern.test(email.value.trim())) {
    showSignupError('กรุณากรอกอีเมลในรูปแบบที่ถูกต้อง', [email]);
    return;
  }

  if (password.value.length < 8) {
    showSignupError('รหัสผ่านตัวอย่างต้องมีอย่างน้อย 8 ตัวอักษร', [password]);
    return;
  }

  if (password.value !== confirmPassword.value) {
    showSignupError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน', [password, confirmPassword]);
    return;
  }

  signupForm.reset();
  signupButton.disabled = true;
  registerStatus.textContent = 'ตรวจสอบข้อมูลเรียบร้อย กำลังเปิดหน้าหลัก…';
  registerStatus.dataset.state = 'success';

  window.setTimeout(() => {
    window.location.replace('home.html?v=20260824-5');
  }, 650);
});
