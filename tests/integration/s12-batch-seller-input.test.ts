import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createBatchSellerChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { getSellerChangeSet } from '../../src/modules/seller-input/application/get-seller-change-set';
import {
  BatchOfferConflictError,
  OfferChangedError,
  ProductNotFoundError,
  sellerBatchChangeSetCreateBodySchema,
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-14T00:00:00.000Z');
const T1 = new Date('2026-09-14T01:00:00.000Z');
const T2 = new Date('2026-09-14T02:00:00.000Z');
const T3 = new Date('2026-09-14T03:00:00.000Z');

async function cleanup(userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function fixture(userId: string, phone: string, label: string) {
  await cleanup(userId, phone);
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);
  const seller = await setupSeller(userId, {
    seller: { displayName: `S12 Seller ${label}` },
    location: { name: `S12 Point ${label}`, type: 'shop', addressText: `Almaty S12 ${label}` },
  }, { database: db });
  return seller;
}

async function createOffer(userId: string, locationId: string, productName: string, amount: string, comment: string) {
  const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
    productName,
    locationId,
    price: { amount, unit: { code: 'kg' } },
    sellerComment: comment,
  }), { database: db });
  const confirmed = await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 });
  return confirmed.items[0]!.resultOffer!.id;
}

async function counts(sellerId: string) {
  return {
    changeSets: Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerId])).rows[0].count),
    items: Number((await pool.query('SELECT count(*) FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id=$1)', [sellerId])).rows[0].count),
    offers: Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerId])).rows[0].count),
  };
}

async function offer(offerId: string) {
  return (await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0];
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe('S12 batch seller input on PostgreSQL 18 after Mandatory Offer Price', () => {
  it('persists one multi-item proposal, keeps buyer truth unchanged before confirm, then applies the whole mixed batch once', async () => {
    const userId = '50000000-0000-4000-8000-000000001201';
    const phone = '+77000001201';
    const seller = await fixture(userId, phone, '1201');
    try {
      const locationId = seller.locations[0]!.id;
      const lambId = await createOffer(userId, locationId, 'Баранина', '4000.00', 'Старая баранина');
      const beefId = await createOffer(userId, locationId, 'Говядина', '3500.00', 'Старая говядина');
      const beforeLamb = await offer(lambId);
      const beforeBeef = await offer(beefId);

      const proposal = await createBatchSellerChangeSet(userId, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'update_offer', offerId: lambId, price: { amount: '4500.00', unit: { code: 'kg' } }, sellerComment: 'Новая баранина' },
          { action: 'deactivate_offer', offerId: beefId },
          { action: 'create_offer', productName: 'Говядина', locationId, price: { amount: '3700.00', unit: { code: 'kg' } }, sellerComment: 'Новый Offer говядины' },
        ],
      }), { database: db });

      expect(proposal.status).toBe('proposed');
      expect(proposal.items).toHaveLength(3);
      expect(proposal.items.every((item) => item.resultOffer === null)).toBe(true);
      expect(await offer(lambId)).toEqual(beforeLamb);
      expect(await offer(beefId)).toEqual(beforeBeef);
      expect(await getSellerChangeSet(userId, proposal.id, { database: db })).toEqual(proposal);

      const confirmed = await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T1 });
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.items).toHaveLength(3);
      expect(confirmed.items.every((item) => item.resultOffer !== null)).toBe(true);

      expect(await offer(lambId)).toMatchObject({ price_amount: '4500.00', seller_comment: 'Новая баранина', revision: 2, status: 'active' });
      expect(await offer(beefId)).toMatchObject({ price_amount: '3500.00', seller_comment: 'Старая говядина', revision: 2, status: 'inactive' });
      expect((await counts(seller.id)).offers).toBe(3);

      const createdItem = confirmed.items.find((item) => item.action === 'create_offer');
      expect(createdItem?.resultOffer?.status).toBe('active');
      const createdRow = await offer(createdItem!.resultOffer!.id);
      expect(createdRow).toMatchObject({ price_amount: '3700.00', seller_comment: 'Новый Offer говядины', revision: 1, status: 'active' });

      const repeated = await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T3 });
      expect(repeated).toEqual(confirmed);
      expect((await offer(lambId)).revision).toBe(2);
      expect((await offer(beefId)).revision).toBe(2);
      expect((await counts(seller.id)).offers).toBe(3);
    } finally {
      await cleanup(userId, phone);
    }
  });

  it('keeps proposal creation zero-persistence when any item fails and rejects duplicate management targets before persistence', async () => {
    const userId = '50000000-0000-4000-8000-000000001202';
    const phone = '+77000001202';
    const seller = await fixture(userId, phone, '1202');
    try {
      const locationId = seller.locations[0]!.id;
      const lambId = await createOffer(userId, locationId, 'Баранина', '4000.00', 'Исходное');
      const before = await counts(seller.id);

      await expect(createBatchSellerChangeSet(userId, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'activate_offer', offerId: lambId },
          { action: 'create_offer', productName: 'Несуществующий S12 товар', locationId, price: { amount: '1' } },
        ],
      }), { database: db })).rejects.toBeInstanceOf(ProductNotFoundError);
      expect(await counts(seller.id)).toEqual(before);

      await expect(createBatchSellerChangeSet(userId, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'update_offer', offerId: lambId, price: { amount: '4100.00', unit: { code: 'kg' } }, sellerComment: 'A' },
          { action: 'activate_offer', offerId: lambId },
        ],
      }), { database: db })).rejects.toBeInstanceOf(BatchOfferConflictError);
      expect(await counts(seller.id)).toEqual(before);
    } finally {
      await cleanup(userId, phone);
    }
  });

  it('rolls back the whole batch when one target becomes stale, including a create_offer item', async () => {
    const userId = '50000000-0000-4000-8000-000000001203';
    const phone = '+77000001203';
    const seller = await fixture(userId, phone, '1203');
    try {
      const locationId = seller.locations[0]!.id;
      const lambId = await createOffer(userId, locationId, 'Баранина', '4000.00', 'L0');
      const beefId = await createOffer(userId, locationId, 'Говядина', '3500.00', 'B0');

      const batch = await createBatchSellerChangeSet(userId, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'create_offer', productName: 'Говядина', locationId, price: { amount: '3600.00', unit: { code: 'kg' } }, sellerComment: 'Не должен появиться' },
          { action: 'update_offer', offerId: lambId, price: { amount: '4200.00', unit: { code: 'kg' } }, sellerComment: 'Batch lamb' },
          { action: 'deactivate_offer', offerId: beefId },
        ],
      }), { database: db });

      const external = await createOfferManagementChangeSet(userId, lambId, sellerOfferChangeBodySchema.parse({
        action: 'update_offer',
        price: { amount: '4100.00', unit: { code: 'kg' } },
        sellerComment: 'External winner',
      }), { database: db });
      await confirmSellerChangeSet(userId, external.id, { database: db, clock: () => T1 });

      const beefBefore = await offer(beefId);
      const offerCountBefore = (await counts(seller.id)).offers;
      await expect(confirmSellerChangeSet(userId, batch.id, { database: db, clock: () => T2 })).rejects.toBeInstanceOf(OfferChangedError);

      expect(await offer(lambId)).toMatchObject({ price_amount: '4100.00', seller_comment: 'External winner', revision: 2 });
      expect(await offer(beefId)).toEqual(beefBefore);
      expect((await counts(seller.id)).offers).toBe(offerCountBefore);

      const persisted = await getSellerChangeSet(userId, batch.id, { database: db });
      expect(persisted.status).toBe('proposed');
      expect(persisted.confirmedAt).toBeNull();
      expect(persisted.items.every((item) => item.resultOffer === null)).toBe(true);
    } finally {
      await cleanup(userId, phone);
    }
  });
});
