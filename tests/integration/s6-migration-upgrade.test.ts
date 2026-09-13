import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './database';

async function createS5MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s5-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of [
    '0000_s0_first_search.sql',
    '0001_s1_offer_lifecycle.sql',
    '0002_s2_auth.sql',
    '0003_s3_seller_location.sql',
    '0004_s4_seller_change_set.sql',
    '0005_s5_offer_management.sql',
  ]) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { version: string; dialect: string; entries: unknown[] };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 6) }, null, 2));
  return folder;
}

async function closeTargetPool(pool: Pool, admin: Pool, name: string) {
  const expectedRemovals = pool.totalCount;
  let removed = 0;
  let resolveRemoved: (() => void) | undefined;
  const removedPromise = expectedRemovals === 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveRemoved = resolve;
      });

  const onRemove = () => {
    removed += 1;
    if (removed === expectedRemovals) resolveRemoved?.();
  };

  if (expectedRemovals > 0) pool.on('remove', onRemove);
  try {
    await pool.end();
    await removedPromise;
  } finally {
    if (expectedRemovals > 0) pool.off('remove', onRemove);
  }

  const remaining = await admin.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = $1',
    [name],
  );
  if (remaining.rows[0]?.count !== '0') {
    throw new Error(
      `S6 migration test target still has active connections after pool shutdown: ${remaining.rows[0]?.count ?? 'unknown'}`,
    );
  }
}

async function withDatabase<T>(name: string, run: (pool: Pool, db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const guardedUrl = testDatabaseUrl();
  const developmentUrl = new URL(process.env.DATABASE_URL!);
  if (decodeURIComponent(developmentUrl.pathname) === `/${name}`) throw new Error('Development database must never be S6 migration test target');
  const admin = new Pool({ connectionString: guardedUrl, max: 1 });
  let pool: Pool | undefined;
  try {
    const version = Number((await admin.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version);
    if (version < 180000 || version >= 190000) throw new Error('S6 migration test requires PostgreSQL 18');
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(guardedUrl);
    url.pathname = `/${name}`;
    pool = new Pool({ connectionString: url.toString(), max: 4 });
    return await run(pool, drizzle({ client: pool }));
  } finally {
    if (pool) await closeTargetPool(pool, admin, name);
    try { await admin.query(`DROP DATABASE IF EXISTS "${name}"`); } finally { await admin.end(); }
  }
}

async function migrateToS5(db: ReturnType<typeof drizzle>) {
  const folder = await createS5MigrationsFolder();
  try { await migrate(db, { migrationsFolder: folder }); } finally { await rm(folder, { recursive: true, force: true }); }
}

const NOW = new Date('2026-09-13T08:00:00.000Z');

describe.sequential('S6 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades valid real S5 data without rewriting Product, Offer or SellerChangeItem identities', async () => {
    await withDatabase('kaida_s6_upgrade_test', async (pool, db) => {
      await migrateToS5(db);

      const productId = '10000000-0000-4000-8000-000000000861';
      const userId = '50000000-0000-4000-8000-000000000861';
      const sellerId = '20000000-0000-4000-8000-000000000861';
      const locationId = '30000000-0000-4000-8000-000000000861';
      const offerId = '40000000-0000-4000-8000-000000000861';
      const changeSetId = '60000000-0000-4000-8000-000000000861';
      const itemId = '70000000-0000-4000-8000-000000000861';

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'S6 upgrade product']);
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000000861', NOW]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S6 upgrade seller', userId]);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'S6 upgrade point', 'S6 upgrade address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,'861.00','KZT','active',$5,$5,$5)`, [offerId, productId, sellerId, locationId, NOW]);
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status,created_at,confirmed_at) VALUES ($1,$2,$3,$4,$4)', [changeSetId, sellerId, 'confirmed', NOW]);
      await pool.query(`INSERT INTO seller_change_items (id,change_set_id,action,product_id,location_id,result_offer_id)
        VALUES ($1,$2,'create_offer',$3,$4,$5)`, [itemId, changeSetId, productId, locationId, offerId]);

      const productBefore = (await pool.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0];
      const offerBefore = (await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0];
      const itemBefore = (await pool.query('SELECT * FROM seller_change_items WHERE id=$1', [itemId])).rows[0];

      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0]).toEqual(productBefore);
      expect((await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0]).toEqual(offerBefore);
      expect((await pool.query('SELECT * FROM seller_change_items WHERE id=$1', [itemId])).rows[0]).toEqual(itemBefore);
      expect((await pool.query("SELECT to_regclass('public.product_aliases') AS table_name")).rows[0].table_name).toBe('product_aliases');

      const indexes = await pool.query<{ indexname: string; indexdef: string }>(`SELECT indexname,indexdef FROM pg_indexes
        WHERE schemaname='public' AND indexname IN ('products_name_normalized_unique','product_aliases_name_product_normalized_unique') ORDER BY indexname`);
      expect(indexes.rows.map((row) => row.indexname)).toEqual([
        'product_aliases_name_product_normalized_unique',
        'products_name_normalized_unique',
      ]);
      for (const row of indexes.rows) {
        const def = row.indexdef.toLowerCase();
        expect(def).toContain('unique');
        expect(def).toContain('normalize');
        expect(def).toContain('casefold');
        expect(def).toContain('pg_unicode_fast');
      }
    });
  });

  it('rolls back all of 0006 when legacy canonical Products collide after normalization', async () => {
    await withDatabase('kaida_s6_collision_test', async (pool, db) => {
      await migrateToS5(db);

      const productA = '10000000-0000-4000-8000-000000000871';
      const productB = '10000000-0000-4000-8000-000000000872';
      const userId = '50000000-0000-4000-8000-000000000871';
      const sellerId = '20000000-0000-4000-8000-000000000871';
      const locationId = '30000000-0000-4000-8000-000000000871';
      const offerId = '40000000-0000-4000-8000-000000000871';
      const changeSetId = '60000000-0000-4000-8000-000000000871';
      const itemId = '70000000-0000-4000-8000-000000000871';

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [productA, 'Баранина', productB, 'баранина']);
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000000871', NOW]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S6 collision seller', userId]);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'Collision point', 'Collision address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,status,last_confirmed_at) VALUES ($1,$2,$3,$4,'active',$5)`, [offerId, productA, sellerId, locationId, NOW]);
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status,created_at,confirmed_at) VALUES ($1,$2,$3,$4,$4)', [changeSetId, sellerId, 'confirmed', NOW]);
      await pool.query(`INSERT INTO seller_change_items (id,change_set_id,action,product_id,location_id,result_offer_id)
        VALUES ($1,$2,'create_offer',$3,$4,$5)`, [itemId, changeSetId, productA, locationId, offerId]);

      const productsBefore = (await pool.query('SELECT * FROM products ORDER BY id')).rows;
      const offersBefore = (await pool.query('SELECT * FROM offers ORDER BY id')).rows;
      const itemsBefore = (await pool.query('SELECT * FROM seller_change_items ORDER BY id')).rows;
      const journalBefore = Number((await pool.query('SELECT count(*) FROM drizzle.__drizzle_migrations')).rows[0].count);
      expect(journalBefore).toBe(6);

      await expect(migrate(db, { migrationsFolder: './drizzle/migrations' })).rejects.toBeTruthy();

      expect((await pool.query('SELECT * FROM products ORDER BY id')).rows).toEqual(productsBefore);
      expect((await pool.query('SELECT * FROM offers ORDER BY id')).rows).toEqual(offersBefore);
      expect((await pool.query('SELECT * FROM seller_change_items ORDER BY id')).rows).toEqual(itemsBefore);
      expect((await pool.query("SELECT to_regclass('public.product_aliases') AS table_name")).rows[0].table_name).toBeNull();
      expect((await pool.query(`SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public' AND indexname IN ('products_name_normalized_unique','product_aliases_name_product_normalized_unique')`)).rows[0].count).toBe(0);
      expect(Number((await pool.query('SELECT count(*) FROM drizzle.__drizzle_migrations')).rows[0].count)).toBe(6);
    });
  });

  it('applies the clean current migration chain and installs ProductAlias constraints', async () => {
    await withDatabase('kaida_s6_clean_chain_test', async (pool, db) => {
      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      const table = await pool.query(`SELECT column_name,is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='product_aliases' ORDER BY ordinal_position`);
      expect(table.rows).toEqual([
        { column_name: 'id', is_nullable: 'NO' },
        { column_name: 'product_id', is_nullable: 'NO' },
        { column_name: 'name', is_nullable: 'NO' },
      ]);

      const constraints = await pool.query(`SELECT conname,contype FROM pg_constraint
        WHERE conrelid='public.product_aliases'::regclass ORDER BY conname`);
      expect(constraints.rows).toEqual(expect.arrayContaining([
        { conname: 'product_aliases_name_not_empty', contype: 'c' },
        { conname: 'product_aliases_pkey', contype: 'p' },
        { conname: 'product_aliases_product_id_products_id_fk', contype: 'f' },
      ]));

      const indexes = await pool.query(`SELECT indexname FROM pg_indexes
        WHERE schemaname='public' AND indexname IN ('products_name_normalized_unique','product_aliases_name_product_normalized_unique') ORDER BY indexname`);
      expect(indexes.rows).toEqual([
        { indexname: 'product_aliases_name_product_normalized_unique' },
        { indexname: 'products_name_normalized_unique' },
      ]);
    });
  });
});
