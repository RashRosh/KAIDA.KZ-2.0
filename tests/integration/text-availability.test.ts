import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as proposeRoute } from '../../src/app/api/seller/text-input/[inputId]/availability/route';
import type { Database } from '../../src/db/client';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import type { AvailabilityStatementView } from '../../src/modules/seller-input/contracts/availability.contract';
import { OfferChangedError } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import {
  applySellerTextInput, getSellerTextSubmission, proposeTextAvailability,
} from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import {
  TextAvailabilityChangedError, TextInputReviewUnavailableError,
} from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

// text-availability (docs/slices/text-availability/SLICE_CONTRACT.md §8, §10): matching only at the selected point,
// one switch-off proposal through the existing change set, the shown → proposal check and the existing confirm guard.
// Fake parser; nothing here depends on a model.
const T0 = new Date('2026-10-27T08:00:00.000Z');
const A = { id: '50000000-0000-4000-8000-000000009401', phoneE164: '+77000009401', token: 'availability-9401' };
const B = { id: '50000000-0000-4000-8000-000000009402', phoneE164: '+77000009402', token: 'availability-9402' };
const env = { SELLER_TEXT_INPUT: 'fake' };
const MIXED = 'Картошка 250 за кг. Сметаны нет. Пельменей нет. Сыра нет. Чеснока нет.';

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

async function sellerWithPoints(u: typeof A, names: string[]) {
  await cleanup(u.id);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [u.id, u.phoneE164, T0]);
  await pool.query('INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), u.id, digestSessionToken(u.token), T0, new Date('2030-01-01T00:00:00Z')]);
  await setupSeller(u.id, { seller: { displayName: 'Availability' }, location: { name: names[0]!, type: 'shop', addressText: 'Almaty' } }, { database: db });
  const sellerId = (await pool.query(bySeller, [u.id])).rows[0].id as string;
  for (const name of names.slice(1)) {
    await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, $2, 'shop', 'Almaty')", [sellerId, name]);
  }
  const rows = (await pool.query('SELECT id, name FROM locations WHERE seller_id=$1', [sellerId])).rows as { id: string; name: string }[];
  return { sellerId, points: Object.fromEntries(rows.map((row) => [row.name, row.id])) as Record<string, string> };
}

async function offer(sellerId: string, locationId: string, title: string, options: { pack?: [string, 'g' | 'kg']; status?: 'active' | 'inactive'; price?: string } = {}) {
  const pack = options.pack ?? null;
  const row = await pool.query(`INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency,
      price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'KZT', $7, $8, $9, $10, now()) RETURNING id`,
  [sellerId, locationId, title, offerTitleSearchText(title), randomUUID(), options.price ?? '1200', pack ? 'package' : 'kg',
    pack?.[0] ?? null, pack?.[1] ?? null, options.status ?? 'active']);
  return row.rows[0].id as string;
}

const offerRow = async (id: string) => (await pool.query('SELECT status, revision FROM offers WHERE id=$1', [id])).rows[0] as { status: string; revision: number };
const changeSetCount = async (userId: string) =>
  Number((await pool.query(`SELECT count(*)::int AS n FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);
const shown = (view: AvailabilityStatementView) => view.candidates.map((c) => ({ offerId: c.offerId, revision: c.revision }));
const pick = (view: AvailabilityStatementView, offerIds: string[]) => ({ index: view.index, shown: shown(view), selected: offerIds });
const rows = (view: AvailabilityStatementView) => view.candidates.map((c) => [c.title, c.packLabel, c.status, c.selectable]);

let seed: { sellerId: string; points: Record<string, string>; smetanaA: string; smetanaB: string; pelm05: string; pelm1: string; syr: string };

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
});

beforeEach(async () => {
  await cleanup(B.id);
  const { sellerId, points } = await sellerWithPoints(A, ['А', 'Б']);
  seed = {
    sellerId, points,
    smetanaA: await offer(sellerId, points['А']!, 'Сметана', { pack: ['400', 'g'] }),
    smetanaB: await offer(sellerId, points['Б']!, 'Сметана', { pack: ['400', 'g'] }),
    pelm05: await offer(sellerId, points['А']!, 'Пельмени', { pack: ['500', 'g'], price: '1400' }),
    pelm1: await offer(sellerId, points['А']!, 'Пельмени', { pack: ['1', 'kg'], price: '2600' }),
    syr: await offer(sellerId, points['А']!, 'Сыр', { pack: ['400', 'g'], status: 'inactive', price: '2900' }),
  };
});

afterAll(async () => {
  for (const u of [A, B]) await cleanup(u.id);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

const submit = (text: string, locationId = seed.points['А']!) => applySellerTextInput(A.id, text, { database: db, env, locationId });

describe('review: candidates only at the selected point (AC 1, 3–8)', () => {
  it('mixed text: drafts as before, four outcomes, nothing changed', async () => {
    const result = await submit(MIXED);
    expect(result.drafts.map((d) => d.payload.title)).toEqual(['Картошка']);
    expect(result.availability.map(rows)).toEqual([
      [['Сметана', '400 г', 'live', true]],
      [['Пельмени', '1 кг', 'live', true], ['Пельмени', '500 г', 'live', true]],
      [['Сыр', '400 г', 'off_before', false]],
      [],
    ]);
    expect(result.availability.flatMap((v) => v.candidates).some((c) => c.offerId === seed.smetanaB)).toBe(false);
    expect([await offerRow(seed.smetanaA), await changeSetCount(A.id)]).toEqual([{ status: 'active', revision: 1 }, 0]);
  });

  it('a bound pack proposes only that pack; the other pack is listed and refused', async () => {
    const result = await submit('Пельменей по 1 кг нет.');
    const [view] = result.availability;
    expect([rows(view!), view!.others.map((o) => [o.title, o.packLabel])]).toEqual([[['Пельмени', '1 кг', 'live', true]], [['Пельмени', '500 г']]]);
    await expect(proposeTextAvailability(A.id, result.inputId, { statements: [pick(view!, [seed.pelm05])] }, { database: db }))
      .rejects.toBeInstanceOf(TextAvailabilityChangedError);
    expect(await changeSetCount(A.id)).toBe(0);
  });

  it('an uncertain pack keeps every pack of the product as a candidate', async () => {
    const result = await submit('Пельменей 0,5 кг и 1 кг нет.');
    expect([result.availability[0]!.variant, rows(result.availability[0]!).length]).toEqual([{ state: 'uncertain', words: '0,5 кг, 1 кг' }, 2]);
  });

  it('another seller, another point, a forged id or an expired review: refused, nothing created', async () => {
    const result = await submit(MIXED);
    const [smetana] = result.availability;
    await sellerWithPoints(B, ['Чужая']);
    await expect(proposeTextAvailability(B.id, result.inputId, { statements: [pick(smetana!, [seed.smetanaA])] }, { database: db }))
      .rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    await expect(proposeTextAvailability(A.id, result.inputId, { statements: [pick(smetana!, [seed.smetanaB])] }, { database: db }))
      .rejects.toBeInstanceOf(TextAvailabilityChangedError);
    await expect(proposeTextAvailability(A.id, result.inputId, { statements: [pick(smetana!, [randomUUID()])] }, { database: db }))
      .rejects.toBeInstanceOf(TextAvailabilityChangedError);
    await expect(proposeTextAvailability(A.id, result.inputId, { statements: [pick(smetana!, [seed.smetanaA])] },
      { database: db, clock: () => new Date(Date.now() + 25 * 3_600_000) })).rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    expect(await changeSetCount(A.id)).toBe(0);
  });
});

describe('proposal and confirmation (AC 2, 9, 10)', () => {
  it('ticked offers only, through the existing confirm; statuses and summary after return', async () => {
    const result = await submit(MIXED);
    const [smetana, pelmeni] = result.availability;
    const { changeSetId } = await proposeTextAvailability(A.id, result.inputId,
      { statements: [pick(smetana!, [seed.smetanaA]), pick(pelmeni!, [seed.pelm05])] }, { database: db });
    expect([(await offerRow(seed.smetanaA)).status, (await offerRow(seed.pelm05)).status]).toEqual(['active', 'active']);

    const pending = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([pending.pendingChangeSetIds, rows(pending.availability[0]!)]).toEqual([[changeSetId], [['Сметана', '400 г', 'pending', false]]]);

    await confirmSellerChangeSet(A.id, changeSetId, { database: db });
    expect([(await offerRow(seed.smetanaA)).status, (await offerRow(seed.pelm05)).status, (await offerRow(seed.pelm1)).status,
      (await offerRow(seed.smetanaB)).status]).toEqual(['inactive', 'inactive', 'active', 'active']);
    const after = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([after.pendingChangeSetIds, after.availability.slice(0, 3).map(rows), after.drafts.length]).toEqual([[], [
      [['Сметана', '400 г', 'off_here', false]],
      [['Пельмени', '1 кг', 'live', true], ['Пельмени', '500 г', 'off_here', false]],
      [['Сыр', '400 г', 'off_before', false]],
    ], 1]);
  });

  it.each([
    ['price edited', "UPDATE offers SET price_amount='1300', revision=revision+1 WHERE id=$1"],
    ['switched off', "UPDATE offers SET status='inactive', revision=revision+1 WHERE id=$1"],
    ['reconfirmed', 'UPDATE offers SET last_confirmed_at=now(), revision=revision+1 WHERE id=$1'],
    ['title edited', "UPDATE offers SET title='Сметана домашняя', title_search='сметана домашняя', revision=revision+1 WHERE id=$1"],
    ['moved to the archived stage (no write of its revision)', "UPDATE offers SET last_confirmed_at=now() - interval '400 hours' WHERE id=$1"],
  ])('changed between showing and proposal — %s: nothing created, fresh candidates', async (_name, sql) => {
    const result = await submit('Сметаны нет.');
    await pool.query(sql, [seed.smetanaA]);
    const refused = await proposeTextAvailability(A.id, result.inputId, { statements: [pick(result.availability[0]!, [seed.smetanaA])] }, { database: db })
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(TextAvailabilityChangedError);
    expect((refused as TextAvailabilityChangedError).changed).toEqual([0]);
    expect(await changeSetCount(A.id)).toBe(0);
  });

  it('a new matching card added between showing and proposal: nothing created', async () => {
    const result = await submit('Сметаны нет.');
    await offer(seed.sellerId, seed.points['А']!, 'Сметана', { pack: ['200', 'g'] });
    await expect(proposeTextAvailability(A.id, result.inputId, { statements: [pick(result.availability[0]!, [seed.smetanaA])] }, { database: db }))
      .rejects.toBeInstanceOf(TextAvailabilityChangedError);
    expect(await changeSetCount(A.id)).toBe(0);
  });

  it('the proposal expects the revision the Seller saw; a later change is refused at confirm', async () => {
    const result = await submit('Сметаны нет.');
    const { changeSetId } = await proposeTextAvailability(A.id, result.inputId, { statements: [pick(result.availability[0]!, [seed.smetanaA])] }, { database: db });
    expect((await pool.query('SELECT expected_offer_revision FROM seller_change_items WHERE change_set_id=$1', [changeSetId])).rows).toEqual([{ expected_offer_revision: 1 }]);
    await pool.query("UPDATE offers SET price_amount='1300', revision=revision+1 WHERE id=$1", [seed.smetanaA]);
    await expect(confirmSellerChangeSet(A.id, changeSetId, { database: db })).rejects.toBeInstanceOf(OfferChangedError);
    expect(await offerRow(seed.smetanaA)).toEqual({ status: 'active', revision: 2 });
  });

  it('a repeated proposal or confirmation never applies twice', async () => {
    const result = await submit('Сметаны нет.');
    const body = { statements: [pick(result.availability[0]!, [seed.smetanaA])] };
    const { changeSetId } = await proposeTextAvailability(A.id, result.inputId, body, { database: db });
    await expect(proposeTextAvailability(A.id, result.inputId, body, { database: db })).rejects.toBeInstanceOf(TextAvailabilityChangedError);
    await confirmSellerChangeSet(A.id, changeSetId, { database: db });
    await confirmSellerChangeSet(A.id, changeSetId, { database: db });
    expect([await offerRow(seed.smetanaA), await changeSetCount(A.id)]).toEqual([{ status: 'inactive', revision: 2 }, 1]);
  });

  it('replay of the same request creates nothing and shows current statuses', async () => {
    const requestId = randomUUID();
    const first = await applySellerTextInput(A.id, MIXED, { database: db, env, locationId: seed.points['А'], requestId });
    const again = await applySellerTextInput(A.id, MIXED, { database: db, env, locationId: seed.points['А'], requestId });
    expect([again.replayed, again.drafts.map((d) => d.id), again.availability.map(rows)]).toEqual([true, first.drafts.map((d) => d.id), first.availability.map(rows)]);
  });

  it('a review saved before this slice (no statements) still loads', async () => {
    const result = await submit(MIXED);
    await pool.query("UPDATE seller_text_submissions SET result = result - 'unavailable' - 'availabilityChangeSetIds' WHERE request_id=$1", [result.inputId]);
    const view = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([view.availability, view.pendingChangeSetIds, view.drafts.length]).toEqual([[], [], 1]);
  });
});

describe('route', () => {
  const post = (token: string, inputId: string, body: unknown) => proposeRoute(
    new NextRequest(`http://localhost/api/seller/text-input/${inputId}/availability`, {
      method: 'POST', body: JSON.stringify(body), headers: { cookie: `${SESSION_COOKIE_NAME}=${token}`, 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ inputId }) },
  );

  it('201 with a change set; 409 with fresh candidates; 400 without a tick; 404 for an unknown review', async () => {
    const result = await submit('Сметаны нет.');
    const view = result.availability[0]!;
    expect((await post(A.token, result.inputId, { statements: [pick(view, [])] })).status).toBe(400);
    expect((await post(A.token, randomUUID(), { statements: [pick(view, [seed.smetanaA])] })).status).toBe(404);
    await pool.query('UPDATE offers SET revision=revision+1 WHERE id=$1', [seed.smetanaA]);
    const conflict = await post(A.token, result.inputId, { statements: [pick(view, [seed.smetanaA])] });
    const body = await conflict.json() as { error: { code: string }; availability: AvailabilityStatementView[]; changed: number[] };
    expect([conflict.status, body.error.code, body.changed, body.availability[0]!.candidates[0]!.revision]).toEqual([409, 'TEXT_AVAILABILITY_CHANGED', [0], 2]);
    const created = await post(A.token, result.inputId, { statements: [pick(body.availability[0]!, [seed.smetanaA])] });
    expect([created.status, typeof (await created.json() as { changeSetId: string }).changeSetId]).toEqual([201, 'string']);
  });
});
