import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postTextInput } from '../../src/app/api/seller/text-input/route';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import * as offerDrafts from '../../src/modules/offers/drafts/offer-drafts';
import { applySellerTextInput } from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import { SELLER_TEXT_INPUT_MAX_LENGTH, TextInputUnavailableError } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

const T0 = new Date('2026-09-17T08:00:00.000Z');
const SUFFIX = '9101';
const userId = `50000000-0000-4000-8000-00000000${SUFFIX}`;
const phone = `+7700000${SUFFIX}`;
const sessionToken = `seller-text-input-${SUFFIX}`;

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalTextInput = process.env.SELLER_TEXT_INPUT;

function request(token?: string, body?: unknown) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) headers.set('cookie', `${SESSION_COOKIE_NAME}=${token}`);
  return new NextRequest('http://localhost/api/seller/text-input', {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
}

async function cleanupUser() {
  await pool.query('DELETE FROM offer_drafts WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function fixture() {
  await cleanupUser();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [userId, phone, T0]);
  await pool.query(
    'INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [`60000000-0000-4000-8000-00000000${SUFFIX}`, userId, digestSessionToken(sessionToken), T0, new Date('2030-09-17T08:00:00.000Z')],
  );
  await setupSeller(userId, {
    seller: { displayName: 'Text seller' },
    location: { name: 'Point', type: 'shop', addressText: 'Almaty' },
  }, { database: db });
}

async function draftCount() {
  return Number((await pool.query(
    'SELECT count(*)::int AS count FROM offer_drafts WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)',
    [userId],
  )).rows[0].count);
}

beforeAll(async () => {
  const guardedUrl = testDatabaseUrl();
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = guardedUrl;
  process.env.SELLER_TEXT_INPUT = 'fake';
});

afterAll(async () => {
  await pool.end();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalTextInput === undefined) delete process.env.SELLER_TEXT_INPUT;
  else process.env.SELLER_TEXT_INPUT = originalTextInput;
});

describe('seller text input apply', () => {
  it('rejects when mode is off', async () => {
    await fixture();
    await expect(applySellerTextInput(userId, 'Баранина 4500 кг', { database: db, env: { SELLER_TEXT_INPUT: 'off' } }))
      .rejects.toBeInstanceOf(TextInputUnavailableError);
  });

  it('creates catalog-linked draft for exact match', async () => {
    await fixture();
    const locationId = (await pool.query(
      'SELECT id FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1) LIMIT 1',
      [userId],
    )).rows[0]?.id as string;

    const result = await applySellerTextInput(userId, '[fixture:e2e-catalog]', { database: db, env: { SELLER_TEXT_INPUT: 'fake' } });
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.payload.productId).toBe(seedIds.lambProduct);
    expect(result.drafts[0]?.payload.points[0]?.locationId).toBe(locationId);
    expect(result.skipped).toHaveLength(0);

    const offers = await pool.query(
      'SELECT count(*)::int AS count FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)',
      [userId],
    );
    expect(offers.rows[0].count).toBe(0);
  });

  it('creates free-title draft with pack', async () => {
    await fixture();
    const result = await applySellerTextInput(userId, '[fixture:e2e-free-title]', { database: db, env: { SELLER_TEXT_INPUT: 'fake' } });
    expect(result.drafts[0]?.payload.productId).toBeNull();
    expect(result.drafts[0]?.payload.unit).toEqual({ code: 'package' });
    expect(result.drafts[0]?.payload.pack).toEqual({ amount: '500', unit: 'g' });
  });

  it('creates one draft per recognized line', async () => {
    await fixture();
    const result = await applySellerTextInput(userId, '[fixture:e2e-multi]', { database: db, env: { SELLER_TEXT_INPUT: 'fake' } });
    expect(result.drafts).toHaveLength(2);
    expect(await draftCount()).toBe(2);
  });

  it('rolls back all drafts when persistence fails mid-batch', async () => {
    await fixture();
    const original = offerDrafts.saveOfferDraft;
    let calls = 0;
    const spy = vi.spyOn(offerDrafts, 'saveOfferDraft').mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 2) throw new Error('simulated persistence failure');
      return original(...args);
    });
    await expect(applySellerTextInput(userId, '[fixture:e2e-multi]', { database: db, env: { SELLER_TEXT_INPUT: 'fake' } }))
      .rejects.toThrow('simulated persistence failure');
    spy.mockRestore();
    expect(await draftCount()).toBe(0);
  });
});

describe('POST /api/seller/text-input', () => {
  it('requires authentication', async () => {
    expect((await postTextInput(request(undefined, { text: 'Баранина 4500 кг' }))).status).toBe(401);
  });

  it('returns 503 when text input is off', async () => {
    await fixture();
    const previous = process.env.SELLER_TEXT_INPUT;
    process.env.SELLER_TEXT_INPUT = 'off';
    expect((await postTextInput(request(sessionToken, { text: 'Баранина 4500 кг' }))).status).toBe(503);
    process.env.SELLER_TEXT_INPUT = previous;
  });

  it('rejects empty and overlong text', async () => {
    await fixture();
    expect((await postTextInput(request(sessionToken, { text: '   ' }))).status).toBe(400);
    expect((await postTextInput(request(sessionToken, { text: 'x'.repeat(SELLER_TEXT_INPUT_MAX_LENGTH + 1) }))).status).toBe(400);
  });

  it('returns 201 with drafts on success', async () => {
    await fixture();
    const response = await postTextInput(request(sessionToken, { text: '[fixture:e2e-catalog]' }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.drafts).toHaveLength(1);
    expect(body.inputId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.rawText).toBe('[fixture:e2e-catalog]');
    expect(await draftCount()).toBe(1);
  });

  it('does not duplicate drafts when retrying after a failed request', async () => {
    await fixture();
    const original = offerDrafts.saveOfferDraft;
    let failOnce = true;
    const spy = vi.spyOn(offerDrafts, 'saveOfferDraft').mockImplementation(async (...args) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('simulated route failure');
      }
      return original(...args);
    });
    expect((await postTextInput(request(sessionToken, { text: '[fixture:e2e-multi]' }))).status).toBe(503);
    expect(await draftCount()).toBe(0);
    spy.mockRestore();

    const ok = await postTextInput(request(sessionToken, { text: '[fixture:e2e-multi]' }));
    expect(ok.status).toBe(201);
    expect((await ok.json()).drafts).toHaveLength(2);
    expect(await draftCount()).toBe(2);
  });
});
