import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { OfferChangedError } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import {
  applySellerTextInput, getSellerTextSubmission, proposeTextPrices,
} from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import {
  type HeldLineView, TextInputReviewUnavailableError, TextPriceChangedError, TextPriceRejectedError,
} from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

// text-price-update (docs/slices/text-price-update/SLICE_CONTRACT.md §7, §9): one line → one card, server-side
// admissibility, idempotency per set of changes, stale data before proposal and at confirm, rollback. Fake parser.
const T0 = new Date('2026-10-27T08:00:00.000Z');
const A = { id: '50000000-0000-4000-8000-000000009601', phoneE164: '+77000009601' };
const B = { id: '50000000-0000-4000-8000-000000009602', phoneE164: '+77000009602' };
const env = { SELLER_TEXT_INPUT: 'fake' };

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
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

async function seller(u: typeof A, points: string[]) {
  await cleanup(u.id);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [u.id, u.phoneE164, T0]);
  await setupSeller(u.id, { seller: { displayName: 'Price' }, location: { name: points[0]!, type: 'shop', addressText: 'Almaty' } }, { database: db });
  const sellerId = (await pool.query(bySeller, [u.id])).rows[0].id as string;
  for (const name of points.slice(1)) await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, $2, 'shop', 'Almaty')", [sellerId, name]);
  const rows = (await pool.query('SELECT id, name FROM locations WHERE seller_id=$1', [sellerId])).rows as { id: string; name: string }[];
  return { sellerId, points: Object.fromEntries(rows.map((r) => [r.name, r.id])) as Record<string, string> };
}

async function offer(sellerId: string, locationId: string, title: string, pack: [string, 'g' | 'kg'], price: string, extra: { status?: string; cardId?: string } = {}) {
  return (await pool.query(`INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency,
      price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'KZT', 'package', $7, $8, $9, $10) RETURNING id`,
  [sellerId, locationId, title, offerTitleSearchText(title), extra.cardId ?? randomUUID(), price, pack[0], pack[1], extra.status ?? 'active', T0])).rows[0].id as string;
}

const row = async (id: string) => (await pool.query('SELECT price_amount, revision, status, last_confirmed_at FROM offers WHERE id=$1', [id])).rows[0] as
  { price_amount: string; revision: number; status: string; last_confirmed_at: Date };
const changeSets = async (userId: string) => Number((await pool.query(`SELECT count(*)::int AS n FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);
const pick = (line: HeldLineView, offerId: string, price: string) => ({
  index: line.index, shown: line.candidates.map((c) => ({ offerId: c.offerId, revision: c.revision })), offerId, price,
});

let seed: { sellerId: string; a: string; b: string; pelmA: string; pelmB: string; prosto: string; domash: string; syr: string };

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
});

beforeEach(async () => {
  await cleanup(B.id);
  const { sellerId, points } = await seller(A, ['А', 'Б']);
  const card = randomUUID();
  seed = {
    sellerId, a: points['А']!, b: points['Б']!,
    pelmA: await offer(sellerId, points['А']!, 'Пельмени', ['500', 'g'], '1400', { cardId: card }),
    pelmB: await offer(sellerId, points['Б']!, 'Пельмени', ['500', 'g'], '1400', { cardId: card }),
    prosto: await offer(sellerId, points['А']!, 'Сметана Простоквашино', ['400', 'g'], '1200'),
    domash: await offer(sellerId, points['А']!, 'Сметана Домашняя', ['400', 'g'], '1300'),
    syr: await offer(sellerId, points['А']!, 'Сыр', ['400', 'g'], '2900', { status: 'inactive' }),
  };
});

afterAll(async () => {
  for (const u of [A, B]) await cleanup(u.id);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

const submit = (text: string) => applySellerTextInput(A.id, text, { database: db, env, locationId: seed.a });
const propose = (inputId: string, lines: ReturnType<typeof pick>[]) => proposeTextPrices(A.id, inputId, { lines }, { database: db });

describe('what may change (AC 1–4)', () => {
  it('one clear match is pre-selected; several candidates, a missing pack and a switched-off card are not', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г. Сметана 1400 за упаковку 400 г. Сыр 3000 за упаковку 400 г. Пельмени 1500 за упаковку.');
    const [pelm, smetana, syr, noPack] = result.held;
    expect([pelm!.pricePreselect, pelm!.candidates.map((c) => c.priceEligible)]).toEqual([seed.pelmA, [true]]);
    expect([smetana!.pricePreselect, smetana!.candidates.map((c) => c.priceEligible)]).toEqual([null, [true, true]]);
    expect(syr!.candidates.map((c) => c.priceEligible)).toEqual([false]);
    expect([noPack!.pricePreselect, noPack!.candidates.map((c) => c.priceEligible)]).toEqual([null, [true]]);
  });

  it('a price not from the line, the same price or a switched-off card is refused by the server, nothing created', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г. Сыр 3000 за упаковку 400 г.');
    const [pelm, syr] = result.held;
    await expect(propose(result.inputId, [pick(pelm!, seed.pelmA, '1700')])).rejects.toBeInstanceOf(TextPriceRejectedError);
    await expect(propose(result.inputId, [pick(syr!, seed.syr, '3000')])).rejects.toBeInstanceOf(TextPriceChangedError);
    const same = await submit('Пельмени 1400 за упаковку 500 г.');
    await expect(propose(same.inputId, [pick(same.held[0]!, seed.pelmA, '1400')])).rejects.toBeInstanceOf(TextPriceChangedError);
    expect([await changeSets(A.id), (await row(seed.pelmA)).last_confirmed_at]).toEqual([0, T0]);
  });
});

describe('proposal, confirmation and repetition (AC 5–7)', () => {
  it('only the chosen offer at the selected point changes; repeating after success applies nothing', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г.');
    const body = [pick(result.held[0]!, seed.pelmA, '1500')];
    const first = await propose(result.inputId, body);
    expect([first.created, first.state, (await row(seed.pelmA)).price_amount]).toEqual([true, 'pending', '1400']);
    await confirmSellerChangeSet(A.id, first.changeSetId, { database: db });
    const after = await row(seed.pelmA);
    expect([after.price_amount, (await row(seed.pelmB)).price_amount, after.last_confirmed_at > T0]).toEqual(['1500', '1400', true]);
    const again = await propose(result.inputId, body);
    expect([again.changeSetId, again.state, again.created, await changeSets(A.id), (await row(seed.pelmA)).revision])
      .toEqual([first.changeSetId, 'applied', false, 1, after.revision]);
    const view = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([view.held[0]!.priceProposal?.state, view.held[0]!.outcome]).toEqual(['applied', 'same']);
  });

  it('a double tap or a second tab returns the same pending proposal; a different choice gets its own', async () => {
    const result = await submit('Сметана 1400 за упаковку 400 г.');
    const line = result.held[0]!;
    const both = await Promise.all([0, 1].map(() => propose(result.inputId, [pick(line, seed.prosto, '1400')])));
    expect([new Set(both.map((r) => r.changeSetId)).size, await changeSets(A.id)]).toEqual([1, 1]);
    const other = await propose(result.inputId, [pick(line, seed.domash, '1400')]);
    expect([other.created, other.changeSetId === both[0]!.changeSetId, await changeSets(A.id)]).toEqual([true, false, 2]);
    const view = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!;
    expect([view.held[0]!.priceProposal?.offerId, view.pricePendingChangeSetIds]).toEqual([seed.domash, [both[0]!.changeSetId, other.changeSetId].slice(1)]);
  });

  it('a stale or refused proposal lets the Seller choose again; a refused confirm applies nothing', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г.');
    const first = await propose(result.inputId, [pick(result.held[0]!, seed.pelmA, '1500')]);
    await pool.query("UPDATE offers SET price_amount='1450', revision=revision+1 WHERE id=$1", [seed.pelmA]);
    await expect(confirmSellerChangeSet(A.id, first.changeSetId, { database: db })).rejects.toBeInstanceOf(OfferChangedError);
    expect((await row(seed.pelmA)).price_amount).toBe('1450');
    await expect(propose(result.inputId, [pick(result.held[0]!, seed.pelmA, '1500')])).rejects.toBeInstanceOf(TextPriceChangedError);
    const fresh = (await getSellerTextSubmission(A.id, result.inputId, { database: db }))!.held[0]!;
    expect(fresh.priceProposal?.state).toBe('stale');
    const second = await propose(result.inputId, [pick(fresh, seed.pelmA, '1500')]);
    expect([second.created, second.changeSetId !== first.changeSetId]).toEqual([true, true]);
  });
});

describe('conflicts, stale data and rollback (AC 4, 5, 8, 10)', () => {
  it('two prices: only one of them may be proposed', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г. Пельмени 1600 за упаковку 500 г.');
    const [line] = result.held;
    expect([line!.priceChoices, line!.pricePreselect]).toEqual([['1500', '1600'], null]);
    await expect(propose(result.inputId, [pick(line!, seed.pelmA, '1700')])).rejects.toBeInstanceOf(TextPriceRejectedError);
    expect((await propose(result.inputId, [pick(line!, seed.pelmA, '1600')])).created).toBe(true);
  });

  it('two lines choosing one card with different prices are refused, nothing created', async () => {
    const result = await submit('Сметана 1400 за упаковку 400 г. Сметана Простоквашино 1500 за упаковку 400 г.');
    const [short, full] = result.held;
    const refused = await propose(result.inputId, [pick(short!, seed.prosto, '1400'), pick(full!, seed.prosto, '1500')]).catch((e: unknown) => e);
    expect([refused instanceof TextPriceRejectedError && refused.code, await changeSets(A.id)]).toEqual(['TEXT_PRICE_SAME_CARD_CONFLICT', 0]);
  });

  it.each([
    ['switched off', "UPDATE offers SET status='inactive', revision=revision+1 WHERE id=$1"],
    ['re-priced', "UPDATE offers SET price_amount='1450', revision=revision+1 WHERE id=$1"],
  ])('a card %s between showing and the proposal → nothing created; one stale line rolls back the whole request', async (_name, sql) => {
    const result = await submit('Пельмени 1500 за упаковку 500 г. Сметана Простоквашино 1500 за упаковку 400 г.');
    const [pelm, prosto] = result.held;
    await pool.query(sql, [seed.prosto]);
    const refused = await propose(result.inputId, [pick(pelm!, seed.pelmA, '1500'), pick(prosto!, seed.prosto, '1500')]).catch((e: unknown) => e);
    expect([refused instanceof TextPriceChangedError && refused.changed, await changeSets(A.id), (await row(seed.pelmA)).price_amount])
      .toEqual([[1], 0, '1400']);
  });

  it('another seller or an expired review → refused', async () => {
    const result = await submit('Пельмени 1500 за упаковку 500 г.');
    await seller(B, ['Чужая']);
    await expect(proposeTextPrices(B.id, result.inputId, { lines: [pick(result.held[0]!, seed.pelmA, '1500')] }, { database: db }))
      .rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    await expect(proposeTextPrices(A.id, result.inputId, { lines: [pick(result.held[0]!, seed.pelmA, '1500')] },
      { database: db, clock: () => new Date(Date.now() + 25 * 3_600_000) })).rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    expect(await changeSets(A.id)).toBe(0);
  });
});
