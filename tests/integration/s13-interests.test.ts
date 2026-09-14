import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/interests/route';
import { DELETE, PUT } from '../../src/app/api/interests/[productId]/route';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { connectTestDatabase } from './database';

let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
let originalDatabaseUrl: string | undefined;

const userA = '50000000-0000-4000-8000-000000001301';
const userB = '50000000-0000-4000-8000-000000001302';
const productA = '10000000-0000-4000-8000-000000001301';
const productB = '10000000-0000-4000-8000-000000001302';
const unknownProduct = '10000000-0000-4000-8000-000000001399';
const tokenA = 's13-session-a';
const tokenA2 = 's13-session-a-second';
const tokenB = 's13-session-b';

function request(path: string, method: 'GET' | 'PUT' | 'DELETE', token?: string, body?: string) {
  const headers = new Headers();
  if (token) headers.set('cookie', `${SESSION_COOKIE_NAME}=${token}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`http://localhost${path}`, { method, headers, body });
}

function context(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

async function createUser(userId: string, phone: string, sessions: Array<{ id: string; token: string }>) {
  const now = new Date();
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, now]);
  for (const session of sessions) {
    await pool.query(
      'INSERT INTO auth_sessions (id,user_id,token_digest,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)',
      [session.id, userId, digestSessionToken(session.token), now, new Date(now.getTime() + 86_400_000)],
    );
  }
}

async function cleanupFixture() {
  await pool.query('DELETE FROM buyer_interests WHERE user_id IN ($1,$2) OR product_id IN ($3,$4)', [userA, userB, productA, productB]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id IN ($1,$2)', [userA, userB]);
  await pool.query('DELETE FROM users WHERE id IN ($1,$2) OR phone_e164 IN ($3,$4)', [userA, userB, '+77000001301', '+77000001302']);
  await pool.query('DELETE FROM product_aliases WHERE product_id IN ($1,$2)', [productA, productB]);
  await pool.query('DELETE FROM offers WHERE product_id IN ($1,$2)', [productA, productB]);
  await pool.query('DELETE FROM products WHERE id IN ($1,$2) OR name IN ($3,$4)', [productA, productB, 'S13 Product A', 'S13 Product B']);
}

async function resetFixture() {
  await cleanupFixture();
  await pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [productA, 'S13 Product A', productB, 'S13 Product B']);
  await createUser(userA, '+77000001301', [
    { id: '60000000-0000-4000-8000-000000001301', token: tokenA },
    { id: '60000000-0000-4000-8000-000000001303', token: tokenA2 },
  ]);
  await createUser(userB, '+77000001302', [
    { id: '60000000-0000-4000-8000-000000001302', token: tokenB },
  ]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  pool = connection.pool;
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
});

afterAll(async () => {
  await cleanupFixture().catch(() => undefined);
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await pool.end();
});

describe('S13 Interests API on PostgreSQL 18', () => {
  it('keeps all Interests endpoints private for anonymous requests', async () => {
    await resetFixture();
    const responses = await Promise.all([
      GET(request('/api/interests', 'GET')),
      PUT(request(`/api/interests/${productA}`, 'PUT'), context(productA)),
      DELETE(request(`/api/interests/${productA}`, 'DELETE'), context(productA)),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect((await pool.query('SELECT count(*)::int AS count FROM buyer_interests')).rows[0].count).toBe(0);
  });

  it('lists only current User interests and preserves them across a later session', async () => {
    await resetFixture();
    const first = await PUT(request(`/api/interests/${productA}`, 'PUT', tokenA), context(productA));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ interest: { product: { id: productA, name: 'S13 Product A' } } });

    const repeated = await PUT(request(`/api/interests/${productA}`, 'PUT', tokenA), context(productA));
    expect(repeated.status).toBe(200);
    expect((await pool.query('SELECT count(*)::int AS count FROM buyer_interests WHERE user_id=$1 AND product_id=$2', [userA, productA])).rows[0].count).toBe(1);

    const forB = await PUT(request(`/api/interests/${productB}`, 'PUT', tokenB), context(productB));
    expect(forB.status).toBe(200);

    const listA = await GET(request('/api/interests', 'GET', tokenA2));
    expect(listA.status).toBe(200);
    expect(await listA.json()).toEqual({ interests: [{ product: { id: productA, name: 'S13 Product A' } }] });

    const selectorAttempt = await GET(request(`/api/interests?userId=${userB}`, 'GET', tokenA));
    expect(selectorAttempt.status).toBe(400);
    expect(await selectorAttempt.json()).toEqual({ error: { code: 'INVALID_INTERESTS_QUERY', message: 'Некорректный запрос интересов.' } });

    const removeA = await DELETE(request(`/api/interests/${productA}`, 'DELETE', tokenA), context(productA));
    expect(removeA.status).toBe(204);
    const removeAgain = await DELETE(request(`/api/interests/${productA}`, 'DELETE', tokenA), context(productA));
    expect(removeAgain.status).toBe(204);
    expect((await pool.query('SELECT user_id,product_id FROM buyer_interests ORDER BY user_id')).rows).toEqual([
      { user_id: userB, product_id: productB },
    ]);
  });

  it('rejects malformed or unsupported input and does not create unknown Products', async () => {
    await resetFixture();
    const malformed = await PUT(request('/api/interests/not-a-uuid', 'PUT', tokenA), context('not-a-uuid'));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: { code: 'INVALID_PRODUCT_ID', message: 'Некорректный товар.' } });

    const unknown = await PUT(request(`/api/interests/${unknownProduct}`, 'PUT', tokenA), context(unknownProduct));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Товар не найден.' } });

    const query = await PUT(request(`/api/interests/${productA}?x=1`, 'PUT', tokenA), context(productA));
    expect(query.status).toBe(400);
    expect(await query.json()).toEqual({ error: { code: 'INVALID_INTEREST_INPUT', message: 'Некорректный запрос интереса.' } });

    const body = await PUT(request(`/api/interests/${productA}`, 'PUT', tokenA, '{}'), context(productA));
    expect(body.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int AS count FROM buyer_interests')).rows[0].count).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM products WHERE id=$1', [unknownProduct])).rows[0].count).toBe(0);
  });

  it('handles concurrent duplicate PUTs with exactly one persisted Interest', async () => {
    await resetFixture();
    const [first, second] = await Promise.all([
      PUT(request(`/api/interests/${productA}`, 'PUT', tokenA), context(productA)),
      PUT(request(`/api/interests/${productA}`, 'PUT', tokenA), context(productA)),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect((await pool.query('SELECT count(*)::int AS count FROM buyer_interests WHERE user_id=$1 AND product_id=$2', [userA, productA])).rows[0].count).toBe(1);
  });

  it('treats DELETE of an absent valid Product ID as successful final state', async () => {
    await resetFixture();
    const response = await DELETE(request(`/api/interests/${unknownProduct}`, 'DELETE', tokenA), context(unknownProduct));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
});
