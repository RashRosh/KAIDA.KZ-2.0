import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { createDatabase } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createBatchSellerChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  OfferChangedError,
  sellerBatchChangeSetCreateBodySchema,
  sellerChangeSetCreateBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-14T04:00:00.000Z');
const T1 = new Date('2026-09-14T05:00:00.000Z');
const T2 = new Date('2026-09-14T06:00:00.000Z');

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
    seller: { displayName: `S12 race ${label}` },
    location: { name: `S12 race point ${label}`, type: 'shop', addressText: `Almaty ${label}` },
  }, { database: db });

  async function create(productName: string, amount: string) {
    const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
      productName,
      locationId: seller.locations[0]!.id,
      price: { amount, unit: { code: 'kg' } },
      sellerComment: `${productName} исходное`,
    }), { database: db });
    return (await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 })).items[0]!.resultOffer!.id;
  }

  return {
    seller,
    lambId: await create('Баранина', '4000.00'),
    beefId: await create('Говядина', '3500.00'),
  };
}

function batch(lambId: string, beefId: string, lambAmount: string, beefAmount: string, label: string) {
  return sellerBatchChangeSetCreateBodySchema.parse({
    items: [
      { action: 'update_offer', offerId: lambId, price: { amount: lambAmount, unit: { code: 'kg' } }, sellerComment: `L ${label}` },
      { action: 'update_offer', offerId: beefId, price: { amount: beefAmount, unit: { code: 'kg' } }, sellerComment: `B ${label}` },
    ],
  });
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe('S12 batch concurrency on PostgreSQL 18', () => {
  it('concurrent confirmation of the same multi-item ChangeSet applies every item once and both callers converge', async () => {
    const userId = '50000000-0000-4000-8000-000000001211';
    const phone = '+77000001211';
    const { lambId, beefId } = await fixture(userId, phone, '1211');
    const proposal = await createBatchSellerChangeSet(userId, batch(lambId, beefId, '4100.00', '3600.00', 'same'), { database: db });
    const a = createDatabase(testDatabaseUrl());
    const b = createDatabase(testDatabaseUrl());
    try {
      const [left, right] = await Promise.all([
        confirmSellerChangeSet(userId, proposal.id, { database: a.db, clock: () => T1 }),
        confirmSellerChangeSet(userId, proposal.id, { database: b.db, clock: () => T2 }),
      ]);

      expect(left.status).toBe('confirmed');
      expect(right.status).toBe('confirmed');
      expect(left.confirmedAt).toBe(right.confirmedAt);
      expect(left.items).toHaveLength(2);
      expect(right.items).toEqual(left.items);

      const rows = await pool.query('SELECT id,revision,price_amount,seller_comment FROM offers WHERE id = ANY($1::uuid[]) ORDER BY id', [[lambId, beefId]]);
      expect(rows.rows.every((row) => row.revision === 2)).toBe(true);
      expect(rows.rows.map((row) => row.price_amount).sort()).toEqual(['3600.00', '4100.00']);
    } finally {
      await a.pool.end();
      await b.pool.end();
      await cleanup(userId, phone);
    }
  });

  it('overlapping multi-offer batches have exactly one winner and an OFFER_CHANGED loser with no partial commit', async () => {
    const userId = '50000000-0000-4000-8000-000000001212';
    const phone = '+77000001212';
    const { lambId, beefId } = await fixture(userId, phone, '1212');

    const proposalA = await createBatchSellerChangeSet(userId, batch(lambId, beefId, '4200.00', '3700.00', 'A'), { database: db });
    const proposalB = await createBatchSellerChangeSet(userId, sellerBatchChangeSetCreateBodySchema.parse({
      items: [
        { action: 'update_offer', offerId: beefId, price: { amount: '3800.00', unit: { code: 'kg' } }, sellerComment: 'B B' },
        { action: 'update_offer', offerId: lambId, price: { amount: '4300.00', unit: { code: 'kg' } }, sellerComment: 'L B' },
      ],
    }), { database: db });

    const a = createDatabase(testDatabaseUrl());
    const b = createDatabase(testDatabaseUrl());
    try {
      const results = await Promise.allSettled([
        confirmSellerChangeSet(userId, proposalA.id, { database: a.db, clock: () => T1 }),
        confirmSellerChangeSet(userId, proposalB.id, { database: b.db, clock: () => T2 }),
      ]);
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof confirmSellerChangeSet>>> => result.status === 'fulfilled');
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toBeInstanceOf(OfferChangedError);

      const rows = await pool.query('SELECT id,revision,price_amount,seller_comment FROM offers WHERE id = ANY($1::uuid[])', [[lambId, beefId]]);
      expect(rows.rows.every((row) => row.revision === 2)).toBe(true);
      const state = Object.fromEntries(rows.rows.map((row) => [row.id, [row.price_amount, row.seller_comment]]));
      const winnerA = state[lambId]?.[0] === '4200.00' && state[beefId]?.[0] === '3700.00';
      const winnerB = state[lambId]?.[0] === '4300.00' && state[beefId]?.[0] === '3800.00';
      expect(winnerA || winnerB).toBe(true);

      const persisted = await pool.query('SELECT cs.id,cs.status,cs.confirmed_at,i.result_offer_id FROM seller_change_sets cs JOIN seller_change_items i ON i.change_set_id=cs.id WHERE cs.id = ANY($1::uuid[]) ORDER BY cs.id,i.id', [[proposalA.id, proposalB.id]]);
      const byChangeSet = new Map<string, typeof persisted.rows>();
      for (const row of persisted.rows) byChangeSet.set(row.id, [...(byChangeSet.get(row.id) ?? []), row]);
      const states = [...byChangeSet.values()];
      expect(states.filter((rowsForSet) => rowsForSet.every((row) => row.status === 'confirmed' && row.result_offer_id !== null))).toHaveLength(1);
      expect(states.filter((rowsForSet) => rowsForSet.every((row) => row.status === 'proposed' && row.confirmed_at === null && row.result_offer_id === null))).toHaveLength(1);
    } finally {
      await a.pool.end();
      await b.pool.end();
      await cleanup(userId, phone);
    }
  });
});