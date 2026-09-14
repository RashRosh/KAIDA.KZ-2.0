import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { connectTestDatabase, testDatabaseUrl } from './database';

type ContactsRoute = {
  GET(request: NextRequest): Promise<Response>;
  PUT(request: NextRequest): Promise<Response>;
};

const now = new Date();
const expires = new Date(now.getTime() + 86_400_000);
const originalDatabaseUrl = process.env.DATABASE_URL;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
let poolInitialized = false;

async function loadRoute(): Promise<ContactsRoute> {
  const modulePath = '../../src/app/api/seller/contacts/route';
  return import(modulePath) as Promise<ContactsRoute>;
}

function digest(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function request(method: 'GET' | 'PUT', token?: string, body?: unknown) {
  const headers = new Headers();
  if (token) headers.set('cookie', `kaida_session=${token}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest('http://localhost/api/seller/contacts', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function replacement(overrides: Partial<{
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
}> = {}) {
  return {
    phoneE164: null,
    whatsappPhoneE164: null,
    telegramUsername: null,
    instagramUsername: null,
    ...overrides,
  };
}

async function createOwnerFixture(suffix: string, withSeller: boolean) {
  const userId = `50000000-0000-4000-8000-00000001${suffix}`;
  const sellerId = `20000000-0000-4000-8000-00000001${suffix}`;
  const phone = `+77000001${suffix}`;
  const token = `s10-session-${suffix}`;
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, now]);
  await pool.query('INSERT INTO auth_sessions (id,user_id,token_digest,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)', [
    `60000000-0000-4000-8000-00000001${suffix}`, userId, digest(token), now, expires,
  ]);
  if (withSeller) {
    await pool.query('INSERT INTO sellers (id,display_name,owner_user_id) VALUES ($1,$2,$3)', [sellerId, `S10 seller ${suffix}`, userId]);
  }
  return { userId, sellerId, phone, token };
}

async function cleanup() {
  if (!poolInitialized) return;
  await pool.query("DELETE FROM auth_sessions WHERE user_id::text LIKE '50000000-0000-4000-8000-00000001%'");
  await pool.query("DELETE FROM sellers WHERE owner_user_id::text LIKE '50000000-0000-4000-8000-00000001%'");
  await pool.query("DELETE FROM users WHERE id::text LIKE '50000000-0000-4000-8000-00000001%'");
}

beforeAll(async () => {
  const guardedTestUrl = testDatabaseUrl();
  const connection = await connectTestDatabase();
  pool = connection.pool;
  poolInitialized = true;
  process.env.DATABASE_URL = guardedTestUrl;
  await cleanup();
});

afterAll(async () => {
  try {
    await cleanup();
  } finally {
    try {
      if (poolInitialized) await pool.end();
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

describe('S10 owner-only Seller contacts API on PostgreSQL 18', () => {
  it('requires authentication for GET and PUT', async () => {
    const route = await loadRoute();
    expect((await route.GET(request('GET'))).status).toBe(401);
    expect((await route.PUT(request('PUT', undefined, replacement()))).status).toBe(401);
  });

  it('returns SELLER_NOT_FOUND for an authenticated User without Seller', async () => {
    const route = await loadRoute();
    const owner = await createOwnerFixture('1101', false);
    const getResponse = await route.GET(request('GET', owner.token));
    expect(getResponse.status).toBe(404);
    expect(await getResponse.json()).toMatchObject({ error: { code: 'SELLER_NOT_FOUND' } });
    const putResponse = await route.PUT(request('PUT', owner.token, replacement()));
    expect(putResponse.status).toBe(404);
  });

  it('reads null initial state and performs exact full replacement including independent null deletion', async () => {
    const route = await loadRoute();
    const owner = await createOwnerFixture('1102', true);

    const initial = await route.GET(request('GET', owner.token));
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({ contacts: replacement() });
    expect(JSON.stringify(await (await route.GET(request('GET', owner.token))).json())).not.toContain(owner.phone);

    const firstState = replacement({
      phoneE164: '+12025550123',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    });
    const first = await route.PUT(request('PUT', owner.token, firstState));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ contacts: firstState });

    const secondState = replacement({
      phoneE164: '+33123456789',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: null,
      instagramUsername: 'kaida.shop',
    });
    const second = await route.PUT(request('PUT', owner.token, secondState));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ contacts: secondState });
    expect(await (await route.GET(request('GET', owner.token))).json()).toEqual({ contacts: secondState });

    const cleared = await route.PUT(request('PUT', owner.token, replacement()));
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toEqual({ contacts: replacement() });
  });

  it('rejects partial, non-canonical, URL-like and ownership-spoof bodies without mutation', async () => {
    const route = await loadRoute();
    const owner = await createOwnerFixture('1103', true);
    const baseline = replacement({
      phoneE164: '+12025550123',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    });
    expect((await route.PUT(request('PUT', owner.token, baseline))).status).toBe(200);

    const invalidBodies: unknown[] = [
      { phoneE164: null, whatsappPhoneE164: null, telegramUsername: null },
      { ...baseline, sellerId: owner.sellerId },
      { ...baseline, ownerUserId: owner.userId },
      { ...baseline, url: 'https://evil.example' },
      { ...baseline, href: 'javascript:alert(1)' },
      { ...baseline, phoneE164: '8 (700) 123-45-67' },
      { ...baseline, whatsappPhoneE164: '+44 7911 123456' },
      { ...baseline, telegramUsername: '@kaida_shop' },
      { ...baseline, instagramUsername: 'https://instagram.com/evil' },
    ];
    for (const invalid of invalidBodies) {
      const response = await route.PUT(request('PUT', owner.token, invalid));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_SELLER_CONTACTS' } });
    }

    const row = (await pool.query(`SELECT contact_phone_e164,whatsapp_phone_e164,telegram_username,instagram_username
      FROM sellers WHERE id=$1`, [owner.sellerId])).rows[0];
    expect(row).toEqual({
      contact_phone_e164: '+12025550123',
      whatsapp_phone_e164: '+447911123456',
      telegram_username: 'kaida_shop',
      instagram_username: 'kaida.shop',
    });
  });

  it('isolates Seller ownership because the resource has no client-selected Seller identity', async () => {
    const route = await loadRoute();
    const ownerA = await createOwnerFixture('1104', true);
    const ownerB = await createOwnerFixture('1105', true);
    const stateA = replacement({ phoneE164: '+12025550124', telegramUsername: 'owner_a' });
    const stateB = replacement({ phoneE164: '+12025550125', telegramUsername: 'owner_b' });
    expect((await route.PUT(request('PUT', ownerA.token, stateA))).status).toBe(200);
    expect((await route.PUT(request('PUT', ownerB.token, stateB))).status).toBe(200);

    const spoof = await route.PUT(request('PUT', ownerA.token, { ...stateA, sellerId: ownerB.sellerId }));
    expect(spoof.status).toBe(400);

    expect(await (await route.GET(request('GET', ownerA.token))).json()).toEqual({ contacts: stateA });
    expect(await (await route.GET(request('GET', ownerB.token))).json()).toEqual({ contacts: stateB });
  });
});
