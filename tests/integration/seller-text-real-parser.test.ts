import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postTextInput } from '../../src/app/api/seller/text-input/route';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import * as offerDrafts from '../../src/modules/offers/drafts/offer-drafts';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import {
  applySellerTextInput, submissionTextDigest,
} from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import {
  TextInputParserError, TextInputRequestConflictError, TextInputUnavailableError,
} from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { type StubState, createStubState, handleStubRequest, stubFetch } from '../support/c2-replay-stub';
import { connectTestDatabase, testDatabaseUrl } from './database';
import { withMigrationTestDatabase } from './migration-test-database';

// seller-ai-text-real-parser §9.1 integration, REPLAY mode: the real adapter, pipeline, submissions table and drafts run
// against PostgreSQL; the inference service is the replay stub serving saved C2 answers. Not a real model.

const KEY = 'r'.repeat(40);
const T0 = new Date('2026-10-21T08:00:00.000Z');
const A = { id: '50000000-0000-4000-8000-000000009201', phoneE164: '+77000009201', token: 'real-parser-9201' };
const B = { id: '50000000-0000-4000-8000-000000009202', phoneE164: '+77000009202', token: 'real-parser-9202' };
const C = { id: '50000000-0000-4000-8000-000000009203', phoneE164: '+77000009203', token: 'real-parser-9203' };
const TWO = 'Баранина 4500 за кг\nКурага пачка 500 г 1200';
const SAVED = 'Привет, актуальные цены на сегодня. Морковь по 570 за килограмм. Перец 1740 за кг. Огурцы 970 за кг.';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
let stub: StubState;
const originalDatabaseUrl = process.env.DATABASE_URL;
const env = () => ({
  SELLER_TEXT_INPUT: 'real',
  SELLER_TEXT_PARSER_URL: 'http://127.0.0.1:9',
  SELLER_TEXT_PARSER_API_KEY: KEY,
  SELLER_TEXT_INPUT_ALLOWLIST: `${A.phoneE164},${B.phoneE164}`,
});
const deps = (over: Record<string, unknown> = {}) => ({ database: db, env: env(), fetch: stubFetch(stub), ...over });

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

async function sellerFor(user: typeof A) {
  await cleanup(user.id);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [user.id, user.phoneE164, T0]);
  await pool.query('INSERT INTO auth_sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), user.id, digestSessionToken(user.token), T0, new Date('2030-01-01T00:00:00Z')]);
  await setupSeller(user.id, { seller: { displayName: 'Real parser seller' }, location: { name: 'Point', type: 'shop', addressText: 'Almaty' } }, { database: db });
  return (await pool.query(bySeller, [user.id])).rows[0].id as string;
}

const count = async (table: 'offer_drafts' | 'offers', userId: string) =>
  Number((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);
const submission = async (sellerId: string, requestId: string) =>
  (await pool.query('SELECT * FROM seller_text_submissions WHERE seller_id=$1 AND request_id=$2', [sellerId, requestId])).rows[0];

async function publish(userId: string, draft: { id: string; payload: { title: string; productId: string | null; price: string; unit: unknown; pack: unknown; points: { locationId: string }[] } }) {
  // What the existing editor sends: the card fields and the draftId — never the draft payload or its aiHints.
  const body = cardCreateBodySchema.parse({
    title: draft.payload.title, productId: draft.payload.productId, price: draft.payload.price, unit: draft.payload.unit,
    pack: draft.payload.pack, sellerComment: '', photoIds: [], points: draft.payload.points.map((p) => ({ locationId: p.locationId })),
    draftId: draft.id,
  });
  const proposal = await createCardChangeSet(userId, body, { database: db });
  await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => new Date() });
}

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
});

afterAll(async () => {
  for (const user of [A, B, C]) await cleanup(user.id);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

beforeEach(() => {
  stub = createStubState(KEY);
  vi.restoreAllMocks();
});

describe('real parser, replay mode: drafts', () => {
  it('creates private drafts with provenance, catalog link, seller-unit pack and nothing published', async () => {
    await sellerFor(A);
    const result = await applySellerTextInput(A, TWO, deps());
    expect(result.parser).toBe('real');
    expect(result.drafts.map((d) => [d.payload.title, d.payload.productId, d.payload.price, d.payload.unit, d.payload.pack])).toEqual([
      ['Баранина', seedIds.lambProduct, '4500', { code: 'kg' }, null],
      ['Курага', null, '1200', { code: 'package' }, { amount: '500', unit: 'g' }],
    ]);
    expect(result.drafts[0]!.payload.aiHints).toMatchObject({ source: 'text', inputId: result.inputId, parser: 'real', parserConfig: 'c2/script-2.2/Qwen3-4B@1cfa9a7' });
    expect(await count('offers', A.id)).toBe(0);
    expect(stub.calls).toBe(1);
  });

  it('an out-of-stock mention of an already published offer: a statement with that card, no draft, the offer unchanged', async () => {
    // Revised by text-availability (D-A): the mention is a «Нет в наличии» statement whose candidate is the published
    // card; it creates no available-product draft and changes no offer before an explicit confirmation.
    const sellerId = await sellerFor(A);
    const locationId = (await pool.query('SELECT id FROM locations WHERE seller_id=$1', [sellerId])).rows[0].id as string;
    await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,title,title_search,card_id)
      VALUES ($1,$2,$3,'570','KZT','active',now(),'Морковь','морковь',$4)`, [null, sellerId, locationId, randomUUID()]);
    const offerBefore = (await pool.query('SELECT * FROM offers WHERE seller_id=$1', [sellerId])).rows;

    const result = await applySellerTextInput(A, 'Есть редис, виноград и яблоки. Моркови нет в наличии.', deps());

    expect(result.skipped.filter((item) => /морков/i.test(item.label))).toEqual([]);
    expect(result.availability.map((view) => [view.sourceQuote, view.variant.state, view.candidates.map((c) => [c.title, c.status])]))
      .toEqual([['Моркови нет в наличии', 'none', [['Морковь', 'live']]]]);
    expect(result.drafts.map((d) => d.payload.title).filter((title) => /морков/i.test(title))).toEqual([]);
    expect((await pool.query('SELECT * FROM offers WHERE seller_id=$1', [sellerId])).rows).toEqual(offerBefore);
    expect(await count('offers', A.id)).toBe(1);
  });

  it('ambiguous catalog title: no automatic choice, productId null and a notice', async () => {
    await sellerFor(A);
    const first = randomUUID();
    const second = randomUUID();
    await pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [first, 'RP Pear A', second, 'RP Pear B']);
    await pool.query("INSERT INTO product_localized_names (product_id,locale,name) VALUES ($1,'kk','Груша-дичка'),($2,'kk','Груша-дичка')", [first, second]);
    try {
      const result = await applySellerTextInput(A, 'Груша-дичка 900 за кг', deps());
      expect(result.drafts[0]!.payload.productId).toBeNull();
      expect(result.drafts[0]!.payload.aiHints?.catalogStatus).toBe('ambiguous');
      expect(result.uncertain[0]).toMatchObject({ fields: ['catalog'], message: 'Каталог: выберите товар вручную' });
      expect((await pool.query('SELECT count(*)::int n FROM products WHERE id IN ($1,$2)', [first, second])).rows[0].n).toBe(2);
    } finally {
      await pool.query('DELETE FROM product_localized_names WHERE product_id IN ($1,$2)', [first, second]);
      await pool.query('DELETE FROM products WHERE id IN ($1,$2)', [first, second]);
    }
  });

  it('a published offer created from a text draft carries no aiHints or submission data', async () => {
    await sellerFor(A);
    const result = await applySellerTextInput(A, TWO, deps());
    const draft = result.drafts[0]!;
    // The editor cannot even send aiHints: the publish body is strict.
    expect(cardCreateBodySchema.safeParse({ title: 'x', productId: null, price: '1', unit: { code: 'kg' }, pack: null, sellerComment: '',
      photoIds: [], points: [{ locationId: draft.payload.points[0]!.locationId }], aiHints: draft.payload.aiHints }).success).toBe(false);
    await publish(A.id, draft);
    const offers = (await pool.query(`SELECT to_jsonb(o)::text AS j FROM offers o WHERE seller_id IN (${bySeller})`, [A.id])).rows;
    const items = (await pool.query(`SELECT to_jsonb(i)::text AS j FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE s.seller_id IN (${bySeller})`, [A.id])).rows;
    expect(offers).toHaveLength(1);
    for (const row of [...offers, ...items]) {
      for (const trace of ['aiHints', 'sourceQuote', 'inputId', 'parserConfig', result.inputId]) expect(row.j).not.toContain(trace);
    }
    expect(await count('offer_drafts', A.id)).toBe(1);
  });

  it.each([
    ['service error', `${TWO} [stub:fail]`, 'TEXT_INPUT_FAILED'],
    ['invalid answer', `${TWO} [stub:no-array]`, 'TEXT_INPUT_FAILED'],
    ['wrong model', `${TWO} [stub:wrong-model]`, 'TEXT_INPUT_FAILED'],
  ])('%s → no drafts and a failed submission that can be retried', async (_name, text, code) => {
    const sellerId = await sellerFor(A);
    const requestId = randomUUID();
    await expect(applySellerTextInput(A, text, deps({ requestId }))).rejects.toMatchObject({ code });
    expect(await count('offer_drafts', A.id)).toBe(0);
    expect(await submission(sellerId, requestId)).toMatchObject({ status: 'failed', failure_code: code, result: null });
  });

  it('timeout → no drafts', async () => {
    await sellerFor(A);
    stub.slowMs = 2500;
    await expect(applySellerTextInput(A, `${TWO} [stub:slow]`, deps({ env: { ...env(), SELLER_TEXT_PARSER_TIMEOUT_MS: '1000' } })))
      .rejects.toMatchObject({ code: 'TEXT_INPUT_TIMEOUT' });
    expect(await count('offer_drafts', A.id)).toBe(0);
  });

  it('database error mid-batch rolls back every draft; the retry creates them once', async () => {
    const sellerId = await sellerFor(A);
    const requestId = randomUUID();
    const original = offerDrafts.saveOfferDraft;
    let calls = 0;
    const spy = vi.spyOn(offerDrafts, 'saveOfferDraft').mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 2) throw new Error('simulated persistence failure');
      return original(...args);
    });
    await expect(applySellerTextInput(A, TWO, deps({ requestId }))).rejects.toThrow('simulated persistence failure');
    spy.mockRestore();
    expect(await count('offer_drafts', A.id)).toBe(0);
    expect((await submission(sellerId, requestId)).status).toBe('failed');
    const retry = await applySellerTextInput(A, TWO, deps({ requestId }));
    expect([retry.replayed, retry.drafts.length, await count('offer_drafts', A.id), stub.calls]).toEqual([false, 2, 2, 2]);
  });

  it('non-allowlisted seller cannot use the real parser', async () => {
    await sellerFor(C);
    await expect(applySellerTextInput(C, TWO, deps())).rejects.toBeInstanceOf(TextInputUnavailableError);
    expect(stub.calls).toBe(0);
  });

  it('logs identifiers and counts only, never seller text, quotes, titles or model output', async () => {
    await sellerFor(A);
    const lines: string[] = [];
    for (const method of ['info', 'log', 'warn', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(' ')); });
    }
    await applySellerTextInput(A, TWO, deps());
    await applySellerTextInput(A, `${TWO} [stub:fail]`, deps()).catch(() => undefined);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) for (const secret of ['Баранина', 'Курага', '4500', 'пачка', KEY]) expect(line).not.toContain(secret);
  });
});

describe('durable retry protection (§6.4)', () => {
  it('a sequential retry replays: no inference, nothing created, same drafts', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    const first = await applySellerTextInput(A, TWO, deps({ requestId }));
    const second = await applySellerTextInput(A, TWO, deps({ requestId }));
    expect(second.replayed).toBe(true);
    expect(second.drafts.map((d) => d.id)).toEqual(first.drafts.map((d) => d.id));
    expect([stub.calls, await count('offer_drafts', A.id)]).toEqual([1, 2]);
  });

  it('replay needs no in-process state (fresh dependencies, as after a restart)', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    const first = await applySellerTextInput(A, TWO, deps({ requestId }));
    const afterRestart = createStubState(KEY);
    const again = await applySellerTextInput(A, TWO, { database: db, env: env(), fetch: stubFetch(afterRestart), requestId });
    expect([again.replayed, afterRestart.calls]).toEqual([true, 0]);
    expect(again.drafts.map((d) => d.id)).toEqual(first.drafts.map((d) => d.id));
    expect(again.skipped).toEqual(first.skipped);
    expect(again.uncertain).toEqual(first.uncertain);
  });

  it('concurrent identical requests: one inference, one draft set, the same ids in both answers', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    stub.slowMs = 600;
    const text = `${TWO} [stub:slow]`;
    const [x, y] = await Promise.all([
      applySellerTextInput(A, text, deps({ requestId })),
      applySellerTextInput(A, text, deps({ requestId })),
    ]);
    expect(stub.calls).toBe(1);
    expect(await count('offer_drafts', A.id)).toBe(2);
    expect(x.drafts.map((d) => d.id)).toEqual(y.drafts.map((d) => d.id));
    expect([x.replayed, y.replayed].sort()).toEqual([false, true]);
  });

  it('after one draft was published: replay, nothing recreated, the published one counted', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    const first = await applySellerTextInput(A, TWO, deps({ requestId }));
    await publish(A.id, first.drafts[0]!);
    const again = await applySellerTextInput(A, TWO, deps({ requestId }));
    expect([again.replayed, again.unavailableDrafts, again.drafts.map((d) => d.id)]).toEqual([true, 1, [first.drafts[1]!.id]]);
    expect([stub.calls, await count('offer_drafts', A.id), await count('offers', A.id)]).toEqual([1, 1, 1]);
  });

  it('after all drafts were deleted: replay with zero drafts, nothing recreated', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    const first = await applySellerTextInput(A, TWO, deps({ requestId }));
    for (const draft of first.drafts) await offerDrafts.deleteOfferDraft(A.id, draft.id, { database: db });
    const again = await applySellerTextInput(A, TWO, deps({ requestId }));
    expect([again.replayed, again.unavailableDrafts, again.drafts, again.uncertain]).toEqual([true, 2, [], []]);
    expect([stub.calls, await count('offer_drafts', A.id)]).toEqual([1, 0]);
  });

  it('the same requestId with different text is refused, before and after publication', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    const first = await applySellerTextInput(A, TWO, deps({ requestId }));
    await expect(applySellerTextInput(A, SAVED, deps({ requestId }))).rejects.toBeInstanceOf(TextInputRequestConflictError);
    await publish(A.id, first.drafts[0]!);
    await publish(A.id, first.drafts[1]!);
    await expect(applySellerTextInput(A, SAVED, deps({ requestId }))).rejects.toBeInstanceOf(TextInputRequestConflictError);
    expect([stub.calls, await count('offer_drafts', A.id), await count('offers', A.id)]).toEqual([1, 0, 2]);
  });

  it('another seller’s identical requestId is an unrelated submission', async () => {
    await sellerFor(A);
    await sellerFor(B);
    const requestId = randomUUID();
    const a = await applySellerTextInput(A, TWO, deps({ requestId }));
    const b = await applySellerTextInput(B, SAVED, deps({ requestId }));
    expect([a.replayed, b.replayed, b.drafts.length, stub.calls]).toEqual([false, false, 3, 2]);
  });

  it('a failed attempt is retried: inference runs again and drafts are created once', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    const text = `${TWO} [stub:fail-once]`;
    await expect(applySellerTextInput(A, text, deps({ requestId }))).rejects.toBeInstanceOf(TextInputParserError);
    const retry = await applySellerTextInput(A, text, deps({ requestId }));
    const again = await applySellerTextInput(A, text, deps({ requestId }));
    expect([retry.replayed, again.replayed, stub.calls, await count('offer_drafts', A.id)]).toEqual([false, true, 2, 2]);
  });

  it('a stale attempt is taken over and the old owner’s late commit creates nothing', async () => {
    await sellerFor(A);
    const requestId = randomUUID();
    stub.slowMs = 800;
    const text = `${TWO} [stub:slow]`;
    // The first request is still in inference when a second one (another app process: own slot) arrives "later than
    // the lease" and takes over.
    const twoSlots = { ...env(), SELLER_TEXT_PARSER_CONCURRENCY: '2' };
    const slowOwner = applySellerTextInput(A, text, deps({ requestId, env: twoSlots }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const later = () => new Date(Date.now() + 10 * 60 * 1000);
    const takeOver = await applySellerTextInput(A, text, deps({ requestId, clock: later, env: twoSlots }));
    const old = await slowOwner;
    expect(takeOver.replayed).toBe(false);
    expect(old.replayed).toBe(true);
    expect(old.drafts.map((d) => d.id)).toEqual(takeOver.drafts.map((d) => d.id));
    expect([stub.calls, await count('offer_drafts', A.id)]).toEqual([2, 2]);
  });

  it('expired rows are purged and an expired requestId is a new submission', async () => {
    const sellerId = await sellerFor(A);
    const requestId = randomUUID();
    const old = new Date(Date.now() - 48 * 3600 * 1000);
    await pool.query(`INSERT INTO seller_text_submissions (seller_id, request_id, text_digest, parser, status, attempt_id, attempt_started_at,
      failure_code, result, created_at, completed_at, expires_at) VALUES ($1,$2,$3,'real','succeeded',$4,$5,NULL,$6,$5,$5,$7)`,
    [sellerId, requestId, submissionTextDigest(requestId, 'другой текст'), randomUUID(), old,
      JSON.stringify({ draftIds: [], skipped: [], uncertain: [], notices: [] }), new Date(old.getTime() + 24 * 3600 * 1000)]);
    const result = await applySellerTextInput(A, TWO, deps({ requestId }));
    expect([result.replayed, result.drafts.length]).toEqual([false, 2]);
    expect((await submission(sellerId, requestId)).text_digest).toBe(submissionTextDigest(requestId, TWO));
  });

  it('stores a salted digest, never the text', async () => {
    const sellerId = await sellerFor(A);
    const requestId = randomUUID();
    await applySellerTextInput(A, TWO, deps({ requestId }));
    const row = await submission(sellerId, requestId);
    expect(JSON.stringify(row)).not.toContain('Баранина 4500 за кг');
    expect(row.text_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()).toBe(24 * 3600 * 1000);
  });
});

describe('POST /api/seller/text-input in real mode (loopback replay stub over HTTP)', () => {
  let server: Server;
  let httpStub: StubState;
  const saved: Record<string, string | undefined> = {};
  const request = (token: string, body: unknown) => new NextRequest('http://localhost/api/seller/text-input', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=${token}` }, body: JSON.stringify(body),
  });

  beforeAll(async () => {
    httpStub = createStubState(KEY);
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const response = await handleStubRequest(new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers, body: Buffer.concat(chunks) }), httpStub);
      res.writeHead(response.status, { 'content-type': 'application/json' });
      res.end(Buffer.from(await response.arrayBuffer()));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const next = { ...env(), SELLER_TEXT_PARSER_URL: `http://127.0.0.1:${port}` };
    for (const [k, v] of Object.entries(next)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise((resolve) => server.close(resolve));
  });

  it('201 then 200 for a retry, 409 for other text, 503 for a failure, 503 for a non-allowlisted seller', async () => {
    await sellerFor(A);
    await sellerFor(C);
    const requestId = randomUUID();
    const first = await postTextInput(request(A.token, { text: TWO, requestId }));
    expect(first.status).toBe(201);
    const body = await first.json();
    expect([body.inputId, body.parser, body.drafts.length, body.unavailableDrafts, 'replayed' in body]).toEqual([requestId, 'real', 2, 0, false]);
    expect((await postTextInput(request(A.token, { text: TWO, requestId }))).status).toBe(200);
    const conflict = await postTextInput(request(A.token, { text: SAVED, requestId }));
    expect([conflict.status, (await conflict.json()).error.code]).toEqual([409, 'TEXT_INPUT_REQUEST_CONFLICT']);
    const failed = await postTextInput(request(A.token, { text: `${TWO} [stub:fail]`, requestId: randomUUID() }));
    expect([failed.status, (await failed.json()).error.code]).toEqual([503, 'TEXT_INPUT_FAILED']);
    const blocked = await postTextInput(request(C.token, { text: TWO }));
    expect([blocked.status, (await blocked.json()).error.code]).toEqual([503, 'TEXT_INPUT_UNAVAILABLE']);
    expect(await count('offer_drafts', A.id)).toBe(2);
    expect(httpStub.calls).toBe(2);
  });

  it('rejects a malformed requestId', async () => {
    await sellerFor(A);
    expect((await postTextInput(request(A.token, { text: TWO, requestId: 'not-a-uuid' }))).status).toBe(400);
  });
});

describe('migration 0030', () => {
  beforeAll(() => { process.env.DATABASE_URL = originalDatabaseUrl; });

  it('adds the empty submissions table and leaves every existing table unchanged', async () => {
    await withMigrationTestDatabase({ name: 'kaida_text_submissions_upgrade_test' }, async (migrationPool) => {
      const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8')) as { entries: { idx: number; tag: string }[] };
      const apply = async (tag: string) => {
        for (const statement of (await readFile(`drizzle/migrations/${tag}.sql`, 'utf8')).split('--> statement-breakpoint')) {
          if (statement.trim()) await migrationPool.query(statement);
        }
      };
      for (const entry of journal.entries.filter((e) => e.idx < 30)) await apply(entry.tag);
      await migrationPool.query("INSERT INTO users(id,phone_e164,created_at) VALUES('a9300000-0000-4000-8000-000000000001','+77000993001','2026-10-10T00:00:00Z')");
      await migrationPool.query("INSERT INTO sellers(id,owner_user_id,display_name) VALUES('a9300000-0000-4000-8000-000000000002','a9300000-0000-4000-8000-000000000001','Upgrade seller')");
      await migrationPool.query(`INSERT INTO offer_drafts(seller_id,payload) VALUES('a9300000-0000-4000-8000-000000000002',$1)`,
        [JSON.stringify({ title: 'x', productId: null, price: '', unit: null, pack: null, sellerComment: '', photoIds: [], points: [] })]);
      const tables = (await migrationPool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.tablename as string);
      const before = new Map<string, unknown[]>();
      for (const table of tables) before.set(table, (await migrationPool.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows);
      await apply('0030_seller_text_submissions');
      for (const table of tables) {
        expect((await migrationPool.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows).toEqual(before.get(table));
      }
      expect((await migrationPool.query('SELECT count(*)::int n FROM seller_text_submissions')).rows[0].n).toBe(0);
      await expect(migrationPool.query(`INSERT INTO seller_text_submissions (seller_id, request_id, text_digest, parser, status, attempt_id,
        attempt_started_at, created_at, expires_at) VALUES ('a9300000-0000-4000-8000-000000000002', gen_random_uuid(), 'nothex', 'real',
        'processing', gen_random_uuid(), now(), now(), now() + interval '1 day')`)).rejects.toMatchObject({ code: '23514' });
    });
  });
});
