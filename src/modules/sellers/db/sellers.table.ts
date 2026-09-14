import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../identity/db/users.table';

export const sellers = pgTable('sellers', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  contactPhoneE164: text('contact_phone_e164'),
  whatsappPhoneE164: text('whatsapp_phone_e164'),
  telegramUsername: text('telegram_username'),
  instagramUsername: text('instagram_username'),
}, (table) => [
  uniqueIndex('sellers_owner_user_id_owned_unique')
    .on(table.ownerUserId)
    .where(sql`${table.ownerUserId} IS NOT NULL`),
  check('sellers_display_name_not_blank', sql`char_length(btrim(${table.displayName})) >= 1`),
  check('sellers_display_name_max_length', sql`char_length(btrim(${table.displayName})) <= 120`),
  check('sellers_contact_phone_e164_format', sql`${table.contactPhoneE164} IS NULL OR ${table.contactPhoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`),
  check('sellers_whatsapp_phone_e164_format', sql`${table.whatsappPhoneE164} IS NULL OR ${table.whatsappPhoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`),
  check('sellers_telegram_username_format', sql`${table.telegramUsername} IS NULL OR ${table.telegramUsername} ~ '^[a-z0-9_]{1,64}$'`),
  check('sellers_instagram_username_format', sql`${table.instagramUsername} IS NULL OR ${table.instagramUsername} ~ '^[a-z0-9._]{1,64}$'`),
]);
