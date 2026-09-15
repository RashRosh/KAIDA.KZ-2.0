import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { withMigrationTestDatabase } from './migration-test-database';

const PRE_S10_MIGRATIONS = [
  '0000_s0_first_search.sql',
  '0001_s1_offer_lifecycle.sql',
  '0002_s2_auth.sql',
  '0003_s3_seller_location.sql',
  '0004_s4_seller_change_set.sql',
  '0005_s5_offer_management.sql',
  '0006_s6_product_aliases.sql',
  '0007_s8_location_coordinates.sql',
] as const;

async function createPreS10MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s10-pre-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of PRE_S10_MIGRATIONS) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as {
    version: string;
    dialect: string;
    entries: unknown[];
  };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 8) }, null, 2));
  return folder;
}

async function migrateToPreS10(db: Parameters<typeof migrate>[0]) {
  const folder = await createPreS10MigrationsFolder();
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('S10 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades S9 schema without rewriting legacy Seller identity or publishing Identity phone', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s10_upgrade_test' }, async (pool, rawDb) => {
      await migrateToPreS10(rawDb);
      const db = rawDb as unknown as Database;
      const productId = '10000000-0000-4000-8000-000000010801';
      const userId = '50000000-0000-4000-8000-000000010801';
      const sellerId = '20000000-0000-4000-8000-000000010801';
      const locationId = '30000000-0000-4000-8000-000000010801';
      const offerId = '40000000-0000-4000-8000-000000010801';
      const productName = 'S10 migration product 10801';
      const identityPhone = '+77009991801';
      const now = new Date('2026-09-14T00:00:00Z');

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, identityPhone, now]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S10 legacy seller', userId]);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'S10 legacy point', 'S10 legacy address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,status,last_confirmed_at,revision,created_at,updated_at)
        VALUES ($1,$2,$3,$4,'active',$5,1,$5,$5)`, [offerId, productId, sellerId, locationId, now]);

      await migrate(rawDb, { migrationsFolder: './drizzle/migrations' });

      const columns = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(`
        SELECT column_name,data_type,is_nullable
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sellers'
          AND column_name IN ('contact_phone_e164','whatsapp_phone_e164','telegram_username','instagram_username')
        ORDER BY column_name
      `);
      expect(columns.rows).toEqual([
        { column_name: 'contact_phone_e164', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'instagram_username', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'telegram_username', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'whatsapp_phone_e164', data_type: 'text', is_nullable: 'YES' },
      ]);

      expect((await pool.query(`SELECT id,owner_user_id,contact_phone_e164,whatsapp_phone_e164,telegram_username,instagram_username
        FROM sellers WHERE id=$1`, [sellerId])).rows[0]).toEqual({
        id: sellerId,
        owner_user_id: userId,
        contact_phone_e164: null,
        whatsapp_phone_e164: null,
        telegram_username: null,
        instagram_username: null,
      });
      expect((await pool.query('SELECT phone_e164 FROM users WHERE id=$1', [userId])).rows[0].phone_e164).toBe(identityPhone);

      const search = await searchOffers(productName, db, { clock: () => now, validityPeriodHours: 168 });
      expect(search.offers).toEqual([]);
      expect(JSON.stringify(search)).not.toContain(identityPhone);

      await expect(pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [sellerId, '8 (700) 123-45-67']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('UPDATE sellers SET whatsapp_phone_e164=$2 WHERE id=$1', [sellerId, '+0447911123456']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('UPDATE sellers SET telegram_username=$2 WHERE id=$1', [sellerId, 't.me/evil']))
        .rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('UPDATE sellers SET instagram_username=$2 WHERE id=$1', [sellerId, 'instagram.com/evil']))
        .rejects.toMatchObject({ code: '23514' });

      await pool.query(`UPDATE sellers SET
        contact_phone_e164=$2, whatsapp_phone_e164=$3, telegram_username=$4, instagram_username=$5
        WHERE id=$1`, [sellerId, '+12025550123', '+447911123456', 'kaida_shop', 'two..dots']);
      expect((await pool.query(`SELECT contact_phone_e164,whatsapp_phone_e164,telegram_username,instagram_username
        FROM sellers WHERE id=$1`, [sellerId])).rows[0]).toEqual({
        contact_phone_e164: '+12025550123',
        whatsapp_phone_e164: '+447911123456',
        telegram_username: 'kaida_shop',
        instagram_username: 'two..dots',
      });
    });
  });
});
