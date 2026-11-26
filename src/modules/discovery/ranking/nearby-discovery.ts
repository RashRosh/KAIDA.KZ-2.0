import type { BuyerLocation } from '../../search/contracts/buyer-location.contract';
import type { SearchOffer } from '../../search/contracts/search.contract';
import { compareActualityTier, distanceMetersForRanking } from '../../search/ranking/search-ranking';
import type { DiscoveryOffer } from '../contracts/discovery.contract';
import { validateNearbyRadiusMeters } from '../config/discovery.config';

export type NearbyDiscoveryCandidate = {
  offer: SearchOffer;
  lastConfirmedAt: Date;
  locationGeo: BuyerLocation | null;
};

type RankedNearbyOffer = NearbyDiscoveryCandidate & {
  distanceMeters: number;
  roadDistanceMeters?: number;
};

function compareNearbyOffers(a: RankedNearbyOffer, b: RankedNearbyOffer, ageingSince?: Date): number {
  const tier = compareActualityTier(a, b, ageingSince);
  if (tier !== 0) return tier;
  const distanceOrder = (a.roadDistanceMeters ?? a.distanceMeters) - (b.roadDistanceMeters ?? b.distanceMeters);
  if (distanceOrder !== 0) return distanceOrder;

  const aTime = a.lastConfirmedAt.getTime();
  const bTime = b.lastConfirmedAt.getTime();
  if (aTime !== bTime) return aTime > bTime ? -1 : 1;

  if (a.offer.id === b.offer.id) return 0;
  return a.offer.id < b.offer.id ? -1 : 1;
}

export function selectNearbyCandidates(
  candidates: readonly NearbyDiscoveryCandidate[],
  buyerLocation: BuyerLocation,
  nearbyRadiusMeters: number,
): RankedNearbyOffer[] {
  const radius = validateNearbyRadiusMeters(nearbyRadiusMeters);

  return candidates.flatMap((candidate) => {
    if (candidate.locationGeo === null) return [];
    const distanceMeters = distanceMetersForRanking(buyerLocation, candidate.locationGeo);
    return distanceMeters > radius ? [] : [{ ...candidate, distanceMeters }];
  });
}

export function rankNearbyOffers(
  candidates: RankedNearbyOffer[],
  ageingSince?: Date,
  roadDistances?: ReadonlyMap<string, number>,
): DiscoveryOffer[] {
  const measured = candidates.map((candidate) => ({
    ...candidate,
    roadDistanceMeters: roadDistances?.get(candidate.offer.location.id),
  }));
  return measured.sort((a, b) => compareNearbyOffers(a, b, ageingSince))
    .map(({ offer, distanceMeters, roadDistanceMeters }) => ({
      ...offer,
      distanceMeters,
      ...(roadDistanceMeters !== undefined ? { roadDistanceMeters } : {}),
    }));
}

export function selectNearbyOffers(
  candidates: readonly NearbyDiscoveryCandidate[],
  buyerLocation: BuyerLocation,
  nearbyRadiusMeters: number,
  ageingSince?: Date,
): DiscoveryOffer[] {
  return rankNearbyOffers(selectNearbyCandidates(candidates, buyerLocation, nearbyRadiusMeters), ageingSince);
}
