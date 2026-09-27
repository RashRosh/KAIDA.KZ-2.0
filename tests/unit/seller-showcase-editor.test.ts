import { describe, expect, it } from 'vitest';
import { formatPack, packFromColumns, samePack } from '../../src/modules/offers/pack/pack';
import { normalizeOfferTitle, offerTitleSearchText, queryWords, titleMatchesQuery } from '../../src/modules/offers/title/offer-title';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import {
  createBody,
  draftPayload,
  emptyCardValues,
  keepsLink,
  updateBody,
  validateCard,
  valuesFromDraft,
  type CardValues,
} from '../../src/app/seller/_components/card-editor-state';
import { groupCards, missingDraftFields, pluralKey } from '../../src/app/seller/_components/card-model';
import { pluralForm } from '../../src/i18n/format';
import type { SellerOfferView } from '../../src/modules/offers/contracts/seller-offer.contract';

// seller-showcase-editor §7 (unit): word matching, pack/unit rules, editor state, plural forms.

describe('title words', () => {
  it('normalizes the title and its search words (case, ё, punctuation)', () => {
    expect(normalizeOfferTitle('  Баранина,   лопатка ')).toBe('Баранина, лопатка');
    expect(offerTitleSearchText('Мёд «Горный», 500г')).toBe('мед горный 500г');
  });

  it('finds a title when every query word starts one of its words', () => {
    const title = offerTitleSearchText('Баранина, лопатка');
    expect(titleMatchesQuery(title, queryWords('баран'))).toBe(true);
    expect(titleMatchesQuery(title, queryWords('ЛОПАТ баранина'))).toBe(true);
    expect(titleMatchesQuery(title, queryWords('аранина'))).toBe(false);
    expect(titleMatchesQuery(title, queryWords('баранина свежая'))).toBe(false);
    expect(titleMatchesQuery(offerTitleSearchText('Мёд'), queryWords('мед'))).toBe(true);
  });

  it('ignores 1-letter query words', () => {
    expect(queryWords('б')).toEqual([]);
    expect(queryWords('мясо б')).toEqual(['мясо']);
  });
});

describe('pack and unit rules', () => {
  it('formats and compares packs', () => {
    expect(formatPack(packFromColumns('0.600', 'kg'))).toBe('0,6 кг');
    expect(formatPack(packFromColumns('500', 'g'), 'kk')).toBe('500 г');
    expect(samePack({ amount: '500.0', unit: 'g' }, { amount: '500', unit: 'g' })).toBe(true);
    expect(samePack(null, { amount: '500', unit: 'g' })).toBe(false);
  });

  it('accepts a pack only for packages and pieces and «Другое» only as one word', () => {
    const card = { title: 'Курага', productId: null, price: '1800', unit: { code: 'package' }, pack: { amount: '500', unit: 'g' }, sellerComment: '', photoIds: [], points: [{ locationId: '00000000-0000-4000-8000-000000000001' }] };
    expect(cardCreateBodySchema.safeParse(card).success).toBe(true);
    expect(cardCreateBodySchema.safeParse({ ...card, unit: { code: 'liter' } }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...card, pack: null, unit: { code: 'other', value: 'связка' } }).success).toBe(true);
    expect(cardCreateBodySchema.safeParse({ ...card, pack: null, unit: { code: 'other', value: 'большая связка' } }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...card, pack: null, unit: { code: 'other', value: 'а'.repeat(21) } }).success).toBe(false);
  });
});

function filled(patch: Partial<CardValues> = {}): CardValues {
  return {
    ...emptyCardValues(),
    title: 'Баранина, лопатка',
    amount: '5 000',
    unit: { code: 'kg', custom: '' },
    points: { a: { selected: true, ownPrice: null }, b: { selected: true, ownPrice: '5 200' } },
    ...patch,
  };
}

describe('card editor state', () => {
  it('reports every missing required field on an empty new card', () => {
    const { errors, payload } = validateCard(emptyCardValues(), 'create', 2);
    expect(payload).toBeNull();
    expect(errors).toEqual({ title: 'card.nameRequired', price: 'card.priceRequired', unit: 'card.unitRequired', points: 'card.pointChoose' });
    expect(validateCard(emptyCardValues(), 'create', 0).errors.points).toBe('card.pointRequired');
  });

  it('builds the create body with the common price and an own price', () => {
    const values = filled();
    const { payload } = validateCard(values, 'create', 2);
    expect(createBody(values, payload!, ['p1'], 'draft-1')).toEqual({
      title: 'Баранина, лопатка', productId: null, price: '5000', unit: { code: 'kg' }, pack: null, sellerComment: '',
      photoIds: ['p1'], points: [{ locationId: 'a' }, { locationId: 'b', ownPrice: '5200' }], draftId: 'draft-1',
    });
  });

  it('keeps a chosen suggestion only while the title starts with it', () => {
    expect(keepsLink('Баранина, лопатка', 'Баранина')).toBe(true);
    expect(keepsLink('Говядина', 'Баранина')).toBe(false);
    const { payload } = validateCard(filled({ productId: 'lamb', linkedName: 'Баранина', title: 'Курага' }), 'create', 2);
    expect(payload?.productId).toBeNull();
  });

  it('drops the pack when the unit does not take one and sends the chosen points on edit', () => {
    const { payload } = validateCard(filled({ packOpen: true, packAmount: '600' }), 'edit', 2);
    expect(payload?.pack).toBeNull();
    const values = filled({ unit: { code: 'package', custom: '' }, packOpen: true, packAmount: '600', applyPrice: { o2: false }, points: { c: { selected: true, ownPrice: null } } });
    const edit = validateCard(values, 'edit', 3);
    expect(edit.payload?.pack).toEqual({ amount: '600', unit: 'g' });
    expect(updateBody(values, edit.payload!, [], [{ id: 'o1', revision: 2 }, { id: 'o2', revision: 5 }])).toMatchObject({
      offers: [{ offerId: 'o1', revision: 2, applyPrice: true }, { offerId: 'o2', revision: 5, applyPrice: false }],
      addPoints: ['c'],
    });
  });

  it('round-trips a draft and lists what it still needs', () => {
    const values = filled({ amount: '', unit: { code: '', custom: '' } });
    const payload = draftPayload(values, ['p1']);
    expect(missingDraftFields(payload)).toEqual(['showcase.fieldPrice', 'showcase.fieldUnit']);
    const back = valuesFromDraft(payload, new Set(['a']));
    expect(back.title).toBe('Баранина, лопатка');
    expect(Object.keys(back.points)).toEqual(['a']);
  });
});

describe('showcase', () => {
  const offer = (id: string, cardId: string, point: string, amount: string, own: boolean, updatedAt: string): SellerOfferView => ({
    id, cardId, revision: 1, priceOwn: own, pack: null, packLabel: null, removal: null,
    product: { id: null, name: 'Курага' },
    location: { id: point, name: point, addressText: '' },
    price: { amount, currency: 'KZT', unit: 'кг', unitChoice: { code: 'kg' } },
    sellerComment: null, status: 'active', lastConfirmedAt: updatedAt, updatedAt, buyerVisible: true,
  });

  it('groups Offers of one card with the common price, newest change first', () => {
    const cards = groupCards([
      offer('1', 'c1', 'Б', '1800', false, '2026-09-27T01:00:00Z'),
      offer('2', 'c1', 'А', '2000', true, '2026-09-27T03:00:00Z'),
      offer('3', 'c2', 'А', '900', false, '2026-09-27T02:00:00Z'),
    ]);
    expect(cards.map((card) => [card.cardId, card.offers.length, card.commonPrice])).toEqual([['c1', 2, '1800'], ['c2', 1, '900']]);
  });

  it('uses Russian plural forms', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map(pluralForm)).toEqual(['one', 'few', 'many', 'many', 'one', 'few', 'many']);
    expect(pluralKey('card.willCreate', 3)).toBe('card.willCreate.few');
  });
});
