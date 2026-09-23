import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase, withStructuredPriceUnit } from './migration-test-database';

async function createS2MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s2-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of ['0000_s0_first_search.sql', '0001_s1_offer_lifecycle.sql', '0002_s2_auth.sql']) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { version: string; dialect: string; entries: unknown[] };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 3) }, null, 2));
  return folder;
}

async function migrateToS2(db: ReturnType<typeof drizzle>) {
  const folder = await createS2MigrationsFolder();
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

const NOW = new Date('2026-09-12T00:00:00Z');

async function insertOffer(pool: Pool, values: { id: string; productId: string; sellerId: string; locationId: string; comment: string }) {
  await pool.query(
    `INSERT INTO offers (id, product_id, seller_id, location_id, price_amount, price_currency, price_unit, seller_comment, status, last_confirmed_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [values.id, values.productId, values.sellerId, values.locationId, '777.00', 'KZT', 'кг', values.comment, 'active', NOW, NOW, NOW],
  );
}

describe('S3 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades real S2 data, derives ownership and preserves Offer rows', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s3_upgrade_test' }, async (pool, db) => {
      await migrateToS2(db);

      const productId = '10000000-0000-4000-8000-000000000501';
      const canonicalSeller = '20000000-0000-4000-8000-000000000001';
      const legacySeller = '20000000-0000-4000-8000-000000000501';
      const canonicalLocation = '30000000-0000-4000-8000-000000000001';
      const legacyLocation = '30000000-0000-4000-8000-000000000501';
      const canonicalOffer = '40000000-0000-4000-8000-000000000501';
      const legacyOffer = '40000000-0000-4000-8000-000000000502';
      const userId = '50000000-0000-4000-8000-000000000501';

      await pool.query('INSERT INTO products (id, name) VALUES ($1,$2)', [productId, 'S3 upgrade fixture']);
      await pool.query('INSERT INTO sellers (id, display_name) VALUES ($1,$2),($3,$4)', [canonicalSeller, 'Асыл Ет, тестовый продавец', legacySeller, 'Legacy seller']);
      await pool.query('INSERT INTO locations (id, name, address_text) VALUES ($1,$2,$3),($4,$5,$6)', [canonicalLocation, 'Тестовая мясная точка', 'Алматы, Зелёный базар, тестовый павильон 12', legacyLocation, 'Legacy point', 'Legacy address']);
      await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, '+77000000501', NOW]);
      await insertOffer(pool, { id: canonicalOffer, productId, sellerId: canonicalSeller, locationId: canonicalLocation, comment: 'Canonical preserved' });
      await insertOffer(pool, { id: legacyOffer, productId, sellerId: legacySeller, locationId: legacyLocation, comment: 'Legacy preserved' });

      const beforeOffer = (await pool.query('SELECT * FROM offers WHERE id=$1', [legacyOffer])).rows[0];
      await migrate(db, { migrationsFolder: './drizzle/migrations' });
      const afterOffer = (await pool.query('SELECT * FROM offers WHERE id=$1', [legacyOffer])).rows[0];
      const { revision, seller_comment_version: sellerCommentVersion, ...preservedAfterOffer } = afterOffer;
      expect(preservedAfterOffer).toEqual(withStructuredPriceUnit(beforeOffer, 'kg'));
      expect(revision).toBe(1);
      expect(sellerCommentVersion).toBe(1);

      expect((await pool.query('SELECT owner_user_id FROM sellers WHERE id=$1', [canonicalSeller])).rows[0].owner_user_id).toBeNull();
      expect((await pool.query('SELECT seller_id, type FROM locations WHERE id=$1', [canonicalLocation])).rows[0]).toEqual({ seller_id: canonicalSeller, type: 'pavilion' });
      expect((await pool.query('SELECT seller_id, type FROM locations WHERE id=$1', [legacyLocation])).rows[0]).toEqual({ seller_id: legacySeller, type: 'other' });
      expect((await pool.query('SELECT phone_e164 FROM users WHERE id=$1', [userId])).rows[0].phone_e164).toBe('+77000000501');

      await expect(pool.query('INSERT INTO sellers (display_name, owner_user_id) VALUES ($1,$2)', ['Unknown owner', '99999999-9999-4999-8999-999999999999']))
        .rejects.toMatchObject({ code: '23503' });
      await expect(pool.query('INSERT INTO locations (seller_id, name, address_text, type) VALUES ($1,$2,$3,$4)', [legacySeller, 'Bad type', 'Address', 'warehouse']))
        .rejects.toMatchObject({ code: '23514' });

      const offerColumns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' ORDER BY ordinal_position")).rows.map((row) => row.column_name);
      expect(offerColumns).toEqual(['id', 'product_id', 'seller_id', 'location_id', 'price_amount', 'price_currency', 'seller_comment', 'created_at', 'updated_at', 'status', 'last_confirmed_at', 'revision', 'seller_comment_version', 'price_unit_code', 'price_unit_value']);
    });
  });

  it('fails atomically for ambiguous/unowned legacy Location and leaves S2 schema + journal intact', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s3_ambiguous_test' }, async (pool, db) => {
      await migrateToS2(db);
      const productId = '10000000-0000-4000-8000-000000000551';
      const sellerA = '20000000-0000-4000-8000-000000000551';
      const sellerB = '20000000-0000-4000-8000-000000000552';
      const ambiguousLocation = '30000000-0000-4000-8000-000000000551';
      const unownedLocation = '30000000-0000-4000-8000-000000000552';
      await pool.query('INSERT INTO products (id, name) VALUES ($1,$2)', [productId, 'S3 ambiguous fixture']);
      await pool.query('INSERT INTO sellers (id, display_name) VALUES ($1,$2),($3,$4)', [sellerA, 'Seller A', sellerB, 'Seller B']);
      await pool.query('INSERT INTO locations (id, name, address_text) VALUES ($1,$2,$3),($4,$5,$6)', [ambiguousLocation, 'Ambiguous', 'Address A', unownedLocation, 'Unowned', 'Address B']);
      await insertOffer(pool, { id: '40000000-0000-4000-8000-000000000551', productId, sellerId: sellerA, locationId: ambiguousLocation, comment: 'A' });
      await insertOffer(pool, { id: '40000000-0000-4000-8000-000000000552', productId, sellerId: sellerB, locationId: ambiguousLocation, comment: 'B' });

      await expect(migrate(db, { migrationsFolder: './drizzle/migrations' })).rejects.toBeTruthy();

      const s3Columns = Number((await pool.query(
        `SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND ((table_name='sellers' AND column_name='owner_user_id') OR (table_name='locations' AND column_name IN ('seller_id','type')))`,
      )).rows[0].count);
      expect(s3Columns).toBe(0);
      expect(Number((await pool.query('SELECT count(*) FROM drizzle.__drizzle_migrations')).rows[0].count)).toBe(3);
      expect((await pool.query('SELECT display_name FROM sellers WHERE id=$1', [sellerA])).rows[0].display_name).toBe('Seller A');
      expect((await pool.query('SELECT name FROM locations WHERE id=$1', [unownedLocation])).rows[0].name).toBe('Unowned');
    });
  });
});
