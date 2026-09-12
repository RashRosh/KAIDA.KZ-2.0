import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { getSellerChangeSet } from '../../src/modules/seller-input/application/get-seller-change-set';
import {
  OfferAlreadyInactiveError,
  OfferNotFoundError,
  OfferUpdateNoChangesError,
  SellerInputInvariantError,
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-12T00:00:00.000Z');
const T1 = new Date('2026-09-12T01:00:00.000Z');
const T2 = new Date('2026-09-12T02:00:00.000Z');
const T3 = new Date('2026-09-12T03:00:00.000Z');
const T4 = new Date('2026-09-12T04:00:00.000Z');

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

async function createFixture(userId: string, phone: string, label: string) {
  await cleanupUser(userId, phone);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);
  return setupSeller(userId, {
    seller: { displayName: `S5 Seller ${label}` },
    location: { name: `S5 Point ${label}`, type: 'shop', addressText: `Almaty S5 ${label}` },
  }, { database: db });
}

async function createS4Offer(userId: string, locationId: string, values: { amount?: string; unit?: string | null; comment?: string | null } = {}) {
  const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
    productName: 'Баранина',
    locationId,
    price: values.amount === undefined ? null : { amount: values.amount, unit: values.unit ?? null },
    sellerComment: values.comment ?? null,
  }), { database: db });
  const confirmed = await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 });
  return confirmed.items[0]!.resultOffer!.id;
}

function updateInput(price: { amount: string; unit?: string | null } | null, sellerComment: string | null) {
  return sellerOfferChangeBodySchema.parse({ action: 'update_offer', price, sellerComment });
}

function actionInput(action: 'activate_offer' | 'deactivate_offer') {
  return sellerOfferChangeBodySchema.parse({ action });
}

async function offerRow(offerId: string) {
  return (await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0];
}

async function sellerCounts(sellerId: string) {
  return {
    changeSets: Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerId])).rows[0].count),
    items: Number((await pool.query('SELECT count(*) FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id=$1)', [sellerId])).rows[0].count),
    offers: Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerId])).rows[0].count),
  };
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe('S5 offer management on PostgreSQL 18', () => {
  it('keeps S4 create public flow and DB default revision, then lists the owned Offer without exposing revision', async () => {
    const userId = '50000000-0000-4000-8000-000000000801';
    const phone = '+77000000801';
    const seller = await createFixture(userId, phone, '801');
    try {
      const offerId = await createS4Offer(userId, seller.locations[0]!.id, { amount: '4200.00', unit: 'кг', comment: 'Исходная партия' });
      expect((await offerRow(offerId)).revision).toBe(1);

      const owned = await listOwnedOffers(userId, { database: db });
      expect(owned).toHaveLength(1);
      expect(owned[0]).toEqual({
        id: offerId,
        product: { id: seedIds.lambProduct, name: 'Баранина' },
        location: { id: seller.locations[0]!.id, name: seller.locations[0]!.name, addressText: seller.locations[0]!.addressText },
        price: { amount: '4200.00', currency: 'KZT', unit: 'кг' },
        sellerComment: 'Исходная партия',
        status: 'active',
        lastConfirmedAt: T0.toISOString(),
      });
      expect('revision' in owned[0]!).toBe(false);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('uses a persisted full-state update proposal, preserves buyer truth before confirm and increments revision only once', async () => {
    const userId = '50000000-0000-4000-8000-000000000802';
    const phone = '+77000000802';
    const seller = await createFixture(userId, phone, '802');
    try {
      const offerId = await createS4Offer(userId, seller.locations[0]!.id, { amount: '4200.00', unit: 'кг', comment: 'Старая партия' });
      const before = await offerRow(offerId);
      const beforeCounts = await sellerCounts(seller.id);

      await expect(createOfferManagementChangeSet(userId, offerId, updateInput({ amount: '4200.0', unit: 'кг' }, 'Старая партия'), { database: db }))
        .rejects.toBeInstanceOf(OfferUpdateNoChangesError);
      expect(await sellerCounts(seller.id)).toEqual(beforeCounts);
      expect(await offerRow(offerId)).toEqual(before);

      const proposed = await createOfferManagementChangeSet(userId, offerId, updateInput({ amount: '4500.00', unit: 'кг' }, 'Новая партия'), { database: db });
      expect(proposed.status).toBe('proposed');
      expect(proposed.items[0]).toMatchObject({
        action: 'update_offer',
        price: { amount: '4500.00', currency: 'KZT', unit: 'кг' },
        sellerComment: 'Новая партия',
        resultOffer: null,
      });
      expect(await offerRow(offerId)).toEqual(before);

      const itemRow = (await pool.query('SELECT target_offer_id,expected_offer_revision FROM seller_change_items WHERE change_set_id=$1', [proposed.id])).rows[0];
      expect(itemRow).toEqual({ target_offer_id: offerId, expected_offer_revision: 1 });
      expect(await getSellerChangeSet(userId, proposed.id, { database: db })).toEqual(proposed);

      const beforeSearch = await searchOffers('баранина', db, { clock: () => T1, validityPeriodHours: 168 });
      const buyerBefore = beforeSearch.offers.find((offer) => offer.id === offerId)!;
      expect(buyerBefore).toMatchObject({ price: { amount: '4200.00' }, sellerComment: 'Старая партия' });

      const confirmed = await confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => T1 });
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.items[0]!.resultOffer!.id).toBe(offerId);
      const applied = await offerRow(offerId);
      expect(applied).toMatchObject({
        price_amount: '4500.00',
        price_currency: 'KZT',
        price_unit: 'кг',
        seller_comment: 'Новая партия',
        status: 'active',
        revision: 2,
      });
      expect(new Date(applied.last_confirmed_at).toISOString()).toBe(T1.toISOString());
      expect(new Date(applied.updated_at).toISOString()).toBe(T1.toISOString());
      expect(applied.product_id).toBe(before.product_id);
      expect(applied.location_id).toBe(before.location_id);
      expect(applied.seller_id).toBe(before.seller_id);
      expect(applied.id).toBe(before.id);

      const repeated = await confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => T4 });
      expect(repeated.confirmedAt).toBe(T1.toISOString());
      const repeatedRow = await offerRow(offerId);
      expect(repeatedRow.revision).toBe(2);
      expect(new Date(repeatedRow.updated_at).toISOString()).toBe(T1.toISOString());
      expect(new Date(repeatedRow.last_confirmed_at).toISOString()).toBe(T1.toISOString());

      const afterSearch = await searchOffers('баранина', db, { clock: () => T1, validityPeriodHours: 168 });
      expect(afterSearch.offers.find((offer) => offer.id === offerId)).toMatchObject({ price: { amount: '4500.00' }, sellerComment: 'Новая партия' });
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('clears full-state fields, keeps inactive update inactive, and implements deactivate/activate freshness semantics on the same Offer', async () => {
    const userId = '50000000-0000-4000-8000-000000000803';
    const phone = '+77000000803';
    const seller = await createFixture(userId, phone, '803');
    try {
      const offerId = await createS4Offer(userId, seller.locations[0]!.id, { amount: '1000.00', unit: 'шт', comment: 'Есть' });

      const deactivate = await createOfferManagementChangeSet(userId, offerId, actionInput('deactivate_offer'), { database: db });
      expect((await offerRow(offerId)).status).toBe('active');
      await confirmSellerChangeSet(userId, deactivate.id, { database: db, clock: () => T1 });
      const inactive = await offerRow(offerId);
      expect(inactive).toMatchObject({ status: 'inactive', revision: 2, price_amount: '1000.00', seller_comment: 'Есть' });
      expect(new Date(inactive.last_confirmed_at).toISOString()).toBe(T0.toISOString());

      const countsBeforeRejected = await sellerCounts(seller.id);
      await expect(createOfferManagementChangeSet(userId, offerId, actionInput('deactivate_offer'), { database: db }))
        .rejects.toBeInstanceOf(OfferAlreadyInactiveError);
      expect(await sellerCounts(seller.id)).toEqual(countsBeforeRejected);

      const clearUpdate = await createOfferManagementChangeSet(userId, offerId, updateInput(null, null), { database: db });
      await confirmSellerChangeSet(userId, clearUpdate.id, { database: db, clock: () => T2 });
      const cleared = await offerRow(offerId);
      expect(cleared).toMatchObject({
        id: offerId,
        status: 'inactive',
        price_amount: null,
        price_currency: null,
        price_unit: null,
        seller_comment: null,
        revision: 3,
      });
      expect(new Date(cleared.last_confirmed_at).toISOString()).toBe(T2.toISOString());

      const activateInactive = await createOfferManagementChangeSet(userId, offerId, actionInput('activate_offer'), { database: db });
      await confirmSellerChangeSet(userId, activateInactive.id, { database: db, clock: () => T3 });
      expect(await offerRow(offerId)).toMatchObject({ id: offerId, status: 'active', revision: 4 });

      const activateFresh = await createOfferManagementChangeSet(userId, offerId, actionInput('activate_offer'), { database: db });
      await confirmSellerChangeSet(userId, activateFresh.id, { database: db, clock: () => T4 });
      const fresh = await offerRow(offerId);
      expect(fresh).toMatchObject({ id: offerId, status: 'active', revision: 5 });
      expect(new Date(fresh.last_confirmed_at).toISOString()).toBe(T4.toISOString());

      await pool.query('UPDATE offers SET last_confirmed_at=$2 WHERE id=$1', [offerId, new Date('2025-01-01T00:00:00Z')]);
      const expiredSearch = await searchOffers('баранина', db, { clock: () => T4, validityPeriodHours: 168 });
      expect(expiredSearch.offers.some((offer) => offer.id === offerId)).toBe(false);
      const activateExpired = await createOfferManagementChangeSet(userId, offerId, actionInput('activate_offer'), { database: db });
      await confirmSellerChangeSet(userId, activateExpired.id, { database: db, clock: () => new Date('2026-09-12T05:00:00Z') });
      const refreshed = await offerRow(offerId);
      expect(refreshed).toMatchObject({ id: offerId, status: 'active', revision: 6 });
      const refreshedSearch = await searchOffers('баранина', db, { clock: () => new Date('2026-09-12T05:00:00Z'), validityPeriodHours: 168 });
      expect(refreshedSearch.offers.some((offer) => offer.id === offerId)).toBe(true);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('hides foreign/nonexistent/ownerless Offers and treats cross-seller Location corruption as invariant failure', async () => {
    const userId = '50000000-0000-4000-8000-000000000804';
    const phone = '+77000000804';
    const otherUserId = '50000000-0000-4000-8000-000000000805';
    const otherPhone = '+77000000805';
    const seller = await createFixture(userId, phone, '804');
    const other = await createFixture(otherUserId, otherPhone, '805');
    try {
      const ownOfferId = await createS4Offer(userId, seller.locations[0]!.id, { amount: '10.00' });
      const foreignOfferId = await createS4Offer(otherUserId, other.locations[0]!.id, { amount: '20.00' });
      const counts = await sellerCounts(seller.id);

      await expect(createOfferManagementChangeSet(userId, foreignOfferId, actionInput('activate_offer'), { database: db })).rejects.toBeInstanceOf(OfferNotFoundError);
      await expect(createOfferManagementChangeSet(userId, '40000000-0000-4000-8000-000000000999', actionInput('activate_offer'), { database: db })).rejects.toBeInstanceOf(OfferNotFoundError);
      await expect(createOfferManagementChangeSet(userId, seedIds.lambOffer, actionInput('activate_offer'), { database: db })).rejects.toBeInstanceOf(OfferNotFoundError);
      expect(await sellerCounts(seller.id)).toEqual(counts);

      await pool.query('UPDATE offers SET location_id=$2 WHERE id=$1', [ownOfferId, other.locations[0]!.id]);
      await expect(createOfferManagementChangeSet(userId, ownOfferId, actionInput('activate_offer'), { database: db })).rejects.toBeInstanceOf(SellerInputInvariantError);
      expect(await sellerCounts(seller.id)).toEqual(counts);
    } finally {
      await cleanupUser(userId, phone);
      await cleanupUser(otherUserId, otherPhone);
    }
  });

  it('rolls back Offer mutation, revision, result link and confirmation if a later DB write fails', async () => {
    const userId = '50000000-0000-4000-8000-000000000806';
    const phone = '+77000000806';
    const seller = await createFixture(userId, phone, '806');
    const functionName = 's5_test_fail_result_link';
    const triggerName = 's5_test_fail_result_link_trigger';
    try {
      const offerId = await createS4Offer(userId, seller.locations[0]!.id, { amount: '3000.00', unit: 'кг', comment: 'До ошибки' });
      const before = await offerRow(offerId);
      const proposal = await createOfferManagementChangeSet(userId, offerId, updateInput({ amount: '3100.00', unit: 'кг' }, 'После ошибки'), { database: db });

      await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'S5 test failure'; END $$`);
      await pool.query(`CREATE TRIGGER ${triggerName} BEFORE UPDATE OF result_offer_id ON seller_change_items FOR EACH ROW WHEN (NEW.change_set_id = '${proposal.id}'::uuid AND NEW.result_offer_id IS NOT NULL) EXECUTE FUNCTION ${functionName}()`);

      await expect(confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T1 })).rejects.toBeTruthy();
      expect(await offerRow(offerId)).toEqual(before);
      const state = (await pool.query('SELECT cs.status,cs.confirmed_at,i.result_offer_id FROM seller_change_sets cs JOIN seller_change_items i ON i.change_set_id=cs.id WHERE cs.id=$1', [proposal.id])).rows[0];
      expect(state).toEqual({ status: 'proposed', confirmed_at: null, result_offer_id: null });
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON seller_change_items`);
      await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
      await cleanupUser(userId, phone);
    }
  });
});
