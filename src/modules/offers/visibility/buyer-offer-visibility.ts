import { and, isNotNull, sql } from 'drizzle-orm';
import { locations } from '../../locations/db/locations.table';
import { visibleOffersPredicate } from '../lifecycle/offer-lifecycle';

// A card an operator removed from the showcase (operator-post-check) is hidden in every point until the operator
// returns it or the Seller republishes it. The outer table is named explicitly: an unqualified column would bind to r.
export const notRemovedByOperatorPredicate = sql`not exists (
  select 1 from offer_card_removals r
  where r.card_id = "offers"."card_id" and r.restored_at is null and r.cleared_at is null
)`;

// Buyer visibility is a read-side policy across the owning Offer, Seller and Location modules.
// Seller-side records remain valid even when this predicate is false. A public phone is not required: contacts are
// optional and belong to the point (point-contacts-hours §2).
export function buyerVisibleOffersPredicate(cutoff: Date) {
  return and(
    visibleOffersPredicate(cutoff),
    isNotNull(locations.latitude),
    isNotNull(locations.longitude),
    notRemovedByOperatorPredicate,
  );
}
