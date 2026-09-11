import { describe, expect, it } from 'vitest';
import { InvalidPhoneError, normalizeKzPhone } from '../../src/modules/identity/phone/normalize-phone';

describe('Identity phone normalization', () => {
  it.each([
    '+77001234567',
    '+7 700 123 45 67',
    '7 700 123 45 67',
    '87001234567',
    '8 (700) 123-45-67',
    '  +7 (700) 123-45-67  ',
  ])('normalizes %s to one canonical phone', (input) => {
    expect(normalizeKzPhone(input)).toBe('+77001234567');
  });

  it.each(['', '7001234567', '+996700123456', '8700123456', '870012345678', '+7 700 ABC 45 67', '+77001234567 ext 2'])('rejects invalid input %s', (input) => {
    expect(() => normalizeKzPhone(input)).toThrow(InvalidPhoneError);
  });
});
