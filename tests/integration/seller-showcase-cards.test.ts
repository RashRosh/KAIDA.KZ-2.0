import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { suggestCatalogProducts } from '../../src/modules/catalog/application/suggest-products';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { deleteOfferDraft, listOfferDrafts, saveOfferDraft } from '../../src/modules/offers/drafts/offer-drafts';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import {
  createCardChangeSet,
  pointPriceChangeSet,
  updateCardChangeSet,
} from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import {
  CardPointAlreadyAddedError,
  CardSharedFieldsError,
  cardCreateBodySchema,
  cardUpdateBodySchema,
  pointPriceBodySchema,
} from '../../src/modules/seller-input/contracts/seller-card.contract';
import { OfferChangedError, OfferUpdateNoChangesError, sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';
import { withMigrationTestDatabase } from './migration-test-database';

// seller-showcase-editor §7: multi-point atomicity and revisions, own-price protection, one-point edit, adding a point,
// drafts CRUD and ownership, search by words plus aliases, migration on a fixture of old offers.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-27T06:00:00.000Z');
const clock = () => T0;
const OWNER = { id: '73000000-0000-4000-8000-000000000001', phone: '+77010007301' };
const OTHER = { id: '73000000-0000-4000-8000-000000000002', phone: '+77010007302' };

async function cleanup(user: { id: string; phone: string }) {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${user.id}'`;
  await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE s.seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM sellers WHERE owner_user_id=$1`, [user.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [user.id, user.phone]);
}

// A Seller with three geo-confirmed points, so every Offer is buyer-visible.
async function sellerWithPoints(user: { id: string; phone: string }, label: string) {
  await cleanup(user);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [user.id, user.phone, T0]);
  const seller = await setupSeller(user.id, {
    seller: { displayName: `Cards ${label}` },
    location: { name: `${label} A`, type: 'shop', addressText: `Almaty ${label} A` },
  }, { database: db });
  const b = await createOwnedLocation(user.id, { name: `${label} B`, type: 'shop', addressText: `Almaty ${label} B` }, { database: db });
  const c = await createOwnedLocation(user.id, { name: `${label} C`, type: 'shop', addressText: `Almaty ${label} C` }, { database: db });
  const ids = [seller.locations[0]!.id, b.id, c.id];
  await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95 WHERE id = ANY($1::uuid[])', [ids]);
  return ids;
}

const base = { productId: null, unit: { code: 'kg' }, pack: null, sellerComment: 'Свежая', photoIds: [] };

async function publish(userId: string, body: unknown) {
  const proposal = await createCardChangeSet(userId, cardCreateBodySchema.parse(body), { database: db });
  return confirmSellerChangeSet(userId, proposal.id, { database: db, clock });
}

async function cardOffers(userId: string) {
  return (await listOwnedOffers(userId, { database: db, clock })).sort((a, b) => a.location.name.localeCompare(b.location.name));
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup(OWNER);
  await cleanup(OTHER);
  await pool.end();
});

describe('cards in several points', () => {
  it('one confirm creates one Offer per chosen point with shared fields and an own price; buyers find it by a word', async () => {
    const [a, b] = await sellerWithPoints(OWNER, 'multi');
    const confirmed = await publish(OWNER.id, {
      ...base, title: '  Баранина,   лопатка ', price: '5000', points: [{ locationId: a }, { locationId: b, ownPrice: '5200' }],
    });
    expect(confirmed.items).toHaveLength(2);

    const offers = await cardOffers(OWNER.id);
    expect(offers.map((offer) => [offer.location.name, offer.product.name, offer.price?.amount, offer.priceOwn])).toEqual([
      ['multi A', 'Баранина, лопатка', '5000', false],
      ['multi B', 'Баранина, лопатка', '5200', true],
    ]);
    expect(new Set(offers.map((offer) => offer.cardId)).size).toBe(1);
    // The whole title resolves to no single catalog product, so the card has no catalog link.
    expect(offers[0]!.product.id).toBeNull();

    const byWord = await searchOffers('баран лопат', db, { clock, validityPeriodHours: 168 });
    expect(byWord.offers.filter((offer) => offer.product.name === 'Баранина, лопатка')).toHaveLength(2);
    expect((await searchOffers('лопатка', db, { clock, validityPeriodHours: 168 })).offers.map((offer) => offer.product.name))
      .toContain('Баранина, лопатка');
    expect((await searchOffers('говядина', db, { clock, validityPeriodHours: 168 })).offers.map((offer) => offer.product.name))
      .not.toContain('Баранина, лопатка');
  });

  it('a chosen suggestion links to the catalog, so a catalog alias finds the card; the pack is shown to buyers', async () => {
    const [a] = await sellerWithPoints(OWNER, 'alias');
    await publish(OWNER.id, {
      ...base, title: 'Баранина, в упаковке', productId: seedIds.lambProduct, unit: { code: 'package' }, pack: { amount: '0.6', unit: 'kg' },
      price: '3000', points: [{ locationId: a }],
    });
    const found = (await searchOffers('мясо барана', db, { clock, validityPeriodHours: 168 })).offers
      .find((offer) => offer.product.name === 'Баранина, в упаковке');
    expect(found?.product.id).toBe(seedIds.lambProduct);
    expect(found?.pack).toBe('0,6 кг');
    expect(found?.price.unit).toBe('упак.');
  });

  it('an exact whole-name match links silently; suggestions match word starts in names and aliases', async () => {
    const [a] = await sellerWithPoints(OWNER, 'exact');
    await publish(OWNER.id, { ...base, title: 'говядина', price: '3900', points: [{ locationId: a }] });
    expect((await cardOffers(OWNER.id))[0]!.product.id).toBe(seedIds.beefProduct);

    expect(await suggestCatalogProducts(db, 'бар', 'ru')).toEqual([{ id: seedIds.lambProduct, name: 'Баранина' }]);
    expect(await suggestCatalogProducts(db, 'қой', 'kk')).toEqual([{ id: seedIds.lambProduct, name: 'Қой еті, жауырын' }]);
    expect(await suggestCatalogProducts(db, 'б', 'ru')).toEqual([]);
    expect(await suggestCatalogProducts(db, 'аранина', 'ru')).toEqual([]);
  });

  it('a common price change skips own prices unless chosen; name and comment change everywhere; a point can be added', async () => {
    const [a, b, c] = await sellerWithPoints(OWNER, 'edit');
    await publish(OWNER.id, { ...base, title: 'Курага', price: '1800', points: [{ locationId: a }, { locationId: b, ownPrice: '2000' }] });
    const [offerA, offerB] = await cardOffers(OWNER.id);

    const update = cardUpdateBodySchema.parse({
      ...base, title: 'Курага, отборная', sellerComment: 'Узбекистан', price: '1700',
      offers: [
        { offerId: offerA!.id, revision: offerA!.revision, applyPrice: true },
        { offerId: offerB!.id, revision: offerB!.revision, applyPrice: false },
      ],
      addPoints: [c],
    });
    const proposal = await updateCardChangeSet(OWNER.id, offerA!.cardId, update, { database: db });
    expect(proposal.items.find((item) => item.location.id === a)?.previousPriceAmount).toBe('1800');
    await confirmSellerChangeSet(OWNER.id, proposal.id, { database: db, clock });

    const after = await cardOffers(OWNER.id);
    expect(after.map((offer) => [offer.location.name, offer.product.name, offer.sellerComment, offer.price?.amount, offer.priceOwn])).toEqual([
      ['edit A', 'Курага, отборная', 'Узбекистан', '1700', false],
      ['edit B', 'Курага, отборная', 'Узбекистан', '2000', true],
      ['edit C', 'Курага, отборная', 'Узбекистан', '1700', false],
    ]);
    expect(new Set(after.map((offer) => offer.cardId)).size).toBe(1);

    // Adding a point that is already on the card is refused.
    await expect(updateCardChangeSet(OWNER.id, offerA!.cardId, cardUpdateBodySchema.parse({
      ...base, title: 'Курага, отборная', price: '1700',
      offers: after.map((offer) => ({ offerId: offer.id, revision: offer.revision, applyPrice: true })),
      addPoints: [a],
    }), { database: db })).rejects.toBeInstanceOf(CardPointAlreadyAddedError);
  });

  it('one point gets its own price and returns to the common price; a stale editor is refused', async () => {
    const [a, b] = await sellerWithPoints(OWNER, 'point');
    await publish(OWNER.id, { ...base, title: 'Черешня', price: '2500', points: [{ locationId: a }, { locationId: b }] });
    const [offerA, offerB] = await cardOffers(OWNER.id);

    const own = await pointPriceChangeSet(OWNER.id, offerB!.id, pointPriceBodySchema.parse({ revision: offerB!.revision, price: '2700' }), { database: db });
    await confirmSellerChangeSet(OWNER.id, own.id, { database: db, clock });
    let [, pointB] = await cardOffers(OWNER.id);
    expect([pointB!.price?.amount, pointB!.priceOwn]).toEqual(['2700', true]);

    // The editor opened before the change still carries the old revision.
    await expect(pointPriceChangeSet(OWNER.id, offerB!.id, pointPriceBodySchema.parse({ revision: offerB!.revision, price: '2600' }), { database: db }))
      .rejects.toBeInstanceOf(OfferChangedError);
    await expect(updateCardChangeSet(OWNER.id, offerA!.cardId, cardUpdateBodySchema.parse({
      ...base, title: 'Черешня', price: '2400',
      offers: [{ offerId: offerA!.id, revision: offerA!.revision, applyPrice: true }, { offerId: offerB!.id, revision: offerB!.revision, applyPrice: true }],
      addPoints: [],
    }), { database: db })).rejects.toBeInstanceOf(OfferChangedError);

    const back = await pointPriceChangeSet(OWNER.id, offerB!.id, pointPriceBodySchema.parse({ revision: pointB!.revision, price: null }), { database: db });
    await confirmSellerChangeSet(OWNER.id, back.id, { database: db, clock });
    [, pointB] = await cardOffers(OWNER.id);
    expect([pointB!.price?.amount, pointB!.priceOwn]).toEqual(['2500', false]);
    await expect(pointPriceChangeSet(OWNER.id, offerB!.id, pointPriceBodySchema.parse({ revision: pointB!.revision, price: null }), { database: db }))
      .rejects.toBeInstanceOf(OfferUpdateNoChangesError);
  });

  it('a card change applies to all its Offers or to none', async () => {
    const [a, b] = await sellerWithPoints(OWNER, 'atomic');
    await publish(OWNER.id, { ...base, title: 'Мёд', price: '4000', points: [{ locationId: a }, { locationId: b }] });
    const [offerA, offerB] = await cardOffers(OWNER.id);
    const proposal = await updateCardChangeSet(OWNER.id, offerA!.cardId, cardUpdateBodySchema.parse({
      ...base, title: 'Мёд горный', price: '4500',
      offers: [{ offerId: offerA!.id, revision: offerA!.revision, applyPrice: true }, { offerId: offerB!.id, revision: offerB!.revision, applyPrice: true }],
      addPoints: [],
    }), { database: db });
    // Another device changes point B in between: the whole card change is refused.
    const other = await pointPriceChangeSet(OWNER.id, offerB!.id, pointPriceBodySchema.parse({ revision: offerB!.revision, price: '4100' }), { database: db });
    await confirmSellerChangeSet(OWNER.id, other.id, { database: db, clock });
    await expect(confirmSellerChangeSet(OWNER.id, proposal.id, { database: db, clock })).rejects.toBeInstanceOf(OfferChangedError);
    expect((await cardOffers(OWNER.id)).map((offer) => offer.product.name)).toEqual(['Мёд', 'Мёд']);
  });

  it('a per-Offer change (S5 / S12) on a multi-point card may change only the price, which becomes that point\'s own', async () => {
    const [a, b] = await sellerWithPoints(OWNER, 'legacy');
    await publish(OWNER.id, { ...base, title: 'Орехи', price: '3000', points: [{ locationId: a }, { locationId: b }] });
    const [offerA] = await cardOffers(OWNER.id);
    await expect(createOfferManagementChangeSet(OWNER.id, offerA!.id, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '3000', unit: { code: 'kg' } }, sellerComment: 'Другой комментарий',
    }), { database: db })).rejects.toBeInstanceOf(CardSharedFieldsError);
    const priceOnly = await createOfferManagementChangeSet(OWNER.id, offerA!.id, sellerOfferChangeBodySchema.parse({
      action: 'update_offer', price: { amount: '3100', unit: { code: 'kg' } }, sellerComment: 'Свежая',
    }), { database: db });
    await confirmSellerChangeSet(OWNER.id, priceOnly.id, { database: db, clock });
    const after = await cardOffers(OWNER.id);
    expect(after.map((offer) => [offer.price?.amount, offer.priceOwn, offer.sellerComment])).toEqual([['3100', true, 'Свежая'], ['3000', false, 'Свежая']]);
  });

  it('rejects price 0, a multi-word custom unit and a pack for kilograms', () => {
    const card = { ...base, title: 'Зелень', price: '100', points: [{ locationId: seedIds.location }] };
    expect(cardCreateBodySchema.safeParse({ ...card, price: '0' }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...card, unit: { code: 'other', value: 'пучок' } }).success).toBe(true);
    expect(cardCreateBodySchema.safeParse({ ...card, unit: { code: 'other', value: 'два пучка' } }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...card, unit: { code: 'other', value: 'пучок2' } }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...card, pack: { amount: '500', unit: 'g' } }).success).toBe(false);
    expect(cardCreateBodySchema.safeParse({ ...card, title: 'З' }).success).toBe(false);
  });
});

describe('drafts', () => {
  const empty = { title: '', productId: null, price: '', unit: null, pack: null, sellerComment: '', photoIds: [], points: [] };

  it('saves an incomplete card privately, updates it, and removes it when the card from it is published', async () => {
    const [a] = await sellerWithPoints(OWNER, 'draft');
    await sellerWithPoints(OTHER, 'draft-other');
    const draft = await saveOfferDraft(OWNER.id, null, { ...empty, title: 'Черешня' }, { database: db });
    expect(await listOfferDrafts(OTHER.id, { database: db })).toEqual([]);
    await expect(saveOfferDraft(OTHER.id, draft.id, empty, { database: db })).rejects.toMatchObject({ code: 'DRAFT_NOT_FOUND' });
    await expect(deleteOfferDraft(OTHER.id, draft.id, { database: db })).rejects.toMatchObject({ code: 'DRAFT_NOT_FOUND' });

    const updated = await saveOfferDraft(OWNER.id, draft.id, { ...empty, title: 'Черешня', price: '1500', points: [{ locationId: a, ownPrice: null }] }, { database: db });
    expect((await listOfferDrafts(OWNER.id, { database: db })).map((item) => item.payload)).toEqual([updated.payload]);
    // A draft is not an Offer: nothing to find.
    expect((await searchOffers('черешня', db, { clock, validityPeriodHours: 168 })).offers.filter((offer) => offer.seller.displayName === 'Cards draft')).toEqual([]);

    await publish(OWNER.id, { ...base, title: 'Черешня', price: '1500', points: [{ locationId: a }], draftId: draft.id });
    expect(await listOfferDrafts(OWNER.id, { database: db })).toEqual([]);
  });

  it('drops photos that are not the owner\'s', async () => {
    await sellerWithPoints(OWNER, 'draft-photo');
    const saved = await saveOfferDraft(OWNER.id, null, { ...empty, photoIds: ['99999999-9999-4999-8999-999999999999'] }, { database: db });
    expect(saved.payload.photoIds).toEqual([]);
  });
});

async function migrateTo0015(database: ReturnType<typeof drizzle>) {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-showcase-cards-'));
  await mkdir(join(folder, 'meta'));
  try {
    const files = (await readdir(join(process.cwd(), 'drizzle/migrations'))).filter((file) => file.endsWith('.sql') && file < '0016').sort();
    expect(files.at(-1)).toBe('0015_point_contacts_hours.sql');
    for (const file of files) await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
    const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { entries: unknown[] };
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 16) }));
    await migrate(database, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('migration 0016', () => {
  it('gives existing Offers the Russian catalog name as title and makes each its own one-point card', async () => {
    await withMigrationTestDatabase({ name: 'kaida_showcase_cards_upgrade_test' }, async (migrationPool, database) => {
      await migrateTo0015(database);
      const id = (n: number) => `74000000-0000-4000-8000-00000000000${n}`;
      await migrationPool.query(`INSERT INTO products (id,name) VALUES ('${id(1)}','Помидоры розовые, Баку')`);
      await migrationPool.query(`INSERT INTO sellers (id,display_name) VALUES ('${id(2)}','Legacy')`);
      await migrationPool.query(`INSERT INTO locations (id,seller_id,name,address_text,type) VALUES
        ('${id(3)}','${id(2)}','A','Almaty A','shop'),('${id(4)}','${id(2)}','B','Almaty B','shop')`);
      // Two Offers of one product in two points, and a legacy inactive Offer without a price.
      await migrationPool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,price_unit_value,seller_comment,status,last_confirmed_at) VALUES
        ('${id(5)}','${id(1)}','${id(2)}','${id(3)}','1200','KZT','other','связка длинная','Сладкие','active',now()),
        ('${id(6)}','${id(1)}','${id(2)}','${id(4)}','1300','KZT','kg',NULL,NULL,'active',now())`);
      await migrationPool.query('ALTER TABLE offers DROP CONSTRAINT offers_future_price_required');
      await migrationPool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,status,last_confirmed_at) VALUES ('${id(7)}','${id(1)}','${id(2)}','${id(3)}','inactive',now())`);
      await migrationPool.query(`ALTER TABLE offers ADD CONSTRAINT offers_future_price_required CHECK (price_amount IS NOT NULL AND price_currency = 'KZT') NOT VALID`);
      const before = (await migrationPool.query('SELECT * FROM offers ORDER BY id')).rows;

      await migrate(database, { migrationsFolder: './drizzle/migrations' });

      const after = (await migrationPool.query('SELECT * FROM offers ORDER BY id')).rows;
      expect(after).toEqual(before.map((row) => ({
        ...row,
        title: 'Помидоры розовые, Баку',
        title_search: 'помидоры розовые баку',
        card_id: row.id,
        price_own: false,
        pack_amount: null,
        pack_unit: null,
      })));
      const constraints = await migrationPool.query(`SELECT conname, convalidated FROM pg_constraint
        WHERE conname IN ('offers_future_price_required','seller_change_items_future_price_required') ORDER BY conname`);
      expect(constraints.rows).toEqual([
        { conname: 'offers_future_price_required', convalidated: false },
        { conname: 'seller_change_items_future_price_required', convalidated: false },
      ]);
    });
  });
});
