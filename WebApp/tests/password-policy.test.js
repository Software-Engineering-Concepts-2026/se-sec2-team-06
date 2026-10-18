import { describe, expect, it } from 'vitest';

import {
  getPasswordPolicyErrors,
  getPasswordRequirements,
  getPasswordStrength,
} from '../src/auth/password-policy.js';

describe('registration password policy', () => {
  it('requires only eight characters, a letter, and a number', () => {
    expect(getPasswordRequirements('abcdefg1')).toEqual([
      { id: 'minimum-length', label: 'อย่างน้อย 8 ตัวอักษร', valid: true },
      { id: 'letter', label: 'มีตัวอักษรอย่างน้อย 1 ตัว', valid: true },
      { id: 'number', label: 'มีตัวเลขอย่างน้อย 1 ตัว', valid: true },
    ]);
    expect(getPasswordPolicyErrors('abcdefg1')).toEqual([]);
    expect(getPasswordPolicyErrors('abcdefgh')).toContain('รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว');
    expect(getPasswordPolicyErrors('12345678')).toContain('รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว');
    expect(getPasswordPolicyErrors('abc1234')).toContain('รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร');
  });

  it('recognizes Unicode letters and digits and counts code points', () => {
    expect(getPasswordPolicyErrors('猫猫猫猫猫猫猫1')).toEqual([]);
    expect(getPasswordPolicyErrors('😀😀😀😀😀😀😀1')).toContain('รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว');
  });

  it('keeps strength feedback advisory beyond the three required rules', () => {
    expect(getPasswordPolicyErrors('StudyPlan42!')).toEqual([]);
    expect(getPasswordStrength('StudyPlan42!')).toEqual({
      score: 6,
      maxScore: 6,
      label: 'แข็งแรง',
      tone: 'strong',
    });
    expect(getPasswordStrength('abcdefg1').score).toBeLessThan(6);
  });
});
