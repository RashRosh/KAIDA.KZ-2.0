import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './database';

async function createS3MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s3-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of ['0000_s0_first_search.sql', '0001_s1_offer_lifecycle.sql', '0002_s2_auth.sql', '0003_s3_seller_location.sql']) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { version: string; dialect: string; entries: unknown[] };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 4) }, null, 2));
  return folder;
}

async function withUpgradeDatabase<T>(run: (pool: Pool, db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const guardedUrl = testDatabaseUrl();
  const developmentUrl = new URL(process.env.DATABASE_URL!);
  const name = 'kaida_s4_upgrade_test';
  if (decodeURIComponent(developmentUrl.pathname) === `/${name}`) throw new Error('Development database must never be S4 upgrade target');
  const admin = new Pool({ connectionString: guardedUrl, max: 1 });
  let pool: Pool | undefined;
  try {
    const version = Number((await admin.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version);
    if (version < 180000 || version >= 190000) throw new Error('S4 migration test requires PostgreSQL 18');
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

async function migrateToS3(db: ReturnType<typeof drizzle>) {
  const folder = await createS3MigrationsFolder();
  try { await migrate(db, { migrationsFolder: folder }); } finally { await rm(folder, { recursive: true, force: true }); }
}

const NOW = new Date('2026-09-12T00:00:00Z');

describe('S4 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades real S3 data unchanged and installs Seller Change Set constraints', async () => {
    await withUpgradeDatabase(async (pool, db) => {
      await migrateToS3(db);

      const productId = '10000000-0000-4000-8000-000000000701';
      const userId = '50000000-0000-4000-8000-000000000701';
      const sellerId = '20000000-0000-4000-8000-000000000701';
      const locationId = '30000000-0000-4000-8000-000000000701';
      const offerId = '40000000-0000-4000-8000-000000000701';

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'S4 upgrade product']);
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000000701', NOW]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S4 upgrade seller', userId]);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'Upgrade point', 'Upgrade address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit,seller_comment,status,last_confirmed_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$9,$9)`, [offerId, productId, sellerId, locationId, '777.00', 'KZT', 'кг', 'Preserved', NOW]);

      const before = {
        product: (await pool.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0],
        user: (await pool.query('SELECT * FROM users WHERE id=$1', [userId])).rows[0],
        seller: (await pool.query('SELECT * FROM sellers WHERE id=$1', [sellerId])).rows[0],
        location: (await pool.query('SELECT * FROM locations WHERE id=$1', [locationId])).rows[0],
        offer: (await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0],
      };

      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0]).toEqual(before.product);
      expect((await pool.query('SELECT * FROM users WHERE id=$1', [userId])).rows[0]).toEqual(before.user);
      expect((await pool.query('SELECT * FROM sellers WHERE id=$1', [sellerId])).rows[0]).toEqual(before.seller);
      expect((await pool.query('SELECT id,seller_id,name,address_text,type FROM locations WHERE id=$1', [locationId])).rows[0]).toEqual(before.location);
      expect((await pool.query('SELECT latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0]).toEqual({ latitude: null, longitude: null });
      const afterOffer = (await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0];
      const { revision, ...preservedAfterOffer } = afterOffer;
      expect(preservedAfterOffer).toEqual(before.offer);
      expect(revision).toBe(1);
      expect(Number((await pool.query('SELECT count(*) FROM seller_change_sets')).rows[0].count)).toBe(0);
      expect(Number((await pool.query('SELECT count(*) FROM seller_change_items')).rows[0].count)).toBe(0);

      const changeSetId = '60000000-0000-4000-8000-000000000701';
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status) VALUES ($1,$2,$3)', [changeSetId, sellerId, 'proposed']);
      await expect(pool.query('INSERT INTO seller_change_sets (seller_id,status) VALUES ($1,$2)', [sellerId, 'cancelled'])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO seller_change_sets (seller_id,status,confirmed_at) VALUES ($1,$2,$3)', [sellerId, 'confirmed', null])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO seller_change_sets (seller_id,status) VALUES ($1,$2)', ['99999999-9999-4999-8999-999999999999', 'proposed'])).rejects.toMatchObject({ code: '23503' });

      await expect(pool.query('INSERT INTO seller_change_items (change_set_id,action,product_id,location_id) VALUES ($1,$2,$3,$4)', [changeSetId, 'update_offer', productId, locationId])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO seller_change_items (change_set_id,action,product_id,location_id) VALUES ($1,$2,$3,$4)', ['60000000-0000-4000-8000-000000000799', 'create_offer', productId, locationId])).rejects.toMatchObject({ code: '23503' });
      await expect(pool.query('INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_amount,price_currency) VALUES ($1,$2,$3,$4,$5,$6)', [changeSetId, 'create_offer', productId, locationId, '1.234', 'KZT'])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_currency) VALUES ($1,$2,$3,$4,$5)', [changeSetId, 'create_offer', productId, locationId, 'KZT'])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,result_offer_id) VALUES ($1,$2,$3,$4,$5)', [changeSetId, 'create_offer', productId, locationId, '40000000-0000-4000-8000-000000000799'])).rejects.toMatchObject({ code: '23503' });

      const index = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='seller_change_items' AND indexname='seller_change_items_change_set_id_idx'");
      expect(index.rowCount).toBe(1);
      const tupleUnique = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='offers' AND indexdef ILIKE '%seller_id%product_id%location_id%' AND indexdef ILIKE '%UNIQUE%'");
      expect(tupleUnique.rowCount).toBe(0);
    });
  });
});
