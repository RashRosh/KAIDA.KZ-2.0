import { describe, expect, it } from 'vitest';
import {
  actualityDays,
  actualityDue,
  actualityStage,
  ageingSince,
  buyerActuality,
  readActualityPolicy,
  type ActualityPolicy,
} from '../../src/modules/offers/actuality/actuality';
import { cardActuality } from '../../src/app/seller/_components/card-model';
import type { SellerOfferView } from '../../src/modules/offers/contracts/seller-offer.contract';
import { rankSearchOfferCandidates, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';
import { readSearchRankingPolicy } from '../../src/modules/search/config/search-ranking-policy.config';

// offer-actuality §6/§7: stages and badges at every boundary, the fresh tier first, card age = oldest active point.

const H = 60 * 60 * 1000;
const policy: ActualityPolicy = { dueHours: 24, ageingHours: 48, hiddenHours: 168, archiveHours: 336 };

describe('actuality policy', () => {
  it('reads defaults and refuses thresholds that do not grow', () => {
    expect(readActualityPolicy({})).toEqual(policy);
    expect(readActualityPolicy({ ACTUALITY_AGEING_HOURS: '72', OFFER_VALIDITY_PERIOD_HOURS: '200' })).toMatchObject({ ageingHours: 72, hiddenHours: 200 });
    expect(() => readActualityPolicy({ ACTUALITY_AGEING_HOURS: '200' })).toThrow();
    expect(() => readActualityPolicy({ ACTUALITY_ARCHIVE_HOURS: 'x' })).toThrow();
  });

  it('switches stage exactly at 48 / 168 / 336 hours and due at 24 hours', () => {
    expect(actualityDue(24 * H - 1, policy)).toBe(false);
    expect(actualityDue(24 * H, policy)).toBe(true);
    expect(actualityStage(48 * H - 1, policy)).toBe('fresh');
    expect(actualityStage(48 * H, policy)).toBe('ageing');
    expect(actualityStage(168 * H - 1, policy)).toBe('ageing');
    expect(actualityStage(168 * H, policy)).toBe('hidden');
    expect(actualityStage(336 * H - 1, policy)).toBe('hidden');
    expect(actualityStage(336 * H, policy)).toBe('archived');
  });

  it('badge days are whole days of age', () => {
    expect(actualityDays(0)).toBe(0);
    expect(actualityDays(24 * H - 1)).toBe(0);
    expect(actualityDays(24 * H)).toBe(1);
    expect(actualityDays(48 * H)).toBe(2);
    expect(actualityDays(168 * H - 1)).toBe(6);
    const now = new Date('2026-09-28T12:00:00Z');
    expect(buyerActuality(new Date(now.getTime() - 50 * H), now, policy)).toEqual({ days: 2, ageing: true });
    expect(buyerActuality(new Date(now.getTime() - 47 * H), now, policy)).toEqual({ days: 1, ageing: false });
  });
});

describe('fresh tier before ageing tier', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const candidate = (id: string, hoursAgo: number, latitude: number): SearchRankingCandidate => ({
    offer: { id } as SearchRankingCandidate['offer'],
    lastConfirmedAt: new Date(now.getTime() - hoursAgo * H),
    locationGeo: { latitude, longitude: 76.95 },
  });
  const near = candidate('00000000-0000-4000-8000-000000000001', 60, 43.2501);
  const far = candidate('00000000-0000-4000-8000-000000000002', 1, 43.40);

  it('ranks a fresh far offer before an ageing near one, with and without buyer location', () => {
    const since = ageingSince(now, policy);
    const options = { now, actualityPolicy: policy, rankingPolicy: readSearchRankingPolicy(), sortMode: 'actuality' as const };
    expect(rankSearchOfferCandidates([near, far], { latitude: 43.25, longitude: 76.95 }, since, options).map((c) => c.offer.id)).toEqual([far.offer.id, near.offer.id]);
    expect(rankSearchOfferCandidates([near, far], undefined, since, options).map((c) => c.offer.id)).toEqual([far.offer.id, near.offer.id]);
  });
});

describe('card actuality', () => {
  const offer = (id: string, status: 'active' | 'inactive', lastConfirmedAt: string, stage: SellerOfferView['actuality']['stage'], days: number): SellerOfferView => ({
    id, cardId: 'c', status, lastConfirmedAt, removal: null,
    actuality: { days, stage, due: days >= 1 },
  }) as unknown as SellerOfferView;

  it('takes the oldest switched-on point; archived only when every switched-on point is', () => {
    const fresh = offer('a', 'active', '2026-09-28T10:00:00.000Z', 'fresh', 0);
    const old = offer('b', 'active', '2026-09-20T10:00:00.000Z', 'hidden', 8);
    const off = offer('c', 'inactive', '2026-08-01T10:00:00.000Z', 'archived', 58);
    expect(cardActuality([fresh, old, off])).toMatchObject({ days: 8, stage: 'hidden', due: true, archived: false });
    expect(cardActuality([offer('d', 'active', '2026-09-01T10:00:00.000Z', 'archived', 27), off])).toMatchObject({ archived: true });
    expect(cardActuality([off])).toBeNull();
    expect(cardActuality([{ ...fresh, removal: { reason: 'other', comment: null, removedAt: '2026-09-28T00:00:00.000Z' } }])).toBeNull();
  });
});
