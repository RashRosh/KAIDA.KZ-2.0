import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as heldDraftRoute } from '../../src/app/api/seller/text-input/[inputId]/held/[index]/draft/route';
import type { Database } from '../../src/db/client';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { deleteOfferDraft, saveOfferDraft } from '../../src/modules/offers/drafts/offer-drafts';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import {
  applySellerTextInput, createDraftFromHeldLine, getSellerTextSubmission,
} from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import { TextInputReviewUnavailableError } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

// text-duplicates (docs/slices/text-duplicates/SLICE_CONTRACT.md §8, §10): held lines instead of automatic drafts,
// differences instead of «the same product», price conflicts that block publication, repeat-safe draft on request.
// Fake parser; no model.
const T0 = new Date('2026-10-27T08:00:00.000Z');
const A = { id: '50000000-0000-4000-8000-000000009501', phoneE164: '+77000009501', token: 'duplicates-9501' };
const B = { id: '50000000-0000-4000-8000-000000009502', phoneE164: '+77000009502', token: 'duplicates-9502' };
const env = { SELLER_TEXT_INPUT: 'fake' };
const REPEAT = 'Сметана Простоквашино 1200 за упаковку 400 г. Сметана домашняя 1500 за упаковку 400 г. Пельмени 1500 за упаковку 500 г. '
  + 'Пельмени 2600 за упаковку 1 кг. Сыр 2900 за упаковку 400 г. Картошка 250 за кг. Картошка 300 за кг.';
const CONFLICT_WITH_CARD = 'Пельмени 1400 за упаковку 500 г. Пельмени 1500 за упаковку 500 г.';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const originalDatabaseUrl = process.env.DATABASE_URL;
const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';

async function cleanup(userId: string) {
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [userId]);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM seller_text_submissions WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

async function seller(u: typeof A, point: string) {
  await cleanup(u.id);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [u.id, u.phoneE164, T0]);
  await pool.query('INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), u.id, digestSessionToken(u.token), T0, new Date('2030-01-01T00:00:00Z')]);
  await setupSeller(u.id, { seller: { displayName: 'Duplicates' }, location: { name: point, type: 'shop', addressText: 'Almaty' } }, { database: db });
  const row = (await pool.query(`SELECT l.id, l.seller_id FROM locations l WHERE l.seller_id IN (${bySeller})`, [u.id])).rows[0];
  return { sellerId: row.seller_id as string, pointId: row.id as string };
}

async function offer(sellerId: string, locationId: string, title: string, pack: [string, 'g' | 'kg'], price: string, status = 'active') {
  return (await pool.query(`INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency,
      price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'KZT', 'package', $7, $8, $9, now()) RETURNING id`,
  [sellerId, locationId, title, offerTitleSearchText(title), randomUUID(), price, pack[0], pack[1], status])).rows[0].id as string;
}

const offersSnapshot = async (sellerId: string) =>
  (await pool.query('SELECT id, revision, status, price_amount FROM offers WHERE seller_id=$1 ORDER BY id', [sellerId])).rows;
const draftCount = async (userId: string) =>
  Number((await pool.query(`SELECT count(*)::int AS n FROM offer_drafts WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);

let seed: { sellerId: string; pointId: string; smetana: string; pelm05: string; syr: string };

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
});

beforeEach(async () => {
  await cleanup(B.id);
  const { sellerId, pointId } = await seller(A, 'А');
  seed = {
    sellerId, pointId,
    smetana: await offer(sellerId, pointId, 'Сметана Простоквашино', ['400', 'g'], '1200'),
    pelm05: await offer(sellerId, pointId, 'Пельмени', ['500', 'g'], '1400'),
    syr: await offer(sellerId, pointId, 'Сыр', ['400', 'g'], '2900', 'inactive'),
  };
});

afterAll(async () => {
  for (const u of [A, B]) await cleanup(u.id);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

const submit = (text: string) => applySellerTextInput(A.id, text, { database: db, env, locationId: seed.pointId });

describe('a repeated list (AC 1–7, 11)', () => {
  it('possible matches are held, other products and packs become drafts, nothing changes on the showcase', async () => {
    const before = await offersSnapshot(seed.sellerId);
    const result = await submit(REPEAT);
    expect(result.drafts.map((d) => [d.payload.title, d.payload.price, d.payload.pack])).toEqual([
      ['Сметана домашняя', '1500', { amount: '400', unit: 'g' }],
      ['Пельмени', '2600', { amount: '1', unit: 'kg' }],
      ['Картошка', '', null],
    ]);
    expect(result.held.map((h) => [h.title, h.outcome, h.candidates.map((c) => c.differences.map((d) => d.kind))])).toEqual([
      ['Сметана Простоквашино', 'same', [[]]],
      ['Пельмени', 'differs', [['price']]],
      ['Сыр', 'off', [[]]],
    ]);
    const kartoshka = result.drafts[2]!;
    expect(result.priceChoices).toEqual([{ draftId: kartoshka.id, choices: ['250', '300'] }]);
    expect(result.draftNotes).toEqual([{ draftId: result.drafts[1]!.id, otherPacks: [{ title: 'Пельмени', packLabel: '500 г' }] }]);
    expect(await offersSnapshot(seed.sellerId)).toEqual(before);
  });

  it('a draft with conflicting prices cannot be published until a price is chosen', async () => {
    const result = await submit('Картошка 250 за кг. Картошка 300 за кг.');
    const [draft] = result.drafts;
    const body = (price: string) => ({ title: draft!.payload.title, productId: draft!.payload.productId, price, unit: draft!.payload.unit, pack: null,
      sellerComment: '', photoIds: [], points: [{ locationId: seed.pointId }], draftId: draft!.id });
    expect(cardCreateBodySchema.safeParse(body(draft!.payload.price)).success).toBe(false);
    await saveOfferDraft(A.id, draft!.id, { ...draft!.payload, price: '300' }, { database: db });
    expect(cardCreateBodySchema.safeParse(body('300')).success).toBe(true);
  });

  it('§4.4: an existing card repeated with two prices — no automatic draft, card untouched, one draft on request', async () => {
    const before = await offersSnapshot(seed.sellerId);
    const result = await submit(CONFLICT_WITH_CARD);
    expect([result.drafts.length, await draftCount(A.id)]).toEqual([0, 0]);
    expect(result.held.map((h) => [h.outcome, h.priceChoices, h.candidates.map((c) => [c.offerId, c.differences])])).toEqual([
      ['differs', ['1400', '1500'], [[seed.pelm05, [{ kind: 'priceConflict', prices: ['1400', '1500'] }]]]],
    ]);
    expect(await offersSnapshot(seed.sellerId)).toEqual(before);

    const made = await createDraftFromHeldLine(A.id, result.inputId, 0, { database: db });
    const again = await createDraftFromHeldLine(A.id, result.inputId, 0, { database: db });
    expect([made.created, again.created, again.draftId]).toEqual([true, false, made.draftId]);
    const view = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([view.drafts.map((d) => [d.id, d.payload.price]), view.priceChoices, view.held[0]!.draftId])
      .toEqual([[[made.draftId, '']], [{ draftId: made.draftId, choices: ['1400', '1500'] }], made.draftId]);
    expect(await offersSnapshot(seed.sellerId)).toEqual(before);
  });
});

describe('draft on request, recovery and scope (AC 8–10)', () => {
  it('concurrent requests create one draft; a deleted draft is made anew', async () => {
    const result = await submit('Сметана Простоквашино 1200 за упаковку 400 г.');
    const both = await Promise.all([0, 1].map(() => createDraftFromHeldLine(A.id, result.inputId, 0, { database: db })));
    expect(new Set(both.map((r) => r.draftId)).size).toBe(1);
    expect(await draftCount(A.id)).toBe(1);
    await deleteOfferDraft(A.id, both[0]!.draftId, { database: db });
    const fresh = await createDraftFromHeldLine(A.id, result.inputId, 0, { database: db });
    expect([fresh.created, fresh.draftId === both[0]!.draftId, await draftCount(A.id)]).toEqual([true, false, 1]);
  });

  it('after a reload: held lines restored, candidates from current data', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г.');
    expect(result.held[0]!.outcome).toBe('differs');
    await pool.query("UPDATE offers SET price_amount='1500', revision=revision+1 WHERE id=$1", [seed.pelm05]);
    const view = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([view.held[0]!.outcome, view.held[0]!.draftId]).toEqual(['same', null]);
  });

  it('another seller, an unknown index or an expired review: refused, nothing created', async () => {
    const result = await submit('Сметана Простоквашино 1200 за упаковку 400 г.');
    await seller(B, 'Чужая');
    await expect(createDraftFromHeldLine(B.id, result.inputId, 0, { database: db })).rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    await expect(createDraftFromHeldLine(A.id, result.inputId, 5, { database: db })).rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    await expect(createDraftFromHeldLine(A.id, result.inputId, 0, { database: db, clock: () => new Date(Date.now() + 25 * 3_600_000) }))
      .rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    expect(await draftCount(A.id)).toBe(0);
  });

  it('a card of another seller is never a candidate', async () => {
    const other = await seller(B, 'Чужая');
    await offer(other.sellerId, other.pointId, 'Картошка', ['1', 'kg'], '250');
    const result = await submit('Картошка 250 за кг.');
    expect([result.held.length, result.drafts.length]).toEqual([0, 1]);
  });

  it('a review saved before this slice still loads', async () => {
    const result = await submit(REPEAT);
    await pool.query("UPDATE seller_text_submissions SET result = result - 'held' - 'priceChoices' WHERE request_id=$1", [result.inputId]);
    const view = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([view.held, view.priceChoices, view.drafts.length]).toEqual([[], [], 3]);
  });

  it('route: 201 then 200 with the same draft; 404 for a foreign review', async () => {
    const result = await submit('Сметана Простоквашино 1200 за упаковку 400 г.');
    const post = (token: string, inputId: string) => heldDraftRoute(
      new NextRequest(`http://localhost/api/seller/text-input/${inputId}/held/0/draft`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
      { params: Promise.resolve({ inputId, index: '0' }) },
    );
    const first = await post(A.token, result.inputId);
    const second = await post(A.token, result.inputId);
    const [a, b] = [await first.json(), await second.json()] as { draftId: string }[];
    expect([first.status, second.status, a!.draftId === b!.draftId]).toEqual([201, 200, true]);
    await seller(B, 'Чужая');
    expect((await post(B.token, result.inputId)).status).toBe(404);
  });
});
