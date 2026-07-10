// ============================================
// Registration form validation — prototype only
// Matches the Five S's prompt requirements:
// 1. Prevent default form submission on Sign Up
// 2. Check Password / Confirm Password match
// 3. Alert "Passwords do not match!" if they don't
// 4. Alert "Please fill in all fields." if any field is empty
// 5. Alert "Registration successful! (This is a prototype)" if all checks pass
// ============================================

const signupForm = document.getElementById('signup-form');
const fullName = document.getElementById('full-name');
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirm-password');

signupForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const fields = [fullName, email, password, confirmPassword];
  fields.forEach(field => field.classList.remove('field-error'));

  const hasEmptyField = fields.some(field => field.value.trim() === '');
  if (hasEmptyField) {
    fields.forEach(field => {
      if (field.value.trim() === '') field.classList.add('field-error');
    });
    alert('Please fill in all fields.');
    return;
  }

  if (password.value !== confirmPassword.value) {
    password.classList.add('field-error');
    confirmPassword.classList.add('field-error');
    alert('Passwords do not match!');
    return;
  }

  alert('Registration successful! (This is a prototype)');
  window.location.href = 'login.html';
});
