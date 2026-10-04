import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { searchResponseSchema } from '../../src/modules/search/contracts/search.contract';
import { connectTestDatabase } from './database';

// Stage #6 «Сначала дешевле»: nominal price ascending, units are NOT normalized, geo-less Offers interleave.
const productId = '10000000-0000-4000-8000-000000009600';
const productName = 'S6b Cheaper Product 9600';
const sellerId = '20000000-0000-4000-8000-000000009600';
const geoLocationId = '30000000-0000-4000-8000-000000009601';
const geolessLocationId = '30000000-0000-4000-8000-000000009602';

const offerIds = {
  cheapestGeoless: '40000000-0000-4000-8000-000000009601',
  midPerKg: '40000000-0000-4000-8000-000000009602',
  midPerPieceNewer: '40000000-0000-4000-8000-000000009603',
  expensive: '40000000-0000-4000-8000-000000009604',
  inactiveCheapest: '40000000-0000-4000-8000-000000009605',
} as const;

const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };
const now = new Date('2026-09-13T12:00:00.000Z');
const lifecycleOptions = { clock: () => now, validityPeriodHours: 24 };

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
  await pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, 'S6b cheaper seller', '+77000009600']);
  await pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$3,'S6b geo','S6b geo address','shop',$4,$5),
    ($2,$3,'S6b geoless','S6b geoless address','shop',NULL,NULL)`,
  [geoLocationId, geolessLocationId, sellerId, buyerLocation.latitude, buyerLocation.longitude]);

  await insertOffer(offerIds.cheapestGeoless, geolessLocationId, 500, 'package', 'active', '2026-09-13T10:00:00.000Z');
  await insertOffer(offerIds.midPerKg, geoLocationId, 1000, 'kg', 'active', '2026-09-13T11:00:00.000Z');
  // Same nominal price, different unit, fresher — ties break on freshness, units never normalize.
  await insertOffer(offerIds.midPerPieceNewer, geoLocationId, 1000, 'piece', 'active', '2026-09-13T11:30:00.000Z');
  await insertOffer(offerIds.expensive, geoLocationId, 2000, 'kg', 'active', '2026-09-13T11:45:00.000Z');
  await insertOffer(offerIds.inactiveCheapest, geoLocationId, 100, 'kg', 'inactive', '2026-09-13T11:59:00.000Z');
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

const ids = (result: Awaited<ReturnType<typeof searchOffers>>) => result.offers.map((offer) => offer.id);

const expectedOrder = [
  offerIds.cheapestGeoless,
  offerIds.midPerPieceNewer,
  offerIds.midPerKg,
  offerIds.expensive,
];

describe('Search «Сначала дешевле» on PostgreSQL 18 (stage #6)', () => {
  it('orders by nominal price ascending, ties by freshness, geo-less interleaved, inactive excluded', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, sortMode: 'cheaper' });
    expect(ids(result)).toEqual(expectedOrder);
  });

  it('keeps the same order with Buyer location (coordinates do not affect price order)', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation, sortMode: 'cheaper' });
    expect(ids(result)).toEqual(expectedOrder);
  });

  it('keeps the public DTO unchanged and valid', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation, sortMode: 'cheaper' });
    expect(searchResponseSchema.safeParse(result).success).toBe(true);
    const serialized = JSON.stringify(result);
    for (const forbidden of ['"latitude"', '"longitude"', '"score"', '"rank"', '"lastConfirmedAt"']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('does not change the default actuality order', async () => {
    const result = await searchOffers(productName, db, lifecycleOptions);
    expect(ids(result)).toEqual([
      offerIds.expensive,
      offerIds.midPerPieceNewer,
      offerIds.midPerKg,
      offerIds.cheapestGeoless,
    ]);
  });
});
