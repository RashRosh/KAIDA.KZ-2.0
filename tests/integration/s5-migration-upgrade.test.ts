import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

async function createS4MigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-s4-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of [
    '0000_s0_first_search.sql',
    '0001_s1_offer_lifecycle.sql',
    '0002_s2_auth.sql',
    '0003_s3_seller_location.sql',
    '0004_s4_seller_change_set.sql',
  ]) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { version: string; dialect: string; entries: unknown[] };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 5) }, null, 2));
  return folder;
}

async function migrateToS4(db: ReturnType<typeof drizzle>) {
  const folder = await createS4MigrationsFolder();
  try { await migrate(db, { migrationsFolder: folder }); } finally { await rm(folder, { recursive: true, force: true }); }
}

const NOW = new Date('2026-09-12T09:00:00.000Z');

describe('S5 migration upgrade path on PostgreSQL 18', () => {
  it('upgrades real S4 data, preserves S4 rows and installs S5 revision/target constraints', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s5_upgrade_test' }, async (pool, db) => {
      await migrateToS4(db);

      const productId = '10000000-0000-4000-8000-000000000851';
      const userId = '50000000-0000-4000-8000-000000000851';
      const sellerId = '20000000-0000-4000-8000-000000000851';
      const locationId = '30000000-0000-4000-8000-000000000851';
      const offerId = '40000000-0000-4000-8000-000000000851';
      const changeSetId = '60000000-0000-4000-8000-000000000851';
      const itemId = '70000000-0000-4000-8000-000000000851';

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'S5 upgrade product']);
      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000000851', NOW]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S5 upgrade seller', userId]);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'Upgrade point', 'Upgrade address', 'shop']);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit,seller_comment,status,last_confirmed_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$9,$9)`, [offerId, productId, sellerId, locationId, '777.00', 'KZT', 'кг', 'Preserved', NOW]);
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status,created_at,confirmed_at) VALUES ($1,$2,$3,$4,$4)', [changeSetId, sellerId, 'confirmed', NOW]);
      await pool.query(`INSERT INTO seller_change_items (id,change_set_id,action,product_id,location_id,price_amount,price_currency,price_unit,seller_comment,result_offer_id)
        VALUES ($1,$2,'create_offer',$3,$4,$5,'KZT',$6,$7,$8)`, [itemId, changeSetId, productId, locationId, '777.00', 'кг', 'Preserved', offerId]);

      const offerBefore = (await pool.query('SELECT id,product_id,seller_id,location_id,price_amount,price_currency,price_unit,seller_comment,status,last_confirmed_at,created_at,updated_at FROM offers WHERE id=$1', [offerId])).rows[0];
      const itemBefore = (await pool.query('SELECT id,change_set_id,action,product_id,location_id,price_amount,price_currency,price_unit,seller_comment,result_offer_id FROM seller_change_items WHERE id=$1', [itemId])).rows[0];

      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      const offerAfter = (await pool.query('SELECT id,product_id,seller_id,location_id,price_amount,price_currency,price_unit,seller_comment,status,last_confirmed_at,created_at,updated_at,revision FROM offers WHERE id=$1', [offerId])).rows[0];
      const { revision, ...preservedOffer } = offerAfter;
      expect(preservedOffer).toEqual(offerBefore);
      expect(revision).toBe(1);

      const itemAfter = (await pool.query('SELECT id,change_set_id,action,product_id,location_id,price_amount,price_currency,price_unit,seller_comment,result_offer_id,target_offer_id,expected_offer_revision FROM seller_change_items WHERE id=$1', [itemId])).rows[0];
      const { target_offer_id, expected_offer_revision, ...preservedItem } = itemAfter;
      expect(preservedItem).toEqual(itemBefore);
      expect(target_offer_id).toBeNull();
      expect(expected_offer_revision).toBeNull();

      const proposedId = '60000000-0000-4000-8000-000000000852';
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status) VALUES ($1,$2,$3)', [proposedId, sellerId, 'proposed']);

      await expect(pool.query(`INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_amount,price_currency,target_offer_id,expected_offer_revision)
        VALUES ($1,'create_offer',$2,$3,1,'KZT',$4,1)`, [proposedId, productId, locationId, offerId])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query(`INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_amount,price_currency)
        VALUES ($1,'update_offer',$2,$3,1,'KZT')`, [proposedId, productId, locationId])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query(`INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_amount,price_currency,target_offer_id,expected_offer_revision)
        VALUES ($1,'update_offer',$2,$3,1,'KZT',$4,0)`, [proposedId, productId, locationId, offerId])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query(`INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_amount,price_currency,target_offer_id,expected_offer_revision)
        VALUES ($1,'update_offer',$2,$3,1,'KZT',$4,1)`, [proposedId, productId, locationId, '40000000-0000-4000-8000-000000000999'])).rejects.toMatchObject({ code: '23503' });
      await expect(pool.query(`INSERT INTO seller_change_items (change_set_id,action,product_id,location_id,price_amount,price_currency,target_offer_id,expected_offer_revision)
        VALUES ($1,'delete_offer',$2,$3,1,'KZT',$4,1)`, [proposedId, productId, locationId, offerId])).rejects.toMatchObject({ code: '23514' });

      for (const action of ['update_offer', 'deactivate_offer', 'activate_offer']) {
        const id = crypto.randomUUID();
        await expect(pool.query(`INSERT INTO seller_change_items (id,change_set_id,action,product_id,location_id,price_amount,price_currency,target_offer_id,expected_offer_revision)
          VALUES ($1,$2,$3,$4,$5,1,'KZT',$6,1)`, [id, proposedId, action, productId, locationId, offerId])).resolves.toBeDefined();
      }

      const revisionDefault = await pool.query(`SELECT column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='revision'`);
      expect(revisionDefault.rows[0]).toEqual({ column_default: '1', is_nullable: 'NO' });
    });
  });

  it('applies the full 0000-0005 chain to a clean PostgreSQL 18 database', async () => {
    await withMigrationTestDatabase({ name: 'kaida_s5_clean_chain_test' }, async (pool, db) => {
      await migrate(db, { migrationsFolder: './drizzle/migrations' });
      const columns = await pool.query(`SELECT table_name,column_name FROM information_schema.columns
        WHERE table_schema='public' AND ((table_name='offers' AND column_name='revision') OR (table_name='seller_change_items' AND column_name IN ('target_offer_id','expected_offer_revision')))
        ORDER BY table_name,column_name`);
      expect(columns.rows).toEqual([
        { table_name: 'offers', column_name: 'revision' },
        { table_name: 'seller_change_items', column_name: 'expected_offer_revision' },
        { table_name: 'seller_change_items', column_name: 'target_offer_id' },
      ]);
    });
  });
});
