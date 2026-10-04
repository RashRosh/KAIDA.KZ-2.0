import type { SearchOffer } from '../contracts/search.contract';
import type { BuyerLocation } from '../contracts/buyer-location.contract';
import type { SearchRankingPolicy, SearchSortMode } from '../config/search-ranking-policy.config';
import type { ActualityPolicy } from '../../offers/actuality/actuality';

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;
const HOUR_MS = 60 * 60 * 1000;

export type SearchRankingCandidate = {
  offer: SearchOffer;
  lastConfirmedAt: Date;
  locationGeo: BuyerLocation | null;
};

export type RankedSearchCandidate = SearchRankingCandidate & {
  // S9 whole-meter distance used for ranking; null when the Offer's Location has no geo.
  rankingDistanceMeters: number | null;
};

export type SearchRankingOptions = {
  now: Date;
  actualityPolicy: ActualityPolicy;
  rankingPolicy: SearchRankingPolicy;
  sortMode: SearchSortMode;
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

function compareFreshnessThenId(a: SearchRankingCandidate, b: SearchRankingCandidate): number {
  const aTime = a.lastConfirmedAt.getTime();
  const bTime = b.lastConfirmedAt.getTime();
  if (aTime !== bTime) return aTime > bTime ? -1 : 1;
  if (a.offer.id === b.offer.id) return 0;
  return a.offer.id < b.offer.id ? -1 : 1;
}

// offer-actuality: offers confirmed at or before `ageingSince` form the ageing tier, ranked after every fresh offer.
export function compareActualityTier(a: { lastConfirmedAt: Date }, b: { lastConfirmedAt: Date }, ageingSince?: Date): number {
  if (!ageingSince) return 0;
  const aAgeing = a.lastConfirmedAt.getTime() <= ageingSince.getTime();
  const bAgeing = b.lastConfirmedAt.getTime() <= ageingSince.getTime();
  return aAgeing === bAgeing ? 0 : aAgeing ? 1 : -1;
}

// stage #5 (slice contract §2.4): absolute freshness score inside the Offer's own tier — no result-set normalization.
// The spans follow the freshness tier boundaries of the actuality policy (defaults: fresh 48h, ageing 48h…168h),
// so scoring can never disagree with the tier rule: the newest Offer of a tier scores ≈ 1 and decays to 0 at its end.
export function freshnessScore(lastConfirmedAt: Date, now: Date, actualityPolicy: ActualityPolicy): number {
  const ageMs = Math.max(0, now.getTime() - lastConfirmedAt.getTime());
  const freshSpanMs = actualityPolicy.ageingHours * HOUR_MS;
  if (ageMs < freshSpanMs) return Math.max(0, 1 - ageMs / freshSpanMs);
  const ageingSpanMs = (actualityPolicy.hiddenHours - actualityPolicy.ageingHours) * HOUR_MS;
  return Math.max(0, 1 - (ageMs - freshSpanMs) / ageingSpanMs);
}

// Absolute decaying distance score (slice contract §2.4): 0 km ≈ 1, smoothly decreasing; never normalized
// against the other Offers of the result set.
export function distanceScore(rankingDistanceMeters: number): number {
  return 1 / (1 + rankingDistanceMeters / 1000);
}

// A geo-less Offer gets no distance component at all — its freshness part is not renormalized (contract §2.6).
function weightedScore(
  candidate: SearchRankingCandidate,
  rankingDistanceMeters: number | null,
  weights: SearchRankingPolicy[SearchSortMode],
  options: SearchRankingOptions,
): number {
  const fresh = freshnessScore(candidate.lastConfirmedAt, options.now, options.actualityPolicy);
  if (rankingDistanceMeters === null) return fresh * weights.freshnessWeight;
  return fresh * weights.freshnessWeight + distanceScore(rankingDistanceMeters) * weights.distanceWeight;
}

export function rankSearchOfferCandidates(
  candidates: readonly SearchRankingCandidate[],
  buyerLocation: BuyerLocation | undefined,
  ageingSince: Date | undefined,
  options: SearchRankingOptions,
): RankedSearchCandidate[] {
  if (!buyerLocation) {
    // Without Buyer location Search ranks by pure freshness semantics — the weights are not involved at all.
    return [...candidates]
      .sort((a, b) => compareActualityTier(a, b, ageingSince) || compareFreshnessThenId(a, b))
      .map((candidate) => ({ ...candidate, rankingDistanceMeters: null }));
  }

  const weights = options.rankingPolicy[options.sortMode];
  const ranked = candidates.map((candidate) => ({
    candidate,
    rankingDistanceMeters: candidate.locationGeo === null
      ? null
      : distanceMetersForRanking(buyerLocation, candidate.locationGeo),
  }));

  ranked.sort((a, b) => {
    const tier = compareActualityTier(a.candidate, b.candidate, ageingSince);
    if (tier !== 0) return tier;
    // Stage 5A contract §2.1 «Ближе»: every geo-known Offer of the tier ranks ahead of the geo-less group (the
    // geo-less group then orders by freshness → id). «Актуальнее» lets the absolute weighted scores interleave.
    if (options.sortMode === 'distance') {
      if (a.rankingDistanceMeters === null && b.rankingDistanceMeters !== null) return 1;
      if (a.rankingDistanceMeters !== null && b.rankingDistanceMeters === null) return -1;
    }
    const aScore = weightedScore(a.candidate, a.rankingDistanceMeters, weights, options);
    const bScore = weightedScore(b.candidate, b.rankingDistanceMeters, weights, options);
    if (aScore !== bScore) return aScore > bScore ? -1 : 1;
    return compareFreshnessThenId(a.candidate, b.candidate);
  });

  return ranked.map(({ candidate, rankingDistanceMeters }) => ({ ...candidate, rankingDistanceMeters }));
}
