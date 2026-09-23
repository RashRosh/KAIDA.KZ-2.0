import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createBatchSellerChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { getSellerChangeSet } from '../../src/modules/seller-input/application/get-seller-change-set';
import {
  sellerBatchChangeSetCreateBodySchema,
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const userId = '5d000000-0000-4000-8000-000000001301';
const phone = '+77000013010';
const T0 = new Date('2026-09-24T08:00:00.000Z');
const later = (minutes: number) => new Date(T0.getTime() + minutes * 60 * 1000);
const buyerLocation = { latitude: 43.2, longitude: 76.9 };

async function cleanup() {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function counts(sellerId: string) {
  const row = (await pool.query(`SELECT
    (SELECT count(*)::int FROM seller_change_sets WHERE seller_id=$1) AS change_sets,
    (SELECT count(*)::int FROM offers WHERE seller_id=$1) AS offers`, [sellerId])).rows[0];
  return row as { change_sets: number; offers: number };
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe.sequential('Offer price unit through S4, S5, S12 and every read', () => {
  it('stores structured units, localizes canonical labels, keeps custom values and rolls back a batch with one invalid unit', async () => {
    await cleanup();
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);
    const seller = await setupSeller(userId, {
      seller: { displayName: 'Бірлік сатушы' },
      location: { name: 'Бірлік нүкте', type: 'shop', addressText: 'Алматы' },
    }, { database: db });
    const locationId = seller.locations[0]!.id;
    await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [seller.id, phone]);
    await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [locationId]);

    // S4: create with kg.
    const created = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
      productName: 'Баранина', locationId, price: { amount: '4200.00', unit: { code: 'kg' } }, sellerComment: 'бірлік',
    }), { database: db });
    expect(created.items[0]!.price).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'кг', unitChoice: { code: 'kg' } });
    const offerId = (await confirmSellerChangeSet(userId, created.id, { database: db, clock: () => T0 })).items[0]!.resultOffer!.id;
    const stored = async () => (await pool.query('SELECT price_amount,price_currency,price_unit_code,price_unit_value,revision FROM offers WHERE id=$1', [offerId])).rows[0];
    expect(await stored()).toEqual({ price_amount: '4200.00', price_currency: 'KZT', price_unit_code: 'kg', price_unit_value: null, revision: 1 });

    // S5: kg → piece, then the review renders per locale.
    const update = await createOfferManagementChangeSet(userId, offerId, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '4200.00', unit: { code: 'piece' } }, sellerComment: 'бірлік',
    }), { database: db });
    expect((await getSellerChangeSet(userId, update.id, { database: db, locale: 'kk' })).items[0]!.price)
      .toEqual({ amount: '4200.00', currency: 'KZT', unit: 'дана', unitChoice: { code: 'piece' } });
    expect((await getSellerChangeSet(userId, update.id, { database: db })).items[0]!.price!.unit).toBe('шт');
    await confirmSellerChangeSet(userId, update.id, { database: db, clock: () => later(1) });
    expect(await stored()).toEqual({ price_amount: '4200.00', price_currency: 'KZT', price_unit_code: 'piece', price_unit_value: null, revision: 2 });

    const owned = async (locale?: 'ru' | 'kk') => (await listOwnedOffers(userId, { database: db, clock: () => later(2), validityPeriodHours: 168, locale }))
      .find((offer) => offer.id === offerId)!.price;
    expect(await owned()).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'шт', unitChoice: { code: 'piece' } });
    expect(await owned('kk')).toMatchObject({ unit: 'дана' });

    const searched = async (locale?: 'ru' | 'kk') => (await searchOffers('баранина', db, { clock: () => later(2), validityPeriodHours: 168, locale }))
      .offers.find((offer) => offer.id === offerId)!.price;
    expect(await searched()).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'шт' });
    expect(await searched('kk')).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'дана' });
    const nearby = (await findNearbyOffers(buyerLocation, db, { clock: () => later(2), validityPeriodHours: 168, locale: 'kk' }))
      .offers.find((offer) => offer.id === offerId)!;
    expect(nearby.price).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'дана' });

    // A custom value is kept as written in both locales.
    const custom = await createOfferManagementChangeSet(userId, offerId, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '4200.00', unit: { code: 'other', value: ' ведро ' } }, sellerComment: 'бірлік',
    }), { database: db });
    await confirmSellerChangeSet(userId, custom.id, { database: db, clock: () => later(3) });
    expect(await stored()).toMatchObject({ price_amount: '4200.00', price_unit_code: 'other', price_unit_value: 'ведро', revision: 3 });
    expect(await owned('kk')).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'ведро', unitChoice: { code: 'other', value: 'ведро' } });
    expect((await searched('kk')).unit).toBe('ведро');
    expect((await searched()).unit).toBe('ведро');

    // Same unit, same amount and comment is still a no-op.
    await expect(createOfferManagementChangeSet(userId, offerId, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '4200.00', unit: { code: 'other', value: 'ведро' } }, sellerComment: 'бірлік',
    }), { database: db })).rejects.toMatchObject({ code: 'OFFER_UPDATE_NO_CHANGES' });

    // S12: the same validation rule; one invalid unit rejects the whole batch before anything is stored.
    const before = await counts(seller.id);
    const invalidBatch = sellerBatchChangeSetCreateBodySchema.safeParse({
      items: [
        { action: 'create_offer', productName: 'Говядина', locationId, price: { amount: '3900.00', unit: { code: 'liter' } } },
        { action: 'update_offer', offerId, price: { amount: '4300.00', unit: { code: 'other', value: '' } }, sellerComment: null },
      ],
    });
    expect(invalidBatch.success).toBe(false);
    expect(await counts(seller.id)).toEqual(before);

    const batch = await createBatchSellerChangeSet(userId, sellerBatchChangeSetCreateBodySchema.parse({
      items: [
        { action: 'create_offer', productName: 'Говядина', locationId, price: { amount: '3900.00', unit: { code: 'package' } } },
        { action: 'update_offer', offerId, price: { amount: '4300.00', unit: null }, sellerComment: null },
      ],
    }), { database: db });
    const confirmedBatch = await confirmSellerChangeSet(userId, batch.id, { database: db, clock: () => later(4) });
    const beefId = confirmedBatch.items.find((item) => item.action === 'create_offer')!.resultOffer!.id;
    expect((await pool.query('SELECT price_unit_code,price_unit_value FROM offers WHERE id=$1', [beefId])).rows[0]).toEqual({ price_unit_code: 'package', price_unit_value: null });
    expect(await stored()).toMatchObject({ price_amount: '4300.00', price_unit_code: null, price_unit_value: null, revision: 4 });
    expect(await owned()).toEqual({ amount: '4300.00', currency: 'KZT', unit: null, unitChoice: null });
  });
});
