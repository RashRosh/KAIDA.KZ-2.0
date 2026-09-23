import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

async function migrateToFoundation(db: ReturnType<typeof drizzle>) {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-localization-foundation-'));
  await mkdir(join(folder, 'meta'));
  try {
    for (const file of [
      '0000_s0_first_search.sql', '0001_s1_offer_lifecycle.sql', '0002_s2_auth.sql',
      '0003_s3_seller_location.sql', '0004_s4_seller_change_set.sql', '0005_s5_offer_management.sql',
      '0006_s6_product_aliases.sql', '0007_s8_location_coordinates.sql', '0008_s10_seller_contacts.sql',
      '0009_s13_buyer_interests.sql', '0010_mandatory_offer_price.sql',
    ]) await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
    const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { entries: unknown[] };
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 11) }));
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('Catalog localization migration upgrade', () => {
  it('preserves Product, alias and Offer identities and copies every legacy name to ru', async () => {
    await withMigrationTestDatabase({ name: 'kaida_catalog_localization_upgrade_test' }, async (pool, db) => {
      await migrateToFoundation(db);
      const productId = '10000000-0000-4000-8000-000000001101';
      const sellerId = '20000000-0000-4000-8000-000000001101';
      const locationId = '30000000-0000-4000-8000-000000001101';
      const offerId = '40000000-0000-4000-8000-000000001101';
      const aliasId = '11000000-0000-4000-8000-000000001101';
      const now = new Date('2026-09-23T00:00:00.000Z');

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Upgrade Product']);
      await pool.query('INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3)', [aliasId, productId, 'upgrade alias']);
      await pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, 'Upgrade Seller']);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'Upgrade Point', 'Upgrade Address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at)
        VALUES ($1,$2,$3,$4,'100','KZT','active',$5)`, [offerId, productId, sellerId, locationId, now]);

      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT id,name FROM products WHERE id=$1', [productId])).rows[0]).toEqual({ id: productId, name: 'Upgrade Product' });
      expect((await pool.query('SELECT id,product_id,name,locale FROM product_aliases WHERE id=$1', [aliasId])).rows[0]).toEqual({ id: aliasId, product_id: productId, name: 'upgrade alias', locale: null });
      expect((await pool.query('SELECT id,product_id FROM offers WHERE id=$1', [offerId])).rows[0]).toEqual({ id: offerId, product_id: productId });
      expect((await pool.query('SELECT product_id,locale,name,verified_at FROM product_localized_names WHERE product_id=$1', [productId])).rows).toEqual([
        { product_id: productId, locale: 'ru', name: 'Upgrade Product', verified_at: null },
      ]);
    });
  });
});
