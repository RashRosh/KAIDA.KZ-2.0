import { sql } from 'drizzle-orm';
import { check, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sellers } from './sellers.table';

// Numbers a Seller has proved by code. A number verified once is verified on every point of that Seller.
export const sellerVerifiedPhones = pgTable('seller_verified_phones', {
  sellerId: uuid('seller_id').notNull().references(() => sellers.id),
  phoneE164: text('phone_e164').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.sellerId, table.phoneE164] }),
  check('seller_verified_phones_phone_e164_format', sql`${table.phoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`),
]);
