import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

async function migrateToCatalogLocalization(db: ReturnType<typeof drizzle>) {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-catalog-localization-'));
  await mkdir(join(folder, 'meta'));
  try {
    const files = (await readdir(join(process.cwd(), 'drizzle/migrations')))
      .filter((file) => file.endsWith('.sql') && file < '0012')
      .sort();
    expect(files.at(-1)).toBe('0011_catalog_localization.sql');
    for (const file of files) await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
    const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { entries: unknown[] };
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 12) }));
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('Seller comment translation migration upgrade', () => {
  it('keeps Offer ids and comments unchanged, starts every comment at version 1 and adds empty storage', async () => {
    await withMigrationTestDatabase({ name: 'kaida_seller_comment_translation_upgrade_test' }, async (pool, db) => {
      await migrateToCatalogLocalization(db);
      const productId = '10000000-0000-4000-8000-000000001201';
      const sellerId = '20000000-0000-4000-8000-000000001201';
      const locationId = '30000000-0000-4000-8000-000000001201';
      const commented = '40000000-0000-4000-8000-000000001201';
      const plain = '40000000-0000-4000-8000-000000001202';
      const now = new Date('2026-09-23T00:00:00.000Z');

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Upgrade Product']);
      await pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, 'Upgrade Seller']);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'Upgrade Point', 'Upgrade Address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,seller_comment,status,last_confirmed_at,revision)
        VALUES ($1,$3,$4,$5,'100','KZT','Жаңа, таңертеңгі жеткізілім','active',$6,4),
               ($2,$3,$4,$5,'200','KZT',NULL,'inactive',$6,2)`, [commented, plain, productId, sellerId, locationId, now]);

      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT id,seller_comment,seller_comment_version,revision,status FROM offers ORDER BY id')).rows).toEqual([
        { id: commented, seller_comment: 'Жаңа, таңертеңгі жеткізілім', seller_comment_version: 1, revision: 4, status: 'active' },
        { id: plain, seller_comment: null, seller_comment_version: 1, revision: 2, status: 'inactive' },
      ]);
      expect((await pool.query('SELECT count(*)::int AS n FROM offer_comment_translations')).rows[0].n).toBe(0);
    });
  });
});
