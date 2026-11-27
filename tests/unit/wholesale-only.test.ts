import { describe, expect, it } from 'vitest';
import { unsetOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import {
  formatWholesaleBatch,
  wholesaleFlexibleInputSchema,
  wholesaleNeedsPerContainer,
  type Wholesale,
} from '../../src/modules/offers/wholesale/wholesale';
import { cardCreateBodySchema, cardUpdateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { cardPreviewBodySchema } from '../../src/modules/seller-input/contracts/card-preview.contract';
import { offerDraftPayloadSchema } from '../../src/modules/offers/drafts/offer-draft.contract';
import { searchOfferSchema, type SearchOffer } from '../../src/modules/search/contracts/search.contract';
import { rankSearchOfferCandidates, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';
import {
  createBody,
  draftPayload,
  emptyCardValues,
  previewAvailability,
  previewBody,
  updateBody,
  validateCard,
  validateWholesale,
  valuesFromChangeSet,
  valuesFromDraft,
  type CardValues,
  type WholesaleDraft,
} from '../../src/app/seller/_components/card-editor-state';
import { missingDraftFields } from '../../src/app/seller/_components/card-model';
import { messages } from '../../src/i18n/messages';

// wholesale-only §7 (unit): flexible wholesale schema, batch formatting without perContainer,
// card & preview & SearchOffer schemas, price sort partitioning (retail before wholesale-only),
// and editor state rules for «Только оптом».

const NBSP = ' ';
const plain = (text: string) => text.replaceAll(NBSP, ' ');
const UUID1 = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';

describe('wholesale-only domain & schemas', () => {
  it('flexible wholesale schema allows non-unit container without perContainer, still forbids unit with perContainer', () => {
    const parsed = wholesaleFlexibleInputSchema.parse({ amount: '450', batchCount: 1, container: 'bag' });
    expect(parsed).toEqual({ amount: '450', batchCount: 1, container: 'bag', containerText: null, perContainer: null });
    expect(wholesaleNeedsPerContainer(parsed)).toBe(true);

    const withPer = wholesaleFlexibleInputSchema.parse({ amount: '450', batchCount: 1, container: 'bag', perContainer: '20' });
    expect(wholesaleNeedsPerContainer(withPer)).toBe(false);

    const unitContainer = wholesaleFlexibleInputSchema.parse({ amount: '450', batchCount: 10, container: 'unit' });
    expect(wholesaleNeedsPerContainer(unitContainer)).toBe(false);

    expect(wholesaleFlexibleInputSchema.safeParse({ amount: '450', batchCount: 10, container: 'unit', perContainer: '5' }).success).toBe(false);
    expect(wholesaleFlexibleInputSchema.safeParse({ amount: '450', batchCount: 1, container: 'bag', perContainer: '0' }).success).toBe(false);
    expect(wholesaleFlexibleInputSchema.safeParse({ amount: '450', batchCount: 1, container: 'other' }).success).toBe(false);
  });

  it('formats minimum batch without brackets when perContainer is null', () => {
    const bag: Wholesale = { amount: '450', batchCount: 1, container: 'bag', containerText: null, perContainer: null };
    expect(plain(formatWholesaleBatch(bag, 'кг', 'ru'))).toBe('от 1 мешка');
    expect(plain(formatWholesaleBatch({ ...bag, batchCount: 2 }, 'кг', 'ru'))).toBe('от 2 мешков');
    expect(plain(formatWholesaleBatch(bag, 'кг', 'kk'))).toBe('кемінде 1 қап');
    expect(plain(formatWholesaleBatch({ ...bag, container: 'other', containerText: 'бидон', batchCount: 3 }, 'л', 'ru'))).toBe('от 3 × бидон');
  });

  it('card create/update schemas enforce retail OR wholesale, perContainer when mixed, and no ownPrice on wholesale-only', () => {
    const base = { title: 'Томаты опт', productId: null, unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [] };

    // Wholesale-only without perContainer succeeds on create & update.
    const created = cardCreateBodySchema.parse({
      ...base, price: null, points: [{ locationId: UUID1 }],
      wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    });
    expect(created.price).toBeNull();
    expect(created.wholesale?.perContainer).toBeNull();

    // Neither retail nor wholesale is rejected.
    expect(cardCreateBodySchema.safeParse({ ...base, price: null, points: [{ locationId: UUID1 }] }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...base, price: null, points: [{ locationId: UUID1 }], wholesale: null }).success).toBe(false);
    expect(cardUpdateBodySchema.safeParse({ ...base, price: null, offers: [{ offerId: UUID1, revision: 1, applyPrice: true }], addPoints: [], wholesale: null }).success).toBe(false);

    // Mixed retail + wholesale without perContainer is rejected.
    expect(cardCreateBodySchema.safeParse({
      ...base, price: '600', points: [{ locationId: UUID1 }],
      wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    }).success).toBe(false);

    // Point ownPrice on wholesale-only is rejected.
    expect(cardCreateBodySchema.safeParse({
      ...base, price: null, points: [{ locationId: UUID1, ownPrice: '500' }],
      wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    }).success).toBe(false);
  });

  it('card preview schema accepts wholesale-only with unit and rejects missing unit or missing both prices', () => {
    const base = { kind: 'create', title: 'Томаты опт', pack: null, sellerComment: '', photoIds: [], points: [{ locationId: UUID1 }] };
    expect(cardPreviewBodySchema.safeParse({
      ...base, price: null, unit: { code: 'kg' }, wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    }).success).toBe(true);
    expect(cardPreviewBodySchema.safeParse({
      ...base, price: null, unit: null, wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    }).success).toBe(false);
    expect(cardPreviewBodySchema.safeParse({
      ...base, price: null, unit: { code: 'kg' }, wholesale: null,
    }).success).toBe(false);
  });

  it('SearchOffer schema accepts price: null when wholesale is present and rejects price: null without wholesale', () => {
    const base = {
      id: UUID1,
      product: { id: null, name: 'Томаты опт' },
      seller: { id: UUID1, displayName: 'Опт' },
      location: { id: UUID2, name: 'Базар', addressText: 'Алматы', openingHours: unsetOpeningHours() },
      sellerComment: null,
      routeAvailable: false,
    };
    expect(searchOfferSchema.safeParse({
      ...base, price: null, wholesale: { amount: '450', currency: 'KZT', unit: 'кг', batch: 'от 1 мешка' },
    }).success).toBe(true);
    expect(searchOfferSchema.safeParse({ ...base, price: null }).success).toBe(false);
  });

  it('every new RU i18n key has a KK translation', () => {
    const keys = Object.keys(messages.ru).filter((key) => key.startsWith('wholesale.') || key === 'preview.needTitleWholesale');
    for (const key of keys) expect((messages.kk as Record<string, string>)[key], key).toBeTruthy();
  });
});

describe('price sorting excludes wholesale-only offers (PO 2026-11-26)', () => {
  function candidate(id: string, confirmedIso: string, price: string | null, wholesale?: string): SearchRankingCandidate {
    const offer: SearchOffer = {
      id,
      product: { id: null, name: 'Томаты' },
      seller: { id: UUID1, displayName: 'Продавец' },
      location: { id: UUID2, name: 'Точка', addressText: 'Алматы', openingHours: unsetOpeningHours() },
      price: price === null ? null : { amount: price, currency: 'KZT', unit: 'кг' },
      ...(wholesale ? { wholesale: { amount: wholesale, currency: 'KZT' as const, ...(price === null ? { unit: 'кг' } : {}), batch: 'от 1 мешка' } } : {}),
      sellerComment: null,
      routeAvailable: true,
    };
    return { offer, lastConfirmedAt: new Date(confirmedIso), locationGeo: { latitude: 43.25, longitude: 76.95 } };
  }

  const retailCheap = candidate('00000000-0000-4000-8000-000000000010', '2026-11-25T10:00:00Z', '500');
  const retailExpensive = candidate('00000000-0000-4000-8000-000000000011', '2026-11-25T11:00:00Z', '900', '400');
  const wholesaleOldCheap = candidate('00000000-0000-4000-8000-000000000012', '2026-11-25T08:00:00Z', null, '100');
  const wholesaleFreshExpensive = candidate('00000000-0000-4000-8000-000000000013', '2026-11-25T12:00:00Z', null, '5000');

  it('sort=price asc places all retail offers before wholesale-only; wholesale-only ordered by freshness', () => {
    const ranked = rankSearchOfferCandidates(
      [wholesaleOldCheap, retailExpensive, wholesaleFreshExpensive, retailCheap],
      undefined,
      { sort: 'price', direction: 'asc' },
    );
    expect(ranked.map((item) => item.offer.id)).toEqual([
      retailCheap.offer.id,
      retailExpensive.offer.id,
      wholesaleFreshExpensive.offer.id,
      wholesaleOldCheap.offer.id,
    ]);
  });

  it('sort=price desc places all retail offers before wholesale-only; wholesale-only ordered by freshness', () => {
    const ranked = rankSearchOfferCandidates(
      [wholesaleOldCheap, retailCheap, wholesaleFreshExpensive, retailExpensive],
      undefined,
      { sort: 'price', direction: 'desc' },
    );
    expect(ranked.map((item) => item.offer.id)).toEqual([
      retailExpensive.offer.id,
      retailCheap.offer.id,
      wholesaleFreshExpensive.offer.id,
      wholesaleOldCheap.offer.id,
    ]);
  });

  it('sort=actuality orders wholesale-only alongside retail by confirmation time', () => {
    const ranked = rankSearchOfferCandidates(
      [retailCheap, wholesaleFreshExpensive, wholesaleOldCheap],
      undefined,
      { sort: 'actuality', direction: 'desc' },
    );
    expect(ranked.map((item) => item.offer.id)).toEqual([
      wholesaleFreshExpensive.offer.id,
      retailCheap.offer.id,
      wholesaleOldCheap.offer.id,
    ]);
  });
});

describe('editor state for «Только оптом»', () => {
  const wsDraft = (patch: Partial<WholesaleDraft> = {}): WholesaleDraft => ({
    amount: '450', batchCount: '1', container: 'bag', containerText: '', perContainer: '', needsReview: false, ...patch,
  });

  const wholesaleCard = (patch: Partial<CardValues> = {}): CardValues => ({
    ...emptyCardValues(),
    title: 'Томаты опт',
    wholesaleOnly: true,
    unit: { code: 'kg', custom: '' },
    points: { [UUID1]: { selected: true, ownPrice: '999' } },
    wholesale: wsDraft(),
    ...patch,
  });

  it('validates wholesale-only without retail price or perContainer and strips ownPrice from createBody', () => {
    expect(validateWholesale(wsDraft(), { requirePerContainer: false }).input).toEqual({
      amount: '450', batchCount: 1, container: 'bag',
    });
    const result = validateCard(wholesaleCard(), 'create', 1);
    expect(result.errors).toEqual({});
    expect(result.payload?.price).toBeNull();
    const body = createBody(wholesaleCard(), result.payload!, [], null);
    expect(body.price).toBeNull();
    expect(body.points).toEqual([{ locationId: UUID1 }]);
    expect(cardCreateBodySchema.safeParse(body).success).toBe(true);
  });

  it('requires wholesale when wholesaleOnly is on', () => {
    const result = validateCard(wholesaleCard({ wholesale: null }), 'create', 1);
    expect(result.payload).toBeNull();
    expect(result.errors).toEqual({ wholesale: 'wholesale.required' });
  });

  it('round-trips wholesaleOnly through draftPayload, valuesFromDraft, and missingDraftFields', () => {
    const saved = offerDraftPayloadSchema.parse(draftPayload(wholesaleCard(), []));
    expect(saved.wholesaleOnly).toBe(true);
    expect(missingDraftFields(saved)).toEqual([]);
    expect(missingDraftFields({ ...saved, wholesale: null })).toContain('showcase.fieldPrice');
    const restored = valuesFromDraft(saved, new Set([UUID1]));
    expect(restored.wholesaleOnly).toBe(true);
    expect(restored.wholesale).toEqual(wsDraft());
  });

  it('restores wholesale-only from ChangeSet and builds valid previewBody', () => {
    const restored = valuesFromChangeSet({
      items: [{
        action: 'create_offer',
        product: { id: null, name: 'Томаты опт' },
        location: { id: UUID1 },
        price: null,
        priceOwn: false,
        pack: null,
        sellerComment: null,
        wholesale: { amount: '450', batchCount: 1, container: 'bag', containerText: null, perContainer: null, unitChoice: { code: 'kg' } },
      }],
    }, new Map());
    expect(restored?.values.wholesaleOnly).toBe(true);
    expect(restored?.values.unit).toEqual({ code: 'kg', custom: '' });
    expect(restored?.values.amount).toBe('');

    expect(previewAvailability(wholesaleCard(), 'create', { activePoints: 0, uploading: false }).ok).toBe(true);
    expect(previewAvailability(wholesaleCard({ wholesale: null }), 'create', { activePoints: 0, uploading: false }).reasons).toEqual(['titlePrice']);
    const preview = previewBody(wholesaleCard(), { kind: 'create' }, []);
    expect(cardPreviewBodySchema.safeParse(preview).success).toBe(true);
    expect(updateBody(wholesaleCard(), validateCard(wholesaleCard(), 'edit', 1).payload!, [], [{ id: UUID2, revision: 1 }]).price).toBeNull();
  });
});
