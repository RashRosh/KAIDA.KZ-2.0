import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { findPhotoAccess } from '../../src/modules/media/infrastructure/photos.repository';
import {
  loadOperatorCard,
  loadOperatorFeed,
  markOperatorFeedSeen,
  removeCard,
  restoreCard,
} from '../../src/modules/moderation/application/operator-post-check';
import { isOperator } from '../../src/modules/moderation/application/resolve-operator';
import { parseOperatorPhones } from '../../src/modules/moderation/config/operator-access.config';
import { CardRemovedByOperatorError, OperatorCardNotFoundError } from '../../src/modules/moderation/contracts/moderation.contract';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { resolveBuyerOfferRoute } from '../../src/modules/offers/application/resolve-buyer-offer-route';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { createCardChangeSet, updateCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { cardCreateBodySchema, cardUpdateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { OfferChangedError, sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// operator-post-check §7: removal hides the whole card on every buyer path, the Seller view, return, republish,
// stale ChangeSet, activation refusal, feed composition and «since last view», idempotent log, access by phone list.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-20T06:00:00.000Z');
const clock = () => T0;
const SELLER = { id: '74000000-0000-4000-8000-000000000001', phone: '+77010007401' };
const OPERATOR = { id: '74000000-0000-4000-8000-000000000002', phone: '+77010007402' };
const buyerLocation = { latitude: 43.25, longitude: 76.95 };
const read = { clock, validityPeriodHours: 168 };

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${SELLER.id}'`;
  await pool.query(`DELETE FROM offer_card_removals WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM operator_feed_marks WHERE user_id=$1', [OPERATOR.id]);
  await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE s.seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM photos WHERE owner_user_id=$1`, [SELLER.id]);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [SELLER.id]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[]) OR phone_e164 = ANY($2::text[])', [[SELLER.id, OPERATOR.id], [SELLER.phone, OPERATOR.phone]]);
}

async function prepare() {
  await cleanup();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3),($4,$5,$3)', [SELLER.id, SELLER.phone, T0, OPERATOR.id, OPERATOR.phone]);
  const seller = await setupSeller(SELLER.id, {
    seller: { displayName: 'Post-check seller' },
    location: { name: 'Постпроверка А', type: 'shop', addressText: 'Almaty A' },
  }, { database: db });
  const b = await createOwnedLocation(SELLER.id, { name: 'Постпроверка Б', type: 'shop', addressText: 'Almaty B' }, { database: db });
  const points = [seller.locations[0]!.id, b.id];
  await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95 WHERE id = ANY($1::uuid[])', [points]);
  return points;
}

const base = { productId: null, unit: { code: 'kg' }, pack: null, sellerComment: 'Свежая', photoIds: [] };

async function publishCard(title: string, points: string[]) {
  const proposal = await createCardChangeSet(SELLER.id, cardCreateBodySchema.parse({
    ...base, title, price: '3000', points: points.map((locationId) => ({ locationId })),
  }), { database: db });
  await confirmSellerChangeSet(SELLER.id, proposal.id, { database: db, clock });
  const offers = (await listOwnedOffers(SELLER.id, { database: db, clock })).filter((offer) => offer.product.name === title);
  return { cardId: offers[0]!.cardId, offers };
}

async function updateProposal(cardId: string, title: string) {
  const offers = (await listOwnedOffers(SELLER.id, { database: db, clock })).filter((offer) => offer.cardId === cardId);
  return updateCardChangeSet(SELLER.id, cardId, cardUpdateBodySchema.parse({
    ...base, title, price: '3100',
    offers: offers.map((offer) => ({ offerId: offer.id, revision: offer.revision, applyPrice: true })),
    addPoints: [],
  }), { database: db });
}

async function buyerSees(word: string, offerIds: string[]) {
  const search = (await searchOffers(word, db, read)).offers.map((offer) => offer.id);
  const nearby = (await findNearbyOffers(buyerLocation, db, read)).offers.map((offer) => offer.id);
  const pages = await Promise.all(offerIds.map((id) => resolveBuyerOfferRoute(id, { database: db, ...read })));
  return {
    search: offerIds.filter((id) => search.includes(id)).length,
    nearby: offerIds.filter((id) => nearby.includes(id)).length,
    pages: pages.filter((page) => page !== null).length,
  };
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

describe('operator access', () => {
  it('only listed login phones are operators; a malformed list fails loudly', () => {
    const phones = parseOperatorPhones(' +7 701 000 74 02 , 87010007403');
    expect([...phones]).toEqual(['+77010007402', '+77010007403']);
    expect(isOperator({ id: OPERATOR.id, phoneE164: OPERATOR.phone }, phones)).toBe(true);
    expect(isOperator({ id: SELLER.id, phoneE164: SELLER.phone }, phones)).toBe(false);
    expect(isOperator(null, phones)).toBe(false);
    expect(parseOperatorPhones(undefined).size).toBe(0);
    expect(() => parseOperatorPhones('+7701,abc')).toThrow();
  });
});

describe('removal, return and republish', () => {
  it('removes the whole card on every buyer path, shows the reason to the Seller and returns it', async () => {
    const points = await prepare();
    const { cardId, offers } = await publishCard('Постпроверка курага', points);
    const ids = offers.map((offer) => offer.id);
    expect(await buyerSees('постпроверка', ids)).toEqual({ search: 2, nearby: 2, pages: 2 });

    const removed = await removeCard(OPERATOR.id, cardId, { reason: 'photo_mismatch', comment: 'На фото другой товар' }, { database: db });
    expect(removed.removal).toMatchObject({ reason: 'photo_mismatch', comment: 'На фото другой товар' });
    expect(await buyerSees('постпроверка', ids)).toEqual({ search: 0, nearby: 0, pages: 0 });

    const seller = await listOwnedOffers(SELLER.id, { database: db, clock });
    expect(seller.every((offer) => offer.removal?.reason === 'photo_mismatch' && !offer.buyerVisible)).toBe(true);

    // A second tap is a no-op: still one log row.
    await removeCard(OPERATOR.id, cardId, { reason: 'other', comment: null }, { database: db });
    const log = await pool.query('SELECT reason, removed_by_user_id FROM offer_card_removals WHERE card_id=$1', [cardId]);
    expect(log.rows).toEqual([{ reason: 'photo_mismatch', removed_by_user_id: OPERATOR.id }]);

    const returned = await restoreCard(OPERATOR.id, cardId, { database: db });
    expect(returned.removal).toBeNull();
    await restoreCard(OPERATOR.id, cardId, { database: db });
    expect(await buyerSees('постпроверка', ids)).toEqual({ search: 2, nearby: 2, pages: 2 });
    const after = await pool.query('SELECT restored_by_user_id, restored_at IS NOT NULL AS restored FROM offer_card_removals WHERE card_id=$1', [cardId]);
    expect(after.rows).toEqual([{ restored_by_user_id: OPERATOR.id, restored: true }]);
  });

  it('refuses switching a removed card on; a stale ChangeSet is refused; a new one republishes the card', async () => {
    const points = await prepare();
    const { cardId, offers } = await publishCard('Постпроверка энергетик', points);
    const stale = await updateProposal(cardId, 'Постпроверка энергетик старый');
    const off = await createOfferManagementChangeSet(SELLER.id, offers[0]!.id, sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }), { database: db });
    await confirmSellerChangeSet(SELLER.id, off.id, { database: db, clock });

    await removeCard(OPERATOR.id, cardId, { reason: 'prohibited_item', comment: null }, { database: db });

    await expect(createOfferManagementChangeSet(SELLER.id, offers[0]!.id, sellerOfferChangeBodySchema.parse({ action: 'activate_offer' }), { database: db }))
      .rejects.toBeInstanceOf(CardRemovedByOperatorError);
    await expect(confirmSellerChangeSet(SELLER.id, stale.id, { database: db, clock })).rejects.toBeInstanceOf(OfferChangedError);

    const fixed = await updateProposal(cardId, 'Постпроверка лимонад');
    await confirmSellerChangeSet(SELLER.id, fixed.id, { database: db, clock });
    const seller = (await listOwnedOffers(SELLER.id, { database: db, clock })).filter((offer) => offer.cardId === cardId);
    expect(seller.every((offer) => offer.removal === null)).toBe(true);
    expect((await searchOffers('лимонад', db, read)).offers.filter((offer) => offer.product.name === 'Постпроверка лимонад')).toHaveLength(1);
    const log = await pool.query('SELECT cleared_by_change_set_id FROM offer_card_removals WHERE card_id=$1', [cardId]);
    expect(log.rows).toEqual([{ cleared_by_change_set_id: fixed.id }]);

    const feed = await loadOperatorFeed(OPERATOR.id, { tab: 'all', offset: 0 }, { database: db });
    const kinds = feed.rows.filter((row) => row.cardId === cardId).map((row) => row.kind);
    expect(kinds).toContain('republished');
    expect(kinds).toContain('new');
  });

  it('hides photos of a removed card from the public; the card screen shows every point', async () => {
    const points = await prepare();
    const { cardId, offers } = await publishCard('Постпроверка сыр', points);
    const photo = await pool.query('INSERT INTO photos (owner_user_id, width, height) VALUES ($1, 10, 10) RETURNING id', [SELLER.id]);
    const photoId = photo.rows[0].id as string;
    for (const offer of offers) await pool.query('INSERT INTO offer_photos (offer_id, photo_id, position) VALUES ($1,$2,0)', [offer.id, photoId]);
    expect((await findPhotoAccess(db, photoId))?.publicViaActiveOffer).toBe(true);

    await removeCard(OPERATOR.id, cardId, { reason: 'contacts_or_ads', comment: null }, { database: db });
    const access = await findPhotoAccess(db, photoId);
    expect(access?.publicViaActiveOffer).toBe(false);
    expect(access?.attachedToOffer).toBe(true);

    const card = await loadOperatorCard(cardId, { database: db });
    expect(card.points.map((point) => point.name)).toEqual(['Постпроверка А', 'Постпроверка Б']);
    expect(card.sellerPhone).toBe('+7 701 ··· 01');
    expect(card.photoIds).toEqual([photoId]);
    await expect(loadOperatorCard('74000000-0000-4000-8000-0000000000ff', { database: db })).rejects.toBeInstanceOf(OperatorCardNotFoundError);
  });
});

describe('feed', () => {
  it('lists new and changed cards newest first and counts events after the last view', async () => {
    const points = await prepare();
    const first = await publishCard('Постпроверка мёд', [points[0]!]);
    const changed = await updateProposal(first.cardId, 'Постпроверка мёд горный');
    await confirmSellerChangeSet(SELLER.id, changed.id, { database: db, clock: () => new Date(T0.getTime() + 60_000) });

    const all = await loadOperatorFeed(OPERATOR.id, { tab: 'all', offset: 0 }, { database: db });
    const mine = all.rows.filter((row) => row.cardId === first.cardId);
    expect(mine.map((row) => row.kind)).toEqual(['changed', 'new']);
    expect(mine[0]).toMatchObject({ title: 'Постпроверка мёд горный', pointName: 'Постпроверка А', morePoints: 0, sellerPhone: '+7 701 ··· 01' });
    expect(all.seenUntil).toBeNull();

    await markOperatorFeedSeen(OPERATOR.id, new Date(T0.getTime() + 60_000), { database: db });
    const fresh = await loadOperatorFeed(OPERATOR.id, { tab: 'new', offset: 0 }, { database: db });
    expect(fresh.rows.filter((row) => row.cardId === first.cardId)).toEqual([]);
    expect(fresh.seenUntil).toBe(new Date(T0.getTime() + 60_000).toISOString());

    // The mark never moves back.
    await markOperatorFeedSeen(OPERATOR.id, T0, { database: db });
    expect((await loadOperatorFeed(OPERATOR.id, { tab: 'new', offset: 0 }, { database: db })).seenUntil)
      .toBe(new Date(T0.getTime() + 60_000).toISOString());
  });
});
