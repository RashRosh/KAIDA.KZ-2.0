import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { findVisibleDiscoveryCandidates } from '../../src/modules/discovery/infrastructure/discovery.repository';
import { loadOperatorCard, loadOperatorFeed } from '../../src/modules/moderation/application/operator-post-check';
import { loadReportContext, submitReport } from '../../src/modules/moderation/application/offer-reports';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { buildCardPreview } from '../../src/modules/seller-input/application/card-preview';
import { createCardChangeSet, pointPriceChangeSet, updateCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createPriceUpdateChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { checkDuplicates } from '../../src/modules/seller-input/application/match-duplicates';
import { reconfirmCards, undoReconfirmations } from '../../src/modules/seller-input/application/reconfirm-actuality';
import { cardPreviewBodySchema } from '../../src/modules/seller-input/contracts/card-preview.contract';
import {
  cardCreateBodySchema,
  cardUpdateBodySchema,
  CommonPriceMissingError,
  pointPriceBodySchema,
  WholesaleReviewRequiredError,
} from '../../src/modules/seller-input/contracts/seller-card.contract';
import { OfferChangedError, OfferPriceRequiredError, sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

// wholesale-only §6–§7 (integration): DB constraints (0033), wholesale-only create / mode transitions / lifecycle,
// buyer Search + price sort (retail always before wholesale-only) + Nearby + preview + reports + operator + text-input guard.

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-11-26T06:00:00.000Z');
const clock = () => T0;
const OWNER = { id: '75000000-0000-4000-8000-000000000001', phone: '+77010007501' };
const REPORTER = { id: '75000000-0000-4000-8000-000000000002', phone: '+77010007502' };
const OPERATOR = { id: '75000000-0000-4000-8000-000000000003', phone: '+77010007503' };
const NBSP = ' ';
const plain = (text: string | undefined) => text?.replaceAll(NBSP, ' ');

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${OWNER.id}'`;
  await pool.query(`DELETE FROM offer_report_photos WHERE report_id IN (SELECT id FROM offer_reports WHERE reporter_user_id='${REPORTER.id}')`);
  await pool.query(`DELETE FROM offer_report_receipts WHERE user_id='${REPORTER.id}'`);
  await pool.query(`DELETE FROM offer_reports WHERE reporter_user_id='${REPORTER.id}'`);
  await pool.query(`DELETE FROM operator_feed_marks WHERE user_id='${OPERATOR.id}'`);
  await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets s ON s.id=i.change_set_id WHERE s.seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellers}))`);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM sellers WHERE owner_user_id=$1`, [OWNER.id]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[]) OR phone_e164 = ANY($2::text[])', [
    [OWNER.id, REPORTER.id, OPERATOR.id],
    [OWNER.phone, REPORTER.phone, OPERATOR.phone],
  ]);
}

async function sellerWithPoints(label: string) {
  await cleanup();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3),($4,$5,$3),($6,$7,$3)', [
    OWNER.id, OWNER.phone, T0, REPORTER.id, REPORTER.phone, OPERATOR.id, OPERATOR.phone,
  ]);
  const seller = await setupSeller(OWNER.id, {
    seller: { displayName: `WholesaleOnly ${label}` },
    location: { name: `${label} A`, type: 'shop', addressText: `Almaty ${label} A` },
  }, { database: db });
  const b = await createOwnedLocation(OWNER.id, { name: `${label} B`, type: 'shop', addressText: `Almaty ${label} B` }, { database: db });
  const ids = [seller.locations[0]!.id, b.id];
  await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95 WHERE id = ANY($1::uuid[])', [ids]);
  return ids;
}

async function publish(body: unknown, at: Date = T0) {
  const proposal = await createCardChangeSet(OWNER.id, cardCreateBodySchema.parse(body), { database: db });
  return confirmSellerChangeSet(OWNER.id, proposal.id, { database: db, clock: () => at });
}

async function ownedOffers() {
  return (await listOwnedOffers(OWNER.id, { database: db, clock })).sort((a, b) => a.location.name.localeCompare(b.location.name));
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

describe('wholesale-only cards (integration)', () => {
  it('publishes a wholesale-only card without perContainer across points and exposes it in Search, Nearby, Preview, Reports, and Operator', async () => {
    const [a, b] = await sellerWithPoints('pub');
    const title = 'Томаты оптовые толькоопт';
    await publish({
      title,
      productId: null,
      price: null,
      unit: { code: 'kg' },
      pack: null,
      sellerComment: 'Опт с поля',
      photoIds: [],
      points: [{ locationId: a }, { locationId: b }],
      wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    });

    const owned = await ownedOffers();
    expect(owned).toHaveLength(2);
    for (const offer of owned) {
      expect(offer.price).toBeNull();
      expect(offer.buyerVisible).toBe(true);
      expect(offer.wholesale?.amount).toBe('450');
      expect(offer.wholesale?.perContainer).toBeNull();
      expect(offer.wholesale?.unit).toBe('кг');
      expect(offer.wholesale?.unitChoice).toEqual({ code: 'kg' });
      expect(plain(offer.wholesale?.batch)).toBe('от 1 мешка');
    }

    // Search projection
    const search = await searchOffers(title, db, { clock, validityPeriodHours: 168 });
    expect(search.offers).toHaveLength(2);
    for (const offer of search.offers) {
      expect(offer.price).toBeNull();
      expect(offer.wholesale).toEqual({
        amount: '450',
        currency: 'KZT',
        unit: 'кг',
        batch: expect.stringMatching(/^от 1\u00a0мешка$/),
      });
    }

    // Nearby discovery projection
    const nearby = (await findVisibleDiscoveryCandidates(db, new Date(T0.getTime() - 168 * 3600_000)))
      .filter((item) => item.offer.product.name === title);
    expect(nearby).toHaveLength(2);
    expect(nearby[0]!.offer.price).toBeNull();
    expect(nearby[0]!.offer.wholesale?.unit).toBe('кг');

    // Pre-publication preview
    const previews = await buildCardPreview(OWNER.id, cardPreviewBodySchema.parse({
      kind: 'create',
      title: 'Томаты превью опт',
      price: null,
      unit: { code: 'kg' },
      pack: null,
      sellerComment: '',
      photoIds: [],
      points: [{ locationId: a }],
      wholesale: { amount: '450', batchCount: 1, container: 'bag' },
    }), { database: db, clock });
    expect(previews).toHaveLength(1);
    expect(previews[0]!.offer.price).toBeNull();
    expect(previews[0]!.offer.wholesale?.unit).toBe('кг');
    expect(plain(previews[0]!.offer.wholesale?.batch)).toBe('от 1 мешка');

    // Buyer offer report context & submission
    const reportContext = await loadReportContext(owned[0]!.id, 'ru', { database: db, clock });
    expect(reportContext.available).toBe(true);
    expect(reportContext.evidence.points[0]!.amount).toBe('450');
    const submitted = await submitReport(REPORTER.id, {
      submissionId: '75000000-0000-4000-8000-000000000099',
      offerId: owned[0]!.id,
      version: reportContext.evidence.version,
      locale: 'ru',
      reason: 'price_mismatch',
      text: 'Цена отличается',
      photoId: null,
    }, { database: db, clock });
    expect(submitted.receipt).toBeTruthy();

    // Operator post-check feed & card
    const feed = await loadOperatorFeed(OPERATOR.id, { tab: 'all', offset: 0 }, { database: db });
    const row = feed.rows.find((entry) => entry.cardId === owned[0]!.cardId);
    expect(row?.price).toEqual({ amount: '450', unit: 'кг', wholesaleOnly: true });
    const opCard = await loadOperatorCard(owned[0]!.cardId, { database: db });
    expect(opCard.points[0]!.price).toEqual({ amount: '450', unit: 'кг', wholesaleOnly: true });
  });

  it('sort=price (asc & desc) always puts retail offers before wholesale-only; wholesale-only ordered by freshness', async () => {
    const [a] = await sellerWithPoints('sort');
    const tag = 'сортировкатоматы';
    const retailLow = await publish({
      title: `Розница дешёвая ${tag}`, productId: null, price: '500', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: a }],
    }, new Date('2026-11-26T01:00:00Z'));
    const retailHigh = await publish({
      title: `Розница дорогая ${tag}`, productId: null, price: '900', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: a }],
    }, new Date('2026-11-26T02:00:00Z'));
    const wholesaleOldCheap = await publish({
      title: `Опт старый дешёвый ${tag}`, productId: null, price: null, unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: a }],
      wholesale: { amount: '100', batchCount: 1, container: 'bag' },
    }, new Date('2026-11-26T03:00:00Z'));
    const wholesaleNewExpensive = await publish({
      title: `Опт свежий дорогой ${tag}`, productId: null, price: null, unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: a }],
      wholesale: { amount: '2000', batchCount: 1, container: 'bag' },
    }, new Date('2026-11-26T04:00:00Z'));

    const id = (cs: typeof retailLow) => cs.items[0]!.resultOffer!.id;
    const asc = await searchOffers(tag, db, { clock, validityPeriodHours: 168, sort: 'price', direction: 'asc' });
    expect(asc.offers.map((o) => o.id)).toEqual([id(retailLow), id(retailHigh), id(wholesaleNewExpensive), id(wholesaleOldCheap)]);

    const desc = await searchOffers(tag, db, { clock, validityPeriodHours: 168, sort: 'price', direction: 'desc' });
    expect(desc.offers.map((o) => o.id)).toEqual([id(retailHigh), id(retailLow), id(wholesaleNewExpensive), id(wholesaleOldCheap)]);
  });

  it('transitions wholesale-only ↔ mixed, supports reconfirm/undo/deactivate/activate, and skips text price updates', async () => {
    const [a] = await sellerWithPoints('trans');
    await publish({
      title: 'Огурцы переход', productId: null, price: null, unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [],
      points: [{ locationId: a }], wholesale: { amount: '400', batchCount: 1, container: 'bag' },
    });

    // Per-point retail price is rejected on wholesale-only.
    let [offer] = await ownedOffers();
    await expect(pointPriceChangeSet(OWNER.id, offer!.id, pointPriceBodySchema.parse({ revision: offer!.revision, price: '500' }), { database: db }))
      .rejects.toBeInstanceOf(CommonPriceMissingError);

    // Reconfirm & undo work cleanly.
    const later = new Date(T0.getTime() + 48 * 3600_000);
    const reconfirmedCs = await reconfirmCards(OWNER.id, [offer!.cardId], { database: db, clock: () => later });
    const undo = await undoReconfirmations(OWNER.id, [reconfirmedCs.id], { database: db, clock: () => new Date(later.getTime() + 2000) });
    expect(undo.undone).toHaveLength(1);
    expect(undo.failed).toEqual([]);

    // Deactivate & activate work cleanly.
    [offer] = await ownedOffers();
    const offCs = await createOfferManagementChangeSet(OWNER.id, offer!.id, sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }), { database: db });
    await confirmSellerChangeSet(OWNER.id, offCs.id, { database: db, clock });
    [offer] = await ownedOffers();
    expect(offer!.status).toBe('inactive');
    const onCs = await createOfferManagementChangeSet(OWNER.id, offer!.id, sellerOfferChangeBodySchema.parse({ action: 'activate_offer' }), { database: db });
    await confirmSellerChangeSet(OWNER.id, onCs.id, { database: db, clock });
    [offer] = await ownedOffers();
    expect(offer!.status).toBe('active');

    // Text duplicate check marks wholesale-only ineligible for retail price update, and createPriceUpdateChangeSet refuses it.
    const dupes = await checkDuplicates(OWNER.id, a, [{
      title: 'Огурцы переход', price: '500', unit: { code: 'kg' }, pack: null, uncertain: [],
    }], { database: db });
    expect(dupes[0]!.candidates[0]!.priceEligible).toBe(false);
    await expect(db.transaction((tx) => createPriceUpdateChangeSet(tx, OWNER.id, [{ offerId: offer!.id, expectedRevision: offer!.revision, price: '500' }])))
      .rejects.toBeInstanceOf(OfferChangedError);

    // Switching wholesale-only (without perContainer) → retail without supplying perContainer is refused.
    await expect(updateCardChangeSet(OWNER.id, offer!.cardId, cardUpdateBodySchema.parse({
      title: offer!.product.name, productId: null, price: '600', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [],
      offers: [{ offerId: offer!.id, revision: offer!.revision, applyPrice: true }], addPoints: [],
    }), { database: db })).rejects.toBeInstanceOf(WholesaleReviewRequiredError);

    // Providing perContainer transitions cleanly to mixed.
    const toMixed = await updateCardChangeSet(OWNER.id, offer!.cardId, cardUpdateBodySchema.parse({
      title: offer!.product.name, productId: null, price: '600', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [],
      offers: [{ offerId: offer!.id, revision: offer!.revision, applyPrice: true }], addPoints: [],
      wholesale: { amount: '400', batchCount: 1, container: 'bag', perContainer: '20' },
    }), { database: db });
    await confirmSellerChangeSet(OWNER.id, toMixed.id, { database: db, clock });
    [offer] = await ownedOffers();
    expect(offer!.price?.amount).toBe('600');
    expect(offer!.wholesale?.perContainer).toBe('20');

    // Switching mixed → wholesale-only works and records previousPriceAmount on proposal.
    const backToOnly = await updateCardChangeSet(OWNER.id, offer!.cardId, cardUpdateBodySchema.parse({
      title: offer!.product.name, productId: null, price: null, unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [],
      offers: [{ offerId: offer!.id, revision: offer!.revision, applyPrice: true }], addPoints: [],
      wholesale: { amount: '400', batchCount: 1, container: 'bag' },
    }), { database: db });
    expect(backToOnly.items[0]!.previousPriceAmount).toBe('600');
    await confirmSellerChangeSet(OWNER.id, backToOnly.id, { database: db, clock });
    [offer] = await ownedOffers();
    expect(offer!.price).toBeNull();
    expect(offer!.wholesale?.perContainer).toBeNull();

    // Omitting wholesale while clearing retail on a retail-only card throws OfferPriceRequiredError.
    const [b] = (await sellerWithPoints('noprice'));
    await publish({
      title: 'Без опта', productId: null, price: '500', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: b }],
    });
    const [retailOnly] = await ownedOffers();
    await expect(updateCardChangeSet(OWNER.id, retailOnly!.cardId, cardUpdateBodySchema.parse({
      title: retailOnly!.product.name, productId: null, price: null, unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [],
      offers: [{ offerId: retailOnly!.id, revision: retailOnly!.revision, applyPrice: true }], addPoints: [],
    }), { database: db })).rejects.toBeInstanceOf(OfferPriceRequiredError);
  });

  it('DB constraints 0033 reject neither retail nor wholesale, reject mixed without perContainer, and accept wholesale-only without perContainer', async () => {
    const [a] = await sellerWithPoints('db');
    await publish({
      title: 'Картофель БД', productId: null, price: '300', unit: { code: 'kg' }, pack: null, sellerComment: '', photoIds: [], points: [{ locationId: a }],
    });
    const [offer] = await ownedOffers();
    const set = (sql: string) => pool.query(`UPDATE offers SET ${sql} WHERE id=$1`, [offer!.id]);

    // Neither retail nor wholesale -> rejected by DB.
    await expect(set('price_amount=NULL, price_currency=NULL')).rejects.toThrow(/offers_active_price_required|offers_future_price_required/);
    // Mixed retail + wholesale with non-unit container & NULL perContainer -> rejected.
    await expect(set("wholesale_price_amount=250, wholesale_batch_count=1, wholesale_container='bag', wholesale_per_container=NULL"))
      .rejects.toThrow(/offers_wholesale_valid/);
    // Wholesale-only with non-unit container & NULL perContainer -> accepted!
    await set("price_amount=NULL, price_currency=NULL, wholesale_price_amount=250, wholesale_batch_count=1, wholesale_container='bag', wholesale_per_container=NULL");
    expect((await ownedOffers())[0]!.price).toBeNull();
    // Wholesale-only with NaN perContainer -> rejected.
    await expect(set("wholesale_per_container='NaN'::numeric")).rejects.toThrow(/offers_wholesale_valid/);
  });
});
