import { describe, expect, it } from 'vitest';
import { lineDifferences, preselectedForReturn, returnEligible } from '../../src/modules/seller-input/application/match-duplicates';
import type { DuplicateCandidate, DuplicateLineInput } from '../../src/modules/seller-input/contracts/duplicates.contract';

const line: DuplicateLineInput = { title: 'Сыр', price: '3000', unit: { code: 'package' }, pack: { amount: '400', unit: 'g' }, uncertain: [] };
const card = { status: 'inactive' as const, product: { id: null, name: 'Сыр' }, removal: null,
  pack: { amount: '400', unit: 'g' as const }, price: { amount: '2900', currency: 'KZT' as const, unit: 'упак.', unitChoice: { code: 'package' as const } } };
const candidate = (input: DuplicateLineInput): DuplicateCandidate => ({ offerId: 'o', revision: 1, cardId: 'c', title: 'Сыр', packLabel: '400 г',
  price: card.price, status: 'off', priceEligible: false, returnEligible: returnEligible(input, card), packKnown: true, differences: lineDifferences(input, card) });

describe('return eligibility and strict pre-selection', () => {
  it.each(['2900', '3000', null])('same, different or absent price %s permits a single exact match', (price) => {
    const input = { ...line, price };
    expect(returnEligible(input, card)).toBe(true);
    expect(preselectedForReturn(input, [candidate(input)])).toBe('o');
  });
  it('unknown unit, uncertain unit, active or operator-removed card never permits a return', () => {
    expect(returnEligible({ ...line, unit: null }, card)).toBe(false);
    expect(returnEligible({ ...line, uncertain: ['unit'] }, card)).toBe(false);
    expect(returnEligible(line, { ...card, status: 'active' })).toBe(false);
    expect(returnEligible(line, { ...card, removal: { reason: 'other', comment: null, removedAt: new Date().toISOString() } })).toBe(false);
  });
  it('unknown pack, ambiguous name, several candidates and possibly merged lines need a manual choice', () => {
    for (const input of [{ ...line, pack: null }, { ...line, title: 'Сыр домашний' }, { ...line, possiblyMerged: true }]) {
      expect(preselectedForReturn(input, [candidate(input)])).toBeNull();
    }
    expect(preselectedForReturn(line, [candidate(line), { ...candidate(line), offerId: 'other' }])).toBeNull();
  });
  it('a conflict price and a blocked card are never pre-selected', () => {
    const input = { ...line, price: null, priceChoices: ['3000', '3100'] };
    expect(preselectedForReturn(input, [candidate(input)])).toBeNull();
    expect(preselectedForReturn(line, [{ ...candidate(line), blocked: { kind: 'contradiction' } }])).toBeNull();
  });
});
