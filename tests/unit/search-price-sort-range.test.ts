import { describe, expect, it } from 'vitest';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';
import { rankSearchOfferCandidates, type SearchRankingCandidate } from '../../src/modules/search/ranking/search-ranking';
import { filterOffersByPriceRange } from '../../src/modules/search/price-filter';
import { readSearchRankingPolicy } from '../../src/modules/search/config/search-ranking-policy.config';
import { ageingSince, type ActualityPolicy } from '../../src/modules/offers/actuality/actuality';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';

// stage #6 (Issue #12) — «Сначала дешевле» + price from–to per the approved contract rev 2: the nominal Offer
// price (KZT) ascends inside the freshness tiers, units are intentionally not normalized (the Issue #12 clause
// «must not compare incompatible unit semantics as equivalent» is superseded by the MVP rule), the range filter
// is inclusive on the same nominal amount, and the cheaper mode never touches the ranking policy weights.

const H = 60 * 60 * 1000;
const NOW = new Date('2026-09-13T12:00:00Z');
const ACTUALITY: ActualityPolicy = { dueHours: 24, ageingHours: 48, hiddenHours: 168, archiveHours: 336 };
const RANKING = readSearchRankingPolicy();

const buyer = { latitude: 0, longitude: 0 };
const near = { latitude: 0, longitude: 0 };
const far = { latitude: 0.16, longitude: 0 };

let offerSeq = 0;
function candidate(hoursAgo: number, priceAmount: string, locationGeo: SearchRankingCandidate['locationGeo'] = null, unit: string | null = 'кг'): SearchRankingCandidate {
  offerSeq += 1;
  const id = `70000000-0000-4000-8000-${String(offerSeq).padStart(12, '0')}`;
  const offer = {
    id,
    product: { id: '10000000-0000-4000-8000-000000000001', name: 'stage #6 unit product' },
    seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 'stage #6 unit seller' },
    location: { id: '30000000-0000-4000-8000-000000000001', name: 'stage #6 unit location', addressText: 'stage #6 unit address', openingHours: templateOpeningHours() },
    price: { amount: priceAmount, currency: 'KZT', unit },
    sellerComment: null,
    routeAvailable: true,
  } as SearchOffer;
  return { offer, lastConfirmedAt: new Date(NOW.getTime() - hoursAgo * H), locationGeo };
}

function rank(input: readonly SearchRankingCandidate[], mode: 'actuality' | 'distance' | 'cheaper', buyerLocation?: typeof buyer) {
  return rankSearchOfferCandidates(input, buyerLocation, ageingSince(NOW, ACTUALITY), {
    now: NOW,
    actualityPolicy: ACTUALITY,
    rankingPolicy: RANKING,
    sortMode: mode,
  });
}

function ids(items: readonly { offer: { id: string } }[]) {
  return items.map((item) => item.offer.id);
}

describe('stage #6 «Сначала дешевле»', () => {
  it('orders by the nominal price.amount ascending inside one freshness tier', () => {
    const cheap = candidate(10, '900');
    const middle = candidate(8, '999.5');
    const expensive = candidate(6, '1200');
    expect(ids(rank([expensive, middle, cheap], 'cheaper'))).toEqual([cheap.offer.id, middle.offer.id, expensive.offer.id]);
  });

  it('compares decimals numerically, never as strings', () => {
    // String comparison would place '1000' before '999.5'; the numeric rule must not.
    const decimal = candidate(6, '999.5');
    const whole = candidate(8, '1000');
    expect(ids(rank([whole, decimal], 'cheaper'))).toEqual([decimal.offer.id, whole.offer.id]);
  });

  it('orders different units solely by the displayed nominal amount (superseded Issue #12 clause)', () => {
    const package800 = candidate(5, '800', near, 'упак.');
    const kilo1000 = candidate(4, '1000', near, 'кг');
    const piece700 = candidate(3, '700', near, 'шт.');
    expect(ids(rank([kilo1000, package800, piece700], 'cheaper'))).toEqual([piece700.offer.id, package800.offer.id, kilo1000.offer.id]);
  });

  it('keeps the freshness tier boundary above any price advantage', () => {
    const expensiveFresh = candidate(1, '5000', near);
    const cheapAgeing = candidate(60, '100', near);
    expect(ids(rank([cheapAgeing, expensiveFresh], 'cheaper'))).toEqual([expensiveFresh.offer.id, cheapAgeing.offer.id]);
    expect(ids(rank([cheapAgeing, expensiveFresh], 'cheaper', buyer))).toEqual([expensiveFresh.offer.id, cheapAgeing.offer.id]);
  });

  it('resolves equal nominal prices by freshness then Offer.id (deterministic tie-break)', () => {
    const first = candidate(5, '1000');
    const second = candidate(5, '1000');
    expect(first.offer.id < second.offer.id).toBe(true);
    expect(ids(rank([second, first], 'cheaper'))).toEqual([first.offer.id, second.offer.id]);
    const older = candidate(9, '1000');
    expect(ids(rank([older, first], 'cheaper'))).toEqual([first.offer.id, older.offer.id]);
  });

  it('interleaves geo-known and geo-less Offers on the same nominal basis', () => {
    const geolessCheap = candidate(7, '800', null);
    const geoKnownMiddle = candidate(6, '900', far);
    const geolessExpensive = candidate(5, '1000', null);
    expect(ids(rank([geolessExpensive, geoKnownMiddle, geolessCheap], 'cheaper', buyer))).toEqual([geolessCheap.offer.id, geoKnownMiddle.offer.id, geolessExpensive.offer.id]);
  });

  it('leaves «Актуальнее»/«Ближе» untouched (stage #5/5A regression)', () => {
    const freshFar = candidate(1, '5000', far);
    const oldNear = candidate(47, '100', near);
    expect(ids(rank([oldNear, freshFar], 'actuality', buyer))).toEqual([freshFar.offer.id, oldNear.offer.id]);
    expect(ids(rank([oldNear, freshFar], 'distance', buyer))).toEqual([oldNear.offer.id, freshFar.offer.id]);
  });

  it('keeps the policy free of cheaper weights: the mode never reads the configuration', () => {
    const policy = readSearchRankingPolicy({});
    expect(Object.keys(policy).sort()).toEqual(['actuality', 'distance']);
    // A cheaper ranking produces its order even with the default policy object in place.
    const cheap = candidate(2, '100');
    const expensive = candidate(1, '200');
    expect(ids(rank([expensive, cheap], 'cheaper'))).toEqual([cheap.offer.id, expensive.offer.id]);
  });
});

describe('stage #6 price from–to presentation filter', () => {
  let seq = 0;
  function priceOffer(amount: string, unit: string | null = 'кг'): SearchOffer {
    seq += 1;
    return {
      id: `80000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
      product: { id: '10000000-0000-4000-8000-000000000001', name: 'price unit product' },
      seller: { id: '20000000-0000-4000-8000-000000000001', displayName: 'price unit seller' },
      location: { id: '30000000-0000-4000-8000-000000000001', name: 'price unit location', addressText: 'price unit address', openingHours: templateOpeningHours() },
      price: { amount, currency: 'KZT', unit },
      sellerComment: null,
      routeAvailable: true,
    };
  }

  const fourNinetyNine = priceOffer('499.90');
  const fiveHundred = priceOffer('500');
  const thousand = priceOffer('1000');
  const twoThousand = priceOffer('2000');

  it('applies inclusive boundaries on the nominal amount', () => {
    const filtered = filterOffersByPriceRange([fourNinetyNine, fiveHundred, thousand, twoThousand], 500, 2000);
    expect(filtered.map((offer) => offer.id)).toEqual([fiveHundred.id, thousand.id, twoThousand.id]);
  });

  it('supports only-min and only-max bounds', () => {
    expect(filterOffersByPriceRange([fourNinetyNine, fiveHundred, thousand], 500, null).map((offer) => offer.id)).toEqual([fiveHundred.id, thousand.id]);
    expect(filterOffersByPriceRange([fiveHundred, thousand, twoThousand], null, 1000).map((offer) => offer.id)).toEqual([fiveHundred.id, thousand.id]);
    expect(filterOffersByPriceRange([fiveHundred], null, null)).toHaveLength(1);
  });

  it('filters across different units identically — no unit normalization or conversion', () => {
    const package800 = priceOffer('800', 'упак.');
    const kilo750 = priceOffer('750', 'кг');
    const piece900 = priceOffer('900', 'шт.');
    expect(filterOffersByPriceRange([package800, kilo750, piece900], 760, 850).map((offer) => offer.id)).toEqual([package800.id]);
    // 750/кг and 900/шт. stay out exactly because their nominal amounts are out of range — never converted.
    expect(filterOffersByPriceRange([package800, kilo750, piece900], 700, 1000)).toHaveLength(3);
  });
});
