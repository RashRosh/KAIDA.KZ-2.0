import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getReview } from '../../src/app/api/seller/text-input/[inputId]/route';
import { GET as listReviews } from '../../src/app/api/seller/text-input/route';
import type { Database } from '../../src/db/client';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { deleteOfferDraft } from '../../src/modules/offers/drafts/offer-drafts';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import {
  applySellerTextInput, getSellerTextSubmission, listSellerTextSubmissions,
} from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import {
  TextInputPointNotFoundError, TextInputPointRequiredError, TextInputRequestConflictError,
} from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

// seller-ai-text-real-parser §16 (connected journey): target point, review recovery from the server record, ownership,
// expiry and published/deleted drafts. Fake parser; nothing here depends on the model.
const T0 = new Date('2026-10-22T08:00:00.000Z');
const A = { id: '50000000-0000-4000-8000-000000009301', phoneE164: '+77000009301', token: 'journey-9301' };
const B = { id: '50000000-0000-4000-8000-000000009302', phoneE164: '+77000009302', token: 'journey-9302' };
const C = { id: '50000000-0000-4000-8000-000000009303', phoneE164: '+77000009303', token: 'journey-9303' };
const env = { SELLER_TEXT_INPUT: 'fake' };
const TWO = '[fixture:e2e-multi]';
const SKIPPED = '[fixture:e2e-skipped]';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalTextInput = process.env.SELLER_TEXT_INPUT;
const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';

async function cleanup(userId: string) {
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [userId]);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

async function user(u: typeof A) {
  await cleanup(u.id);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [u.id, u.phoneE164, T0]);
  await pool.query('INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), u.id, digestSessionToken(u.token), T0, new Date('2030-01-01T00:00:00Z')]);
}

async function sellerWithPoints(u: typeof A, names: string[]) {
  await user(u);
  await setupSeller(u.id, { seller: { displayName: 'Journey' }, location: { name: names[0]!, type: 'shop', addressText: 'Almaty' } }, { database: db });
  const sellerId = (await pool.query(bySeller, [u.id])).rows[0].id as string;
  for (const name of names.slice(1)) {
    await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, $2, 'shop', 'Almaty')", [sellerId, name]);
  }
  const rows = (await pool.query('SELECT id, name FROM locations WHERE seller_id=$1', [sellerId])).rows as { id: string; name: string }[];
  return Object.fromEntries(rows.map((row) => [row.name, row.id])) as Record<string, string>;
}

const draftCount = async (userId: string) =>
  Number((await pool.query(`SELECT count(*)::int AS n FROM offer_drafts WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);
const submissionCount = async (userId: string) =>
  Number((await pool.query(`SELECT count(*)::int AS n FROM seller_text_submissions WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);
const get = (token: string, path: string) => new NextRequest(`http://localhost${path}`, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.SELLER_TEXT_INPUT = 'fake';
});

afterAll(async () => {
  for (const u of [A, B, C]) await cleanup(u.id);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalTextInput === undefined) delete process.env.SELLER_TEXT_INPUT;
  else process.env.SELLER_TEXT_INPUT = originalTextInput;
});

describe('target trading point', () => {
  it('without a seller or without a point: point required, nothing created', async () => {
    await user(C);
    await expect(applySellerTextInput(C.id, TWO, { database: db, env })).rejects.toBeInstanceOf(TextInputPointRequiredError);
    await setupSeller(C.id, { seller: { displayName: 'No point' }, location: { name: 'Temp', type: 'shop', addressText: 'Almaty' } }, { database: db });
    await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [C.id]);
    await expect(applySellerTextInput(C.id, TWO, { database: db, env })).rejects.toBeInstanceOf(TextInputPointRequiredError);
    expect([await draftCount(C.id), await submissionCount(C.id)]).toEqual([0, 0]);
  });

  it('drafts go to the chosen point of several; never another one', async () => {
    const points = await sellerWithPoints(A, ['Рынок', 'Магазин']);
    const result = await applySellerTextInput(A.id, TWO, { database: db, env, locationId: points['Магазин'] });
    expect(result.drafts.map((d) => d.payload.points)).toEqual([[{ locationId: points['Магазин'], ownPrice: null }], [{ locationId: points['Магазин'], ownPrice: null }]]);
  });

  it('another seller’s point is refused before anything is created', async () => {
    await sellerWithPoints(A, ['Рынок']);
    const foreign = await sellerWithPoints(B, ['Чужая']);
    await expect(applySellerTextInput(A.id, TWO, { database: db, env, locationId: foreign['Чужая'] })).rejects.toBeInstanceOf(TextInputPointNotFoundError);
    expect([await draftCount(A.id), await submissionCount(A.id)]).toEqual([0, 0]);
  });

  it('the same request with another point is a conflict, not a second set of drafts', async () => {
    const points = await sellerWithPoints(A, ['Рынок', 'Магазин']);
    const requestId = randomUUID();
    await applySellerTextInput(A.id, TWO, { database: db, env, requestId, locationId: points['Рынок'] });
    await expect(applySellerTextInput(A.id, TWO, { database: db, env, requestId, locationId: points['Магазин'] }))
      .rejects.toBeInstanceOf(TextInputRequestConflictError);
    expect(await draftCount(A.id)).toBe(2);
  });
});

describe('review recovery from the server record', () => {
  it('recovers drafts, skipped items and the point; never the raw text', async () => {
    const points = await sellerWithPoints(A, ['Рынок']);
    const created = await applySellerTextInput(A.id, SKIPPED, { database: db, env });
    const review = await getSellerTextSubmission(A.id, created.inputId, { database: db });
    expect(review).toMatchObject({
      inputId: created.inputId, status: 'succeeded', locationId: points['Рынок'], parser: 'fake',
      skipped: [{ label: 'Виноград' }], unavailableDrafts: 0, publishedDrafts: 0, deletedDrafts: 0,
    });
    expect(review!.drafts.map((d) => d.id)).toEqual(created.drafts.map((d) => d.id));
    expect(JSON.stringify(review)).not.toContain('[fixture:e2e-skipped]');
    expect(review).not.toHaveProperty('rawText');
  });

  it('is visible only to its own seller', async () => {
    await sellerWithPoints(A, ['Рынок']);
    await sellerWithPoints(B, ['Чужая']);
    const created = await applySellerTextInput(A.id, SKIPPED, { database: db, env });
    expect(await getSellerTextSubmission(B.id, created.inputId, { database: db })).toBeNull();
    expect((await getReview(get(B.token, `/api/seller/text-input/${created.inputId}`), { params: Promise.resolve({ inputId: created.inputId }) })).status).toBe(404);
    expect((await getReview(get(A.token, `/api/seller/text-input/${created.inputId}`), { params: Promise.resolve({ inputId: created.inputId }) })).status).toBe(200);
    expect((await getReview(get(A.token, '/api/seller/text-input/x'), { params: Promise.resolve({ inputId: 'not-a-uuid' }) })).status).toBe(404);
    const listedForB = await (await listReviews(get(B.token, '/api/seller/text-input'))).json();
    expect(listedForB.submissions).toEqual([]);
  });

  it('an expired record is unavailable and no longer listed', async () => {
    await sellerWithPoints(A, ['Рынок']);
    const created = await applySellerTextInput(A.id, SKIPPED, { database: db, env });
    const later = () => new Date(Date.now() + 25 * 3600 * 1000);
    expect(await getSellerTextSubmission(A.id, created.inputId, { database: db, clock: later })).toBeNull();
    expect(await listSellerTextSubmissions(A.id, { database: db, clock: later })).toEqual([]);
  });

  it('tells published drafts apart from deleted ones', async () => {
    const points = await sellerWithPoints(A, ['Рынок']);
    const created = await applySellerTextInput(A.id, TWO, { database: db, env });
    const [first, second] = created.drafts;
    const body = cardCreateBodySchema.parse({ title: first!.payload.title, productId: first!.payload.productId, price: first!.payload.price,
      unit: first!.payload.unit, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: points['Рынок'] }], draftId: first!.id });
    const proposal = await createCardChangeSet(A.id, body, { database: db });
    await confirmSellerChangeSet(A.id, proposal.id, { database: db, clock: () => new Date() });
    await deleteOfferDraft(A.id, second!.id, { database: db });
    expect(await getSellerTextSubmission(A.id, created.inputId, { database: db }))
      .toMatchObject({ drafts: [], unavailableDrafts: 2, publishedDrafts: 1, deletedDrafts: 1 });
  });

  it('lists the seller’s own reviews newest first with live counts', async () => {
    await sellerWithPoints(A, ['Рынок']);
    const first = await applySellerTextInput(A.id, TWO, { database: db, env });
    const second = await applySellerTextInput(A.id, SKIPPED, { database: db, env });
    await deleteOfferDraft(A.id, first.drafts[0]!.id, { database: db });
    const listed = await listSellerTextSubmissions(A.id, { database: db });
    expect(listed.map((r) => [r.inputId, r.drafts, r.skipped])).toEqual([[second.inputId, 1, 1], [first.inputId, 1, 0]]);
  });
});
