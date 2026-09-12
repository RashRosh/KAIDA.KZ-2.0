import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { getSellerChangeSet } from '../../src/modules/seller-input/application/get-seller-change-set';
import {
  ChangeSetNotFoundError,
  LocationNotFoundError,
  ProductAmbiguousError,
  ProductNotFoundError,
  SellerInputInvariantError,
  SellerRequiredError,
  sellerChangeSetCreateBodySchema,
  type SellerChangeSetCreateInput,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const NOW = new Date('2026-09-12T06:30:00.000Z');

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
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, NOW]);
  return setupSeller(userId, {
    seller: { displayName: `S4 Seller ${label}` },
    location: { name: `S4 Point ${label}`, type: 'shop', addressText: `Almaty S4 ${label}` },
  }, { database: db });
}

function input(locationId: string, values: Record<string, unknown> = {}) {
  return sellerChangeSetCreateBodySchema.parse({ productName: 'Баранина', locationId, ...values });
}

async function sellerS4Counts(sellerId: string) {
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

describe('S4 Seller Change Set on PostgreSQL 18', () => {
  it('creates one persisted proposed Item in one flow and creates no Offer before confirmation', async () => {
    const userId = '50000000-0000-4000-8000-000000000601';
    const phone = '+77000000601';
    const seller = await createFixture(userId, phone, '601');
    try {
      const created = await createSellerChangeSet(userId, input(seller.locations[0]!.id, { productName: '  БАРАНИНА  ' }), { database: db });
      expect(created.status).toBe('proposed');
      expect(created.confirmedAt).toBeNull();
      expect(created.items).toHaveLength(1);
      expect(created.items[0]).toMatchObject({ action: 'create_offer', product: { id: seedIds.lambProduct, name: 'Баранина' }, resultOffer: null, price: null });
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 1, items: 1, offers: 0 });

      const loaded = await getSellerChangeSet(userId, created.id, { database: db });
      expect(loaded).toEqual(created);
      expect(loaded.items[0]!.location.id).toBe(seller.locations[0]!.id);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('rejects User without Seller, unknown/ambiguous Product and foreign Location without S4 writes', async () => {
    const userId = '50000000-0000-4000-8000-000000000602';
    const phone = '+77000000602';
    const otherUserId = '50000000-0000-4000-8000-000000000603';
    const otherPhone = '+77000000603';
    await cleanupUser(userId, phone);
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, NOW]);
    await expect(createSellerChangeSet(userId, input(seedIds.location), { database: db })).rejects.toBeInstanceOf(SellerRequiredError);

    const seller = await createFixture(userId, phone, '602');
    const other = await createFixture(otherUserId, otherPhone, '603');
    try {
      await expect(createSellerChangeSet(userId, input(seller.locations[0]!.id, { productName: 'Крабы' }), { database: db })).rejects.toBeInstanceOf(ProductNotFoundError);
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 0, items: 0, offers: 0 });

      await expect(createSellerChangeSet(userId, input(other.locations[0]!.id), { database: db })).rejects.toBeInstanceOf(LocationNotFoundError);
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 0, items: 0, offers: 0 });

      await pool.query('DELETE FROM products WHERE name=$1', ['баранина']);
      await pool.query('INSERT INTO products (name) VALUES ($1)', ['баранина']);
      await expect(createSellerChangeSet(userId, input(seller.locations[0]!.id), { database: db })).rejects.toBeInstanceOf(ProductAmbiguousError);
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 0, items: 0, offers: 0 });
    } finally {
      await pool.query('DELETE FROM products WHERE name=$1', ['баранина']);
      await cleanupUser(userId, phone);
      await cleanupUser(otherUserId, otherPhone);
    }
  });

  it('rolls back ChangeSet when mandatory Item insert fails inside proposal transaction', async () => {
    const userId = '50000000-0000-4000-8000-000000000604';
    const phone = '+77000000604';
    const seller = await createFixture(userId, phone, '604');
    try {
      const invalid = {
        productName: 'Баранина',
        locationId: seller.locations[0]!.id,
        price: null,
        sellerComment: 'x'.repeat(501),
      } as SellerChangeSetCreateInput;
      await expect(createSellerChangeSet(userId, invalid, { database: db })).rejects.toBeTruthy();
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 0, items: 0, offers: 0 });
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('confirms atomically, copies values, is idempotent and preserves Search seed Offer', async () => {
    const userId = '50000000-0000-4000-8000-000000000605';
    const phone = '+77000000605';
    const seller = await createFixture(userId, phone, '605');
    try {
      const beforeSeed = (await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0];
      const proposed = await createSellerChangeSet(userId, input(seller.locations[0]!.id, {
        price: { amount: '4321.50', unit: 'кг' },
        sellerComment: 'S4 fresh lamb',
      }), { database: db });

      const confirmed = await confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => NOW });
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.confirmedAt).toBe(NOW.toISOString());
      expect(confirmed.items[0]!.resultOffer).toMatchObject({ status: 'active', lastConfirmedAt: NOW.toISOString() });
      const offerId = confirmed.items[0]!.resultOffer!.id;
      const row = (await pool.query('SELECT * FROM offers WHERE id=$1', [offerId])).rows[0];
      expect(row).toMatchObject({
        product_id: seedIds.lambProduct,
        seller_id: seller.id,
        location_id: seller.locations[0]!.id,
        price_amount: '4321.50',
        price_currency: 'KZT',
        price_unit: 'кг',
        seller_comment: 'S4 fresh lamb',
        status: 'active',
      });
      expect(new Date(row.last_confirmed_at).toISOString()).toBe(NOW.toISOString());
      expect(new Date(row.created_at).toISOString()).toBe(NOW.toISOString());
      expect(new Date(row.updated_at).toISOString()).toBe(NOW.toISOString());

      const repeated = await confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => new Date('2027-01-01T00:00:00Z') });
      expect(repeated.items[0]!.resultOffer!.id).toBe(offerId);
      expect(repeated.confirmedAt).toBe(NOW.toISOString());
      expect((await sellerS4Counts(seller.id)).offers).toBe(1);

      const search = await searchOffers('баранина', db, { clock: () => NOW, validityPeriodHours: 168 });
      expect(search.offers.some((offer) => offer.id === seedIds.lambOffer)).toBe(true);
      expect(search.offers.some((offer) => offer.id === offerId)).toBe(true);
      const seedResult = search.offers.find((offer) => offer.id === seedIds.lambOffer)!;
      expect(seedResult).toMatchObject({
        product: { id: seedIds.lambProduct, name: 'Баранина' },
        seller: { id: seedIds.seller, displayName: 'Асыл Ет, тестовый продавец' },
        price: { amount: '4200.00', currency: 'KZT', unit: 'кг' },
        sellerComment: 'Свежий привоз.',
      });
      expect((await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0]).toEqual(beforeSeed);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('stores no price as amount/currency/unit NULL and allows price without unit', async () => {
    const userId = '50000000-0000-4000-8000-000000000606';
    const phone = '+77000000606';
    const seller = await createFixture(userId, phone, '606');
    try {
      const noPrice = await createSellerChangeSet(userId, input(seller.locations[0]!.id), { database: db });
      const noPriceRow = (await pool.query('SELECT price_amount, price_currency, price_unit FROM seller_change_items WHERE change_set_id=$1', [noPrice.id])).rows[0];
      expect(noPriceRow).toEqual({ price_amount: null, price_currency: null, price_unit: null });

      const priced = await createSellerChangeSet(userId, input(seller.locations[0]!.id, { price: { amount: '0' } }), { database: db });
      const pricedRow = (await pool.query('SELECT price_amount, price_currency, price_unit FROM seller_change_items WHERE change_set_id=$1', [priced.id])).rows[0];
      expect(pricedRow).toEqual({ price_amount: '0', price_currency: 'KZT', price_unit: null });
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('isolates read/confirm by Seller ownership', async () => {
    const userId = '50000000-0000-4000-8000-000000000607';
    const phone = '+77000000607';
    const otherUserId = '50000000-0000-4000-8000-000000000608';
    const otherPhone = '+77000000608';
    const seller = await createFixture(userId, phone, '607');
    await createFixture(otherUserId, otherPhone, '608');
    try {
      const proposed = await createSellerChangeSet(userId, input(seller.locations[0]!.id), { database: db });
      await expect(getSellerChangeSet(otherUserId, proposed.id, { database: db })).rejects.toBeInstanceOf(ChangeSetNotFoundError);
      await expect(confirmSellerChangeSet(otherUserId, proposed.id, { database: db })).rejects.toBeInstanceOf(ChangeSetNotFoundError);
      await expect(getSellerChangeSet(userId, '60000000-0000-4000-8000-000000000999', { database: db })).rejects.toBeInstanceOf(ChangeSetNotFoundError);
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 1, items: 1, offers: 0 });
    } finally {
      await cleanupUser(userId, phone);
      await cleanupUser(otherUserId, otherPhone);
    }
  });

  it('allows distinct Change Sets with the same Seller/Product/Location to create distinct Offers', async () => {
    const userId = '50000000-0000-4000-8000-000000000609';
    const phone = '+77000000609';
    const seller = await createFixture(userId, phone, '609');
    try {
      const a = await createSellerChangeSet(userId, input(seller.locations[0]!.id, { price: { amount: '1000', unit: 'кг' }, sellerComment: 'A' }), { database: db });
      const b = await createSellerChangeSet(userId, input(seller.locations[0]!.id, { price: { amount: '1200', unit: 'кг' }, sellerComment: 'B' }), { database: db });
      const appliedA = await confirmSellerChangeSet(userId, a.id, { database: db, clock: () => NOW });
      const appliedB = await confirmSellerChangeSet(userId, b.id, { database: db, clock: () => NOW });
      expect(appliedA.items[0]!.resultOffer!.id).not.toBe(appliedB.items[0]!.resultOffer!.id);
      expect(await sellerS4Counts(seller.id)).toEqual({ changeSets: 2, items: 2, offers: 2 });
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('treats confirmed state without result_offer_id as invariant failure, not idempotent success', async () => {
    const userId = '50000000-0000-4000-8000-000000000610';
    const phone = '+77000000610';
    const seller = await createFixture(userId, phone, '610');
    try {
      const proposed = await createSellerChangeSet(userId, input(seller.locations[0]!.id), { database: db });
      await confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => NOW });
      await pool.query('UPDATE seller_change_items SET result_offer_id=NULL WHERE change_set_id=$1', [proposed.id]);
      await expect(confirmSellerChangeSet(userId, proposed.id, { database: db })).rejects.toBeInstanceOf(SellerInputInvariantError);
      await expect(getSellerChangeSet(userId, proposed.id, { database: db })).rejects.toBeInstanceOf(SellerInputInvariantError);
      expect((await sellerS4Counts(seller.id)).offers).toBe(1);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('rolls back failed confirmation and leaves proposal unapplied', async () => {
    const userId = '50000000-0000-4000-8000-000000000611';
    const phone = '+77000000611';
    const seller = await createFixture(userId, phone, '611');
    const proposed = await createSellerChangeSet(userId, input(seller.locations[0]!.id), { database: db });
    try {
      await pool.query('DROP TRIGGER IF EXISTS s4_test_reject_offer ON offers; DROP FUNCTION IF EXISTS s4_test_reject_offer()');
      await pool.query(`CREATE FUNCTION s4_test_reject_offer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.seller_id = '${seller.id}'::uuid THEN RAISE EXCEPTION 'S4 test reject Offer'; END IF; RETURN NEW; END $$`);
      await pool.query('CREATE TRIGGER s4_test_reject_offer BEFORE INSERT ON offers FOR EACH ROW EXECUTE FUNCTION s4_test_reject_offer()');

      await expect(confirmSellerChangeSet(userId, proposed.id, { database: db, clock: () => NOW })).rejects.toBeTruthy();
      const changeSet = (await pool.query('SELECT status, confirmed_at FROM seller_change_sets WHERE id=$1', [proposed.id])).rows[0];
      const item = (await pool.query('SELECT result_offer_id FROM seller_change_items WHERE change_set_id=$1', [proposed.id])).rows[0];
      expect(changeSet).toEqual({ status: 'proposed', confirmed_at: null });
      expect(item.result_offer_id).toBeNull();
      expect((await sellerS4Counts(seller.id)).offers).toBe(0);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS s4_test_reject_offer ON offers; DROP FUNCTION IF EXISTS s4_test_reject_offer()');
      await cleanupUser(userId, phone);
    }
  });
});
