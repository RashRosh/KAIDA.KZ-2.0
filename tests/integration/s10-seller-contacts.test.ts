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
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

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
  await pool.query("DELETE FROM auth_sessions WHERE user_id::text LIKE '50000000-0000-4000-8000-00000001%'");
  await pool.query("DELETE FROM sellers WHERE owner_user_id::text LIKE '50000000-0000-4000-8000-00000001%'");
  await pool.query("DELETE FROM users WHERE id::text LIKE '50000000-0000-4000-8000-00000001%'");
}

beforeAll(async () => {
  process.env.DATABASE_URL = testDatabaseUrl();
  const connection = await connectTestDatabase();
  pool = connection.pool;
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('S10 owner-only Seller contacts API on PostgreSQL 18', () => {
  it('requires authentication for GET and PUT', async () => {
    const route = await loadRoute();
    expect((await route.GET(request('GET'))).status).toBe(401);
    expect((await route.PUT(request('PUT', undefined, {
      phone: null, whatsappPhone: null, telegramUsername: null, instagramUsername: null,
    }))).status).toBe(401);
  });

  it('returns SELLER_NOT_FOUND for an authenticated User without Seller', async () => {
    const route = await loadRoute();
    const owner = await createOwnerFixture('1101', false);
    const getResponse = await route.GET(request('GET', owner.token));
    expect(getResponse.status).toBe(404);
    expect(await getResponse.json()).toMatchObject({ error: { code: 'SELLER_NOT_FOUND' } });
    const putResponse = await route.PUT(request('PUT', owner.token, {
      phone: null, whatsappPhone: null, telegramUsername: null, instagramUsername: null,
    }));
    expect(putResponse.status).toBe(404);
  });

  it('saves, normalizes, updates and clears all four contacts as one full replacement', async () => {
    const route = await loadRoute();
    const owner = await createOwnerFixture('1102', true);
    const first = await route.PUT(request('PUT', owner.token, {
      phone: '8 (700) 123-45-67',
      whatsappPhone: '+447911123456',
      telegramUsername: '@Kaida_Shop',
      instagramUsername: '@Kaida.Shop',
    }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ contacts: {
      phoneE164: '+77001234567',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    } });

    const get = await route.GET(request('GET', owner.token));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ contacts: {
      phoneE164: '+77001234567',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    } });

    const second = await route.PUT(request('PUT', owner.token, {
      phone: '+12025550123',
      whatsappPhone: '   ',
      telegramUsername: null,
      instagramUsername: 'two..dots',
    }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ contacts: {
      phoneE164: '+12025550123',
      whatsappPhoneE164: null,
      telegramUsername: null,
      instagramUsername: 'two..dots',
    } });

    const cleared = await route.PUT(request('PUT', owner.token, {
      phone: '', whatsappPhone: '', telegramUsername: '', instagramUsername: '',
    }));
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toEqual({ contacts: {
      phoneE164: null,
      whatsappPhoneE164: null,
      telegramUsername: null,
      instagramUsername: null,
    } });
  });

  it('rejects missing, unknown and ownership/url spoof fields without partial mutation', async () => {
    const route = await loadRoute();
    const owner = await createOwnerFixture('1103', true);
    const baseline = {
      phone: '+12025550123',
      whatsappPhone: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    };
    expect((await route.PUT(request('PUT', owner.token, baseline))).status).toBe(200);

    const invalidBodies: unknown[] = [
      { phone: null, whatsappPhone: null, telegramUsername: null },
      { ...baseline, sellerId: owner.sellerId },
      { ...baseline, ownerUserId: owner.userId },
      { ...baseline, url: 'https://evil.example' },
      { ...baseline, href: 'javascript:alert(1)' },
      { ...baseline, telegramUsername: 'https://t.me/evil' },
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

  it('isolates Seller ownership and never accepts another Seller id', async () => {
    const route = await loadRoute();
    const ownerA = await createOwnerFixture('1104', true);
    const ownerB = await createOwnerFixture('1105', true);
    await route.PUT(request('PUT', ownerA.token, {
      phone: '+12025550124', whatsappPhone: null, telegramUsername: 'owner_a', instagramUsername: null,
    }));
    await route.PUT(request('PUT', ownerB.token, {
      phone: '+12025550125', whatsappPhone: null, telegramUsername: 'owner_b', instagramUsername: null,
    }));

    const spoof = await route.PUT(request('PUT', ownerA.token, {
      phone: '+12025550199', whatsappPhone: null, telegramUsername: 'spoof', instagramUsername: null,
      sellerId: ownerB.sellerId,
    }));
    expect(spoof.status).toBe(400);

    expect((await route.GET(request('GET', ownerA.token))).status).toBe(200);
    expect(await (await route.GET(request('GET', ownerA.token))).json()).toMatchObject({ contacts: { phoneE164: '+12025550124', telegramUsername: 'owner_a' } });
    expect(await (await route.GET(request('GET', ownerB.token))).json()).toMatchObject({ contacts: { phoneE164: '+12025550125', telegramUsername: 'owner_b' } });
  });
});
