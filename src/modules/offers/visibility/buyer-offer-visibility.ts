import { and, isNotNull } from 'drizzle-orm';
import { locations } from '../../locations/db/locations.table';
import { sellers } from '../../sellers/db/sellers.table';
import { visibleOffersPredicate } from '../lifecycle/offer-lifecycle';

// Buyer visibility is a read-side policy across the owning Offer, Seller and Location modules.
// Seller-side records remain valid even when this predicate is false.
export function buyerVisibleOffersPredicate(cutoff: Date) {
  return and(
    visibleOffersPredicate(cutoff),
    isNotNull(sellers.contactPhoneE164),
    isNotNull(locations.latitude),
    isNotNull(locations.longitude),
  );
}
