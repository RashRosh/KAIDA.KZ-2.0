import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { sellerChangeSetCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanup(userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe('S4 confirmation concurrency on PostgreSQL 18', () => {
  it('serializes concurrent confirms of one Change Set and creates one Offer', async () => {
    const userId = '50000000-0000-4000-8000-000000000651';
    const phone = '+77000000651';
    await cleanup(userId, phone);
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, new Date('2026-09-12T00:00:00Z')]);
    const seller = await setupSeller(userId, {
      seller: { displayName: 'S4 Concurrent Seller' },
      location: { name: 'Concurrent Point', type: 'shop', addressText: 'Almaty concurrency' },
    }, { database: db });

    try {
      const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
        productName: 'Баранина',
        locationId: seller.locations[0]!.id,
        price: { amount: '2500.00', unit: { code: 'kg' } },
      }), { database: db });
      const now = new Date('2026-09-12T07:00:00Z');

      const [a, b] = await Promise.all([
        confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => now }),
        confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => new Date('2026-09-12T08:00:00Z') }),
      ]);

      expect(a.status).toBe('confirmed');
      expect(b.status).toBe('confirmed');
      expect(a.items[0]!.resultOffer!.id).toBe(b.items[0]!.resultOffer!.id);
      expect(a.confirmedAt).toBe(b.confirmedAt);
      expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [seller.id])).rows[0].count)).toBe(1);
      const item = (await pool.query('SELECT result_offer_id FROM seller_change_items WHERE change_set_id=$1', [proposal.id])).rows[0];
      expect(item.result_offer_id).toBe(a.items[0]!.resultOffer!.id);
    } finally {
      await cleanup(userId, phone);
    }
  });
});
