import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createBatchSellerChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  LocationNotFoundError,
  OfferNotFoundError,
  sellerBatchChangeSetCreateBodySchema,
  sellerChangeSetCreateBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const T0 = new Date('2026-09-14T07:00:00.000Z');

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
  return setupSeller(userId, {
    seller: { displayName: `S12 owner ${label}` },
    location: { name: `S12 owner point ${label}`, type: 'shop', addressText: `Almaty ${label}` },
  }, { database: db });
}

async function createOffer(userId: string, locationId: string) {
  const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
    productName: 'Баранина',
    locationId,
    price: { amount: '4000.00', unit: { code: 'kg' } },
    sellerComment: 'Foreign fixture',
  }), { database: db });
  return (await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 })).items[0]!.resultOffer!.id;
}

async function changeSetCount(sellerId: string) {
  return Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerId])).rows[0].count);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe('S12 batch ownership boundaries on PostgreSQL 18', () => {
  it('rejects a foreign Location or target Offer and persists no batch for the current Seller', async () => {
    const ownUser = '50000000-0000-4000-8000-000000001221';
    const ownPhone = '+77000001221';
    const foreignUser = '50000000-0000-4000-8000-000000001222';
    const foreignPhone = '+77000001222';
    const own = await fixture(ownUser, ownPhone, '1221');
    const foreign = await fixture(foreignUser, foreignPhone, '1222');
    try {
      const foreignOfferId = await createOffer(foreignUser, foreign.locations[0]!.id);
      const before = await changeSetCount(own.id);

      await expect(createBatchSellerChangeSet(ownUser, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'create_offer', productName: 'Баранина', locationId: own.locations[0]!.id, price: { amount: '1' } },
          { action: 'create_offer', productName: 'Говядина', locationId: foreign.locations[0]!.id, price: { amount: '1' } },
        ],
      }), { database: db })).rejects.toBeInstanceOf(LocationNotFoundError);
      expect(await changeSetCount(own.id)).toBe(before);

      await expect(createBatchSellerChangeSet(ownUser, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'create_offer', productName: 'Баранина', locationId: own.locations[0]!.id, price: { amount: '1' } },
          { action: 'activate_offer', offerId: foreignOfferId },
        ],
      }), { database: db })).rejects.toBeInstanceOf(OfferNotFoundError);
      expect(await changeSetCount(own.id)).toBe(before);
    } finally {
      await cleanup(ownUser, ownPhone);
      await cleanup(foreignUser, foreignPhone);
    }
  });
});