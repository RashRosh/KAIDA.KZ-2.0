import { describe, expect, it } from 'vitest';
import { formatAmount } from '../../src/app/_components/OfferCard';

describe('decimal display without floating point conversion', () => {
  it.each([
    ['4200.00', '4\u00a0200'],
    ['0.00', '0'],
    ['4200.50', '4\u00a0200,5'],
    ['9007199254740993.01', '9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0993,01'],
  ])('%s → %s', (amount, display) => expect(formatAmount(amount)).toBe(display));
});
