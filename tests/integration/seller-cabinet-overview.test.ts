import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { sellerChangeSetCreateBodySchema, sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const userId = '5d000000-0000-4000-8000-000000000001';
const phone = '+77000033001';
const T0 = new Date('2026-09-20T08:00:00.000Z');
const hours = (value: number) => new Date(T0.getTime() + value * 60 * 60 * 1000);

async function cleanup() {
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

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe.sequential('Seller cabinet owned-offers read', () => {
  it('reports buyer visibility by the same rules as Search and localizes the Product name', async () => {
    await cleanup();
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);
    const seller = await setupSeller(userId, {
      seller: { displayName: 'Кабинет' },
      location: { name: 'Кабинет нүкте', type: 'shop', addressText: 'Алматы' },
    }, { database: db });
    const locationId = seller.locations[0]!.id;
    const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
      productName: 'Баранина', locationId, price: { amount: '3200', unit: 'кг' }, sellerComment: null,
    }), { database: db });
    const offerId = (await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 })).items[0]!.resultOffer!.id;

    const read = async (at: Date, locale?: 'ru' | 'kk') => (await listOwnedOffers(userId, { database: db, clock: () => at, validityPeriodHours: 168, locale }))[0]!;
    const buyerSees = async (at: Date) => (await searchOffers('баранина', db, { clock: () => at, validityPeriodHours: 168 })).offers.some((offer) => offer.id === offerId);

    // No public phone and no point geo yet: active, but not shown to buyers.
    expect((await read(hours(1))).buyerVisible).toBe(false);
    expect(await buyerSees(hours(1))).toBe(false);

    await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [seller.id, phone]);
    expect((await read(hours(1))).buyerVisible).toBe(false);
    await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [locationId]);
    expect((await read(hours(1))).buyerVisible).toBe(true);
    expect(await buyerSees(hours(1))).toBe(true);

    // Past the validity period the Offer stays active for the Seller but leaves buyer results.
    expect((await read(hours(169))).status).toBe('active');
    expect((await read(hours(169))).buyerVisible).toBe(false);
    expect(await buyerSees(hours(169))).toBe(false);

    const off = await createOfferManagementChangeSet(userId, offerId, sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }), { database: db });
    await confirmSellerChangeSet(userId, off.id, { database: db, clock: () => hours(2) });
    expect(await read(hours(3))).toMatchObject({ status: 'inactive', buyerVisible: false });
    expect(await buyerSees(hours(3))).toBe(false);

    expect((await read(hours(3), 'kk')).product).toEqual({ id: seedIds.lambProduct, name: 'Қой еті, жауырын', nameLocale: 'kk' });
    expect((await read(hours(3))).product).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
  });
});
