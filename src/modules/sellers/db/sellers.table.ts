import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';

export const sellers = pgTable('sellers', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
}, (table) => [
  uniqueIndex('sellers_owner_user_id_owned_unique')
    .on(table.ownerUserId)
    .where(sql`${table.ownerUserId} IS NOT NULL`),
  check('sellers_display_name_not_blank', sql`char_length(btrim(${table.displayName})) >= 1`),
  check('sellers_display_name_max_length', sql`char_length(btrim(${table.displayName})) <= 120`),
]);
