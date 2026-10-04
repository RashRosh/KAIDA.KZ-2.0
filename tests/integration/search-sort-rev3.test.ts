import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { searchResponseSchema } from '../../src/modules/search/contracts/search.contract';
import { connectTestDatabase } from './database';

// Stage 6 Rev 3: explicit price and actuality sorting on PostgreSQL — nominal price across units, directions, defaults,
// and the unchanged buyer eligibility.
const productId = '10000000-0000-4000-8000-000000009700';
const productName = 'Rev3 Sort Product 9700';
const sellerId = '20000000-0000-4000-8000-000000009700';
const geoLocationId = '30000000-0000-4000-8000-000000009701';
const geolessLocationId = '30000000-0000-4000-8000-000000009702';

const offerIds = {
  packageCheap: '40000000-0000-4000-8000-000000009701', // 800 ₸ / упак., oldest eligible
  kgMid: '40000000-0000-4000-8000-000000009702', // 1000 ₸ / кг
  literMid: '40000000-0000-4000-8000-000000009703', // 1000 ₸ / л, fresher than kgMid, geo-less
  pieceDear: '40000000-0000-4000-8000-000000009704', // 2500 ₸ / шт., freshest
  inactiveCheapest: '40000000-0000-4000-8000-000000009705',
  expiredCheapest: '40000000-0000-4000-8000-000000009706',
} as const;

const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };
const now = new Date('2026-09-13T12:00:00.000Z');
const lifecycleOptions = { clock: () => now, validityPeriodHours: 168 };

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanup() {
  await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
}

async function insertOffer(id: string, locationId: string, amount: number, unitCode: string, status: string, confirmedAt: string) {
  await pool.query(
    `INSERT INTO offers
      (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
      VALUES ($1,$2,$3,$4,$5,'KZT',$6,$7,$8,$8,$8,$9,lower($9),gen_random_uuid())`,
    [id, productId, sellerId, locationId, amount, unitCode, status, new Date(confirmedAt), productName],
  );
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  await cleanup();
  await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, 'Rev3 sort seller', '+77000009700']);
  await pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$3,'Rev3 geo','Rev3 geo address','shop',$4,$5),
    ($2,$3,'Rev3 geoless','Rev3 geoless address','shop',NULL,NULL)`,
  [geoLocationId, geolessLocationId, sellerId, buyerLocation.latitude, buyerLocation.longitude]);

  await insertOffer(offerIds.packageCheap, geoLocationId, 800, 'package', 'active', '2026-09-10T12:00:00.000Z');
  await insertOffer(offerIds.kgMid, geoLocationId, 1000, 'kg', 'active', '2026-09-13T10:00:00.000Z');
  await insertOffer(offerIds.literMid, geolessLocationId, 1000, 'liter', 'active', '2026-09-13T11:00:00.000Z');
  await insertOffer(offerIds.pieceDear, geoLocationId, 2500, 'piece', 'active', '2026-09-13T11:50:00.000Z');
  await insertOffer(offerIds.inactiveCheapest, geoLocationId, 100, 'kg', 'inactive', '2026-09-13T11:59:00.000Z');
  await insertOffer(offerIds.expiredCheapest, geoLocationId, 100, 'kg', 'active', '2026-09-01T12:00:00.000Z');
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

const ids = (result: Awaited<ReturnType<typeof searchOffers>>) => result.offers.map((offer) => offer.id);

describe('Search explicit sorting on PostgreSQL 18 (stage 6 Rev 3)', () => {
  it('price: the nominal amount only — 800 ₸ / упак. before 1000 ₸ / кг — with the natural direction cheaper first', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, sort: 'price' });
    // Equal prices (kg and liter) keep «fresher first».
    expect(ids(result)).toEqual([offerIds.packageCheap, offerIds.literMid, offerIds.kgMid, offerIds.pieceDear]);
  });

  it('price desc: dearer first, equal prices still fresher first', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, sort: 'price', direction: 'desc' });
    expect(ids(result)).toEqual([offerIds.pieceDear, offerIds.literMid, offerIds.kgMid, offerIds.packageCheap]);
  });

  it('actuality: fresher first by default, older first with asc — no tier puts the oldest Offer last by rule', async () => {
    expect(ids(await searchOffers(productName, db, lifecycleOptions))).toEqual([offerIds.pieceDear, offerIds.literMid, offerIds.kgMid, offerIds.packageCheap]);
    expect(ids(await searchOffers(productName, db, { ...lifecycleOptions, sort: 'actuality', direction: 'asc' })))
      .toEqual([offerIds.packageCheap, offerIds.kgMid, offerIds.literMid, offerIds.pieceDear]);
  });

  it('keeps buyer eligibility: inactive and expired Offers never appear, whatever the sort', async () => {
    for (const sort of ['price', 'actuality'] as const) {
      const result = await searchOffers(productName, db, { ...lifecycleOptions, sort });
      expect(ids(result)).not.toContain(offerIds.inactiveCheapest);
      expect(ids(result)).not.toContain(offerIds.expiredCheapest);
      expect(result.offers).toHaveLength(4);
    }
  });

  it('the price order does not depend on the buyer location, which only adds the derived distance', async () => {
    const without = await searchOffers(productName, db, { ...lifecycleOptions, sort: 'price' });
    const withLocation = await searchOffers(productName, db, { ...lifecycleOptions, sort: 'price', buyerLocation });
    expect(ids(withLocation)).toEqual(ids(without));
    expect(withLocation.offers.find((offer) => offer.id === offerIds.kgMid)!.distanceMeters).toBe(0);
    expect(withLocation.offers.find((offer) => offer.id === offerIds.literMid)).not.toHaveProperty('distanceMeters');
  });

  it('keeps the public DTO valid and free of raw coordinates', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, sort: 'distance', buyerLocation });
    expect(searchResponseSchema.safeParse(result).success).toBe(true);
    const serialized = JSON.stringify(result);
    for (const forbidden of ['"latitude"', '"longitude"', '"buyerLocation"', '"lastConfirmedAt"', '"score"', '"rank"']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('refuses to rank by distance without a buyer location instead of ordering otherwise', async () => {
    await expect(searchOffers(productName, db, { ...lifecycleOptions, sort: 'distance' })).rejects.toThrow();
  });
});
