import type { SearchOffer } from './contracts/search.contract';

// stage #5 (slice contract §2.7): the distance radius is a presentation-level filter applied on the client over the
// complete Search response — instant, without a request. Finite radius keeps only geo-known Offers within the radius
// (an Offer exactly on the boundary is included); a geo-less Offer cannot prove it is inside the radius and is hidden.
//
// Architectural boundary: Search currently has no pagination and no server-side result limit, so the response is the
// complete eligible result set. If Search ever gains pagination or a server-side result limit, this client-only
// filtering must be redesigned — a truncated server page must never be treated as the complete radius result.
export function filterOffersByRadius(offers: readonly SearchOffer[], radiusMeters: number | null): SearchOffer[] {
  if (radiusMeters === null) return [...offers];
  return offers.filter((offer) => offer.distanceMeters !== undefined && offer.distanceMeters <= radiusMeters);
}
