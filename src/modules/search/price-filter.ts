import type { SearchOffer } from './contracts/search.contract';

// Stage #6 (slice contract §4): the price «от–до» range is a presentation-level filter applied on the client over
// the complete Search response — instant, without a request. It works on the nominal `price.amount` (KZT) exactly
// as displayed on the card: units are not normalized or converted, boundaries are inclusive, and an absent bound
// is not applied.
//
// Architectural boundary: Search currently has no pagination and no server-side result limit, so the response is
// the complete eligible result set. If Search ever gains pagination or a server-side result limit, this
// client-only filtering must be redesigned — a truncated server page must never be treated as the complete
// filtered result. (The same boundary applies to the stage #5 radius filter.)
export function filterOffersByPriceRange(
  offers: readonly SearchOffer[],
  min: number | null,
  max: number | null,
): SearchOffer[] {
  if (min === null && max === null) return [...offers];
  return offers.filter((offer) => {
    const amount = Number.parseFloat(offer.price.amount);
    if (Number.isNaN(amount)) return false;
    if (min !== null && amount < min) return false;
    if (max !== null && amount > max) return false;
    return true;
  });
}
