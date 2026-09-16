import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { resolveBuyerOfferRoute } from '../../src/modules/offers/application/resolve-buyer-offer-route';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

const productId = '10000000-0000-4000-8000-000000019001';
const productName = 'UX1D eligibility product 19001';
const sellerIds = {
  eligible: '20000000-0000-4000-8000-000000019001',
  noPhone: '20000000-0000-4000-8000-000000019002',
  noGeo: '20000000-0000-4000-8000-000000019003',
  neither: '20000000-0000-4000-8000-000000019004',
} as const;
const locationIds = {
  eligible: '30000000-0000-4000-8000-000000019001',
  noPhone: '30000000-0000-4000-8000-000000019002',
  noGeo: '30000000-0000-4000-8000-000000019003',
  neither: '30000000-0000-4000-8000-000000019004',
} as const;
const offerIds = {
  eligible: '40000000-0000-4000-8000-000000019001',
  noPhone: '40000000-0000-4000-8000-000000019002',
  noGeo: '40000000-0000-4000-8000-000000019003',
  neither: '40000000-0000-4000-8000-000000019004',
  inactive: '40000000-0000-4000-8000-000000019005',
  stale: '40000000-0000-4000-8000-000000019006',
} as const;
const point = { latitude: 43.238949, longitude: 76.889709 };
const now = new Date('2026-09-15T12:00:00.000Z');
const fresh = new Date('2026-09-15T11:00:00.000Z');
const stale = new Date('2026-09-14T12:00:00.000Z');
const options = { clock: () => now, validityPeriodHours: 24 };

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanup() {
  await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM locations WHERE seller_id = ANY($1::uuid[])', [Object.values(sellerIds)]);
  await pool.query('DELETE FROM sellers WHERE id = ANY($1::uuid[])', [Object.values(sellerIds)]);
  await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  await cleanup();

  await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await pool.query(`INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES
    ($1,'UX1D eligible seller','+77001900001'),
    ($2,'UX1D no phone seller',NULL),
    ($3,'UX1D no geo seller','+77001900003'),
    ($4,'UX1D neither seller',NULL)`, Object.values(sellerIds));

  await pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$5,'UX1D eligible point','Almaty eligible','shop',$9,$10),
    ($2,$6,'UX1D no phone point','Almaty no phone','shop',$9,$10),
    ($3,$7,'UX1D no geo point','Almaty no geo','shop',NULL,NULL),
    ($4,$8,'UX1D neither point','Almaty neither','shop',NULL,NULL)`, [
    locationIds.eligible,
    locationIds.noPhone,
    locationIds.noGeo,
    locationIds.neither,
    sellerIds.eligible,
    sellerIds.noPhone,
    sellerIds.noGeo,
    sellerIds.neither,
    point.latitude,
    point.longitude,
  ]);

  await pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,created_at,updated_at) VALUES
    ($1,$7,$8,$12,1000,'KZT','active',$16,$16,$16),
    ($2,$7,$9,$13,1000,'KZT','active',$16,$16,$16),
    ($3,$7,$10,$14,1000,'KZT','active',$16,$16,$16),
    ($4,$7,$11,$15,1000,'KZT','active',$16,$16,$16),
    ($5,$7,$8,$12,1000,'KZT','inactive',$16,$16,$16),
    ($6,$7,$8,$12,1000,'KZT','active',$17,$17,$17)`, [
    offerIds.eligible,
    offerIds.noPhone,
    offerIds.noGeo,
    offerIds.neither,
    offerIds.inactive,
    offerIds.stale,
    productId,
    sellerIds.eligible,
    sellerIds.noPhone,
    sellerIds.noGeo,
    sellerIds.neither,
    locationIds.eligible,
    locationIds.noPhone,
    locationIds.noGeo,
    locationIds.neither,
    fresh,
    stale,
  ]);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('UX1D buyer Offer actionability on PostgreSQL 18', () => {
  it('uses the same phone+geo+lifecycle eligibility for Search and Nearby without deleting incomplete records', async () => {
    const search = await searchOffers(productName, db, options);
    expect(search.offers.map(({ id }) => id)).toEqual([offerIds.eligible]);

    const nearby = await findNearbyOffers(point, db, { ...options, nearbyRadiusMeters: 5000 });
    expect(nearby.offers.map(({ id }) => id)).toEqual([offerIds.eligible]);
    expect(nearby.offers[0]?.distanceMeters).toBe(0);

    const stored = await pool.query('SELECT id,status FROM offers WHERE product_id=$1 ORDER BY id', [productId]);
    expect(stored.rows).toHaveLength(6);
    expect(stored.rows.map(({ id }: { id: string }) => id)).toEqual(Object.values(offerIds));
  });

  it('keeps raw Location coordinates private in buyer Search and Nearby DTOs', async () => {
    const searchSerialized = JSON.stringify(await searchOffers(productName, db, options));
    const nearbySerialized = JSON.stringify(await findNearbyOffers(point, db, { ...options, nearbyRadiusMeters: 5000 }));
    for (const serialized of [searchSerialized, nearbySerialized]) {
      expect(serialized).not.toContain('"latitude"');
      expect(serialized).not.toContain('"longitude"');
      expect(serialized).not.toContain(String(point.latitude));
      expect(serialized).not.toContain(String(point.longitude));
    }
  });

  it('resolves a route only for a currently buyer-eligible Offer and returns no destination for all ineligible states', async () => {
    await expect(resolveBuyerOfferRoute(offerIds.eligible, { database: db, ...options })).resolves.toEqual(point);
    for (const offerId of [offerIds.noPhone, offerIds.noGeo, offerIds.neither, offerIds.inactive, offerIds.stale]) {
      await expect(resolveBuyerOfferRoute(offerId, { database: db, ...options })).resolves.toBeNull();
    }
    await expect(resolveBuyerOfferRoute('40000000-0000-4000-8000-000000019099', { database: db, ...options })).resolves.toBeNull();
  });
});
