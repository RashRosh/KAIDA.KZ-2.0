import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { readPhoto } from '../../src/modules/media/application/read-photo';
import { uploadPhoto } from '../../src/modules/media/application/upload-photo';
import { PhotoRejectedError, type PhotoVariant } from '../../src/modules/media/contracts/photo.contract';
import { processPhoto } from '../../src/modules/media/processing/process-photo';
import type { PhotoStorage } from '../../src/modules/media/storage/photo-storage';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { getBuyerOffer } from '../../src/modules/search/application/get-buyer-offer';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  OfferChangedError,
  OfferUpdateNoChangesError,
  PhotoNotFoundError,
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-25T06:00:00.000Z');
const T1 = new Date('2026-09-25T07:00:00.000Z');
const OWNER = { id: '71000000-0000-4000-8000-000000000001', phone: '+77010007101' };
const OTHER = { id: '71000000-0000-4000-8000-000000000002', phone: '+77010007102' };

function memoryStorage(): PhotoStorage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    async write(id: string, variant: PhotoVariant, data: Buffer) { files.set(`${id}/${variant}`, data); },
    async read(id: string, variant: PhotoVariant) { return files.get(`${id}/${variant}`) ?? null; },
  };
}

const storage = memoryStorage();

function image(width: number, height: number, format: 'jpeg' | 'png' = 'jpeg') {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 180, g: 90, b: 40 } } });
  return format === 'png' ? base.png().toBuffer() : base.jpeg().toBuffer();
}

async function jpegWithGps() {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 10, g: 120, b: 60 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'KAIDA test camera', Copyright: 'seller' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '43/1 15/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '76/1 57/1 0/1' },
    })
    .toBuffer();
}

async function cleanupUser(user: { id: string; phone: string }) {
  await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i
    JOIN seller_change_sets cs ON cs.id=i.change_set_id JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)`, [user.id]);
  await pool.query('DELETE FROM offer_photos WHERE offer_id IN (SELECT o.id FROM offers o JOIN sellers s ON s.id=o.seller_id WHERE s.owner_user_id=$1)', [user.id]);
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [user.id]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [user.id]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [user.id]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [user.id]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [user.id]);
  await pool.query('DELETE FROM photos WHERE owner_user_id=$1', [user.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [user.id, user.phone]);
}

async function createSeller(user: { id: string; phone: string }, label: string) {
  await cleanupUser(user);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [user.id, user.phone, T0]);
  const seller = await setupSeller(user.id, {
    seller: { displayName: `Photo Seller ${label}` },
    location: { name: `Photo Point ${label}`, type: 'shop', addressText: `Almaty photo ${label}` },
  }, { database: db });
  await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [seller.id, user.phone]);
  await pool.query('UPDATE locations SET latitude=$2,longitude=$3 WHERE id=$1', [seller.locations[0]!.id, 43.2, 76.9]);
  return seller;
}

async function upload(userId: string, width = 800, height = 600) {
  return (await uploadPhoto(userId, await image(width, height), { database: db, storage })).id;
}

async function createOffer(userId: string, locationId: string, photoIds?: string[]) {
  const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
    productName: 'Баранина',
    locationId,
    price: { amount: '5000', unit: { code: 'kg' } },
    sellerComment: null,
    ...(photoIds ? { photoIds } : {}),
  }), { database: db });
  const confirmed = await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 });
  return { proposal, offerId: confirmed.items[0]!.resultOffer!.id };
}

function update(photoIds?: string[], amount = '5000') {
  return sellerOfferChangeBodySchema.parse({
    action: 'update_offer',
    price: { amount, unit: { code: 'kg' } },
    sellerComment: null,
    ...(photoIds ? { photoIds } : {}),
  });
}

async function offerPhotoIds(offerId: string) {
  return (await pool.query('SELECT photo_id FROM offer_photos WHERE offer_id=$1 ORDER BY position', [offerId])).rows.map((row) => row.photo_id);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanupUser(OWNER);
  await cleanupUser(OTHER);
  await pool.end();
});

describe('photo processing', () => {
  it('re-encodes to resized WebP without any metadata, GPS included', async () => {
    const source = await jpegWithGps();
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const processed = await processPhoto(source);
    for (const output of [processed.display, processed.thumb]) {
      const metadata = await sharp(output).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
    }
    expect({ width: processed.width, height: processed.height }).toEqual({ width: 900, height: 600 });
    expect((await sharp(processed.thumb).metadata()).width).toBe(480);
  });

  it('shrinks a large image to the display size and accepts PNG', async () => {
    const processed = await processPhoto(await image(3200, 2400, 'png'));
    expect({ width: processed.width, height: processed.height }).toEqual({ width: 1600, height: 1200 });
  });

  it('rejects non-images, too small images and oversized files with distinct codes', async () => {
    const codeOf = (promise: Promise<unknown>) => promise.then(() => null, (error: PhotoRejectedError) => error.code);
    expect(await codeOf(processPhoto(Buffer.from('not an image')))).toBe('PHOTO_UNSUPPORTED_TYPE');
    expect(await codeOf(processPhoto(await image(299, 800)))).toBe('PHOTO_TOO_SMALL');
    expect(await codeOf(processPhoto(Buffer.alloc(15 * 1024 * 1024 + 1)))).toBe('PHOTO_TOO_LARGE');
  });
});

describe('offer photos', () => {
  it('publishes a card with ordered photos and shows the cover to buyers and the seller', async () => {
    const seller = await createSeller(OWNER, 'order');
    const [first, second, third] = [await upload(OWNER.id), await upload(OWNER.id), await upload(OWNER.id)];
    const { proposal, offerId } = await createOffer(OWNER.id, seller.locations[0]!.id, [second!, first!, third!]);

    expect(proposal.items[0]!.photos).toEqual([{ id: second }, { id: first }, { id: third }]);
    expect(await offerPhotoIds(offerId)).toEqual([second, first, third]);

    const search = await searchOffers('Баранина', db, { clock: () => T1 });
    expect(search.offers.find((offer) => offer.id === offerId)?.coverPhotoId).toBe(second);
    const owned = await listOwnedOffers(OWNER.id, { database: db, clock: () => T1 });
    expect(owned.find((offer) => offer.id === offerId)?.photos).toEqual([{ id: second }, { id: first }, { id: third }]);
    const page = await getBuyerOffer(offerId, { database: db, clock: () => T1 });
    expect(page?.photos).toEqual([{ id: second }, { id: first }, { id: third }]);
  });

  it('publishes a card without photos; buyer payloads carry no cover field', async () => {
    const seller = await createSeller(OWNER, 'none');
    const { proposal, offerId } = await createOffer(OWNER.id, seller.locations[0]!.id);

    expect(proposal.items[0]).not.toHaveProperty('photos');
    expect(await offerPhotoIds(offerId)).toEqual([]);
    const search = await searchOffers('Баранина', db, { clock: () => T1 });
    expect(search.offers.find((offer) => offer.id === offerId)).not.toHaveProperty('coverPhotoId');
    expect((await getBuyerOffer(offerId, { database: db, clock: () => T1 }))?.photos).toEqual([]);
  });

  it('refuses a foreign or unknown photo and creates nothing', async () => {
    const seller = await createSeller(OWNER, 'foreign');
    await createSeller(OTHER, 'foreign-other');
    const foreign = await upload(OTHER.id);
    const before = (await pool.query('SELECT count(*)::int AS n FROM seller_change_sets')).rows[0].n;

    for (const photoIds of [[foreign], ['71000000-0000-4000-8000-00000000dead']]) {
      await expect(createSellerChangeSet(OWNER.id, sellerChangeSetCreateBodySchema.parse({
        productName: 'Баранина', locationId: seller.locations[0]!.id, price: { amount: '5000', unit: { code: 'kg' } }, photoIds,
      }), { database: db })).rejects.toBeInstanceOf(PhotoNotFoundError);
    }
    expect((await pool.query('SELECT count(*)::int AS n FROM seller_change_sets')).rows[0].n).toBe(before);
  });

  it('rejects more than five or repeated photos at the API boundary', () => {
    const ids = Array.from({ length: 6 }, (_, index) => `71000000-0000-4000-8000-00000000010${index}`);
    const base = { productName: 'Баранина', locationId: ids[0], price: { amount: '1', unit: { code: 'kg' } } };
    expect(sellerChangeSetCreateBodySchema.safeParse({ ...base, photoIds: ids }).success).toBe(false);
    expect(sellerChangeSetCreateBodySchema.safeParse({ ...base, photoIds: [ids[0], ids[0]] }).success).toBe(false);
    expect(sellerChangeSetCreateBodySchema.safeParse({ ...base, photoIds: ids.slice(0, 5) }).success).toBe(true);
  });

  it('edits photos: replace and reorder, keep when omitted, remove all; identical list is a no-op', async () => {
    const seller = await createSeller(OWNER, 'edit');
    const [a, b, c] = [await upload(OWNER.id), await upload(OWNER.id), await upload(OWNER.id)];
    const { offerId } = await createOffer(OWNER.id, seller.locations[0]!.id, [a!, b!]);

    await expect(createOfferManagementChangeSet(OWNER.id, offerId, update([a!, b!]), { database: db }))
      .rejects.toBeInstanceOf(OfferUpdateNoChangesError);

    const reorder = await createOfferManagementChangeSet(OWNER.id, offerId, update([c!, a!]), { database: db });
    expect(reorder.items[0]!.photos).toEqual([{ id: c }, { id: a }]);
    await confirmSellerChangeSet(OWNER.id, reorder.id, { database: db, clock: () => T1 });
    expect(await offerPhotoIds(offerId)).toEqual([c, a]);

    const priceOnly = await createOfferManagementChangeSet(OWNER.id, offerId, update(undefined, '5100'), { database: db });
    expect(priceOnly.items[0]).not.toHaveProperty('photos');
    await confirmSellerChangeSet(OWNER.id, priceOnly.id, { database: db, clock: () => T1 });
    expect(await offerPhotoIds(offerId)).toEqual([c, a]);

    const removeAll = await createOfferManagementChangeSet(OWNER.id, offerId, update([], '5100'), { database: db });
    expect(removeAll.items[0]!.photos).toEqual([]);
    await confirmSellerChangeSet(OWNER.id, removeAll.id, { database: db, clock: () => T1 });
    expect(await offerPhotoIds(offerId)).toEqual([]);
  });

  it('applies photos atomically with the Offer revision and only once', async () => {
    const seller = await createSeller(OWNER, 'atomic');
    const [a, b] = [await upload(OWNER.id), await upload(OWNER.id)];
    const { offerId } = await createOffer(OWNER.id, seller.locations[0]!.id, [a!]);

    const stale = await createOfferManagementChangeSet(OWNER.id, offerId, update([b!]), { database: db });
    const winner = await createOfferManagementChangeSet(OWNER.id, offerId, update(undefined, '6000'), { database: db });
    await confirmSellerChangeSet(OWNER.id, winner.id, { database: db, clock: () => T1 });
    await expect(confirmSellerChangeSet(OWNER.id, stale.id, { database: db, clock: () => T1 }))
      .rejects.toBeInstanceOf(OfferChangedError);
    expect(await offerPhotoIds(offerId)).toEqual([a]);

    const fresh = await createOfferManagementChangeSet(OWNER.id, offerId, update([b!, a!], '6000'), { database: db });
    await confirmSellerChangeSet(OWNER.id, fresh.id, { database: db, clock: () => T1 });
    await confirmSellerChangeSet(OWNER.id, fresh.id, { database: db, clock: () => T1 });
    expect(await offerPhotoIds(offerId)).toEqual([b, a]);
  });
});

describe('photo access', () => {
  it('serves unattached photos to the owner only and attached photos publicly while the Offer is active', async () => {
    const seller = await createSeller(OWNER, 'access');
    await createSeller(OTHER, 'access-other');
    const photo = await upload(OWNER.id);
    const read = (viewer: string | null) => readPhoto(photo, 'thumb', viewer, { database: db, storage });

    expect(await read(OWNER.id)).toMatchObject({ status: 'ok', visibility: 'owner' });
    expect(await read(OTHER.id)).toEqual({ status: 'not_found' });
    expect(await read(null)).toEqual({ status: 'not_found' });

    const { offerId } = await createOffer(OWNER.id, seller.locations[0]!.id, [photo]);
    expect(await read(null)).toMatchObject({ status: 'ok', visibility: 'public' });

    const off = await createOfferManagementChangeSet(OWNER.id, offerId, sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }), { database: db });
    await confirmSellerChangeSet(OWNER.id, off.id, { database: db, clock: () => T1 });
    expect(await read(null)).toEqual({ status: 'not_found' });
    expect(await read(OWNER.id)).toMatchObject({ status: 'ok', visibility: 'owner' });
    expect(await getBuyerOffer(offerId, { database: db, clock: () => T1 })).toBeNull();
  });

  it('limits unattached photos per user', async () => {
    await createSeller(OWNER, 'limit');
    await pool.query(`INSERT INTO photos (owner_user_id, width, height)
      SELECT $1, 800, 600 FROM generate_series(1, 50)`, [OWNER.id]);
    await expect(uploadPhoto(OWNER.id, await image(800, 600), { database: db, storage }))
      .rejects.toMatchObject({ code: 'PHOTO_UNATTACHED_LIMIT' });
  });
});
