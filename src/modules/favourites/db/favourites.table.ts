import { pgTable, timestamp, unique, uuid, index } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';

// Intentionally no Offer/Location FK: excluded/deleted targets retain only minimal references until owner removal.
export const buyerOfferFavourites = pgTable('buyer_offer_favourites', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  offerId: uuid('offer_id').notNull(),
  locationId: uuid('location_id').notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique('buyer_offer_favourites_identity').on(table.userId, table.offerId, table.locationId),
  index('buyer_offer_favourites_owner_order').on(table.userId, table.savedAt.desc(), table.id.desc())]);
