import { describe, expect, it } from 'vitest';
import {
  OFFER_VALIDITY_PERIOD_HOURS_DEFAULT,
  readOfferValidityPeriodHours,
  validateOfferValidityPeriodHours,
} from '../../src/modules/offers/config/offer-lifecycle.config';

describe('S1 offer lifecycle configuration', () => {
  it('uses the technical 168 hour default only when the env value is missing', () => {
    expect(OFFER_VALIDITY_PERIOD_HOURS_DEFAULT).toBe(168);
    expect(readOfferValidityPeriodHours({})).toBe(168);
  });

  it.each([
    ['1', 1],
    ['168', 168],
    [1, 1],
    [168, 168],
  ])('accepts a positive integer value %p', (value, expected) => {
    expect(validateOfferValidityPeriodHours(value)).toBe(expected);
  });

  it.each([
    '0',
    '-1',
    '1.5',
    'NaN',
    'Infinity',
    '',
    '   ',
    'abc',
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects an invalid period %p', (value) => {
    expect(() => validateOfferValidityPeriodHours(value)).toThrow(/positive integer/i);
  });

  it('validates an explicitly supplied internal/test override with the same validator', () => {
    expect(validateOfferValidityPeriodHours(24)).toBe(24);
    expect(() => validateOfferValidityPeriodHours(0)).toThrow(/positive integer/i);
  });

  it('validates an env value through the same contract instead of coercing it silently', () => {
    expect(readOfferValidityPeriodHours({ OFFER_VALIDITY_PERIOD_HOURS: '24' })).toBe(24);
    expect(() => readOfferValidityPeriodHours({ OFFER_VALIDITY_PERIOD_HOURS: '0' })).toThrow(/positive integer/i);
  });
});
