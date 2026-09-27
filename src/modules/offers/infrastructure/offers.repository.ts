import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { locations } from '../../locations/db/locations.table';
import { sellers } from '../../sellers/db/sellers.table';
import { offerPhotos } from '../db/offer-photos.table';
import { offers } from '../db/offers.table';
import { priceUnitFromColumns, priceUnitToColumns, type PriceUnit } from '../price-unit/price-unit';
import { packFromColumns, type Pack } from '../pack/pack';
import { offerTitleSearchText } from '../title/offer-title';

export type OfferWriteDb = Pick<Database, 'insert' | 'select' | 'update'>;

const managementOfferSelection = {
  id: offers.id,
  sellerId: offers.sellerId,
  productId: offers.productId,
  title: offers.title,
  cardId: offers.cardId,
  priceOwn: offers.priceOwn,
  packAmount: offers.packAmount,
  packUnit: offers.packUnit,
  locationId: offers.locationId,
  priceAmount: offers.priceAmount,
  priceCurrency: offers.priceCurrency,
  priceUnitCode: offers.priceUnitCode,
  priceUnitValue: offers.priceUnitValue,
  sellerComment: offers.sellerComment,
  sellerCommentVersion: offers.sellerCommentVersion,
  status: offers.status,
  lastConfirmedAt: offers.lastConfirmedAt,
  revision: offers.revision,
  createdAt: offers.createdAt,
  updatedAt: offers.updatedAt,
};

function withPriceUnit<T extends { priceUnitCode: string | null; priceUnitValue: string | null; packAmount: string | null; packUnit: string | null }>(row: T) {
  const { priceUnitCode, priceUnitValue, packAmount, packUnit, ...rest } = row;
  return { ...rest, priceUnit: priceUnitFromColumns(priceUnitCode, priceUnitValue), pack: packFromColumns(packAmount, packUnit) };
}

// seller-showcase-editor: shared card fields written together on every Offer of a card.
export type OfferCardFields = {
  title: string;
  productId: string | null;
  cardId: string;
  priceOwn: boolean;
  pack: Pack | null;
};

function sharedCardColumns(card: Omit<OfferCardFields, 'cardId'>) {
  return {
    title: card.title,
    titleSearch: offerTitleSearchText(card.title),
    productId: card.productId,
    priceOwn: card.priceOwn,
    packAmount: card.pack?.amount ?? null,
    packUnit: card.pack?.unit ?? null,
  };
}

export async function createOffer(database: OfferWriteDb, values: {
  card: OfferCardFields;
  sellerId: string;
  locationId: string;
  priceAmount: string;
  priceCurrency: 'KZT';
  priceUnit: PriceUnit | null;
  sellerComment: string | null;
  confirmedAt: Date;
}) {
  const rows = await database.insert(offers).values({
    ...sharedCardColumns(values.card),
    cardId: values.card.cardId,
    sellerId: values.sellerId,
    locationId: values.locationId,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    ...priceUnitToColumns(values.priceUnit),
    sellerComment: values.sellerComment,
    status: 'active',
    lastConfirmedAt: values.confirmedAt,
    createdAt: values.confirmedAt,
    updatedAt: values.confirmedAt,
  }).returning({
    id: offers.id,
    sellerId: offers.sellerId,
    productId: offers.productId,
    locationId: offers.locationId,
    sellerComment: offers.sellerComment,
    sellerCommentVersion: offers.sellerCommentVersion,
    status: offers.status,
    lastConfirmedAt: offers.lastConfirmedAt,
  });
  const offer = rows[0];
  if (!offer) throw new Error('Offer insert did not return a row');
  return offer;
}

export async function findOfferById(database: OfferWriteDb, id: string) {
  const rows = await database.select(managementOfferSelection).from(offers).where(eq(offers.id, id)).limit(1);
  return rows[0] ? withPriceUnit(rows[0]) : null;
}

export async function findOwnedOfferForManagement(database: OfferWriteDb, id: string, sellerId: string) {
  const rows = await database.select({
    ...managementOfferSelection,
    locationSellerId: locations.sellerId,
  }).from(offers)
    .innerJoin(locations, eq(offers.locationId, locations.id))
    .where(and(eq(offers.id, id), eq(offers.sellerId, sellerId)))
    .limit(1);
  return rows[0] ? withPriceUnit(rows[0]) : null;
}

export async function lockOfferById(database: OfferWriteDb, id: string) {
  const rows = await database.select(managementOfferSelection)
    .from(offers)
    .where(eq(offers.id, id))
    .for('update')
    .limit(1);
  return rows[0] ? withPriceUnit(rows[0]) : null;
}

export async function listOffersBySeller(database: OfferWriteDb, sellerId: string) {
  const rows = await database.select({
    ...managementOfferSelection,
    locationName: locations.name,
    locationAddressText: locations.addressText,
    locationSellerId: locations.sellerId,
    locationHasGeo: sql<boolean>`${locations.latitude} is not null and ${locations.longitude} is not null`,
  }).from(offers)
    .innerJoin(locations, eq(offers.locationId, locations.id))
    .innerJoin(sellers, eq(offers.sellerId, sellers.id))
    .where(eq(offers.sellerId, sellerId))
    .orderBy(asc(offers.createdAt), asc(offers.id));
  return rows.map(withPriceUnit);
}

const managementUpdateReturning = {
  id: offers.id,
  sellerComment: offers.sellerComment,
  sellerCommentVersion: offers.sellerCommentVersion,
  status: offers.status,
  lastConfirmedAt: offers.lastConfirmedAt,
  revision: offers.revision,
  updatedAt: offers.updatedAt,
};

export async function applyOfferUpdateSnapshot(database: OfferWriteDb, values: {
  offerId: string;
  card: Omit<OfferCardFields, 'cardId'>;
  expectedRevision: number;
  priceAmount: string;
  priceCurrency: 'KZT';
  priceUnit: PriceUnit | null;
  sellerComment: string | null;
  sellerCommentChanged: boolean;
  confirmationTime: Date;
}) {
  return database.update(offers).set({
    ...sharedCardColumns(values.card),
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    ...priceUnitToColumns(values.priceUnit),
    sellerComment: values.sellerComment,
    sellerCommentVersion: values.sellerCommentChanged
      ? sql`${offers.sellerCommentVersion} + 1`
      : offers.sellerCommentVersion,
    lastConfirmedAt: values.confirmationTime,
    updatedAt: values.confirmationTime,
    revision: sql`${offers.revision} + 1`,
  }).where(and(eq(offers.id, values.offerId), eq(offers.revision, values.expectedRevision)))
    .returning(managementUpdateReturning);
}

export async function applyOfferDeactivation(database: OfferWriteDb, values: {
  offerId: string;
  expectedRevision: number;
  confirmationTime: Date;
}) {
  return database.update(offers).set({
    status: 'inactive',
    updatedAt: values.confirmationTime,
    revision: sql`${offers.revision} + 1`,
  }).where(and(eq(offers.id, values.offerId), eq(offers.revision, values.expectedRevision)))
    .returning(managementUpdateReturning);
}

export async function applyOfferActivation(database: OfferWriteDb, values: {
  offerId: string;
  expectedRevision: number;
  confirmationTime: Date;
}) {
  return database.update(offers).set({
    status: 'active',
    lastConfirmedAt: values.confirmationTime,
    updatedAt: values.confirmationTime,
    revision: sql`${offers.revision} + 1`,
  }).where(and(eq(offers.id, values.offerId), eq(offers.revision, values.expectedRevision)))
    .returning(managementUpdateReturning);
}

// All Offers of one card of this Seller, locked for a card-wide change.
export async function lockCardOffers(database: OfferWriteDb, cardId: string, sellerId: string) {
  const rows = await database.select(managementOfferSelection).from(offers)
    .where(and(eq(offers.cardId, cardId), eq(offers.sellerId, sellerId)))
    .orderBy(asc(offers.id))
    .for('update');
  return rows.map(withPriceUnit);
}

export async function findOfferPhotoIds(database: OfferWriteDb, offerId: string): Promise<string[]> {
  const rows = await database.select({ photoId: offerPhotos.photoId }).from(offerPhotos)
    .where(eq(offerPhotos.offerId, offerId))
    .orderBy(asc(offerPhotos.position));
  return rows.map((row) => row.photoId);
}

export async function findOfferPhotoIdsByOffer(database: OfferWriteDb, offerIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (offerIds.length === 0) return result;
  const rows = await database.select({ offerId: offerPhotos.offerId, photoId: offerPhotos.photoId }).from(offerPhotos)
    .where(inArray(offerPhotos.offerId, offerIds))
    .orderBy(asc(offerPhotos.offerId), asc(offerPhotos.position));
  for (const row of rows) result.set(row.offerId, [...(result.get(row.offerId) ?? []), row.photoId]);
  return result;
}

// Replaces the whole ordered list inside the caller's transaction; position 0 is the cover.
export async function replaceOfferPhotos(database: OfferWriteDb & Pick<Database, 'delete'>, offerId: string, photoIds: string[]) {
  await database.delete(offerPhotos).where(eq(offerPhotos.offerId, offerId));
  if (photoIds.length === 0) return;
  await database.insert(offerPhotos).values(photoIds.map((photoId, position) => ({ offerId, photoId, position })));
}
