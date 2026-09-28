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

type RankedNearbyOffer = {
  offer: SearchOffer;
  lastConfirmedAt: Date;
  distanceMeters: number;
};

function compareNearbyOffers(a: RankedNearbyOffer, b: RankedNearbyOffer, ageingSince?: Date): number {
  const tier = compareActualityTier(a, b, ageingSince);
  if (tier !== 0) return tier;
  if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;

  const aTime = a.lastConfirmedAt.getTime();
  const bTime = b.lastConfirmedAt.getTime();
  if (aTime !== bTime) return aTime > bTime ? -1 : 1;

  if (a.offer.id === b.offer.id) return 0;
  return a.offer.id < b.offer.id ? -1 : 1;
}

export function selectNearbyOffers(
  candidates: readonly NearbyDiscoveryCandidate[],
  buyerLocation: BuyerLocation,
  nearbyRadiusMeters: number,
  ageingSince?: Date,
): DiscoveryOffer[] {
  const radius = validateNearbyRadiusMeters(nearbyRadiusMeters);

  return candidates
    .flatMap((candidate): RankedNearbyOffer[] => {
      if (candidate.locationGeo === null) return [];
      const distanceMeters = distanceMetersForRanking(buyerLocation, candidate.locationGeo);
      if (distanceMeters > radius) return [];
      return [{
        offer: candidate.offer,
        lastConfirmedAt: candidate.lastConfirmedAt,
        distanceMeters,
      }];
    })
    .sort((a, b) => compareNearbyOffers(a, b, ageingSince))
    .map(({ offer, distanceMeters }) => ({ ...offer, distanceMeters }));
}
