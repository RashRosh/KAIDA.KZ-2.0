import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const sellers = pgTable('sellers', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
});
