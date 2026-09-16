import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import {
  OfferChangedError,
  OfferPriceRequiredError,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { withMigrationTestDatabase } from './migration-test-database';

const PRE_PRICE_MIGRATIONS = [
  '0000_s0_first_search.sql',
  '0001_s1_offer_lifecycle.sql',
  '0002_s2_auth.sql',
  '0003_s3_seller_location.sql',
  '0004_s4_seller_change_set.sql',
  '0005_s5_offer_management.sql',
  '0006_s6_product_aliases.sql',
  '0007_s8_location_coordinates.sql',
  '0008_s10_seller_contacts.sql',
  '0009_s13_buyer_interests.sql',
] as const;

async function createPrePriceMigrationsFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-price-pre-migrations-'));
  await mkdir(join(folder, 'meta'));
  for (const file of PRE_PRICE_MIGRATIONS) {
    await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
  }
  const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as {
    version: string;
    dialect: string;
    entries: unknown[];
  };
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 10) }, null, 2));
  return folder;
}

async function migrateToPrePrice(db: Parameters<typeof migrate>[0]) {
  const folder = await createPrePriceMigrationsFolder();
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('Mandatory Offer Price migration upgrade on PostgreSQL 18', () => {
  it('quarantines active legacy no-price Offers without fabricating data and preserves seller remediation', async () => {
    await withMigrationTestDatabase({ name: 'kaida_mandatory_price_upgrade_test' }, async (pool, rawDb) => {
      await migrateToPrePrice(rawDb);
      const db = rawDb as unknown as Database;

      const userId = '50000000-0000-4000-8000-000000009901';
      const sellerId = '20000000-0000-4000-8000-000000009901';
      const locationId = '30000000-0000-4000-8000-000000009901';
      const productId = '10000000-0000-4000-8000-000000009901';
      const activeLegacyId = '40000000-0000-4000-8000-000000009901';
      const inactiveLegacyId = '40000000-0000-4000-8000-000000009902';
      const pricedId = '40000000-0000-4000-8000-000000009903';
      const legacyCreateSetId = '60000000-0000-4000-8000-000000009901';
      const legacyCreateItemId = '61000000-0000-4000-8000-000000009901';
      const staleActivationSetId = '60000000-0000-4000-8000-000000009902';
      const staleActivationItemId = '61000000-0000-4000-8000-000000009902';
      const beforeTime = new Date('2026-09-10T10:00:00Z');

      await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, '+77000009901', beforeTime]);
      await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'Legacy price seller', userId]);
      await pool.query(
        'INSERT INTO locations (id,name,address_text,seller_id,type) VALUES ($1,$2,$3,$4,$5)',
        [locationId, 'Legacy price point', 'Almaty legacy point', sellerId, 'shop'],
      );
      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Legacy price product']);

      await pool.query(
        `INSERT INTO offers (
          id,product_id,seller_id,location_id,price_amount,price_currency,price_unit,seller_comment,status,
          last_confirmed_at,revision,created_at,updated_at
        ) VALUES
          ($1,$4,$5,$6,NULL,NULL,NULL,'active legacy','active',$7,7,$7,$7),
          ($2,$4,$5,$6,NULL,NULL,NULL,'inactive legacy','inactive',$7,3,$7,$7),
          ($3,$4,$5,$6,'1250.00','KZT',NULL,'priced','active',$7,4,$7,$7)`,
        [activeLegacyId, inactiveLegacyId, pricedId, productId, sellerId, locationId, beforeTime],
      );

      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status) VALUES ($1,$2,$3)', [legacyCreateSetId, sellerId, 'proposed']);
      await pool.query(
        `INSERT INTO seller_change_items (id,change_set_id,action,product_id,location_id,price_amount,price_currency,price_unit)
         VALUES ($1,$2,'create_offer',$3,$4,NULL,NULL,NULL)`,
        [legacyCreateItemId, legacyCreateSetId, productId, locationId],
      );
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status) VALUES ($1,$2,$3)', [staleActivationSetId, sellerId, 'proposed']);
      await pool.query(
        `INSERT INTO seller_change_items (
          id,change_set_id,action,product_id,location_id,price_amount,price_currency,price_unit,target_offer_id,expected_offer_revision
        ) VALUES ($1,$2,'activate_offer',$3,$4,NULL,NULL,NULL,$5,7)`,
        [staleActivationItemId, staleActivationSetId, productId, locationId, activeLegacyId],
      );

      const countBefore = Number((await pool.query('SELECT count(*) FROM offers')).rows[0].count);
      await migrate(rawDb, { migrationsFolder: './drizzle/migrations' });

      const activeLegacy = (await pool.query('SELECT * FROM offers WHERE id=$1', [activeLegacyId])).rows[0];
      expect(activeLegacy).toMatchObject({
        id: activeLegacyId,
        status: 'inactive',
        revision: 8,
        price_amount: null,
        price_currency: null,
        price_unit: null,
        seller_comment: 'active legacy',
        product_id: productId,
        seller_id: sellerId,
        location_id: locationId,
      });
      expect(new Date(activeLegacy.last_confirmed_at).toISOString()).toBe(beforeTime.toISOString());
      expect(new Date(activeLegacy.updated_at).getTime()).toBeGreaterThan(beforeTime.getTime());

      const inactiveLegacy = (await pool.query('SELECT * FROM offers WHERE id=$1', [inactiveLegacyId])).rows[0];
      expect(inactiveLegacy).toMatchObject({ status: 'inactive', revision: 3, price_amount: null, price_currency: null, price_unit: null });
      expect(new Date(inactiveLegacy.updated_at).toISOString()).toBe(beforeTime.toISOString());

      const priced = (await pool.query('SELECT * FROM offers WHERE id=$1', [pricedId])).rows[0];
      expect(priced).toMatchObject({ status: 'active', revision: 4, price_amount: '1250.00', price_currency: 'KZT', price_unit: null });
      expect(Number((await pool.query('SELECT count(*) FROM offers')).rows[0].count)).toBe(countBefore);

      const constraints = await pool.query<{ conname: string; convalidated: boolean }>(`
        SELECT conname, convalidated
        FROM pg_constraint
        WHERE conname IN (
          'offers_active_price_required',
          'offers_future_price_required',
          'seller_change_items_future_price_required'
        )
        ORDER BY conname
      `);
      expect(constraints.rows).toEqual([
        { conname: 'offers_active_price_required', convalidated: true },
        { conname: 'offers_future_price_required', convalidated: false },
        { conname: 'seller_change_items_future_price_required', convalidated: false },
      ]);

      await expect(pool.query(
        `INSERT INTO offers (product_id,seller_id,location_id,status,last_confirmed_at)
         VALUES ($1,$2,$3,'active',$4)`,
        [productId, sellerId, locationId, beforeTime],
      )).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query(
        `INSERT INTO offers (product_id,seller_id,location_id,status,last_confirmed_at)
         VALUES ($1,$2,$3,'inactive',$4)`,
        [productId, sellerId, locationId, beforeTime],
      )).rejects.toMatchObject({ code: '23514' });

      const zero = await pool.query(
        `INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,price_unit,status,last_confirmed_at)
         VALUES ($1,$2,$3,'0','KZT',NULL,'inactive',$4) RETURNING price_amount,price_currency,price_unit`,
        [productId, sellerId, locationId, beforeTime],
      );
      expect(zero.rows[0]).toEqual({ price_amount: '0', price_currency: 'KZT', price_unit: null });

      await expect(confirmSellerChangeSet(userId, legacyCreateSetId, { database: db }))
        .rejects.toBeInstanceOf(OfferPriceRequiredError);
      expect((await pool.query('SELECT status,confirmed_at FROM seller_change_sets WHERE id=$1', [legacyCreateSetId])).rows[0])
        .toEqual({ status: 'proposed', confirmed_at: null });
      expect((await pool.query('SELECT result_offer_id FROM seller_change_items WHERE id=$1', [legacyCreateItemId])).rows[0].result_offer_id).toBeNull();

      await expect(confirmSellerChangeSet(userId, staleActivationSetId, { database: db }))
        .rejects.toBeInstanceOf(OfferChangedError);

      const updateInput = sellerOfferChangeBodySchema.parse({
        action: 'update_offer',
        price: { amount: '2500.00', unit: null },
        sellerComment: 'repaired',
      });
      const remediation = await createOfferManagementChangeSet(userId, inactiveLegacyId, updateInput, { database: db });
      await confirmSellerChangeSet(userId, remediation.id, { database: db, clock: () => new Date('2026-09-16T12:00:00Z') });
      expect((await pool.query('SELECT status,price_amount,price_currency,price_unit FROM offers WHERE id=$1', [inactiveLegacyId])).rows[0])
        .toEqual({ status: 'inactive', price_amount: '2500.00', price_currency: 'KZT', price_unit: null });

      const activationInput = sellerOfferChangeBodySchema.parse({ action: 'activate_offer' });
      const activation = await createOfferManagementChangeSet(userId, inactiveLegacyId, activationInput, { database: db });
      await confirmSellerChangeSet(userId, activation.id, { database: db, clock: () => new Date('2026-09-16T13:00:00Z') });
      expect((await pool.query('SELECT status,price_amount,price_currency FROM offers WHERE id=$1', [inactiveLegacyId])).rows[0])
        .toEqual({ status: 'active', price_amount: '2500.00', price_currency: 'KZT' });
    });
  });

  it('aborts instead of normalizing a partial legacy price tuple', async () => {
    await withMigrationTestDatabase({ name: 'kaida_mandatory_price_anomaly_test' }, async (pool, rawDb) => {
      await migrateToPrePrice(rawDb);
      const sellerId = '20000000-0000-4000-8000-000000009911';
      const locationId = '30000000-0000-4000-8000-000000009911';
      const productId = '10000000-0000-4000-8000-000000009911';
      const offerId = '40000000-0000-4000-8000-000000009911';
      const beforeTime = new Date('2026-09-10T10:00:00Z');

      await pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, 'Anomaly seller']);
      await pool.query(
        'INSERT INTO locations (id,name,address_text,seller_id,type) VALUES ($1,$2,$3,$4,$5)',
        [locationId, 'Anomaly point', 'Almaty anomaly point', sellerId, 'shop'],
      );
      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Anomaly product']);
      await pool.query(
        `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at)
         VALUES ($1,$2,$3,$4,NULL,'KZT','active',$5)`,
        [offerId, productId, sellerId, locationId, beforeTime],
      );

      await expect(migrate(rawDb, { migrationsFolder: './drizzle/migrations' })).rejects.toThrow(/partial legacy price tuple/);
      expect((await pool.query('SELECT status,price_amount,price_currency FROM offers WHERE id=$1', [offerId])).rows[0])
        .toEqual({ status: 'active', price_amount: null, price_currency: 'KZT' });
    });
  });
});
