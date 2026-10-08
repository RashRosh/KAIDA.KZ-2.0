import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { buildCardPreview, isPreviewOfferId } from '../../src/modules/seller-input/application/card-preview';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import { cardPreviewBodySchema } from '../../src/modules/seller-input/contracts/card-preview.contract';
import { LocationNotFoundError, OfferNotFoundError, SellerRequiredError, sellerChangeSetCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { getBuyerOffer } from '../../src/modules/search/application/get-buyer-offer';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// pre-publication-buyer-preview (contract rev 1 §3.3, §3.10, §6): the preview is the buyer's own projection, built read-only from
// the editor values, available only for the Seller's own points, Offers and photos.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-12T00:00:00.000Z');
const T1 = new Date('2026-09-12T01:00:00.000Z');
const OWNER = '50000000-0000-4000-8000-000000000a01';
const OTHER = '50000000-0000-4000-8000-000000000a02';
const OWNER_PHONE = '+77000000a01'.replace('a', '9');
const OTHER_PHONE = '+77000000a02'.replace('a', '9');

async function cleanup(userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function fixture(userId: string, phone: string, label: string) {
  await cleanup(userId, phone);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);
  const seller = await setupSeller(userId, {
    seller: { displayName: `Preview Seller ${label}` },
    location: { name: `Preview Point ${label}`, type: 'shop', addressText: `Almaty Preview ${label}` },
  }, { database: db });
  await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [seller.id, phone]);
  await pool.query('UPDATE locations SET latitude=$2,longitude=$3 WHERE id=$1', [seller.locations[0]!.id, 43.2, 76.9]);
  return seller;
}

async function counts() {
  const one = async (sql: string) => Number((await pool.query(sql)).rows[0].count);
  return {
    offers: await one('SELECT count(*) FROM offers'),
    changeSets: await one('SELECT count(*) FROM seller_change_sets'),
    photos: await one('SELECT count(*) FROM photos'),
    products: await one('SELECT count(*) FROM products'),
    events: await one('SELECT count(*) FROM search_events'),
  };
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup(OWNER, OWNER_PHONE);
  await cleanup(OTHER, OTHER_PHONE);
  await pool.end();
});

describe('pre-publication buyer preview', () => {
  it('builds the buyer page of a card that is not published, without writing anything', async () => {
    const seller = await fixture(OWNER, OWNER_PHONE, 'a');
    const before = await counts();
    const pages = await buildCardPreview(OWNER, cardPreviewBodySchema.parse({
      kind: 'create',
      title: 'Баранина, лопатка',
      price: '4200',
      unit: { code: 'kg' },
      pack: null,
      sellerComment: 'Свежая, вчерашний забой',
      photoIds: [],
      points: [{ locationId: seller.locations[0]!.id }],
    }), { database: db, clock: () => T1 });

    expect(pages).toHaveLength(1);
    const { offer } = pages[0]!;
    expect(offer.product.name).toBe('Баранина, лопатка');
    expect(offer.price).toMatchObject({ amount: '4200.00', unit: 'кг' });
    expect(offer.sellerComment).toBe('Свежая, вчерашний забой');
    expect(offer.location.id).toBe(seller.locations[0]!.id);
    expect(isPreviewOfferId(offer.id)).toBe(true);
    expect(offer.photos).toEqual([]);
    expect(await counts()).toEqual(before);
  });

  it('a synthetic preview id is not a real offer: the buyer page cannot open it', async () => {
    expect(isPreviewOfferId('preview:0')).toBe(true);
    expect(isPreviewOfferId('00000000-0000-4000-8000-000000000001')).toBe(false);
    // the Offer page opens only uuids, and a preview id is never one
    expect(z.uuid().safeParse('preview:0').success).toBe(false);
  });

  it('shows the resulting price per point: the common price or the own price of each point', async () => {
    const seller = await fixture(OWNER, OWNER_PHONE, 'b');
    const second = await pool.query(
      "INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, 'Preview Point 2', 'shop', 'Almaty Preview 2') RETURNING id",
      [seller.id],
    );
    const pages = await buildCardPreview(OWNER, cardPreviewBodySchema.parse({
      kind: 'create', title: 'Мёд', price: '3000', unit: { code: 'piece' }, pack: null, sellerComment: '', photoIds: [],
      points: [{ locationId: seller.locations[0]!.id }, { locationId: second.rows[0].id, ownPrice: '2500' }],
    }), { database: db, clock: () => T1 });
    expect(pages.map((page) => page.offer.price.amount)).toEqual(['3000.00', '2500.00']);
    expect(new Set(pages.map((page) => page.offer.id)).size).toBe(2);
  });

  it('matches the real buyer page of the same published card (one shared projection)', async () => {
    const seller = await fixture(OWNER, OWNER_PHONE, 'c');
    const proposal = await createSellerChangeSet(OWNER, sellerChangeSetCreateBodySchema.parse({
      productName: 'Баранина',
      locationId: seller.locations[0]!.id,
      price: { amount: '1000.00', unit: { code: 'kg' } },
      sellerComment: 'Исходная партия',
    }), { database: db });
    const confirmed = await confirmSellerChangeSet(OWNER, proposal.id, { database: db, clock: () => T0 });
    const offerId = confirmed.items[0]!.resultOffer!.id;

    const real = await getBuyerOffer(offerId, { database: db, clock: () => T1 });
    expect(real).not.toBeNull();
    const [page] = await buildCardPreview(OWNER, cardPreviewBodySchema.parse({
      kind: 'update', title: real!.product.name, price: '1000.00', unit: { code: 'kg' }, pack: null,
      sellerComment: 'Исходная партия', photoIds: [], offers: [{ offerId, applyPrice: true }], addPoints: [],
    }), { database: db, clock: () => T1 });

    // identical but for the identity of the Offer and the catalog link of the product (a preview has neither)
    const same = { id: 'x', product: { id: null, name: 'x' } };
    expect({ ...page!.offer, ...same }).toEqual({ ...real!, ...same });
    expect(page!.offer.product.name).toBe(real!.product.name);
  });

  it('refuses another Seller’s points and Offers, and a user without a Seller', async () => {
    const mine = await fixture(OWNER, OWNER_PHONE, 'd');
    const theirs = await fixture(OTHER, OTHER_PHONE, 'e');
    const proposal = await createSellerChangeSet(OTHER, sellerChangeSetCreateBodySchema.parse({
      productName: 'Баранина', locationId: theirs.locations[0]!.id, price: { amount: '1000.00', unit: { code: 'kg' } }, sellerComment: null,
    }), { database: db });
    const confirmed = await confirmSellerChangeSet(OTHER, proposal.id, { database: db, clock: () => T0 });
    const theirOffer = confirmed.items[0]!.resultOffer!.id;
    const base = { title: 'Баранина', price: '1000', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [] };

    await expect(buildCardPreview(OWNER, cardPreviewBodySchema.parse({ kind: 'create', ...base, points: [{ locationId: theirs.locations[0]!.id }] }), { database: db }))
      .rejects.toBeInstanceOf(LocationNotFoundError);
    await expect(buildCardPreview(OWNER, cardPreviewBodySchema.parse({ kind: 'update', ...base, offers: [{ offerId: theirOffer, applyPrice: true }], addPoints: [] }), { database: db }))
      .rejects.toBeInstanceOf(OfferNotFoundError);
    const ownProposal = await createSellerChangeSet(OWNER, sellerChangeSetCreateBodySchema.parse({
      productName: 'Баранина', locationId: mine.locations[0]!.id, price: { amount: '1000.00', unit: { code: 'kg' } }, sellerComment: null,
    }), { database: db });
    const ownOffer = (await confirmSellerChangeSet(OWNER, ownProposal.id, { database: db, clock: () => T0 })).items[0]!.resultOffer!.id;
    await expect(buildCardPreview(OWNER, cardPreviewBodySchema.parse({ kind: 'update', ...base, offers: [{ offerId: ownOffer, applyPrice: true }], addPoints: [theirs.locations[0]!.id] }), { database: db }))
      .rejects.toBeInstanceOf(LocationNotFoundError);
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['50000000-0000-4000-8000-000000000a03', '+77000009903', T0]);
    await expect(buildCardPreview('50000000-0000-4000-8000-000000000a03', cardPreviewBodySchema.parse({ kind: 'create', ...base, points: [{ locationId: mine.locations[0]!.id }] }), { database: db }))
      .rejects.toBeInstanceOf(SellerRequiredError);
    await pool.query('DELETE FROM users WHERE id=$1', ['50000000-0000-4000-8000-000000000a03']);
  });

  it('rejects malformed bodies at the schema (empty points, duplicate points, unknown keys)', () => {
    const point = { locationId: '00000000-0000-4000-8000-0000000000a1' };
    const base = { kind: 'create', title: 'Мёд', price: '100', unit: null, pack: null, sellerComment: '', photoIds: [] };
    expect(cardPreviewBodySchema.safeParse({ ...base, points: [] }).success).toBe(false);
    expect(cardPreviewBodySchema.safeParse({ ...base, points: [point, point] }).success).toBe(false);
    expect(cardPreviewBodySchema.safeParse({ ...base, points: [point], extra: 1 }).success).toBe(false);
    expect(cardPreviewBodySchema.safeParse({ ...base, points: [point] }).success).toBe(true);
  });
});
