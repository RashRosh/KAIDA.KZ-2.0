import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { connectTestDatabase } from './database';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { listReports, loadReport, loadReportContext } from '../../src/modules/moderation/application/offer-reports';
import { submitVisitOutcome, visitorKeyHashForGuest } from '../../src/modules/moderation/application/visit-outcomes';
import { submitVisitOutcomeSchema } from '../../src/modules/moderation/contracts/visit-outcome.contract';
import { POST as submitOutcomeRoute } from '../../src/app/api/offers/[id]/visit-outcome/route';

let conn: Awaited<ReturnType<typeof connectTestDatabase>>;
const users = ['b9010000-0000-4000-8000-000000000001', 'b9010000-0000-4000-8000-000000000002'];
const [sellerId, buyerId] = users as [string, string];
const phones = ['+77000994101', '+77000994102'];
const buyerSessionToken = randomUUID();
const T0 = new Date('2026-11-27T10:00:00Z');
const clock = () => T0;
const deps = () => ({ database: conn.db, clock });
let locationId: string;
const oldEnv = { url: process.env.DATABASE_URL, flag: process.env.BUYER_REPORTS_LOCAL_TESTING, secret: process.env.IDENTITY_OTP_HMAC_SECRET_HEX };

async function clean() {
  const p = conn.pool;
  const sellerQ = 'SELECT id FROM sellers WHERE owner_user_id=$1';
  await p.query(`DELETE FROM visit_outcomes WHERE seller_id IN (${sellerQ})`, [sellerId]);
  await p.query(`DELETE FROM offer_reports WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellerQ}))`, [sellerId]);
  await p.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${sellerQ}))`, [sellerId]);
  await p.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellerQ}))`, [sellerId]);
  await p.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellerQ})`, [sellerId]);
  await p.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellerQ}))`, [sellerId]);
  await p.query(`DELETE FROM offers WHERE seller_id IN (${sellerQ})`, [sellerId]);
  await p.query(`DELETE FROM locations WHERE seller_id IN (${sellerQ})`, [sellerId]);
  await p.query('DELETE FROM sellers WHERE owner_user_id=$1', [sellerId]);
  await p.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [users]);
  await p.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
}

async function publishOffer(title: string) {
  const set = await createCardChangeSet(sellerId, cardCreateBodySchema.parse({
    title, productId: null, price: '1100', unit: { code: 'kg' }, pack: null, sellerComment: 'Свежий товар', photoIds: [],
    points: [{ locationId }],
  }), deps());
  const confirmed = await confirmSellerChangeSet(sellerId, set.id, deps());
  const offerId = confirmed.items[0]!.resultOffer!.id;
  const ctx = await loadReportContext(offerId, 'ru', deps());
  return { offerId, version: ctx.evidence.version, cardId: ctx.evidence.cardId };
}

beforeAll(async () => {
  conn = await connectTestDatabase();
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BUYER_REPORTS_LOCAL_TESTING = '1';
  process.env.IDENTITY_OTP_HMAC_SECRET_HEX = '1'.repeat(64);
});

beforeEach(async () => {
  await clean();
  for (let i = 0; i < users.length; i++) {
    await conn.pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,$3)', [users[i], phones[i], T0]);
  }
  await conn.pool.query(
    'INSERT INTO auth_sessions(id,user_id,token_digest,created_at,expires_at) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), buyerId, digestSessionToken(buyerSessionToken), T0, new Date(T0.getTime() + 86_400_000)],
  );
  const setup = await setupSeller(sellerId, {
    seller: { displayName: 'Продавец исходов' },
    location: { name: 'Точка исходов', type: 'shop', addressText: 'ул. Примерная, 1' },
  }, deps());
  locationId = setup.locations[0]!.id;
});

afterAll(async () => {
  await clean();
  process.env.DATABASE_URL = oldEnv.url;
  process.env.BUYER_REPORTS_LOCAL_TESTING = oldEnv.flag;
  process.env.IDENTITY_OTP_HMAC_SECRET_HEX = oldEnv.secret;
  await conn.pool.end();
});

describe('visit outcomes (CJM 24.11 #2) on PostgreSQL 18', () => {
  it('enforces DB CHECK constraints and immutability trigger on anonymous_key_hash', async () => {
    const offer = await publishOffer('Огурцы проверка БД');
    const guestHash = visitorKeyHashForGuest(randomUUID(), '1'.repeat(64));

    // Actor XOR: neither reporter_user_id nor anonymous_key_hash -> rejected
    await expect(conn.pool.query(
      `INSERT INTO offer_reports(offer_id,card_id,card_version,reason,evidence) VALUES($1,$2,$3,'out_of_stock','{}'::jsonb)`,
      [offer.offerId, offer.cardId, offer.version],
    )).rejects.toThrow(/offer_reports_actor/);

    // Actor XOR: both reporter_user_id and anonymous_key_hash -> rejected
    await expect(conn.pool.query(
      `INSERT INTO offer_reports(reporter_user_id,anonymous_key_hash,offer_id,card_id,card_version,reason,evidence) VALUES($1,$2,$3,$4,$5,'out_of_stock','{}'::jsonb)`,
      [buyerId, guestHash, offer.offerId, offer.cardId, offer.version],
    )).rejects.toThrow(/offer_reports_actor/);

    // matched outcome with a reason -> rejected
    await expect(conn.pool.query(
      `INSERT INTO visit_outcomes(offer_id,card_id,location_id,seller_id,card_version,outcome,reason,visitor_key_hash,is_verified)
       SELECT id,card_id,location_id,seller_id,$2,'matched','out_of_stock',$3,false FROM offers WHERE id=$1`,
      [offer.offerId, offer.version, guestHash],
    )).rejects.toThrow(/visit_outcomes_kind_reason/);

    // Guest problem report is immutable (cannot tamper with anonymous_key_hash)
    const created = await submitVisitOutcome(
      { kind: 'guest', anonymousKeyHash: guestHash },
      offer.offerId,
      submitVisitOutcomeSchema.parse({ submissionId: randomUUID(), version: offer.version, locale: 'ru', outcome: 'problem', reason: 'out_of_stock', text: 'Не было на полке' }),
      deps(),
    );
    expect(created.reportId).toBeTruthy();
    await expect(conn.pool.query(
      'UPDATE offer_reports SET anonymous_key_hash=$1 WHERE id=$2',
      ['b'.repeat(64), created.reportId],
    )).rejects.toThrow(/immutable/);
  });

  it('guest submits 1-tap matched and no-photo photo_mismatch problem without login; operator sees isVerified=false without PII', async () => {
    const first = await publishOffer('Яблоки гость совпало');
    const second = await publishOffer('Груши гость проблема');
    const guestHash = visitorKeyHashForGuest(randomUUID(), '1'.repeat(64));
    const sub1 = randomUUID();

    const matched = await submitVisitOutcome(
      { kind: 'guest', anonymousKeyHash: guestHash },
      first.offerId,
      submitVisitOutcomeSchema.parse({ submissionId: sub1, version: first.version, locale: 'ru', outcome: 'matched', hasVisitSignal: true }),
      deps(),
    );
    expect(matched).toMatchObject({ outcome: 'matched', isVerified: false, duplicate: false, reportId: null });

    // Same-version repeat stays idempotent and keeps first outcome.
    const repeat = await submitVisitOutcome(
      { kind: 'guest', anonymousKeyHash: guestHash },
      first.offerId,
      submitVisitOutcomeSchema.parse({ submissionId: randomUUID(), version: first.version, locale: 'ru', outcome: 'problem', reason: 'point_closed' }),
      deps(),
    );
    expect(repeat).toMatchObject({ id: matched.id, outcome: 'matched', duplicate: true });

    // photo_mismatch works even when Offer has 0 photos (CJM P1-14.2) and enters operator X-03 with isVerified=false.
    const problem = await submitVisitOutcome(
      { kind: 'guest', anonymousKeyHash: guestHash },
      second.offerId,
      submitVisitOutcomeSchema.parse({ submissionId: randomUUID(), version: second.version, locale: 'ru', outcome: 'problem', reason: 'photo_mismatch', text: 'Выглядит иначе чем описано' }),
      deps(),
    );
    expect(problem).toMatchObject({ outcome: 'problem', isVerified: false, duplicate: false });
    expect(problem.reportId).toBeTruthy();

    const operatorReport = await loadReport(problem.reportId!, deps());
    expect(operatorReport.isVerified).toBe(false);
    expect(operatorReport.reason).toBe('photo_mismatch');
    expect(operatorReport.text).toBe('Выглядит иначе чем описано');
    expect(JSON.stringify(operatorReport)).not.toContain(guestHash);

    const queue = await listReports('open', 0, deps());
    expect(queue.rows.find((r) => r.id === problem.reportId)?.isVerified).toBe(false);
  });

  it('HTTP route mints HttpOnly visitor cookie for guests, verifies authenticated users, enforces same-origin and default-off gate', async () => {
    const offer = await publishOffer('Персики API тест');
    const payload = { submissionId: randomUUID(), version: offer.version, locale: 'ru', outcome: 'matched', hasVisitSignal: true };

    // Foreign origin -> 403
    const foreign = await submitOutcomeRoute(
      new NextRequest(`http://localhost/api/offers/${offer.offerId}/visit-outcome`, {
        method: 'POST',
        headers: { origin: 'https://evil.invalid', 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: offer.offerId }) },
    );
    expect(foreign.status).toBe(403);

    // Guest submission succeeds and mints HttpOnly kaida_visitor cookie
    const guestRes = await submitOutcomeRoute(
      new NextRequest(`http://localhost/api/offers/${offer.offerId}/visit-outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: offer.offerId }) },
    );
    expect(guestRes.status).toBe(200);
    const guestJson = await guestRes.json();
    expect(guestJson).toMatchObject({ outcome: 'matched', isVerified: false, duplicate: false });
    const setCookie = guestRes.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('kaida_visitor=');
    expect(setCookie.toLowerCase()).toContain('httponly');

    // Authenticated user submits problem -> isVerified=true and links to offer_reports
    const authRes = await submitOutcomeRoute(
      new NextRequest(`http://localhost/api/offers/${offer.offerId}/visit-outcome`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=${buyerSessionToken}` },
        body: JSON.stringify({ submissionId: randomUUID(), version: offer.version, locale: 'ru', outcome: 'problem', reason: 'out_of_stock', text: 'Закончились', hasVisitSignal: true }),
      }),
      { params: Promise.resolve({ id: offer.offerId }) },
    );
    expect(authRes.status).toBe(200);
    const authJson = await authRes.json();
    expect(authJson).toMatchObject({ outcome: 'problem', isVerified: true, duplicate: false });
    expect(authJson.reportId).toBeTruthy();

    // Default-off gate -> 404
    process.env.BUYER_REPORTS_LOCAL_TESTING = '0';
    try {
      const offRes = await submitOutcomeRoute(
        new NextRequest(`http://localhost/api/offers/${offer.offerId}/visit-outcome`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        { params: Promise.resolve({ id: offer.offerId }) },
      );
      expect(offRes.status).toBe(404);
    } finally {
      process.env.BUYER_REPORTS_LOCAL_TESTING = '1';
    }
  });
});
