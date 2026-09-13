import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import {
  LocationNotFoundError,
  setOwnedLocationGeo,
} from '../../src/modules/locations/application/set-owned-location-geo';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { getOwnedSeller } from '../../src/modules/sellers/application/get-owned-seller';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

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

async function createUser(userId: string, phone: string) {
  await cleanupUser(userId, phone);
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, new Date('2026-09-13T00:00:00Z')]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await pool.end();
});

describe('S8 Location geo on PostgreSQL 18', () => {
  it('starts null, persists an owned point, replaces it and treats the same pair as idempotent', async () => {
    const userId = '50000000-0000-4000-8000-000000000901';
    const phone = '+77000000901';
    await createUser(userId, phone);
    try {
      const seller = await setupSeller(userId, {
        seller: { displayName: 'S8 geo seller 901' },
        location: { name: 'S8 geo point 901', type: 'shop', addressText: 'S8 geo address 901' },
      }, { database: db });
      const locationId = seller.locations[0]!.id;

      expect(seller.locations[0]!.geo).toBeNull();
      expect((await pool.query('SELECT latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0])
        .toEqual({ latitude: null, longitude: null });

      const pointA = { latitude: 43.238949, longitude: 76.889709 };
      const first = await setOwnedLocationGeo(userId, locationId, pointA, { database: db });
      expect(first.geo).toEqual(pointA);
      expect((await getOwnedSeller(userId, { database: db }))?.locations[0]?.geo).toEqual(pointA);

      const same = await setOwnedLocationGeo(userId, locationId, pointA, { database: db });
      expect(same.geo).toEqual(pointA);

      const pointB = { latitude: 43.250001, longitude: 76.910002 };
      const replaced = await setOwnedLocationGeo(userId, locationId, pointB, { database: db });
      expect(replaced.geo).toEqual(pointB);
      expect((await pool.query('SELECT latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0])
        .toEqual(pointB);
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('uses the same not-found semantics for foreign, nonexistent and no-Seller mutation attempts', async () => {
    const ownerId = '50000000-0000-4000-8000-000000000902';
    const foreignId = '50000000-0000-4000-8000-000000000903';
    const noSellerId = '50000000-0000-4000-8000-000000000904';
    const ownerPhone = '+77000000902';
    const foreignPhone = '+77000000903';
    const noSellerPhone = '+77000000904';
    await createUser(ownerId, ownerPhone);
    await createUser(foreignId, foreignPhone);
    await createUser(noSellerId, noSellerPhone);
    try {
      await setupSeller(ownerId, {
        seller: { displayName: 'S8 owner 902' },
        location: { name: 'S8 owner point', type: 'shop', addressText: 'S8 owner address' },
      }, { database: db });
      const foreignSeller = await setupSeller(foreignId, {
        seller: { displayName: 'S8 foreign 903' },
        location: { name: 'S8 foreign point', type: 'home', addressText: 'S8 foreign address' },
      }, { database: db });
      const foreignLocationId = foreignSeller.locations[0]!.id;
      const point = { latitude: 43.2, longitude: 76.8 };

      for (const operation of [
        () => setOwnedLocationGeo(ownerId, foreignLocationId, point, { database: db }),
        () => setOwnedLocationGeo(ownerId, '99999999-9999-4999-8999-999999999999', point, { database: db }),
        () => setOwnedLocationGeo(noSellerId, foreignLocationId, point, { database: db }),
      ]) {
        try {
          await operation();
          throw new Error('Expected LOCATION_NOT_FOUND');
        } catch (error) {
          expect(error).toBeInstanceOf(LocationNotFoundError);
          expect((error as LocationNotFoundError).code).toBe('LOCATION_NOT_FOUND');
        }
      }

      expect((await getOwnedSeller(foreignId, { database: db }))?.locations[0]?.geo).toBeNull();
    } finally {
      await cleanupUser(ownerId, ownerPhone);
      await cleanupUser(foreignId, foreignPhone);
      await cleanupUser(noSellerId, noSellerPhone);
    }
  });

  it('enforces complete-pair, ranges and rejects PostgreSQL special double values for both coordinates', async () => {
    const userId = '50000000-0000-4000-8000-000000000905';
    const phone = '+77000000905';
    await createUser(userId, phone);
    try {
      const seller = await setupSeller(userId, {
        seller: { displayName: 'S8 DB proof seller' },
        location: { name: 'S8 DB proof point', type: 'other', addressText: 'S8 DB proof address' },
      }, { database: db });
      const locationId = seller.locations[0]!.id;

      await expect(pool.query('UPDATE locations SET latitude=43,longitude=NULL WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_geo_complete_pair' });
      await expect(pool.query('UPDATE locations SET latitude=NULL,longitude=76 WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_geo_complete_pair' });
      await expect(pool.query('UPDATE locations SET latitude=90.000001,longitude=0 WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_latitude_range' });
      await expect(pool.query('UPDATE locations SET latitude=0,longitude=180.000001 WHERE id=$1', [locationId]))
        .rejects.toMatchObject({ code: '23514', constraint: 'locations_longitude_range' });

      for (const special of ['NaN', 'Infinity', '-Infinity']) {
        await expect(pool.query(`UPDATE locations SET latitude='${special}'::double precision,longitude=0 WHERE id=$1`, [locationId]))
          .rejects.toMatchObject({ code: '23514', constraint: 'locations_latitude_range' });
        await expect(pool.query(`UPDATE locations SET latitude=0,longitude='${special}'::double precision WHERE id=$1`, [locationId]))
          .rejects.toMatchObject({ code: '23514', constraint: 'locations_longitude_range' });
      }

      await pool.query('UPDATE locations SET latitude=90,longitude=180 WHERE id=$1', [locationId]);
      expect((await pool.query('SELECT latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0])
        .toEqual({ latitude: 90, longitude: 180 });
      await pool.query('UPDATE locations SET latitude=-90,longitude=-180 WHERE id=$1', [locationId]);
      expect((await pool.query('SELECT latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0])
        .toEqual({ latitude: -90, longitude: -180 });
    } finally {
      await cleanupUser(userId, phone);
    }
  });

  it('keeps raw geo out of Search projection for both shop and home Locations', async () => {
    const shopUserId = '50000000-0000-4000-8000-000000000906';
    const homeUserId = '50000000-0000-4000-8000-000000000907';
    const shopPhone = '+77000000906';
    const homePhone = '+77000000907';
    const productId = '10000000-0000-4000-8000-000000000908';
    const productName = 'S8 privacy product 908';
    await createUser(shopUserId, shopPhone);
    await createUser(homeUserId, homePhone);
    await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
    await pool.query('DELETE FROM product_aliases WHERE product_id=$1', [productId]);
    await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
    try {
      const shop = await setupSeller(shopUserId, {
        seller: { displayName: 'S8 privacy shop seller' },
        location: { name: 'S8 privacy shop', type: 'shop', addressText: 'S8 shop address' },
      }, { database: db });
      const home = await setupSeller(homeUserId, {
        seller: { displayName: 'S8 privacy home seller' },
        location: { name: 'S8 privacy home', type: 'home', addressText: 'S8 home address' },
      }, { database: db });
      await setOwnedLocationGeo(shopUserId, shop.locations[0]!.id, { latitude: 43.21, longitude: 76.81 }, { database: db });
      await setOwnedLocationGeo(homeUserId, home.locations[0]!.id, { latitude: 43.22, longitude: 76.82 }, { database: db });

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
      const now = new Date();
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,status,last_confirmed_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,'active',$5,$5,$5),($6,$2,$7,$8,'active',$5,$5,$5)`, [
        '40000000-0000-4000-8000-000000000906', productId, shop.id, shop.locations[0]!.id, now,
        '40000000-0000-4000-8000-000000000907', home.id, home.locations[0]!.id,
      ]);

      const body = await searchOffers(productName, db);
      expect(body.offers).toHaveLength(2);
      for (const offer of body.offers) {
        expect(offer.location).not.toHaveProperty('geo');
        expect(offer.location).not.toHaveProperty('latitude');
        expect(offer.location).not.toHaveProperty('longitude');
      }
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('"geo"');
      expect(serialized).not.toContain('"latitude"');
      expect(serialized).not.toContain('"longitude"');
    } finally {
      await pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
      await pool.query('DELETE FROM product_aliases WHERE product_id=$1', [productId]);
      await pool.query('DELETE FROM products WHERE id=$1 OR name=$2', [productId, productName]);
      await cleanupUser(shopUserId, shopPhone);
      await cleanupUser(homeUserId, homePhone);
    }
  });
});
