import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;
const productId = '10000000-0000-4000-8000-000000011100';
const productName = 'S11 Discovery Product 11100';
const sellerId = '20000000-0000-4000-8000-000000011100';
const locationIds = {
  inside: '30000000-0000-4000-8000-000000011101',
  boundary: '30000000-0000-4000-8000-000000011102',
  outside: '30000000-0000-4000-8000-000000011103',
  geoless: '30000000-0000-4000-8000-000000011104',
} as const;
const offerIds = {
  insideFreshA: '40000000-0000-4000-8000-000000011101',
  insideFreshB: '40000000-0000-4000-8000-000000011102',
  insideOld: '40000000-0000-4000-8000-000000011103',
  boundary: '40000000-0000-4000-8000-000000011104',
  outside: '40000000-0000-4000-8000-000000011105',
  geoless: '40000000-0000-4000-8000-000000011106',
  inactive: '40000000-0000-4000-8000-000000011107',
  expired: '40000000-0000-4000-8000-000000011108',
} as const;

const buyerLocation = { latitude: 0, longitude: 0 };
const now = new Date('2026-09-14T12:00:00.000Z');
const lifecycleOptions = { clock: () => now, validityPeriodHours: 24 };
const nearbyOptions = { ...lifecycleOptions, nearbyRadiusMeters: 5000 };

function pointNorthByMeters(meters: number) {
  return {
    latitude: meters / EARTH_MEAN_RADIUS_METERS * 180 / Math.PI,
    longitude: 0,
  };
}

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanup() {
  await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  await cleanup();

  const inside = pointNorthByMeters(1000.4);
  const boundary = pointNorthByMeters(5000.4);
  const outside = pointNorthByMeters(5000.6);

  await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await pool.query(`INSERT INTO sellers
    (id,display_name,contact_phone_e164,whatsapp_phone_e164,telegram_username,instagram_username)
    VALUES ($1,$2,$3,$4,$5,$6)`, [
    sellerId,
    'S11 discovery seller',
    '+77010000001',
    '+77010000002',
    's11seller',
    's11.seller',
  ]);
  await pool.query(`INSERT INTO locations
    (id,seller_id,name,address_text,type,latitude,longitude)
    VALUES
    ($1,$5,'S11 inside','S11 inside address','shop',$6,$7),
    ($2,$5,'S11 boundary','S11 boundary address','shop',$8,$9),
    ($3,$5,'S11 outside','S11 outside address','shop',$10,$11),
    ($4,$5,'S11 geoless','S11 geoless address','shop',NULL,NULL)`, [
    locationIds.inside,
    locationIds.boundary,
    locationIds.outside,
    locationIds.geoless,
    sellerId,
    inside.latitude,
    inside.longitude,
    boundary.latitude,
    boundary.longitude,
    outside.latitude,
    outside.longitude,
  ]);

  await pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at)
    VALUES
    ($1,$9,$10,$11,'1','KZT',NULL,'active',$15,$15,$15),
    ($2,$9,$10,$11,'1','KZT',NULL,'active',$15,$15,$15),
    ($3,$9,$10,$11,'1','KZT',NULL,'active',$16,$16,$16),
    ($4,$9,$10,$12,'1','KZT',NULL,'active',$17,$17,$17),
    ($5,$9,$10,$13,'1','KZT',NULL,'active',$18,$18,$18),
    ($6,$9,$10,$14,'1','KZT',NULL,'active',$19,$19,$19),
    ($7,$9,$10,$11,'1','KZT',NULL,'inactive',$20,$20,$20),
    ($8,$9,$10,$11,'1','KZT',NULL,'active',$21,$21,$21)`, [
    offerIds.insideFreshA,
    offerIds.insideFreshB,
    offerIds.insideOld,
    offerIds.boundary,
    offerIds.outside,
    offerIds.geoless,
    offerIds.inactive,
    offerIds.expired,
    productId,
    sellerId,
    locationIds.inside,
    locationIds.boundary,
    locationIds.outside,
    locationIds.geoless,
    new Date('2026-09-14T11:00:00.000Z'),
    new Date('2026-09-14T10:00:00.000Z'),
    new Date('2026-09-14T11:30:00.000Z'),
    new Date('2026-09-14T11:45:00.000Z'),
    new Date('2026-09-14T11:50:00.000Z'),
    new Date('2026-09-14T11:59:00.000Z'),
    new Date('2026-09-13T12:00:00.000Z'),
  ]);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

function ids(result: Awaited<ReturnType<typeof findNearbyOffers>>) {
  return result.offers.map(({ id }) => id);
}

async function persistentSnapshot() {
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM sellers) AS sellers,
    (SELECT count(*)::int FROM locations) AS locations,
    (SELECT count(*)::int FROM offers) AS offers`);
  const seller = await pool.query('SELECT * FROM sellers WHERE id=$1', [sellerId]);
  const locations = await pool.query('SELECT * FROM locations WHERE seller_id=$1 ORDER BY id', [sellerId]);
  const offers = await pool.query('SELECT * FROM offers WHERE product_id=$1 ORDER BY id', [productId]);
  return { counts: counts.rows, seller: seller.rows, locations: locations.rows, offers: offers.rows };
}

describe('S11 Nearby Discovery on PostgreSQL 18 after UX1D eligibility', () => {
  it('applies S1 visibility, inclusive rounded radius and deterministic distance/freshness/id ordering', async () => {
    const result = await findNearbyOffers(buyerLocation, db, nearbyOptions);

    expect(ids(result)).toEqual([
      offerIds.insideFreshA,
      offerIds.insideFreshB,
      offerIds.insideOld,
      offerIds.boundary,
    ]);
    expect(result.offers.map(({ distanceMeters }) => distanceMeters)).toEqual([1000, 1000, 1000, 5000]);
    expect(ids(result)).not.toContain(offerIds.outside);
    expect(ids(result)).not.toContain(offerIds.geoless);
    expect(ids(result)).not.toContain(offerIds.inactive);
    expect(ids(result)).not.toContain(offerIds.expired);
  });

  it('returns the S10 public contacts projection plus distance without raw geo or private ranking metadata', async () => {
    const result = await findNearbyOffers(buyerLocation, db, nearbyOptions);
    expect(result.offers[0]?.seller.contacts).toEqual({
      phoneE164: '+77010000001',
      whatsappPhoneE164: '+77010000002',
      telegramUsername: 's11seller',
      instagramUsername: 's11.seller',
    });

    const serialized = JSON.stringify(result);
    expect(serialized).toContain('"distanceMeters"');
    for (const forbidden of [
      '"geo"',
      '"latitude"',
      '"longitude"',
      '"buyerLocation"',
      '"lastConfirmedAt"',
      '"nearbyRadiusMeters"',
      '"rank"',
      '"score"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('is read-only across User/Seller/Location/Offer persistence', async () => {
    const before = await persistentSnapshot();
    await findNearbyOffers(buyerLocation, db, nearbyOptions);
    const after = await persistentSnapshot();
    expect(after).toEqual(before);
  });

  it('keeps Search unfiltered by Nearby radius while applying UX1D phone+geo eligibility', async () => {
    const search = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation });
    expect(search.offers.map(({ id }) => id)).toEqual([
      offerIds.insideFreshA,
      offerIds.insideFreshB,
      offerIds.insideOld,
      offerIds.boundary,
      offerIds.outside,
    ]);
    expect(search.offers.map(({ id }) => id)).toContain(offerIds.outside);
    expect(search.offers.map(({ id }) => id)).not.toContain(offerIds.geoless);
    expect(JSON.stringify(search)).not.toContain('"distanceMeters"');
  });

  it('returns the same exact order for repeated identical inputs', async () => {
    const runs = await Promise.all(Array.from({ length: 3 }, () =>
      findNearbyOffers(buyerLocation, db, nearbyOptions)));
    const expected = ids(runs[0]!);
    for (const result of runs) expect(ids(result)).toEqual(expected);
  });
});
