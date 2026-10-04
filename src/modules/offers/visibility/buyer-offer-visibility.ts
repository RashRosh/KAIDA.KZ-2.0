import { and, isNotNull, sql } from 'drizzle-orm';
import { locations } from '../../locations/db/locations.table';
import { visibleOffersPredicate } from '../lifecycle/offer-lifecycle';

// A card an operator removed from the showcase (operator-post-check) is hidden in every point until the operator
// returns it or the Seller republishes it. The outer table is named explicitly: an unqualified column would bind to r.
export const notRemovedByOperatorPredicate = sql`not exists (
  select 1 from offer_card_removals r
  where r.card_id = "offers"."card_id" and r.restored_at is null and r.cleared_at is null
)`;

// Generic buyer visibility: lifecycle + operator removal. Location identity (a non-blank address) is guaranteed by
// the schema, so coordinates are NOT part of ordinary Search / buyer Offer page visibility (stage 5A: Location
// identity ≠ Location coordinates; revises the UX1D geo-eligibility for Search only).
// Buyer-side records remain valid even when this predicate is false. A public phone is not required: contacts are
// optional and belong to the point (point-contacts-hours §2).
export function buyerVisibleOffersPredicate(cutoff: Date) {
  return and(
    visibleOffersPredicate(cutoff),
    notRemovedByOperatorPredicate,
  );
}

// Geo-dependent eligibility on top of the generic visibility: Nearby and the route destination additionally require
// complete Location coordinates (stage 5A — the UX1D geo requirement stays for geo-dependent behavior only).
export function buyerGeoVisibleOffersPredicate(cutoff: Date) {
  return and(
    buyerVisibleOffersPredicate(cutoff),
    isNotNull(locations.latitude),
    isNotNull(locations.longitude),
  );
}
