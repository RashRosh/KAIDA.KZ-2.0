import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, primaryKey, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { photos } from '../../media/db/photos.table';
import { offers } from './offers.table';

export const OFFER_PHOTO_LIMIT = 5;

// Ordered photos of an Offer; position 0 is the cover. Written only by a confirmed SellerChangeSet.
export const offerPhotos = pgTable('offer_photos', {
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  photoId: uuid('photo_id').notNull().references(() => photos.id),
  position: integer('position').notNull(),
}, (table) => [
  primaryKey({ columns: [table.offerId, table.position] }),
  uniqueIndex('offer_photos_offer_photo_unique').on(table.offerId, table.photoId),
  index('offer_photos_photo_id_idx').on(table.photoId),
  check('offer_photos_position_range', sql`${table.position} >= 0 AND ${table.position} < 5`),
]);
