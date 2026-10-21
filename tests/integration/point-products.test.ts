import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getPointProducts } from '../../src/app/api/seller/points/[id]/products/route';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { saveOfferDraft } from '../../src/modules/offers/drafts/offer-drafts';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

// seller-ai-text-real-parser §21: «Товары точки» — scoped to one point, archived cards excluded, drafts of the point
// included, the count equal to the list, other Sellers refused.
const A = { id: '50000000-0000-4000-8000-000000009401', phone: '+77000009401', token: 'point-products-9401' };
const B = { id: '50000000-0000-4000-8000-000000009402', phone: '+77000009402', token: 'point-products-9402' };
const T0 = new Date('2026-10-21T08:00:00.000Z');
let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const originalDatabaseUrl = process.env.DATABASE_URL;
const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';

async function cleanup(user: typeof A) {
  await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [user.id]);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [user.id]);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [user.id]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [user.id]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [user.id]);
  await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
}

async function seller(user: typeof A, points: string[]) {
  await cleanup(user);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [user.id, user.phone, T0]);
  await pool.query('INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), user.id, digestSessionToken(user.token), T0, new Date('2030-01-01T00:00:00Z')]);
  const created = await setupSeller(user.id, { seller: { displayName: 'Products' }, location: { name: points[0]!, type: 'shop', addressText: 'Almaty' } }, { database: db });
  const ids = [created.locations[0]!.id];
  for (const name of points.slice(1)) {
    ids.push((await pool.query("INSERT INTO locations (seller_id,name,type,address_text) VALUES ($1,$2,'shop','Almaty') RETURNING id", [created.id, name])).rows[0].id);
  }
  return { sellerId: created.id, ids };
}

async function offer(sellerId: string, locationId: string, confirmedAt: string) {
  await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,title,title_search,card_id)
    VALUES ($1,$2,$3,'100','KZT','active',$4,'Баранина','баранина',$5)`, [seedIds.lambProduct, sellerId, locationId, confirmedAt, randomUUID()]);
}

const request = (token: string, id: string) => getPointProducts(
  new NextRequest(`http://localhost/api/seller/points/${id}/products`, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
  { params: Promise.resolve({ id }) },
);

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
});

afterAll(async () => {
  await cleanup(A);
  await cleanup(B);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('GET /api/seller/points/:id/products', () => {
  it('lists the point’s live cards and drafts; archived cards and other points do not count', async () => {
    const { sellerId, ids } = await seller(A, ['Рынок', 'Магазин']);
    await offer(sellerId, ids[0]!, new Date().toISOString());
    await offer(sellerId, ids[0]!, '2020-01-01T00:00:00Z'); // archived by age
    await offer(sellerId, ids[1]!, new Date().toISOString());
    const empty = { title: 'Черновик', productId: null, price: '', unit: null, pack: null, sellerComment: '', photoIds: [] };
    await saveOfferDraft(A.id, null, { ...empty, points: [{ locationId: ids[0]!, ownPrice: null }] }, { database: db });
    await saveOfferDraft(A.id, null, { ...empty, points: [] }, { database: db });

    const response = await request(A.token, ids[0]!);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.point).toEqual({ id: ids[0], name: 'Рынок', addressText: 'Almaty' });
    expect([body.offers.length, body.drafts.length, body.total]).toEqual([1, 1, 2]);

    const other = await (await request(A.token, ids[1]!)).json();
    expect([other.offers.length, other.drafts.length, other.total]).toEqual([1, 0, 1]);
  });

  it('another seller’s point and an unknown id answer 404', async () => {
    const { ids } = await seller(A, ['Рынок']);
    await seller(B, ['Чужая']);
    expect((await request(B.token, ids[0]!)).status).toBe(404);
    expect((await request(A.token, randomUUID())).status).toBe(404);
    expect((await request(A.token, 'not-a-uuid')).status).toBe(404);
  });
});
