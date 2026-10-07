import type { SearchOffer, SearchSortDirection, SearchSortMode } from '../contracts/search.contract';
import type { BuyerLocation } from '../contracts/buyer-location.contract';

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

// S15B-4b + search-word-forms: how well a candidate answers the query — 1 Product, 2 whole title words,
// 3 whole words or reviewed word forms, 4 everything else eligible.
export type SearchMatchLevel = 1 | 2 | 3 | 4;

export type SearchRankingCandidate = {
  offer: SearchOffer;
  // Needed by the `relevance` order only.
  matchLevel?: SearchMatchLevel;
  lastConfirmedAt: Date;
  locationGeo: BuyerLocation | null;
};

export type RankedSearchCandidate = SearchRankingCandidate & {
  // Whole-meter distance from the buyer location; null when the Offer's Location has no geo or the request had none.
  rankingDistanceMeters: number | null;
};

// Stage 6 Rev 3 (slice contract §3.2): the selected criterion is the primary ordering of all buyer-eligible Offers —
// there is no tier and no weighted score behind an explicit one. S15B-4b: only `relevance` orders by match level first.
export type SearchRankingOptions = {
  sort: SearchSortMode;
  direction: SearchSortDirection;
};

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function haversineDistanceMeters(from: BuyerLocation, to: BuyerLocation): number {
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const rawA = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  const a = Math.min(1, Math.max(0, rawA));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_MEAN_RADIUS_METERS * c;
}

export function distanceMetersForRanking(from: BuyerLocation, to: BuyerLocation): number {
  return Math.round(haversineDistanceMeters(from, to));
}

function compareId(a: SearchRankingCandidate, b: SearchRankingCandidate): number {
  if (a.offer.id === b.offer.id) return 0;
  return a.offer.id < b.offer.id ? -1 : 1;
}

function compareFreshnessThenId(a: SearchRankingCandidate, b: SearchRankingCandidate): number {
  const aTime = a.lastConfirmedAt.getTime();
  const bTime = b.lastConfirmedAt.getTime();
  if (aTime !== bTime) return aTime > bTime ? -1 : 1;
  return compareId(a, b);
}

// offer-actuality: offers confirmed at or before `ageingSince` form the ageing tier, ranked after every fresh offer.
// Kept for Nearby (S11), whose order is not changed by the explicit Search sorting.
export function compareActualityTier(a: { lastConfirmedAt: Date }, b: { lastConfirmedAt: Date }, ageingSince?: Date): number {
  if (!ageingSince) return 0;
  const aAgeing = a.lastConfirmedAt.getTime() <= ageingSince.getTime();
  const bAgeing = b.lastConfirmedAt.getTime() <= ageingSince.getTime();
  return aAgeing === bAgeing ? 0 : aAgeing ? 1 : -1;
}

// Nominal price (MVP rule): the numeric KZT amount only — units and pack sizes are never normalized.
function nominalPrice(candidate: SearchRankingCandidate): number {
  return Number.parseFloat(candidate.offer.price.amount);
}

// `direction` flips only the primary criterion; every tie-breaker keeps its own fixed direction.
function directed(comparison: number, direction: SearchSortDirection): number {
  return direction === 'asc' ? comparison : -comparison;
}

export function rankSearchOfferCandidates(
  candidates: readonly SearchRankingCandidate[],
  buyerLocation: BuyerLocation | undefined,
  options: SearchRankingOptions,
): RankedSearchCandidate[] {
  if (options.sort === 'distance' && !buyerLocation) {
    // The public API rejects this request; reaching it is a programming error, never a silent re-ordering.
    throw new Error('Sorting by distance needs the buyer location');
  }

  const ranked: RankedSearchCandidate[] = candidates.map((candidate) => ({
    ...candidate,
    rankingDistanceMeters: buyerLocation && candidate.locationGeo !== null
      ? distanceMetersForRanking(buyerLocation, candidate.locationGeo)
      : null,
  }));

  ranked.sort((a, b) => {
    if (options.sort === 'relevance') {
      // Level first, then the existing actuality order (fresher first → stable Offer.id), exactly as the `actuality` desc mode.
      return ((a.matchLevel ?? 4) - (b.matchLevel ?? 4))
        || (b.lastConfirmedAt.getTime() - a.lastConfirmedAt.getTime())
        || compareId(a, b);
    }
    if (options.sort === 'actuality') {
      const byAge = a.lastConfirmedAt.getTime() - b.lastConfirmedAt.getTime();
      // asc = older first, desc = fresher first; equal actuality falls back to the stable id.
      return directed(byAge, options.direction) || compareId(a, b);
    }
    if (options.sort === 'price') {
      return directed(nominalPrice(a) - nominalPrice(b), options.direction) || compareFreshnessThenId(a, b);
    }
    // distance: every geo-known Offer precedes every geo-less one for both directions; geo-less Offers never get a
    // distance and keep the order «fresher first → id».
    if (a.rankingDistanceMeters === null && b.rankingDistanceMeters === null) return compareFreshnessThenId(a, b);
    if (a.rankingDistanceMeters === null) return 1;
    if (b.rankingDistanceMeters === null) return -1;
    return directed(a.rankingDistanceMeters - b.rankingDistanceMeters, options.direction) || compareFreshnessThenId(a, b);
  });

  return ranked;
}
