import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { listOwnedPointDetails, replaceOwnedPointDetails } from '../../src/modules/locations/details/point-details.application';
import { findVerifiedPhones } from '../../src/modules/locations/details/point-details.repository';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// contact-default §4.8, §10 and §11: the login number is recorded as verified when a point holds it; it never reaches a
// buyer payload unless it is a saved point number; points the Seller did not save are untouched.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-10-14T06:00:00.000Z');
const OWNER = { id: '73000000-0000-4000-8000-000000000001', phone: '+77010007301' };
const OTHER = { id: '73000000-0000-4000-8000-000000000002', phone: '+77010007302' };
const hours = templateOpeningHours();

async function cleanup(user: { id: string; phone: string }) {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${user.id}'`;
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [user.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [user.id, user.phone]);
}

async function createSeller(user: { id: string; phone: string }, label: string) {
  await cleanup(user);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [user.id, user.phone, T0]);
  return setupSeller(user.id, {
    seller: { displayName: `Default ${label}` },
    location: { name: `Default point ${label}`, type: 'shop', addressText: `Almaty default ${label}` },
  }, { database: db });
}

const recorded = async (sellerId: string) => (await pool.query('SELECT phone_e164 FROM seller_verified_phones WHERE seller_id=$1 ORDER BY phone_e164', [sellerId])).rows.map((row) => row.phone_e164 as string);

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup(OWNER);
  await cleanup(OTHER);
  await pool.end();
});

describe('login number on a point', () => {
  it('saving a point that holds the login number records it as verified (phone or WhatsApp), idempotently', async () => {
    const seller = await createSeller(OWNER, 'proof');
    const pointId = seller.locations[0]!.id;
    expect(await recorded(seller.id)).toEqual([]); // creating the Seller or the point records nothing

    const saved = await replaceOwnedPointDetails(OWNER.id, pointId, { phone: '8 701 000 73 01', whatsapp: null, openingHours: hours }, { database: db });
    expect(saved.contacts.phone).toEqual({ e164: OWNER.phone, verified: true });
    expect(await recorded(seller.id)).toEqual([OWNER.phone]);
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: OWNER.phone, whatsapp: OWNER.phone, openingHours: hours }, { database: db });
    expect(await recorded(seller.id)).toEqual([OWNER.phone]);

    // WhatsApp alone is enough as well.
    await pool.query('DELETE FROM seller_verified_phones WHERE seller_id=$1', [seller.id]);
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: null, whatsapp: OWNER.phone, openingHours: hours }, { database: db });
    expect(await recorded(seller.id)).toEqual([OWNER.phone]);
  });

  it('another number, or no number, records nothing; the proof does not make other numbers verified', async () => {
    const seller = await createSeller(OWNER, 'other');
    const pointId = seller.locations[0]!.id;
    const saved = await replaceOwnedPointDetails(OWNER.id, pointId, { phone: '+77010007399', whatsapp: null, openingHours: hours }, { database: db });
    expect(saved.contacts.phone).toEqual({ e164: '+77010007399', verified: false });
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: null, whatsapp: null, openingHours: hours }, { database: db });
    expect(await recorded(seller.id)).toEqual([]);
    // Still verified through the login phone (derived), as before.
    expect([...await findVerifiedPhones(db, seller.id)]).toEqual([OWNER.phone]);
  });

  it('saving one point never touches the other points; a point nobody saved keeps its contacts', async () => {
    const seller = await createSeller(OWNER, 'untouched');
    const first = seller.locations[0]!.id;
    await replaceOwnedPointDetails(OWNER.id, first, { phone: '+77010007399', whatsapp: null, openingHours: hours }, { database: db });
    const second = await createOwnedLocation(OWNER.id, { name: 'Second', type: 'market', addressText: 'Almaty default second' }, { database: db });
    const before = await listOwnedPointDetails(OWNER.id, { database: db });
    await replaceOwnedPointDetails(OWNER.id, second.id, { phone: OWNER.phone, whatsapp: null, openingHours: hours }, { database: db });
    const after = await listOwnedPointDetails(OWNER.id, { database: db });
    expect(after.find((point) => point.locationId === first)).toEqual(before.find((point) => point.locationId === first));
    expect(await recorded(seller.id)).toEqual([OWNER.phone]);
  });

  it('a failed save records nothing', async () => {
    const seller = await createSeller(OWNER, 'failed');
    await expect(replaceOwnedPointDetails(OWNER.id, seller.locations[0]!.id, { phone: OWNER.phone, whatsapp: '12345', openingHours: hours }, { database: db }))
      .rejects.toMatchObject({ code: 'INVALID_PHONE' });
    await expect(replaceOwnedPointDetails(OTHER.id, seller.locations[0]!.id, { phone: OWNER.phone, whatsapp: null, openingHours: hours }, { database: db }))
      .rejects.toBeDefined();
    expect(await recorded(seller.id)).toEqual([]);
  });

  it('the contact stays public after the login number changes, because the proof is stored', async () => {
    const seller = await createSeller(OWNER, 'drift');
    const pointId = seller.locations[0]!.id;
    await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [pointId]);
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: OWNER.phone, whatsapp: null, openingHours: hours }, { database: db });
    const product = (await pool.query("SELECT id FROM products WHERE name='Баранина'")).rows[0].id;
    await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at, title, title_search, card_id)
      VALUES ($1,$2,$3,'100','KZT','active',now(),(SELECT name FROM products WHERE id=$1::uuid),lower((SELECT name FROM products WHERE id=$1::uuid)),gen_random_uuid())`, [product, seller.id, pointId]);

    // There is no feature that changes the login number; the test changes it in the database to prove the stored proof.
    await pool.query('UPDATE users SET phone_e164=$2 WHERE id=$1', [OWNER.id, '+77010007377']);
    const offer = (await searchOffers('Баранина', db)).offers.find((item) => item.location.id === pointId)!;
    expect(offer.location.contacts).toEqual({ phoneE164: OWNER.phone });
  });
});

describe('buyer payloads', () => {
  it('never contain the login number unless it is a saved point number', async () => {
    const seller = await createSeller(OWNER, 'payload');
    const pointId = seller.locations[0]!.id;
    await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [pointId]);
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: '+77010007399', whatsapp: null, openingHours: hours }, { database: db });
    await pool.query('INSERT INTO seller_verified_phones (seller_id, phone_e164, verified_at) VALUES ($1,$2,now())', [seller.id, '+77010007399']);
    const product = (await pool.query("SELECT id FROM products WHERE name='Баранина'")).rows[0].id;
    await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at, title, title_search, card_id)
      VALUES ($1,$2,$3,'100','KZT','active',now(),(SELECT name FROM products WHERE id=$1::uuid),lower((SELECT name FROM products WHERE id=$1::uuid)),gen_random_uuid())`, [product, seller.id, pointId]);

    const result = await searchOffers('Баранина', db);
    const offer = result.offers.find((item) => item.location.id === pointId)!;
    expect(offer.location.contacts).toEqual({ phoneE164: '+77010007399' });
    expect(JSON.stringify(result.offers.filter((item) => item.location.id === pointId))).not.toContain(OWNER.phone);

    // Saved as the point's number, it is public (and only then).
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: OWNER.phone, whatsapp: null, openingHours: hours }, { database: db });
    const saved = (await searchOffers('Баранина', db)).offers.find((item) => item.location.id === pointId)!;
    expect(saved.location.contacts).toEqual({ phoneE164: OWNER.phone });
  });
});
