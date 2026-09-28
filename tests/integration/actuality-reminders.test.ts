import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { removeDeviceSubscription, saveDeviceSubscription } from '../../src/modules/reminders/application/device-subscriptions';
import { runActualityReminders, type PushResult, type PushTarget } from '../../src/modules/reminders/application/run-actuality-reminders';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { reconfirmCards } from '../../src/modules/seller-input/application/reconfirm-actuality';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// actuality-reminders §7: the job with a fake push sender — once per moment and cycle, grouped per Seller, quiet
// hours, gone and failed deliveries, concurrent runs; device subscriptions.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const H = 60 * 60 * 1000;
// 12:00 in Almaty (UTC+5): outside quiet hours.
const NOW = new Date('2026-09-20T07:00:00.000Z');
const clock = () => NOW;
const SELLER = { id: '76000000-0000-4000-8000-000000000001', phone: '+77010007601' };
const DEVICE = { endpoint: 'https://push.example.test/device-1', p256dh: 'p256dh-key', auth: 'auth-key' };

type Sent = { target: PushTarget; payload: { title: string; body: string; url: string } };

function fakeSender(result: PushResult = 'ok') {
  const sent: Sent[] = [];
  const send = async (target: PushTarget, payload: string) => {
    sent.push({ target, payload: JSON.parse(payload) });
    return result;
  };
  return { sent, send };
}

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${SELLER.id}'`;
  await pool.query(`DELETE FROM actuality_reminders_sent WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1', [SELLER.id]);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [SELLER.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [SELLER.id, SELLER.phone]);
}

async function prepare() {
  await cleanup();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [SELLER.id, SELLER.phone, NOW]);
  const seller = await setupSeller(SELLER.id, {
    seller: { displayName: 'Reminder seller' },
    location: { name: 'Напоминание А', type: 'shop', addressText: 'Almaty A' },
  }, { database: db });
  return seller.locations[0]!.id;
}

async function card(title: string, point: string, hoursAgo: number) {
  const proposal = await createCardChangeSet(SELLER.id, cardCreateBodySchema.parse({
    productId: null, unit: { code: 'kg' }, pack: null, sellerComment: null, photoIds: [],
    title, price: '1000', points: [{ locationId: point }],
  }), { database: db });
  await confirmSellerChangeSet(SELLER.id, proposal.id, { database: db, clock });
  const cardId = (await listOwnedOffers(SELLER.id, { database: db, clock })).find((offer) => offer.product.name === title)!.cardId;
  await pool.query('UPDATE offers SET last_confirmed_at=$1 WHERE card_id=$2', [new Date(NOW.getTime() - hoursAgo * H), cardId]);
  return cardId;
}

const run = (send: ReturnType<typeof fakeSender>['send'], at: Date = NOW) =>
  runActualityReminders({ send, database: db, clock: () => at });

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('reminder job', () => {
  it('sends one grouped reminder per moment, never twice, and again only after a new confirmation', async () => {
    const point = await prepare();
    await saveDeviceSubscription(SELLER.id, DEVICE, { database: db });
    const first = await card('Напоминание мёд', point, 25);
    await card('Напоминание сыр', point, 30);
    await card('Напоминание чай', point, 23);
    await card('Напоминание рис', point, 50);
    await card('Напоминание соль', point, 145);

    const fake = fakeSender();
    expect(await run(fake.send)).toEqual({ skipped: null, notified: 2, points: 3 });
    expect(fake.sent.map((item) => item.payload)).toEqual([
      { title: 'Подтвердите актуальность', body: 'Иначе завтра карточки опустятся в поиске · 2 карточки', url: '/seller?actuality=1' },
      { title: 'Завтра карточки пропадут из поиска', body: 'Подтвердите актуальность · 1 карточка', url: '/seller?actuality=1' },
    ]);
    expect(fake.sent[0]!.target).toEqual(DEVICE);

    const again = fakeSender();
    expect(await run(again.send)).toMatchObject({ notified: 0 });
    expect(again.sent).toEqual([]);

    // A confirmation starts a new cycle: 25 h after it the reminder comes again.
    await reconfirmCards(SELLER.id, [first], { database: db, clock });
    const later = fakeSender();
    await run(later.send, new Date(NOW.getTime() + 25 * H));
    expect(later.sent.map((item) => item.payload.body)).toContain('Иначе завтра карточки опустятся в поиске · 1 карточка');
  });

  it('keeps quiet at night, skips Sellers without devices and retries a failed delivery', async () => {
    const point = await prepare();
    await card('Напоминание хлеб', point, 25);

    const night = fakeSender();
    expect(await run(night.send, new Date('2026-09-20T17:00:00.000Z'))).toMatchObject({ skipped: 'quiet' });
    expect(night.sent).toEqual([]);

    const noDevice = fakeSender();
    expect(await run(noDevice.send)).toMatchObject({ notified: 0 });

    await saveDeviceSubscription(SELLER.id, DEVICE, { database: db });
    const failing = fakeSender('failed');
    expect(await run(failing.send)).toMatchObject({ notified: 0 });
    expect(failing.sent).toHaveLength(1);
    const retry = fakeSender();
    expect(await run(retry.send)).toMatchObject({ notified: 1 });
  });

  it('deletes a subscription the push service reports gone; concurrent runs send once', async () => {
    const point = await prepare();
    await card('Напоминание масло', point, 25);
    await saveDeviceSubscription(SELLER.id, DEVICE, { database: db });

    const gone = fakeSender('gone');
    await run(gone.send);
    expect((await pool.query('SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id=$1', [SELLER.id])).rows[0].n).toBe(0);

    await saveDeviceSubscription(SELLER.id, DEVICE, { database: db });
    const shared = fakeSender();
    const results = await Promise.all([run(shared.send), run(shared.send), run(shared.send)]);
    expect(shared.sent).toHaveLength(1);
    expect(results.reduce((sum, result) => sum + result.notified, 0)).toBe(1);
  });
});

describe('device subscriptions', () => {
  it('moves a device to the login that enabled it last and removes only the own device', async () => {
    await prepare();
    await saveDeviceSubscription(SELLER.id, DEVICE, { database: db });
    await saveDeviceSubscription(SELLER.id, { ...DEVICE, auth: 'new-auth' }, { database: db });
    const rows = await pool.query('SELECT auth FROM push_subscriptions WHERE endpoint=$1', [DEVICE.endpoint]);
    expect(rows.rows).toEqual([{ auth: 'new-auth' }]);
    await removeDeviceSubscription('76000000-0000-4000-8000-0000000000ff', DEVICE.endpoint, { database: db });
    expect((await pool.query('SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint=$1', [DEVICE.endpoint])).rows[0].n).toBe(1);
    await removeDeviceSubscription(SELLER.id, DEVICE.endpoint, { database: db });
    expect((await pool.query('SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint=$1', [DEVICE.endpoint])).rows[0].n).toBe(0);
  });
});
