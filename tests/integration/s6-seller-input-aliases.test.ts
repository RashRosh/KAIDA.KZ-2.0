import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  ProductAmbiguousError,
  ProductNotFoundError,
  sellerChangeSetCreateBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

const NOW = new Date('2026-09-13T07:00:00.000Z');
let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanupUser(userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function fixture(userId: string, phone: string) {
  await cleanupUser(userId, phone);
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, NOW]);
  return setupSeller(userId, {
    seller: { displayName: 'S6 Alias Seller' },
    location: { name: 'S6 Alias Point', type: 'shop', addressText: 'Almaty S6 Alias' },
  }, { database: db });
}

async function sellerCounts(sellerId: string) {
  const changeSets = Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerId])).rows[0].count);
  const items = Number((await pool.query('SELECT count(*) FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id=$1)', [sellerId])).rows[0].count);
  const offers = Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerId])).rows[0].count);
  return { changeSets, items, offers };
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});
afterAll(async () => { await pool.end(); });

describe.sequential('S6 Seller Input through shared Catalog resolver', () => {
  it('creates an alias proposal with canonical Product preview and confirms canonical product_id', async () => {
    const userId = '50000000-0000-4000-8000-000000000961';
    const phone = '+77000000961';
    const seller = await fixture(userId, phone);
    try {
      const input = sellerChangeSetCreateBodySchema.parse({ productName: '  МЯСО БАРАНА  ', locationId: seller.locations[0]!.id });
      const proposed = await createSellerChangeSet(userId, input, { database: db });
      expect(proposed.status).toBe('proposed');
      expect(proposed.items[0]).toMatchObject({
        action: 'create_offer',
        product: { id: seedIds.lambProduct, name: 'Баранина' },
        resultOffer: null,
      });
      expect(await sellerCounts(seller.id)).toEqual({ changeSets: 1, items: 1, offers: 0 });

      const storedItem = (await pool.query('SELECT product_id FROM seller_change_items WHERE change_set_id=$1', [proposed.id])).rows[0];
      expect(storedItem.product_id).toBe(seedIds.lambProduct);

      const confirmed = await confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => NOW });
      expect(confirmed.items[0]!.resultOffer).not.toBeNull();
      const storedOffer = (await pool.query('SELECT product_id FROM offers WHERE id=$1', [confirmed.items[0]!.resultOffer!.id])).rows[0];
      expect(storedOffer.product_id).toBe(seedIds.lambProduct);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('preserves PRODUCT_NOT_FOUND with zero Seller Input writes', async () => {
    const userId = '50000000-0000-4000-8000-000000000962';
    const phone = '+77000000962';
    const seller = await fixture(userId, phone);
    try {
      const input = sellerChangeSetCreateBodySchema.parse({ productName: 'S6 отсутствующий товар', locationId: seller.locations[0]!.id });
      await expect(createSellerChangeSet(userId, input, { database: db })).rejects.toBeInstanceOf(ProductNotFoundError);
      expect(await sellerCounts(seller.id)).toEqual({ changeSets: 0, items: 0, offers: 0 });
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('preserves PRODUCT_AMBIGUOUS with zero Seller Input writes for a shared alias', async () => {
    const userId = '50000000-0000-4000-8000-000000000963';
    const phone = '+77000000963';
    const seller = await fixture(userId, phone);
    const a = randomUUID();
    const b = randomUUID();
    const aliasA = randomUUID();
    const aliasB = randomUUID();
    try {
      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [a, 'S6 Seller Ambiguous A', b, 'S6 Seller Ambiguous B']);
      await pool.query('INSERT INTO product_aliases (id,product_id,name) VALUES ($1,$2,$3),($4,$5,$6)', [aliasA, a, 'S6 спорный продавец', aliasB, b, 'S6 спорный продавец']);
      const input = sellerChangeSetCreateBodySchema.parse({ productName: 'S6 спорный продавец', locationId: seller.locations[0]!.id });
      await expect(createSellerChangeSet(userId, input, { database: db })).rejects.toBeInstanceOf(ProductAmbiguousError);
      expect(await sellerCounts(seller.id)).toEqual({ changeSets: 0, items: 0, offers: 0 });
    } finally {
      await pool.query('DELETE FROM product_aliases WHERE id IN ($1,$2)', [aliasA, aliasB]);
      await pool.query('DELETE FROM products WHERE id IN ($1,$2)', [a, b]);
      await cleanupUser(userId, phone);
    }
  });
});
