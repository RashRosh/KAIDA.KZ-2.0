import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { connectTestDatabase } from './database';

const productId = '10000000-0000-4000-8000-000000010901';
const productName = 'S10 Search Product 10901';
const aliasName = 'S10 search alias 10901';
const userId = '50000000-0000-4000-8000-000000010901';
const identityPhone = '+77009991901';
const sellerId = '20000000-0000-4000-8000-000000010901';
const nearLocationId = '30000000-0000-4000-8000-000000010901';
const farLocationId = '30000000-0000-4000-8000-000000010902';
const geolessLocationId = '30000000-0000-4000-8000-000000010903';
const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };
const now = new Date('2026-09-14T12:00:00.000Z');
const options = { clock: () => now, validityPeriodHours: 24 };

const offerIds = {
  nearFresh: '40000000-0000-4000-8000-000000010901',
  nearOld: '40000000-0000-4000-8000-000000010902',
  farNewer: '40000000-0000-4000-8000-000000010903',
  geolessNewest: '40000000-0000-4000-8000-000000010904',
  inactive: '40000000-0000-4000-8000-000000010905',
  expired: '40000000-0000-4000-8000-000000010906',
} as const;

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanup() {
  await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM product_aliases WHERE product_id=$1', [productId]);
  await pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, identityPhone]);
  await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
}

function ids(result: Awaited<ReturnType<typeof searchOffers>>) {
  return result.offers.map((offer) => offer.id);
}

function sellerObject(result: Awaited<ReturnType<typeof searchOffers>>) {
  return result.offers[0]?.seller as unknown as Record<string, unknown>;
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  await cleanup();
  await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await pool.query('INSERT INTO product_aliases (product_id,name) VALUES ($1,$2)', [productId, aliasName]);
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, identityPhone, now]);
  await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, 'S10 Search Seller', userId]);
  await pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$4,'S10 near','S10 near address','shop',$5,$6),
    ($2,$4,'S10 far','S10 far address','shop',$7,$8),
    ($3,$4,'S10 geoless','S10 geoless address','shop',NULL,NULL)`, [
    nearLocationId, farLocationId, geolessLocationId, sellerId,
    buyerLocation.latitude, buyerLocation.longitude, 43.338949, 76.989709,
  ]);
  await pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,status,last_confirmed_at,created_at,updated_at)
    VALUES
    ($1,$7,$8,$9,'active',$12,$12,$12),
    ($2,$7,$8,$9,'active',$13,$13,$13),
    ($3,$7,$8,$10,'active',$14,$14,$14),
    ($4,$7,$8,$11,'active',$15,$15,$15),
    ($5,$7,$8,$9,'inactive',$16,$16,$16),
    ($6,$7,$8,$9,'active',$17,$17,$17)`, [
    offerIds.nearFresh, offerIds.nearOld, offerIds.farNewer, offerIds.geolessNewest,
    offerIds.inactive, offerIds.expired, productId, sellerId,
    nearLocationId, farLocationId, geolessLocationId,
    new Date('2026-09-14T11:00:00Z'),
    new Date('2026-09-14T10:00:00Z'),
    new Date('2026-09-14T11:30:00Z'),
    new Date('2026-09-14T11:45:00Z'),
    new Date('2026-09-14T11:59:00Z'),
    new Date('2026-09-13T12:00:00Z'),
  ]);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('S10 Search Seller contacts projection on PostgreSQL 18 after UX1D eligibility', () => {
  it('keeps a Seller with no contact phone valid seller-side but excludes its Offers from buyer Search', async () => {
    const result = await searchOffers(productName, db, options);
    expect(result.offers).toEqual([]);
    const stored = await pool.query('SELECT id,contact_phone_e164 FROM sellers WHERE id=$1', [sellerId]);
    expect(stored.rows).toEqual([{ id: sellerId, contact_phone_e164: null }]);
  });

  it('projects only structured public contacts and leaks no private Seller/Identity/geo/ranking data', async () => {
    await pool.query(`UPDATE sellers SET
      contact_phone_e164=$2, whatsapp_phone_e164=$3, telegram_username=$4, instagram_username=$5
      WHERE id=$1`, [sellerId, '+12025550123', '+447911123456', 'kaida_shop', 'kaida.shop']);

    const result = await searchOffers(productName, db, { ...options, buyerLocation });
    expect(ids(result)).toEqual([offerIds.nearFresh, offerIds.nearOld, offerIds.farNewer]);
    expect(sellerObject(result)).toEqual({
      id: sellerId,
      displayName: 'S10 Search Seller',
      contacts: {
        phoneE164: '+12025550123',
        whatsappPhoneE164: '+447911123456',
        telegramUsername: 'kaida_shop',
        instagramUsername: 'kaida.shop',
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(identityPhone);
    for (const forbidden of [
      'ownerUserId', 'owner_user_id', 'latitude', 'longitude', 'buyerLocation',
      'distance', 'distanceMeters', 'lastConfirmedAt', 'rank', 'score',
      '"url"', '"href"', '"link"', '"redirect"',
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('preserves S1 visibility, S6 alias resolution and exact S9 ordering among buyer-eligible Offers when optional contacts change', async () => {
    const expectedWithGeo = [offerIds.nearFresh, offerIds.nearOld, offerIds.farNewer];
    const expectedWithoutGeo = [offerIds.farNewer, offerIds.nearFresh, offerIds.nearOld];

    const withGeo = await searchOffers(productName, db, { ...options, buyerLocation });
    const withoutGeo = await searchOffers(productName, db, options);
    expect(ids(withGeo)).toEqual(expectedWithGeo);
    expect(ids(withoutGeo)).toEqual(expectedWithoutGeo);
    expect(ids(withGeo)).not.toContain(offerIds.geolessNewest);
    expect(ids(withGeo)).not.toContain(offerIds.inactive);
    expect(ids(withGeo)).not.toContain(offerIds.expired);

    const alias = await searchOffers(aliasName, db, { ...options, buyerLocation });
    expect(ids(alias)).toEqual(expectedWithGeo);
    expect(new Set(alias.offers.map((offer) => offer.product.id))).toEqual(new Set([productId]));

    await pool.query(`UPDATE sellers SET
      contact_phone_e164=$2, whatsapp_phone_e164=$3, telegram_username=$4, instagram_username=$5
      WHERE id=$1`, [sellerId, '+77001234567', null, 'changed_shop', null]);

    expect(ids(await searchOffers(productName, db, { ...options, buyerLocation }))).toEqual(expectedWithGeo);
    expect(ids(await searchOffers(productName, db, options))).toEqual(expectedWithoutGeo);
  });
});
