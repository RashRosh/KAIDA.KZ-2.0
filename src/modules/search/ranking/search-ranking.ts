import type { SearchOffer } from '../contracts/search.contract';
import type { BuyerLocation } from '../contracts/buyer-location.contract';

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

export type SearchRankingCandidate = {
  offer: SearchOffer;
  lastConfirmedAt: Date;
  locationGeo: BuyerLocation | null;
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

export function rankSearchOfferCandidates(
  candidates: readonly SearchRankingCandidate[],
  buyerLocation?: BuyerLocation,
): SearchRankingCandidate[] {
  if (!buyerLocation) {
    return [...candidates].sort(compareFreshnessThenId);
  }

  const ranked = candidates.map((candidate) => ({
    candidate,
    distanceMeters: candidate.locationGeo === null
      ? null
      : distanceMetersForRanking(buyerLocation, candidate.locationGeo),
  }));

  ranked.sort((a, b) => {
    if (a.distanceMeters === null && b.distanceMeters !== null) return 1;
    if (a.distanceMeters !== null && b.distanceMeters === null) return -1;
    if (a.distanceMeters !== null && b.distanceMeters !== null && a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }
    return compareFreshnessThenId(a.candidate, b.candidate);
  });

  return ranked.map(({ candidate }) => candidate);
}
