import { describe, expect, it } from 'vitest';
import {
  batchTotal,
  formatWholesaleBatch,
  sameWholesale,
  wholesaleFromColumns,
  wholesaleInputSchema,
  wholesaleToColumns,
  type Wholesale,
} from '../../src/modules/offers/wholesale/wholesale';
import { cardCreateBodySchema, cardUpdateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { offerDraftPayloadSchema } from '../../src/modules/offers/drafts/offer-draft.contract';
import {
  createBody,
  draftPayload,
  emptyCardValues,
  emptyWholesaleDraft,
  markWholesaleReview,
  previewBody,
  updateBody,
  validateCard,
  validateWholesale,
  valuesFromChangeSet,
  valuesFromDraft,
  wholesaleBasisKey,
  type CardValues,
  type WholesaleDraft,
} from '../../src/app/seller/_components/card-editor-state';
import { messages } from '../../src/i18n/messages';

// wholesale-price §9 (unit): input schema and consistency, container forms ru / kk, «Другое» without declension,
// the total of the minimum batch, and the editor rules of the wholesale sheet.

const NBSP = ' ';
const ws = (patch: Partial<Wholesale> = {}): Wholesale => ({
  amount: '650', batchCount: 1, container: 'box', containerText: null, perContainer: '10', ...patch,
});
const plain = (text: string) => text.replaceAll(NBSP, ' ');

describe('wholesale input schema', () => {
  it('accepts a listed container with its quantity and canonicalizes the decimals', () => {
    expect(wholesaleInputSchema.parse({ amount: '650.50', batchCount: 2, container: 'box', perContainer: '10.500' }))
      .toEqual({ amount: '650.5', batchCount: 2, container: 'box', containerText: null, perContainer: '10.5' });
  });

  it('accepts the retail unit itself without a quantity', () => {
    expect(wholesaleInputSchema.parse({ amount: '600', batchCount: 10, container: 'unit' }))
      .toEqual({ amount: '600', batchCount: 10, container: 'unit', containerText: null, perContainer: null });
  });

  it('accepts «Другое» with its own text', () => {
    expect(wholesaleInputSchema.parse({ amount: '500', batchCount: 3, container: 'other', containerText: ' бидон ', perContainer: '40' }).containerText).toBe('бидон');
  });

  it.each([
    ['zero price', { amount: '0', batchCount: 1, container: 'box', perContainer: '10' }],
    ['batch 0', { amount: '650', batchCount: 0, container: 'box', perContainer: '10' }],
    ['batch 10 000', { amount: '650', batchCount: 10000, container: 'box', perContainer: '10' }],
    ['fractional batch', { amount: '650', batchCount: 1.5, container: 'box', perContainer: '10' }],
    ['box without quantity', { amount: '650', batchCount: 1, container: 'box' }],
    ['unit with quantity', { amount: '650', batchCount: 1, container: 'unit', perContainer: '1' }],
    ['other without text', { amount: '650', batchCount: 1, container: 'other', perContainer: '1' }],
    ['text without other', { amount: '650', batchCount: 1, container: 'box', containerText: 'бидон', perContainer: '1' }],
    ['text over 20', { amount: '650', batchCount: 1, container: 'other', containerText: 'б'.repeat(21), perContainer: '1' }],
    ['zero quantity', { amount: '650', batchCount: 1, container: 'box', perContainer: '0' }],
    ['four decimals', { amount: '650', batchCount: 1, container: 'box', perContainer: '1.0001' }],
    ['unknown container', { amount: '650', batchCount: 1, container: 'barrel', perContainer: '1' }],
    ['extra key', { amount: '650', batchCount: 1, container: 'unit', note: 'x' }],
  ])('rejects %s', (_name, body) => {
    expect(wholesaleInputSchema.safeParse(body).success).toBe(false);
  });

  it('round-trips through the columns and compares canonically', () => {
    const value = ws({ amount: '650.5', perContainer: '10.25' });
    expect(wholesaleFromColumns(wholesaleToColumns(value))).toEqual(value);
    expect(wholesaleFromColumns(wholesaleToColumns(null))).toBeNull();
    expect(sameWholesale(value, { ...value, amount: '650.50' })).toBe(true);
    expect(sameWholesale(value, { ...value, batchCount: 2 })).toBe(false);
    expect(sameWholesale(value, null)).toBe(false);
    expect(sameWholesale(null, null)).toBe(true);
  });
});

describe('the buyer batch line (§3.2)', () => {
  it.each([
    [1, 'от 1 ящика (≈ 10 кг)'],
    [2, 'от 2 ящиков (≈ 20 кг)'],
    [5, 'от 5 ящиков (≈ 50 кг)'],
    [11, 'от 11 ящиков (≈ 110 кг)'],
    [21, 'от 21 ящика (≈ 210 кг)'],
    [111, 'от 111 ящиков (≈ 1110 кг)'],
  ])('ru forms after «от» for %i', (batchCount, text) => {
    expect(plain(formatWholesaleBatch(ws({ batchCount }), 'кг'))).toBe(text);
  });

  it.each([
    ['bag', 'от 2 мешков (≈ 20 кг)'],
    ['carton', 'от 2 коробок (≈ 20 кг)'],
    ['net', 'от 2 сеток (≈ 20 кг)'],
    ['package', 'от 2 упаковок (≈ 20 кг)'],
  ] as const)('ru forms of %s', (container, text) => {
    expect(plain(formatWholesaleBatch(ws({ container, batchCount: 2 }), 'кг'))).toBe(text);
  });

  it('kk uses «кемінде» and the undeclined name', () => {
    expect(plain(formatWholesaleBatch(ws({ batchCount: 21 }), 'кг', 'kk'))).toBe('кемінде 21 жәшік (≈ 210 кг)');
  });

  it('the retail unit as container has no brackets', () => {
    expect(plain(formatWholesaleBatch(ws({ container: 'unit', batchCount: 10, perContainer: null }), 'кг'))).toBe('от 10 кг');
  });

  it('«Другое» is not declined', () => {
    expect(plain(formatWholesaleBatch(ws({ container: 'other', containerText: 'бидон', batchCount: 3, perContainer: '40' }), 'л'))).toBe('от 3 × бидон (≈ 120 л)');
  });

  it('the total is exact with decimals and uses a decimal comma', () => {
    expect(batchTotal(ws({ batchCount: 3, perContainer: '0.333' }))).toBe('0.999');
    expect(batchTotal(ws({ batchCount: 7, perContainer: '1.1' }))).toBe('7.7');
    expect(plain(formatWholesaleBatch(ws({ batchCount: 7, perContainer: '1.1' }), 'кг'))).toBe('от 7 ящиков (≈ 7,7 кг)');
  });

  it('keeps the number with its word (no break inside «1 ящика» or «10 кг»)', () => {
    const text = formatWholesaleBatch(ws(), 'кг');
    expect(text).toContain(`1${NBSP}ящика`);
    expect(text).toContain(`10${NBSP}кг`);
  });

  it('every new message key has a Kazakh text', () => {
    const keys = Object.keys(messages.ru).filter((key) => key.startsWith('wholesale.') || key === 'offer.wholesaleTag' || key.startsWith('actuality.confirm'));
    for (const key of keys) expect((messages.kk as Record<string, string>)[key], key).toBeTruthy();
  });
});

describe('the card API body', () => {
  const base = { title: 'Перец болгарский', productId: null, price: '900', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [] };

  it('create: omitted wholesale means none', () => {
    const parsed = cardCreateBodySchema.parse({ ...base, points: [{ locationId: '00000000-0000-4000-8000-000000000001' }] });
    expect(parsed.wholesale).toBeNull();
  });

  it('update: omitted keeps the card’s wholesale, null removes it', () => {
    const update = { ...base, offers: [{ offerId: '00000000-0000-4000-8000-000000000001', revision: 1, applyPrice: true }], addPoints: [] };
    expect(cardUpdateBodySchema.parse(update).wholesale).toBeUndefined();
    expect(cardUpdateBodySchema.parse({ ...update, wholesale: null }).wholesale).toBeNull();
    expect(cardUpdateBodySchema.parse({ ...update, wholesale: { amount: '650', batchCount: 1, container: 'box', perContainer: '10' } }).wholesale)
      .toEqual(ws());
  });
});

describe('the wholesale sheet in the editor (§3.1)', () => {
  const draft = (patch: Partial<WholesaleDraft> = {}): WholesaleDraft => ({
    amount: '650', batchCount: '1', container: 'box', containerText: '', perContainer: '10', needsReview: false, ...patch,
  });

  it('a complete sheet gives the API input', () => {
    expect(validateWholesale(draft({ amount: '1 650,5', perContainer: '10,5' })).input)
      .toEqual({ amount: '1650.5', batchCount: 1, container: 'box', perContainer: '10.5' });
    expect(validateWholesale(draft({ container: 'unit', perContainer: '', batchCount: '10' })).input)
      .toEqual({ amount: '650', batchCount: 10, container: 'unit' });
    expect(validateWholesale(draft({ container: 'other', containerText: ' бидон ', perContainer: '40' })).input)
      .toEqual({ amount: '650', batchCount: 1, container: 'other', containerText: 'бидон', perContainer: '40' });
  });

  it('is not saved without a price, a batch or the quantity in a container; each error is on its field', () => {
    expect(validateWholesale(draft({ amount: '' })).errors).toEqual({ amount: 'card.priceRequired' });
    expect(validateWholesale(draft({ batchCount: '' })).errors).toEqual({ batch: 'wholesale.batchInvalid' });
    expect(validateWholesale(draft({ batchCount: '0' })).errors).toEqual({ batch: 'wholesale.batchInvalid' });
    expect(validateWholesale(draft({ perContainer: '' })).errors).toEqual({ perContainer: 'wholesale.perContainerRequired' });
    expect(validateWholesale(draft({ perContainer: '0' })).errors).toEqual({ perContainer: 'card.packInvalid' });
    expect(validateWholesale(draft({ container: 'other', containerText: '  ' })).errors).toEqual({ containerText: 'wholesale.containerTextRequired' });
    expect(validateWholesale(draft({ container: '' })).input).toBeNull();
  });

  it('allows a wholesale price above the retail price (no comparison)', () => {
    expect(validateWholesale(draft({ amount: '99999' })).input).not.toBeNull();
  });

  it('a change of the unit or pack clears the quantity and asks for a review', () => {
    expect(markWholesaleReview(draft())).toEqual(draft({ perContainer: '', needsReview: true }));
    expect(markWholesaleReview(draft({ container: 'unit', perContainer: '' }))).toEqual(draft({ container: '', perContainer: '', needsReview: true }));
    const values: CardValues = { ...emptyCardValues(), unit: { code: 'piece', custom: '' } };
    expect(wholesaleBasisKey(values)).toBe(wholesaleBasisKey({ ...values, packOpen: true, packAmount: '' }));
    expect(wholesaleBasisKey(values)).not.toBe(wholesaleBasisKey({ ...values, packOpen: true, packAmount: '500' }));
    expect(wholesaleBasisKey(values)).not.toBe(wholesaleBasisKey({ ...values, unit: { code: 'kg', custom: '' } }));
  });

  const card = (wholesale: WholesaleDraft | null): CardValues => ({
    ...emptyCardValues(), title: 'Перец болгарский', amount: '900', unit: { code: 'kg', custom: '' },
    points: { '00000000-0000-4000-8000-000000000001': { selected: true, ownPrice: null } }, wholesale,
  });

  it('the card cannot be saved while the wholesale awaits a review', () => {
    const result = validateCard(card(draft({ perContainer: '', needsReview: true })), 'create', 1);
    expect(result.payload).toBeNull();
    expect(result.errors).toEqual({ wholesale: 'wholesale.reviewRequired' });
    expect(validateCard(card(draft({ perContainer: '' })), 'create', 1).errors).toEqual({ wholesale: 'wholesale.incomplete' });
  });

  it('create and update bodies carry the wholesale; update always sends it explicitly', () => {
    const { payload } = validateCard(card(draft()), 'create', 1);
    expect(cardCreateBodySchema.parse(createBody(card(draft()), payload!, [], null)).wholesale).toEqual(ws());
    const removed = validateCard(card(null), 'edit', 1).payload!;
    const body = updateBody(card(null), removed, [], [{ id: '00000000-0000-4000-8000-000000000002', revision: 3 }]);
    expect(body.wholesale).toBeNull();
    expect(cardUpdateBodySchema.parse(body).wholesale).toBeNull();
  });

  it('a draft keeps the sheet as typed, also an unfinished one', () => {
    const typed = card(draft({ perContainer: '', needsReview: true }));
    const payload = offerDraftPayloadSchema.parse(draftPayload(typed, []));
    expect(valuesFromDraft(payload, new Set(Object.keys(typed.points))).wholesale).toEqual(typed.wholesale);
    const older = offerDraftPayloadSchema.parse({ ...draftPayload(card(null), []), wholesale: undefined });
    expect(valuesFromDraft(older, new Set()).wholesale).toBeNull();
  });

  it('«Вернуться к правке» restores the wholesale of the proposal', () => {
    const restored = valuesFromChangeSet({ items: [{
      action: 'create_offer', product: { id: null, name: 'Перец' }, location: { id: 'l1' },
      price: { amount: '900', unitChoice: { code: 'kg' } }, priceOwn: false, pack: null, sellerComment: null, wholesale: ws(),
    }] }, new Map());
    expect(restored?.values.wholesale).toEqual(draft());
  });

  it('the preview shows only a valid, reviewed wholesale', () => {
    expect(previewBody(card(draft()), { kind: 'create' }, []).wholesale).toEqual({ amount: '650', batchCount: 1, container: 'box', perContainer: '10' });
    expect(previewBody(card(draft({ needsReview: true })), { kind: 'create' }, []).wholesale).toBeNull();
    expect(previewBody(card(emptyWholesaleDraft()), { kind: 'create' }, []).wholesale).toBeNull();
  });
});
