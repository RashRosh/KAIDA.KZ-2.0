import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { createCardChangeSet, pointPriceChangeSet, updateCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { reconfirmCards } from '../../src/modules/seller-input/application/reconfirm-actuality';
import {
  cardCreateBodySchema,
  cardUpdateBodySchema,
  pointPriceBodySchema,
  WholesaleReviewRequiredError,
} from '../../src/modules/seller-input/contracts/seller-card.contract';
import { sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// wholesale-price §9 (integration): the DB rule, ChangeSet create / edit / remove of the wholesale line, the refused unit
// change without a new wholesale block, reconfirmation and price-only paths keeping it, and the buyer DTO.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-11-24T06:00:00.000Z');
const clock = () => T0;
const OWNER = { id: '74000000-0000-4000-8000-000000000001', phone: '+77010007401' };
const NBSP = ' ';
const plain = (text: string | undefined) => text?.replaceAll(NBSP, ' ');

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${OWNER.id}'`;
  await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE s.seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM sellers WHERE owner_user_id=$1`, [OWNER.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [OWNER.id, OWNER.phone]);
}

async function sellerWithPoints(label: string) {
  await cleanup();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [OWNER.id, OWNER.phone, T0]);
  const seller = await setupSeller(OWNER.id, {
    seller: { displayName: `Wholesale ${label}` },
    location: { name: `${label} A`, type: 'shop', addressText: `Almaty ${label} A` },
  }, { database: db });
  const b = await createOwnedLocation(OWNER.id, { name: `${label} B`, type: 'shop', addressText: `Almaty ${label} B` }, { database: db });
  const ids = [seller.locations[0]!.id, b.id];
  await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95 WHERE id = ANY($1::uuid[])', [ids]);
  return ids;
}

const box = { amount: '650', batchCount: 1, container: 'box', perContainer: '10' };
const card = { productId: null, unit: { code: 'kg' }, pack: null, sellerComment: 'Свежий', photoIds: [], price: '900' };

async function publish(body: unknown) {
  const proposal = await createCardChangeSet(OWNER.id, cardCreateBodySchema.parse(body), { database: db });
  return confirmSellerChangeSet(OWNER.id, proposal.id, { database: db, clock });
}

async function offers() {
  return (await listOwnedOffers(OWNER.id, { database: db, clock })).sort((a, b) => a.location.name.localeCompare(b.location.name));
}

async function edit(body: Record<string, unknown>) {
  const current = await offers();
  const update = cardUpdateBodySchema.parse({
    ...card,
    title: current[0]!.product.name,
    offers: current.map((offer) => ({ offerId: offer.id, revision: offer.revision, applyPrice: !offer.priceOwn })),
    addPoints: [],
    ...body,
  });
  return updateCardChangeSet(OWNER.id, current[0]!.cardId, update, { database: db });
}

async function found(title: string) {
  return (await searchOffers(title, db, { clock, validityPeriodHours: 168 })).offers.filter((offer) => offer.product.name === title);
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

describe('wholesale price of a card', () => {
  it('is published for every point of the card and shown to buyers with the batch line', async () => {
    const [a, b] = await sellerWithPoints('pub');
    await publish({ ...card, title: 'Перец оптовый', points: [{ locationId: a }, { locationId: b, ownPrice: '950' }], wholesale: box });

    const owned = await offers();
    expect(owned.map((offer) => offer.wholesale && { ...offer.wholesale, batch: plain(offer.wholesale.batch) })).toEqual([
      { amount: '650', batchCount: 1, container: 'box', containerText: null, perContainer: '10', batch: 'от 1 ящика (≈ 10 кг)' },
      { amount: '650', batchCount: 1, container: 'box', containerText: null, perContainer: '10', batch: 'от 1 ящика (≈ 10 кг)' },
    ]);

    const buyer = await found('Перец оптовый');
    expect(buyer).toHaveLength(2);
    expect(buyer.map((offer) => [offer.price?.amount, offer.wholesale?.amount, offer.wholesale?.currency, plain(offer.wholesale?.batch)]))
      .toEqual(expect.arrayContaining([['900', '650', 'KZT', 'от 1 ящика (≈ 10 кг)'], ['950', '650', 'KZT', 'от 1 ящика (≈ 10 кг)']]));
  });

  it('a card without wholesale keeps the old buyer DTO shape (no wholesale key)', async () => {
    const [a] = await sellerWithPoints('none');
    await publish({ ...card, title: 'Перец розничный', points: [{ locationId: a }] });
    const [offer] = await found('Перец розничный');
    expect(offer).toBeDefined();
    expect('wholesale' in offer!).toBe(false);
    expect((await offers())[0]!.wholesale).toBeNull();
  });

  it('is changed and removed through the card edit; the proposal shows the old and new line', async () => {
    const [a, b] = await sellerWithPoints('edit');
    await publish({ ...card, title: 'Лук оптовый', points: [{ locationId: a }, { locationId: b }], wholesale: box });

    const changed = await edit({ wholesale: { amount: '500', batchCount: 3, container: 'other', containerText: 'сетка-мешок', perContainer: '25' } });
    expect(plain(changed.items[0]!.previousWholesale?.batch)).toBe('от 1 ящика (≈ 10 кг)');
    expect(plain(changed.items[0]!.wholesale?.batch)).toBe('от 3 × сетка-мешок (≈ 75 кг)');
    await confirmSellerChangeSet(OWNER.id, changed.id, { database: db, clock });
    expect((await offers()).map((offer) => offer.wholesale?.amount)).toEqual(['500', '500']);

    // Omitted keeps the card's wholesale when the unit and pack stay.
    const commentOnly = await edit({ sellerComment: 'Сладкий' });
    expect(commentOnly.items.every((item) => item.wholesale?.amount === '500')).toBe(true);
    await confirmSellerChangeSet(OWNER.id, commentOnly.id, { database: db, clock });

    const removed = await edit({ wholesale: null });
    await confirmSellerChangeSet(OWNER.id, removed.id, { database: db, clock });
    expect((await offers()).map((offer) => offer.wholesale)).toEqual([null, null]);
    expect((await found('Лук оптовый')).some((offer) => offer.wholesale)).toBe(false);
  });

  it('a unit change without a new wholesale block is refused; with one it is accepted', async () => {
    const [a] = await sellerWithPoints('unit');
    await publish({ ...card, title: 'Яблоки оптовые', points: [{ locationId: a }], wholesale: box });

    await expect(edit({ unit: { code: 'piece' } })).rejects.toBeInstanceOf(WholesaleReviewRequiredError);
    await expect(edit({ unit: { code: 'package' }, pack: { amount: '1', unit: 'kg' } })).rejects.toBeInstanceOf(WholesaleReviewRequiredError);
    const [offer] = await offers();
    await expect(createOfferManagementChangeSet(OWNER.id, offer!.id, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '900', unit: { code: 'piece' } }, sellerComment: 'Свежий',
    }), { database: db })).rejects.toBeInstanceOf(WholesaleReviewRequiredError);

    const reviewed = await edit({ unit: { code: 'piece' }, wholesale: { amount: '60', batchCount: 1, container: 'box', perContainer: '80' } });
    await confirmSellerChangeSet(OWNER.id, reviewed.id, { database: db, clock });
    const [after] = await offers();
    expect(after!.price?.unitChoice).toEqual({ code: 'piece' });
    expect(plain(after!.wholesale?.batch)).toBe('от 1 ящика (≈ 80 шт)');
  });

  it('reconfirmation, a per-point price and a price-only per-Offer change keep the wholesale', async () => {
    const [a, b] = await sellerWithPoints('keep');
    await publish({ ...card, title: 'Груши оптовые', points: [{ locationId: a }, { locationId: b }], wholesale: box });
    const before = await offers();

    const later = new Date(T0.getTime() + 3 * 24 * 3600 * 1000);
    await reconfirmCards(OWNER.id, [before[0]!.cardId], { database: db, clock: () => later });
    const reconfirmed = await offers();
    expect(reconfirmed.map((offer) => offer.wholesale?.amount)).toEqual(['650', '650']);

    const point = await pointPriceChangeSet(OWNER.id, reconfirmed[0]!.id, pointPriceBodySchema.parse({ revision: reconfirmed[0]!.revision, price: '880' }), { database: db });
    await confirmSellerChangeSet(OWNER.id, point.id, { database: db, clock });
    const pointed = await offers();
    expect(pointed.map((offer) => [offer.price?.amount, offer.wholesale?.amount])).toEqual([['880', '650'], ['900', '650']]);

    const priceOnly = await createOfferManagementChangeSet(OWNER.id, pointed[1]!.id, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '910', unit: { code: 'kg' } }, sellerComment: 'Свежий',
    }), { database: db });
    await confirmSellerChangeSet(OWNER.id, priceOnly.id, { database: db, clock });
    expect((await offers()).map((offer) => [offer.price?.amount, offer.wholesale?.amount, offer.wholesale?.perContainer]))
      .toEqual([['880', '650', '10'], ['910', '650', '10']]);
  });

  it('the database refuses an inconsistent wholesale line and a line without a unit', async () => {
    const [a] = await sellerWithPoints('db');
    await publish({ ...card, title: 'Морковь оптовая', points: [{ locationId: a }] });
    const [offer] = await offers();
    const set = (sql: string) => pool.query(`UPDATE offers SET ${sql} WHERE id=$1`, [offer!.id]);

    await expect(set("wholesale_price_amount=650")).rejects.toThrow(/offers_wholesale_valid/);
    await expect(set("wholesale_price_amount=650, wholesale_batch_count=1, wholesale_container='box'")).rejects.toThrow(/offers_wholesale_valid/);
    await expect(set("wholesale_price_amount=650, wholesale_batch_count=1, wholesale_container='unit', wholesale_per_container=2")).rejects.toThrow(/offers_wholesale_valid/);
    await expect(set("wholesale_price_amount=650, wholesale_batch_count=10000, wholesale_container='unit'")).rejects.toThrow(/offers_wholesale_valid/);
    await expect(set("wholesale_price_amount=650, wholesale_batch_count=1, wholesale_container='other', wholesale_per_container=2")).rejects.toThrow(/offers_wholesale_valid/);
    await expect(set("wholesale_price_amount=0, wholesale_batch_count=1, wholesale_container='unit'")).rejects.toThrow(/offers_wholesale_valid/);
    await expect(set("price_unit_code=NULL, wholesale_price_amount=650, wholesale_batch_count=1, wholesale_container='unit'")).rejects.toThrow();
    await set("wholesale_price_amount=650, wholesale_batch_count=1, wholesale_container='unit'");
    expect((await offers())[0]!.wholesale?.container).toBe('unit');
  });
});
