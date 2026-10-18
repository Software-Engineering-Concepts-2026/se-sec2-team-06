const PASSWORD_MIN_LENGTH = 8;
const LETTER = /\p{L}/u;
const NUMBER = /\p{N}/u;
const UPPERCASE = /\p{Lu}/u;
const LOWERCASE = /\p{Ll}/u;
const SYMBOL = /[\p{P}\p{S}]/u;

function codePointLength(value) {
  return Array.from(value).length;
}

export function getPasswordRequirements(password) {
  const value = typeof password === 'string' ? password : '';
  const length = codePointLength(value);

  return [
    { id: 'minimum-length', label: 'อย่างน้อย 8 ตัวอักษร', valid: length >= PASSWORD_MIN_LENGTH },
    { id: 'letter', label: 'มีตัวอักษรอย่างน้อย 1 ตัว', valid: LETTER.test(value) },
    { id: 'number', label: 'มีตัวเลขอย่างน้อย 1 ตัว', valid: NUMBER.test(value) },
  ];
}

export function getPasswordPolicyErrors(password) {
  return getPasswordRequirements(password)
    .filter(({ valid }) => !valid)
    .map(({ label }) => `รหัสผ่านต้อง${label}`);
}

export function getPasswordStrength(password) {
  const value = typeof password === 'string' ? password : '';
  const length = codePointLength(value);
  if (length === 0) {
    return { score: 0, maxScore: 6, label: 'เริ่มพิมพ์รหัสผ่าน', tone: 'neutral' };
  }

  const score = [
    length >= PASSWORD_MIN_LENGTH,
    length >= 12,
    UPPERCASE.test(value),
    LOWERCASE.test(value),
    NUMBER.test(value),
    SYMBOL.test(value),
  ].filter(Boolean).length;

  if (score <= 2) return { score, maxScore: 6, label: 'อ่อน', tone: 'weak' };
  if (score <= 4) return { score, maxScore: 6, label: 'ปานกลาง', tone: 'fair' };
  if (score === 5) return { score, maxScore: 6, label: 'ดี', tone: 'good' };
  return { score, maxScore: 6, label: 'แข็งแรง', tone: 'strong' };
}
