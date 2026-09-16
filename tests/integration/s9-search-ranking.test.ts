import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

const productId = '10000000-0000-4000-8000-000000009100';
const productName = 'S9 Ranking Product 9100';
const aliasName = 'S9 ranking alias 9100';
const sellerId = '20000000-0000-4000-8000-000000009100';
const nearLocationId = '30000000-0000-4000-8000-000000009101';
const farLocationId = '30000000-0000-4000-8000-000000009102';
const geolessLocationId = '30000000-0000-4000-8000-000000009103';

const offerIds = {
  nearFreshA: '40000000-0000-4000-8000-000000009101',
  nearFreshB: '40000000-0000-4000-8000-000000009102',
  nearOld: '40000000-0000-4000-8000-000000009103',
  farNewer: '40000000-0000-4000-8000-000000009104',
  geolessFresh: '40000000-0000-4000-8000-000000009105',
  geolessOld: '40000000-0000-4000-8000-000000009106',
  inactiveNearest: '40000000-0000-4000-8000-000000009107',
  expiredNearest: '40000000-0000-4000-8000-000000009108',
} as const;

const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };
const now = new Date('2026-09-13T12:00:00.000Z');
const lifecycleOptions = { clock: () => now, validityPeriodHours: 24 };

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanup() {
  await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM product_aliases WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  await cleanup();

  await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await pool.query('INSERT INTO product_aliases (product_id,name) VALUES ($1,$2)', [productId, aliasName]);
  await pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, 'S9 ranking seller', '+77000009100']);
  await pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$4,'S9 near','S9 near address','shop',$5,$6),
    ($2,$4,'S9 far','S9 far address','shop',$7,$8),
    ($3,$4,'S9 geoless','S9 geoless address','shop',NULL,NULL)`, [
    nearLocationId,
    farLocationId,
    geolessLocationId,
    sellerId,
    buyerLocation.latitude,
    buyerLocation.longitude,
    43.338949,
    76.989709,
  ]);

  await pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,created_at,updated_at)
    VALUES
    ($1,$9,$10,$11,1000,'KZT','active',$14,$14,$14),
    ($2,$9,$10,$11,1000,'KZT','active',$14,$14,$14),
    ($3,$9,$10,$11,1000,'KZT','active',$15,$15,$15),
    ($4,$9,$10,$12,1000,'KZT','active',$16,$16,$16),
    ($5,$9,$10,$13,1000,'KZT','active',$17,$17,$17),
    ($6,$9,$10,$13,1000,'KZT','active',$18,$18,$18),
    ($7,$9,$10,$11,1000,'KZT','inactive',$19,$19,$19),
    ($8,$9,$10,$11,1000,'KZT','active',$20,$20,$20)`, [
    offerIds.nearFreshA,
    offerIds.nearFreshB,
    offerIds.nearOld,
    offerIds.farNewer,
    offerIds.geolessFresh,
    offerIds.geolessOld,
    offerIds.inactiveNearest,
    offerIds.expiredNearest,
    productId,
    sellerId,
    nearLocationId,
    farLocationId,
    geolessLocationId,
    new Date('2026-09-13T11:00:00.000Z'),
    new Date('2026-09-13T10:00:00.000Z'),
    new Date('2026-09-13T11:30:00.000Z'),
    new Date('2026-09-13T11:45:00.000Z'),
    new Date('2026-09-13T09:00:00.000Z'),
    new Date('2026-09-13T11:59:00.000Z'),
    new Date('2026-09-12T12:00:00.000Z'),
  ]);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

function ids(result: Awaited<ReturnType<typeof searchOffers>>) {
  return result.offers.map((offer) => offer.id);
}

describe('S9 Search ranking on PostgreSQL 18 after UX1D eligibility', () => {
  it('preserves the closed legacy searchOffers call signatures at compile time', () => {
    const compileOnly = () => {
      void searchOffers(productName);
      void searchOffers(productName, db);
      void searchOffers(productName, db, { clock: () => now, validityPeriodHours: 24 });
    };
    expect(compileOnly).toBeTypeOf('function');
  });

  it('with Buyer location ranks buyer-eligible Offers by whole-meter distance, then freshness, then Offer.id', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation });
    expect(ids(result)).toEqual([
      offerIds.nearFreshA,
      offerIds.nearFreshB,
      offerIds.nearOld,
      offerIds.farNewer,
    ]);
    expect(ids(result)).not.toContain(offerIds.geolessFresh);
    expect(ids(result)).not.toContain(offerIds.geolessOld);
  });

  it('keeps a farther newer eligible Offer below nearer eligible Offers', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation });
    expect(ids(result).indexOf(offerIds.nearOld)).toBeLessThan(ids(result).indexOf(offerIds.farNewer));
  });

  it('without Buyer location sorts buyer-eligible Offers by freshness then Offer.id', async () => {
    const result = await searchOffers(productName, db, lifecycleOptions);
    expect(ids(result)).toEqual([
      offerIds.farNewer,
      offerIds.nearFreshA,
      offerIds.nearFreshB,
      offerIds.nearOld,
    ]);
  });

  it('excludes ineligible, inactive and cutoff-equal expired Offers before ranking', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation });
    expect(ids(result)).not.toContain(offerIds.geolessFresh);
    expect(ids(result)).not.toContain(offerIds.geolessOld);
    expect(ids(result)).not.toContain(offerIds.inactiveNearest);
    expect(ids(result)).not.toContain(offerIds.expiredNearest);
    expect(result.offers).toHaveLength(4);
  });

  it('uses identical S6 canonical/alias semantics and exact ranking order', async () => {
    const canonical = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation });
    const alias = await searchOffers(aliasName, db, { ...lifecycleOptions, buyerLocation });
    expect(ids(alias)).toEqual(ids(canonical));
    expect(alias.offers.map((offer) => offer.product.id)).toEqual(
      canonical.offers.map((offer) => offer.product.id),
    );
    expect(new Set(alias.offers.map((offer) => offer.product.id))).toEqual(new Set([productId]));
  });

  it('returns exact repeated deterministic ordering for identical inputs', async () => {
    const runs = await Promise.all(Array.from({ length: 5 }, () =>
      searchOffers(productName, db, { ...lifecycleOptions, buyerLocation })));
    const expected = ids(runs[0]!);
    for (const result of runs) expect(ids(result)).toEqual(expected);
  });

  it('discards all private ranking metadata at the public SearchResponse boundary', async () => {
    const result = await searchOffers(productName, db, { ...lifecycleOptions, buyerLocation });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      '"geo"',
      '"latitude"',
      '"longitude"',
      '"buyerLocation"',
      '"distance"',
      '"distanceMeters"',
      '"lastConfirmedAt"',
      '"rank"',
      '"score"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
