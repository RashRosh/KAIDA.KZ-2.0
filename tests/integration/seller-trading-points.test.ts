import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT as updateLocationRequest } from '../../src/app/api/seller/locations/[id]/route';
import { POST as createLocationRequest } from '../../src/app/api/seller/locations/route';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { LocationNotFoundError } from '../../src/modules/locations/application/location-errors';
import { setOwnedLocationGeo } from '../../src/modules/locations/application/set-owned-location-geo';
import { updateOwnedLocation } from '../../src/modules/locations/application/update-owned-location';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createBatchSellerChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  sellerBatchChangeSetCreateBodySchema,
  sellerChangeSetCreateBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

const NOW = new Date('2026-09-17T08:00:00.000Z');
const originalDatabaseUrl = process.env.DATABASE_URL;
let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

function digest(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function request(path: string, method: 'POST' | 'PUT', token?: string, body?: unknown) {
  const headers = new Headers();
  if (token) headers.set('cookie', `kaida_session=${token}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

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

async function fixture(suffix: string) {
  const userId = `50000000-0000-4000-8000-00000000${suffix}`;
  const phone = `+7700000${suffix}`;
  const token = `seller-trading-points-${suffix}`;
  await cleanupUser(userId, phone);
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, NOW]);
  await pool.query('INSERT INTO auth_sessions (id,user_id,token_digest,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)', [
    `60000000-0000-4000-8000-00000000${suffix}`, userId, digest(token), NOW, new Date('2030-09-17T08:00:00.000Z'),
  ]);
  const seller = await setupSeller(userId, {
    seller: { displayName: `Trading points ${suffix}` },
    location: { name: `Point ${suffix}`, type: 'shop', addressText: `Address ${suffix}` },
  }, { database: db });
  return { userId, phone, token, seller };
}

beforeAll(async () => {
  const guardedUrl = testDatabaseUrl();
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  process.env.DATABASE_URL = guardedUrl;
});

afterAll(async () => {
  await pool.end();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('#36 Seller Trading Points on PostgreSQL 18', () => {
  it('exposes strict owner-scoped create/edit APIs with non-disclosing not-found semantics and preserves geo', async () => {
    const owner = await fixture('0361');
    const foreign = await fixture('0362');
    try {
      expect((await createLocationRequest(request('/api/seller/locations', 'POST', undefined, {
        name: 'Anonymous', type: 'shop', addressText: 'Anonymous address',
      }))).status).toBe(401);

      const spoof = await createLocationRequest(request('/api/seller/locations', 'POST', owner.token, {
        name: 'Spoof', type: 'shop', addressText: 'Spoof address', sellerId: foreign.seller.id,
      }));
      expect(spoof.status).toBe(400);

      const createdResponse = await createLocationRequest(request('/api/seller/locations', 'POST', owner.token, {
        name: '  Additional point  ', type: 'pavilion', addressText: '  Additional address  ',
      }));
      expect(createdResponse.status).toBe(201);
      const created = (await createdResponse.json()).location as { id: string };
      await setOwnedLocationGeo(owner.userId, created.id, { latitude: 43.24, longitude: 76.91 }, { database: db });

      const editedResponse = await updateLocationRequest(request(`/api/seller/locations/${created.id}`, 'PUT', owner.token, {
        name: 'Edited point', type: 'market', addressText: 'Edited address',
      }), context(created.id));
      expect(editedResponse.status).toBe(200);
      expect((await editedResponse.json()).location).toEqual({
        id: created.id,
        name: 'Edited point',
        type: 'market',
        addressText: 'Edited address',
        geo: { latitude: 43.24, longitude: 76.91 },
      });

      const foreignResponse = await updateLocationRequest(request(`/api/seller/locations/${foreign.seller.locations[0]!.id}`, 'PUT', owner.token, {
        name: 'No access', type: 'shop', addressText: 'No access',
      }), context(foreign.seller.locations[0]!.id));
      const absentResponse = await updateLocationRequest(request('/api/seller/locations/99999999-9999-4999-8999-999999999999', 'PUT', owner.token, {
        name: 'Absent', type: 'shop', addressText: 'Absent',
      }), context('99999999-9999-4999-8999-999999999999'));
      const malformedResponse = await updateLocationRequest(request('/api/seller/locations/not-an-id', 'PUT', owner.token, {
        name: 'Malformed', type: 'shop', addressText: 'Malformed',
      }), context('not-an-id'));
      expect([foreignResponse.status, absentResponse.status, malformedResponse.status]).toEqual([404, 404, 404]);
      expect(await foreignResponse.json()).toEqual(await absentResponse.json());
      expect(await malformedResponse.json()).toEqual({ error: { code: 'LOCATION_NOT_FOUND', message: 'Точка не найдена.' } });
    } finally {
      await cleanupUser(owner.userId, owner.phone);
      await cleanupUser(foreign.userId, foreign.phone);
    }
  });

  it('preserves independent identity/geo writes, complete concurrent identity payloads, distinct creates and existing Offer links', async () => {
    const owner = await fixture('0363');
    try {
      const locationId = owner.seller.locations[0]!.id;
      const proposal = await createSellerChangeSet(owner.userId, sellerChangeSetCreateBodySchema.parse({
        productName: 'Баранина', locationId, price: { amount: '4200', unit: 'кг' }, sellerComment: 'Existing link',
      }), { database: db });
      const confirmed = await confirmSellerChangeSet(owner.userId, proposal.id, { database: db, clock: () => NOW });
      const offerId = confirmed.items[0]!.resultOffer!.id;
      const beforeOffer = (await pool.query('SELECT id,location_id,status,price_amount,price_currency,price_unit,seller_comment,last_confirmed_at FROM offers WHERE id=$1', [offerId])).rows[0];

      await Promise.all([
        updateOwnedLocation(owner.userId, locationId, { name: 'Identity concurrent', type: 'home', addressText: 'Identity address' }, { database: db }),
        setOwnedLocationGeo(owner.userId, locationId, { latitude: 43.222, longitude: 76.888 }, { database: db }),
      ]);
      expect((await pool.query('SELECT name,type,address_text,latitude,longitude FROM locations WHERE id=$1', [locationId])).rows[0]).toEqual({
        name: 'Identity concurrent', type: 'home', address_text: 'Identity address', latitude: 43.222, longitude: 76.888,
      });

      const payloadA = { name: 'Complete A', type: 'market' as const, addressText: 'Address A' };
      const payloadB = { name: 'Complete B', type: 'pavilion' as const, addressText: 'Address B' };
      await Promise.all([
        updateOwnedLocation(owner.userId, locationId, payloadA, { database: db }),
        updateOwnedLocation(owner.userId, locationId, payloadB, { database: db }),
      ]);
      const finalIdentity = (await pool.query('SELECT name,type,address_text FROM locations WHERE id=$1', [locationId])).rows[0];
      expect([payloadA, payloadB]).toContainEqual({
        name: finalIdentity.name, type: finalIdentity.type, addressText: finalIdentity.address_text,
      });

      const [createdA, createdB] = await Promise.all([
        createOwnedLocation(owner.userId, { name: 'Concurrent A', type: 'shop', addressText: 'Create A' }, { database: db }),
        createOwnedLocation(owner.userId, { name: 'Concurrent B', type: 'other', addressText: 'Create B' }, { database: db }),
      ]);
      expect(createdA.id).not.toBe(createdB.id);
      expect((await pool.query('SELECT count(*)::int AS count FROM locations WHERE id IN ($1,$2) AND seller_id=$3', [createdA.id, createdB.id, owner.seller.id])).rows[0].count).toBe(2);

      await updateOwnedLocation(owner.userId, locationId, { name: 'Final name', type: 'shop', addressText: 'Final address' }, { database: db });
      expect((await pool.query('SELECT id,location_id,status,price_amount,price_currency,price_unit,seller_comment,last_confirmed_at FROM offers WHERE id=$1', [offerId])).rows[0])
        .toEqual(beforeOffer);
    } finally {
      await cleanupUser(owner.userId, owner.phone);
    }
  });

  it('allows geo-less and phone-less Locations in single and batch proposals while UX1D keeps confirmed Offers buyer-ineligible', async () => {
    const owner = await fixture('0364');
    try {
      const firstId = owner.seller.locations[0]!.id;
      const second = await createOwnedLocation(owner.userId, {
        name: 'Geo-less second', type: 'other', addressText: 'Geo-less address',
      }, { database: db });
      expect((await pool.query('SELECT contact_phone_e164 FROM sellers WHERE id=$1', [owner.seller.id])).rows[0].contact_phone_e164).toBeNull();

      const single = await createSellerChangeSet(owner.userId, sellerChangeSetCreateBodySchema.parse({
        productName: 'Баранина', locationId: second.id, price: { amount: '4300', unit: 'кг' },
      }), { database: db });
      expect(single.items[0]!.location.id).toBe(second.id);
      const singleConfirmed = await confirmSellerChangeSet(owner.userId, single.id, { database: db, clock: () => NOW });
      const singleOfferId = singleConfirmed.items[0]!.resultOffer!.id;

      const batch = await createBatchSellerChangeSet(owner.userId, sellerBatchChangeSetCreateBodySchema.parse({
        items: [
          { action: 'create_offer', productName: 'Баранина', locationId: firstId, price: { amount: '4400', unit: 'кг' } },
          { action: 'create_offer', productName: 'Говядина', locationId: second.id, price: { amount: '4500', unit: 'кг' } },
        ],
      }), { database: db });
      expect(batch.items.map((item) => item.location.id)).toEqual([firstId, second.id]);
      const batchConfirmed = await confirmSellerChangeSet(owner.userId, batch.id, { database: db, clock: () => NOW });
      const createdIds = [singleOfferId, ...batchConfirmed.items.map((item) => item.resultOffer!.id)];

      const search = await searchOffers('Баранина', db, { clock: () => NOW, validityPeriodHours: 72 });
      const nearby = await findNearbyOffers({ latitude: 43.238949, longitude: 76.889709 }, db, {
        clock: () => NOW, validityPeriodHours: 72, nearbyRadiusMeters: 50_000,
      });
      for (const offerId of createdIds) {
        expect(search.offers.map((offer) => offer.id)).not.toContain(offerId);
        expect(nearby.offers.map((offer) => offer.id)).not.toContain(offerId);
      }
    } finally {
      await cleanupUser(owner.userId, owner.phone);
    }
  });

  it('uses the same non-disclosing application error for foreign and nonexistent identity edits', async () => {
    const owner = await fixture('0365');
    const foreign = await fixture('0366');
    try {
      const identity = { name: 'Denied', type: 'shop' as const, addressText: 'Denied' };
      await expect(updateOwnedLocation(owner.userId, foreign.seller.locations[0]!.id, identity, { database: db }))
        .rejects.toBeInstanceOf(LocationNotFoundError);
      await expect(updateOwnedLocation(owner.userId, '99999999-9999-4999-8999-999999999999', identity, { database: db }))
        .rejects.toBeInstanceOf(LocationNotFoundError);
    } finally {
      await cleanupUser(owner.userId, owner.phone);
      await cleanupUser(foreign.userId, foreign.phone);
    }
  });
});
