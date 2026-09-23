import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { createDatabase } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  OfferChangedError,
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const T0 = new Date('2026-09-12T06:00:00.000Z');
const T1 = new Date('2026-09-12T07:00:00.000Z');
const T2 = new Date('2026-09-12T08:00:00.000Z');

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
    seller: { displayName: `S5 race ${label}` },
    location: { name: `S5 race point ${label}`, type: 'shop', addressText: `Almaty ${label}` },
  }, { database: db });
  const created = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
    productName: 'Баранина',
    locationId: seller.locations[0]!.id,
    price: { amount: '4000.00', unit: { code: 'kg' } },
    sellerComment: 'Исходное',
  }), { database: db });
  const confirmed = await confirmSellerChangeSet(userId, created.id, { database: db, clock: () => T0 });
  return { seller, offerId: confirmed.items[0]!.resultOffer!.id };
}

function update(amount: string, comment: string) {
  return sellerOfferChangeBodySchema.parse({
    action: 'update_offer',
    price: { amount, unit: { code: 'kg' } },
    sellerComment: comment,
  });
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe('S5 confirmation concurrency on PostgreSQL 18', () => {
  it('concurrent confirmation of the same ChangeSet mutates once and both callers converge', async () => {
    const userId = '50000000-0000-4000-8000-000000000811';
    const phone = '+77000000811';
    const { offerId } = await fixture(userId, phone, '811');
    const proposal = await createOfferManagementChangeSet(userId, offerId, update('4100.00', 'Один ChangeSet'), { database: db });
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
      expect(left.items[0]!.resultOffer!.id).toBe(offerId);
      expect(right.items[0]!.resultOffer!.id).toBe(offerId);

      const row = (await pool.query('SELECT revision,price_amount,seller_comment,updated_at,last_confirmed_at FROM offers WHERE id=$1', [offerId])).rows[0];
      expect(row).toMatchObject({ revision: 2, price_amount: '4100.00', seller_comment: 'Один ChangeSet' });
      expect(new Date(row.updated_at).toISOString()).toBe(left.confirmedAt);
      expect(new Date(row.last_confirmed_at).toISOString()).toBe(left.confirmedAt);
    } finally {
      await a.pool.end();
      await b.pool.end();
      await cleanup(userId, phone);
    }
  });

  it('two different ChangeSets from revision N produce exactly one winner and one OFFER_CHANGED', async () => {
    const userId = '50000000-0000-4000-8000-000000000812';
    const phone = '+77000000812';
    const { offerId } = await fixture(userId, phone, '812');
    const proposalA = await createOfferManagementChangeSet(userId, offerId, update('4200.00', 'Победитель A'), { database: db });
    const proposalB = await createOfferManagementChangeSet(userId, offerId, update('4300.00', 'Победитель B'), { database: db });
    const expected = await pool.query('SELECT expected_offer_revision FROM seller_change_items WHERE change_set_id = ANY($1::uuid[]) ORDER BY change_set_id', [[proposalA.id, proposalB.id]]);
    expect(expected.rows.map((row) => row.expected_offer_revision)).toEqual([1, 1]);

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

      const row = (await pool.query('SELECT revision,price_amount,seller_comment FROM offers WHERE id=$1', [offerId])).rows[0];
      expect(row.revision).toBe(2);
      expect([
        ['4200.00', 'Победитель A'],
        ['4300.00', 'Победитель B'],
      ]).toContainEqual([row.price_amount, row.seller_comment]);

      const states = await pool.query('SELECT cs.id,cs.status,cs.confirmed_at,i.result_offer_id FROM seller_change_sets cs JOIN seller_change_items i ON i.change_set_id=cs.id WHERE cs.id = ANY($1::uuid[])', [[proposalA.id, proposalB.id]]);
      expect(states.rows.filter((state) => state.status === 'confirmed')).toHaveLength(1);
      const loser = states.rows.find((state) => state.status === 'proposed');
      expect(loser).toMatchObject({ confirmed_at: null, result_offer_id: null });
    } finally {
      await a.pool.end();
      await b.pool.end();
      await cleanup(userId, phone);
    }
  });
});
