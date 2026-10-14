import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { removeCard } from '../../src/modules/moderation/application/operator-post-check';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { runActualityReminders, type PushResult, type PushTarget } from '../../src/modules/reminders/application/run-actuality-reminders';
import { saveDeviceSubscription } from '../../src/modules/reminders/application/device-subscriptions';
import { createCardChangeSet, updateCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { reconfirmCardsPerCard, undoReconfirmations, UNDO_RECONFIRM_WINDOW_MS } from '../../src/modules/seller-input/application/reconfirm-actuality';
import { cardCreateBodySchema, cardUpdateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// actuality-words §7.2 / §7.3 / §10: the one-tap confirms card by card (per-card outcomes), and the undo restores exactly
// the previous confirmation time inside the 12 s window — with one deterministic clock.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const H = 60 * 60 * 1000;
// 12:00 in Almaty: outside the reminders' quiet hours.
const NOW = new Date('2026-09-20T07:00:00.000Z');
const at = (ms: number) => () => new Date(NOW.getTime() + ms);
const clock = at(0);
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);
const SELLER = { id: '77000000-0000-4000-8000-000000000001', phone: '+77010007701' };
const OPERATOR = { id: '77000000-0000-4000-8000-000000000002', phone: '+77010007702' };
const DEVICE = { endpoint: 'https://push.example.test/words-1', p256dh: 'p256dh-key', auth: 'auth-key' };

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${SELLER.id}'`;
  await pool.query(`DELETE FROM actuality_reminders_sent WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1', [SELLER.id]);
  await pool.query(`DELETE FROM offer_card_removals WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE s.seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [SELLER.id]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[]) OR phone_e164 = ANY($2::text[])', [[SELLER.id, OPERATOR.id], [SELLER.phone, OPERATOR.phone]]);
}

async function prepare() {
  await cleanup();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3),($4,$5,$3)', [SELLER.id, SELLER.phone, NOW, OPERATOR.id, OPERATOR.phone]);
  const seller = await setupSeller(SELLER.id, {
    seller: { displayName: 'Words seller' },
    location: { name: 'Слова А', type: 'shop', addressText: 'Almaty A' },
  }, { database: db });
  return seller.locations[0]!.id;
}

const base = { productId: null, unit: { code: 'kg' }, pack: null, sellerComment: null, photoIds: [] };

async function card(title: string, point: string, hoursAgo: number) {
  const proposal = await createCardChangeSet(SELLER.id, cardCreateBodySchema.parse({ ...base, title, price: '1000', points: [{ locationId: point }] }), { database: db });
  await confirmSellerChangeSet(SELLER.id, proposal.id, { database: db, clock });
  const cardId = (await listOwnedOffers(SELLER.id, { database: db, clock })).find((offer) => offer.product.name === title)!.cardId;
  await pool.query('UPDATE offers SET last_confirmed_at=$1 WHERE card_id=$2', [ago(hoursAgo), cardId]);
  return cardId;
}

async function offerRow(cardId: string) {
  return (await pool.query('SELECT id, last_confirmed_at, revision, status FROM offers WHERE card_id=$1', [cardId])).rows[0] as { id: string; last_confirmed_at: Date; revision: number; status: string };
}

type Sent = { payload: { body: string } };
function fakeSender(result: PushResult = 'ok') {
  const sent: Sent[] = [];
  const send = async (_target: PushTarget, payload: string) => { sent.push({ payload: JSON.parse(payload) }); return result; };
  return { sent, send };
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('bulk confirmation, card by card', () => {
  it('confirms every card that can be confirmed, reports the rest and leaves them unchanged', async () => {
    const point = await prepare();
    const good = await card('Слова курага', point, 30);
    const second = await card('Слова изюм', point, 100);
    const off = await card('Слова сыр', point, 40);
    const removed = await card('Слова чай', point, 50);
    const off1 = await offerRow(off);
    await confirmSellerChangeSet(SELLER.id, (await createOfferManagementChangeSet(SELLER.id, off1.id, sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }), { database: db })).id, { database: db, clock });
    await pool.query('UPDATE offers SET last_confirmed_at=$1 WHERE card_id=$2', [ago(40), off]);
    await removeCard(OPERATOR.id, removed, { reason: 'other', comment: null }, { database: db });
    const offBefore = await offerRow(off);
    const removedBefore = await offerRow(removed);

    const result = await reconfirmCardsPerCard(SELLER.id, [good, second, off, removed, good], { database: db, clock });
    expect(result.confirmed.map((item) => item.cardId).sort()).toEqual([good, second].sort());
    expect(result.failed.map((item) => [item.cardId, item.code]).sort()).toEqual([[off, 'OFFER_ALREADY_INACTIVE'], [removed, 'CARD_REMOVED_BY_OPERATOR']].sort());
    // One ChangeSet per confirmed card, each a plain reconfirm_offer that remembers the time it replaced.
    expect(new Set(result.confirmed.map((item) => item.changeSetId)).size).toBe(2);
    const items = (await pool.query(
      'SELECT action, previous_confirmed_at FROM seller_change_items WHERE change_set_id = ANY($1::uuid[]) ORDER BY previous_confirmed_at',
      [result.confirmed.map((item) => item.changeSetId)],
    )).rows;
    expect(items.map((row) => row.action)).toEqual(['reconfirm_offer', 'reconfirm_offer']);
    expect(items.map((row) => (row.previous_confirmed_at as Date).toISOString())).toEqual([ago(100).toISOString(), ago(30).toISOString()]);
    expect((await offerRow(good)).last_confirmed_at.toISOString()).toBe(NOW.toISOString());
    expect(await offerRow(off)).toEqual(offBefore);
    expect(await offerRow(removed)).toEqual(removedBefore);

    // Nothing confirmable → nothing confirmed, every reason listed.
    const none = await reconfirmCardsPerCard(SELLER.id, [off, removed], { database: db, clock });
    expect(none.confirmed).toEqual([]);
    expect(none.failed).toHaveLength(2);
  });
});

describe('undo of a reconfirmation', () => {
  it('restores exactly the previous time, keeps the original ChangeSet and adds an undo ChangeSet', async () => {
    const point = await prepare();
    const first = await card('Слова мёд', point, 30);
    const second = await card('Слова рис', point, 60);
    const before = { first: await offerRow(first), second: await offerRow(second) };
    const bulk = await reconfirmCardsPerCard(SELLER.id, [first, second], { database: db, clock });
    const originals = bulk.confirmed.map((item) => item.changeSetId);
    const originalItems = (await pool.query('SELECT id, action, previous_confirmed_at FROM seller_change_items WHERE change_set_id = ANY($1::uuid[]) ORDER BY id', [originals])).rows;

    const undone = await undoReconfirmations(SELLER.id, originals, { database: db, clock: at(8_000) });
    expect(undone.failed).toEqual([]);
    expect(undone.undone).toHaveLength(2);
    const after = { first: await offerRow(first), second: await offerRow(second) };
    expect(after.first.last_confirmed_at.toISOString()).toBe(before.first.last_confirmed_at.toISOString());
    expect(after.second.last_confirmed_at.toISOString()).toBe(before.second.last_confirmed_at.toISOString());
    expect(after.first.revision).toBe(before.first.revision + 2);
    // Audit trail: the originals are untouched; two new confirmed ChangeSets carry the undo items.
    expect((await pool.query('SELECT id, action, previous_confirmed_at FROM seller_change_items WHERE change_set_id = ANY($1::uuid[]) ORDER BY id', [originals])).rows).toEqual(originalItems);
    expect((await pool.query("SELECT status FROM seller_change_sets WHERE id = ANY($1::uuid[])", [originals])).rows.map((row) => row.status)).toEqual(['confirmed', 'confirmed']);
    const undoItems = (await pool.query("SELECT i.action, i.previous_confirmed_at, s.status FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE i.action='undo_reconfirm_offer' AND s.seller_id=(SELECT id FROM sellers WHERE owner_user_id=$1)", [SELLER.id])).rows;
    expect(undoItems).toHaveLength(2);
    expect(undoItems.every((row) => row.status === 'confirmed')).toBe(true);
    // Buyer badge input is the restored time again.
    const listed = await listOwnedOffers(SELLER.id, { database: db, clock });
    expect(listed.find((offer) => offer.cardId === first)!.actuality).toMatchObject({ days: 1, due: true });
  });

  it('refuses after the window, twice, after a later change, for a non-reconfirmation and when it would hide the card', async () => {
    const point = await prepare();
    const late = await card('Слова хлеб', point, 30);
    const lateSet = (await reconfirmCardsPerCard(SELLER.id, [late], { database: db, clock })).confirmed[0]!.changeSetId;
    const expired = await undoReconfirmations(SELLER.id, [lateSet], { database: db, clock: at(UNDO_RECONFIRM_WINDOW_MS + 1) });
    expect(expired.failed.map((item) => item.code)).toEqual(['UNDO_WINDOW_EXPIRED']);
    expect((await offerRow(late)).last_confirmed_at.toISOString()).toBe(NOW.toISOString());
    // The window is inclusive of its last millisecond.
    expect((await undoReconfirmations(SELLER.id, [lateSet], { database: db, clock: at(UNDO_RECONFIRM_WINDOW_MS) })).undone).toHaveLength(1);
    expect((await undoReconfirmations(SELLER.id, [lateSet], { database: db, clock: at(UNDO_RECONFIRM_WINDOW_MS) })).failed.map((item) => item.code)).toEqual(['OFFER_CHANGED']);

    const edited = await card('Слова соль', point, 30);
    const editedSet = (await reconfirmCardsPerCard(SELLER.id, [edited], { database: db, clock })).confirmed[0]!.changeSetId;
    const current = await listOwnedOffers(SELLER.id, { database: db, clock });
    const proposal = await updateCardChangeSet(SELLER.id, edited, cardUpdateBodySchema.parse({
      ...base, title: 'Слова соль', price: '1100',
      offers: current.filter((offer) => offer.cardId === edited).map((offer) => ({ offerId: offer.id, revision: offer.revision, applyPrice: true })), addPoints: [],
    }), { database: db });
    await confirmSellerChangeSet(SELLER.id, proposal.id, { database: db, clock: at(1_000) });
    const refused = await undoReconfirmations(SELLER.id, [editedSet], { database: db, clock: at(2_000) });
    expect(refused.failed.map((item) => item.code)).toEqual(['OFFER_CHANGED']);

    const notReconfirm = (await pool.query("SELECT id FROM seller_change_sets WHERE seller_id=(SELECT id FROM sellers WHERE owner_user_id=$1) AND id NOT IN (SELECT change_set_id FROM seller_change_items WHERE action='reconfirm_offer') LIMIT 1", [SELLER.id])).rows[0].id as string;
    expect((await undoReconfirmations(SELLER.id, [notReconfirm], { database: db, clock: at(1_000) })).failed.map((item) => item.code)).toEqual(['CHANGE_SET_NOT_UNDOABLE']);

    // 167 h 59 min 55 s old when confirmed; ten seconds later an undo would put it past 168 h, so the confirmation stays.
    const edge = await card('Слова масло', point, 167 + 59 / 60 + 55 / 3600);
    const edgeSet = (await reconfirmCardsPerCard(SELLER.id, [edge], { database: db, clock })).confirmed[0]!.changeSetId;
    const hide = await undoReconfirmations(SELLER.id, [edgeSet], { database: db, clock: at(10_000) });
    expect(hide.failed.map((item) => item.code)).toEqual(['UNDO_WOULD_HIDE']);
    expect((await offerRow(edge)).last_confirmed_at.toISOString()).toBe(NOW.toISOString());
  });

  it('does not make the reminders send a moment again after undo (cycle keys)', async () => {
    const point = await prepare();
    await saveDeviceSubscription(SELLER.id, DEVICE, { database: db });
    const cardId = await card('Слова напоминание', point, 25);
    const first = fakeSender();
    expect(await runActualityReminders({ send: first.send, database: db, clock })).toMatchObject({ notified: 1 });
    const set = (await reconfirmCardsPerCard(SELLER.id, [cardId], { database: db, clock })).confirmed[0]!.changeSetId;
    await undoReconfirmations(SELLER.id, [set], { database: db, clock: at(3_000) });
    const again = fakeSender();
    expect(await runActualityReminders({ send: again.send, database: db, clock: at(4_000) })).toMatchObject({ notified: 0 });
    expect(again.sent).toEqual([]);
  });
});
