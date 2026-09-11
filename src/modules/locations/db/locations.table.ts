import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  addressText: text('address_text').notNull(),
});
