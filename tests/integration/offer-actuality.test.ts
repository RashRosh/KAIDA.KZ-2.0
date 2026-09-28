import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { removeCard } from '../../src/modules/moderation/application/operator-post-check';
import { CardRemovedByOperatorError } from '../../src/modules/moderation/contracts/moderation.contract';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { createCardChangeSet, updateCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { reconfirmCards } from '../../src/modules/seller-input/application/reconfirm-actuality';
import { cardCreateBodySchema, cardUpdateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { OfferAlreadyInactiveError, OfferChangedError, sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// offer-actuality §7: reconfirm (single, mass, stale, refused), buyer tiers and the 7-day ceiling in Search and
// Nearby, archive derivation for the Seller — all with one deterministic clock.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const H = 60 * 60 * 1000;
const NOW = new Date('2026-09-20T12:00:00.000Z');
const clock = () => NOW;
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);
const SELLER = { id: '75000000-0000-4000-8000-000000000001', phone: '+77010007501' };
const OPERATOR = { id: '75000000-0000-4000-8000-000000000002', phone: '+77010007502' };
const read = { clock, validityPeriodHours: 168 };
const buyer = { latitude: 43.25, longitude: 76.95 };

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${SELLER.id}'`;
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
    seller: { displayName: 'Actuality seller' },
    location: { name: 'Актуальность А', type: 'shop', addressText: 'Almaty A' },
  }, { database: db });
  const b = await createOwnedLocation(SELLER.id, { name: 'Актуальность Б', type: 'shop', addressText: 'Almaty B' }, { database: db });
  const points = [seller.locations[0]!.id, b.id];
  await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95 WHERE id=$1', [points[0]]);
  await pool.query('UPDATE locations SET latitude=43.30, longitude=76.95 WHERE id=$1', [points[1]]);
  return points;
}

const base = { productId: null, unit: { code: 'kg' }, pack: null, sellerComment: null, photoIds: [] };

// Publishes a card and moves its confirmation back by `hoursAgo`.
async function card(title: string, points: string[], hoursAgo: number) {
  const proposal = await createCardChangeSet(SELLER.id, cardCreateBodySchema.parse({
    ...base, title, price: '1000', points: points.map((locationId) => ({ locationId })),
  }), { database: db });
  await confirmSellerChangeSet(SELLER.id, proposal.id, { database: db, clock });
  const offers = (await listOwnedOffers(SELLER.id, { database: db, clock })).filter((offer) => offer.product.name === title);
  await pool.query('UPDATE offers SET last_confirmed_at=$1 WHERE card_id=$2', [ago(hoursAgo), offers[0]!.cardId]);
  return offers[0]!.cardId;
}

async function sellerCard(cardId: string) {
  return (await listOwnedOffers(SELLER.id, { database: db, clock })).filter((offer) => offer.cardId === cardId);
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

describe('buyer side', () => {
  it('shows fresh before ageing in Search and Nearby, with badges, and nothing from 168 h on', async () => {
    const points = await prepare();
    await card('Актуальность мёд свежий', [points[1]!], 1);
    await card('Актуальность мёд старый', [points[0]!], 60);
    await card('Актуальность мёд скрытый', [points[0]!], 168);
    await card('Актуальность мёд почти', [points[0]!], 168 - 1 / 60);

    const search = (await searchOffers('Актуальность', db, { ...read, buyerLocation: buyer })).offers;
    expect(search.map((offer) => [offer.product.name, offer.actuality])).toEqual([
      ['Актуальность мёд свежий', { days: 0, ageing: false }],
      ['Актуальность мёд старый', { days: 2, ageing: true }],
      ['Актуальность мёд почти', { days: 6, ageing: true }],
    ]);

    const nearby = (await findNearbyOffers(buyer, db, { ...read, nearbyRadiusMeters: 20_000 })).offers
      .filter((offer) => offer.product.name.startsWith('Актуальность'));
    expect(nearby.map((offer) => offer.product.name)).toEqual(['Актуальность мёд свежий', 'Актуальность мёд старый', 'Актуальность мёд почти']);
    expect(nearby[0]!.actuality).toEqual({ days: 0, ageing: false });
  });
});

describe('seller side', () => {
  it('derives due / hidden / archived per point and reconfirms one card or many at once', async () => {
    const points = await prepare();
    const due = await card('Актуальность курага', points, 30);
    const hidden = await card('Актуальность айран', [points[0]!], 200);
    const archived = await card('Актуальность изюм', [points[0]!], 336);

    expect((await sellerCard(due)).map((offer) => offer.actuality)).toEqual([
      { days: 1, stage: 'fresh', due: true }, { days: 1, stage: 'fresh', due: true },
    ]);
    expect((await sellerCard(hidden))[0]!.actuality).toEqual({ days: 8, stage: 'hidden', due: true });
    expect((await sellerCard(archived))[0]!.actuality).toEqual({ days: 14, stage: 'archived', due: true });

    const confirmed = await reconfirmCards(SELLER.id, [due], { database: db, clock });
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.items.map((item) => item.action)).toEqual(['reconfirm_offer', 'reconfirm_offer']);
    expect((await sellerCard(due)).every((offer) => offer.actuality.days === 0 && offer.lastConfirmedAt === NOW.toISOString())).toBe(true);

    await reconfirmCards(SELLER.id, [hidden, archived], { database: db, clock });
    expect((await sellerCard(hidden))[0]!.actuality.stage).toBe('fresh');
    expect((await sellerCard(archived))[0]!.actuality.stage).toBe('fresh');
    expect((await searchOffers('изюм', db, read)).offers.map((offer) => offer.product.name)).toEqual(['Актуальность изюм']);
  });

  it('refuses switched-off and removed cards; a stale edit after reconfirm is refused', async () => {
    const points = await prepare();
    const off = await card('Актуальность сыр', [points[0]!], 30);
    const offer = (await sellerCard(off))[0]!;
    const proposal = await createOfferManagementChangeSet(SELLER.id, offer.id, sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }), { database: db });
    await confirmSellerChangeSet(SELLER.id, proposal.id, { database: db, clock });
    await expect(reconfirmCards(SELLER.id, [off], { database: db, clock })).rejects.toBeInstanceOf(OfferAlreadyInactiveError);

    const removed = await card('Актуальность чай', [points[0]!], 30);
    await removeCard(OPERATOR.id, removed, { reason: 'other', comment: null }, { database: db });
    await expect(reconfirmCards(SELLER.id, [removed], { database: db, clock })).rejects.toBeInstanceOf(CardRemovedByOperatorError);

    const edited = await card('Актуальность хлеб', [points[0]!], 30);
    const before = await sellerCard(edited);
    const stale = await updateCardChangeSet(SELLER.id, edited, cardUpdateBodySchema.parse({
      ...base, title: 'Актуальность хлеб ржаной', price: '1100',
      offers: before.map((item) => ({ offerId: item.id, revision: item.revision, applyPrice: true })), addPoints: [],
    }), { database: db });
    await reconfirmCards(SELLER.id, [edited], { database: db, clock });
    await expect(confirmSellerChangeSet(SELLER.id, stale.id, { database: db, clock })).rejects.toBeInstanceOf(OfferChangedError);
  });
});
