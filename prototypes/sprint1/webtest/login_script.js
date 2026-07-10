// ============================================
// Login form — prototype only, no real auth.
// Checks that fields aren't empty, then redirects to home.html
// ============================================

const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const fields = [loginEmail, loginPassword];
  fields.forEach(field => field.classList.remove('field-error'));

  const hasEmptyField = fields.some(field => field.value.trim() === '');
  if (hasEmptyField) {
    fields.forEach(field => {
      if (field.value.trim() === '') field.classList.add('field-error');
    });
    alert('กรุณากรอกอีเมลและรหัสผ่านให้ครบ');
    return;
  }

  // Prototype: no real authentication — any non-empty input logs in.
  window.location.href = 'home.html';
});
