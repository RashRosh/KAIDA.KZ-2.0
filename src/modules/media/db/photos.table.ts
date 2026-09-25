import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';

// A processed, metadata-free photo. Files live in photo storage under the id; this row only records ownership and
// the stored display dimensions. Owned by the uploading user so a Seller can add photos before the Seller record exists.
export const photos = pgTable('photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('photos_owner_user_id_idx').on(table.ownerUserId),
  check('photos_dimensions_positive', sql`${table.width} >= 1 AND ${table.height} >= 1`),
]);
