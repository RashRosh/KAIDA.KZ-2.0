import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { testDatabaseUrl } from './database';

async function createPreS8MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s8-pre-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of [
    '0000_s0_first_search.sql',
    '0001_s1_offer_lifecycle.sql',
    '0002_s2_auth.sql',
    '0003_s3_seller_location.sql',
    '0004_s4_seller_change_set.sql',
    '0005_s5_offer_management.sql',
    '0006_s6_product_aliases.sql',
  ]) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as {
    version: string;
    dialect: string;
    entries: unknown[];
  };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 7) }, null, 2));
  return folder;
}

async function withUpgradeDatabase<T>(run: (pool: Pool, db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const guardedUrl = testDatabaseUrl();
  const developmentUrl = new URL(process.env.DATABASE_URL!);
  const name = 'kaida_s8_upgrade_test';
  if (decodeURIComponent(developmentUrl.pathname) === `/${name}`) throw new Error('Development database must never be S8 upgrade target');
  const admin = new Pool({ connectionString: guardedUrl, max: 1 });
  let pool: Pool | undefined;
  try {
    const version = Number((await admin.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version);
    if (version < 180000 || version >= 190000) throw new Error('S8 migration test requires PostgreSQL 18');
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(guardedUrl);
    url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.toString(), max: 4 });
    return await run(pool, drizzle({ client: pool }));
  } finally {
    await pool?.end();
    try { await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); } finally { await admin.end(); }
  }
}

async function migrateToPreS8(db: ReturnType<typeof drizzle>) {
  const folder = await createPreS8MigrationsFolder();
  try { await migrate(db, { migrationsFolder: folder }); } finally { await rm(folder, { recursive: true, force: true }); }
}

describe('S8 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades 0000-0006 data through 0007 preserving identities and Offer.location_id, then current Search finds the migrated Offer', async () => {
    await withUpgradeDatabase(async (pool, rawDb) => {
      await migrateToPreS8(rawDb);
      const db = rawDb as unknown as Database;

      const productId = '10000000-0000-4000-8000-000000000981';
      const userId = '50000000-0000-4000-8000-000000000981';
      const sellerId = '20000000-0000-4000-8000-000000000981';
      const locationId = '30000000-0000-4000-8000-000000000981';
      const offerId = '40000000-0000-4000-8000-000000000981';
      const productName = 'S8 migration product 981';
      const now = new Date('2026-09-13T12:00:00Z');

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000000981', now]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S8 migration seller', userId]);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'S8 migration point', 'S8 migration address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,status,last_confirmed_at,revision,created_at,updated_at)
        VALUES ($1,$2,$3,$4,'active',$5,1,$5,$5)`, [offerId, productId, sellerId, locationId, now]);

      expect((await pool.query('SELECT id,name FROM products WHERE id=$1', [productId])).rows[0])
        .toEqual({ id: productId, name: productName });
      expect((await pool.query('SELECT id,owner_user_id FROM sellers WHERE id=$1', [sellerId])).rows[0])
        .toEqual({ id: sellerId, owner_user_id: userId });
      expect((await pool.query('SELECT id,seller_id,name,address_text,type FROM locations WHERE id=$1', [locationId])).rows[0])
        .toEqual({
          id: locationId,
          seller_id: sellerId,
          name: 'S8 migration point',
          address_text: 'S8 migration address',
          type: 'shop',
        });
      expect((await pool.query('SELECT id,product_id,seller_id,location_id FROM offers WHERE id=$1', [offerId])).rows[0])
        .toEqual({ id: offerId, product_id: productId, seller_id: sellerId, location_id: locationId });

      await migrate(rawDb, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT id,name FROM products WHERE id=$1', [productId])).rows[0])
        .toEqual({ id: productId, name: productName });
      expect((await pool.query('SELECT id,owner_user_id FROM sellers WHERE id=$1', [sellerId])).rows[0])
        .toEqual({ id: sellerId, owner_user_id: userId });
      expect((await pool.query('SELECT id,seller_id,name,address_text,type,latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0])
        .toEqual({
          id: locationId,
          seller_id: sellerId,
          name: 'S8 migration point',
          address_text: 'S8 migration address',
          type: 'shop',
          latitude: null,
          longitude: null,
        });
      expect((await pool.query('SELECT id,product_id,seller_id,location_id FROM offers WHERE id=$1', [offerId])).rows[0])
        .toEqual({ id: offerId, product_id: productId, seller_id: sellerId, location_id: locationId });

      const searchAfter = await searchOffers(productName, db, { clock: () => now, validityPeriodHours: 168 });
      expect(searchAfter.offers.map((offer) => offer.id)).toEqual([offerId]);

      await expect(pool.query('UPDATE locations SET latitude=43,longitude=NULL WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_geo_complete_pair' });
      await expect(pool.query('UPDATE locations SET latitude=91,longitude=0 WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_latitude_range' });
      await expect(pool.query('UPDATE locations SET latitude=0,longitude=181 WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_longitude_range' });

      for (const special of ['NaN', 'Infinity', '-Infinity']) {
        await expect(pool.query(`UPDATE locations SET latitude='${special}'::double precision,longitude=0 WHERE id=$1`, [locationId]))
          .rejects.toMatchObject({ code: '23514', constraint: 'locations_latitude_range' });
        await expect(pool.query(`UPDATE locations SET latitude=0,longitude='${special}'::double precision WHERE id=$1`, [locationId]))
          .rejects.toMatchObject({ code: '23514', constraint: 'locations_longitude_range' });
      }
    });
  });
});
