import { and, isNotNull } from 'drizzle-orm';
import { locations } from '../../locations/db/locations.table';
import { visibleOffersPredicate } from '../lifecycle/offer-lifecycle';

// Buyer visibility is a read-side policy across the owning Offer, Seller and Location modules.
// Seller-side records remain valid even when this predicate is false. A public phone is not required: contacts are
// optional and belong to the point (point-contacts-hours §2).
export function buyerVisibleOffersPredicate(cutoff: Date) {
  return and(
    visibleOffersPredicate(cutoff),
    isNotNull(locations.latitude),
    isNotNull(locations.longitude),
  );
}
