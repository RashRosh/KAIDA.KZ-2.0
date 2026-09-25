import { sql } from 'drizzle-orm';
import { check, integer, pgTable, primaryKey, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { photos } from '../../media/db/photos.table';
import { sellerChangeItems } from './seller-change-items.table';

// The proposed ordered photo list of a create_offer item, or of an update_offer item with photos_specified.
export const sellerChangeItemPhotos = pgTable('seller_change_item_photos', {
  itemId: uuid('item_id').notNull().references(() => sellerChangeItems.id),
  photoId: uuid('photo_id').notNull().references(() => photos.id),
  position: integer('position').notNull(),
}, (table) => [
  primaryKey({ columns: [table.itemId, table.position] }),
  uniqueIndex('seller_change_item_photos_item_photo_unique').on(table.itemId, table.photoId),
  check('seller_change_item_photos_position_range', sql`${table.position} >= 0 AND ${table.position} < 5`),
]);
