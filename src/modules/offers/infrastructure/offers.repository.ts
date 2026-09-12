import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../db/offers.table';

export type OfferWriteDb = Pick<Database, 'insert' | 'select' | 'update'>;

const managementOfferSelection = {
  id: offers.id,
  sellerId: offers.sellerId,
  productId: offers.productId,
  locationId: offers.locationId,
  priceAmount: offers.priceAmount,
  priceCurrency: offers.priceCurrency,
  priceUnit: offers.priceUnit,
  sellerComment: offers.sellerComment,
  status: offers.status,
  lastConfirmedAt: offers.lastConfirmedAt,
  revision: offers.revision,
  createdAt: offers.createdAt,
  updatedAt: offers.updatedAt,
};

export async function createOffer(database: OfferWriteDb, values: {
  productId: string;
  sellerId: string;
  locationId: string;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
  confirmedAt: Date;
}) {
  const rows = await database.insert(offers).values({
    productId: values.productId,
    sellerId: values.sellerId,
    locationId: values.locationId,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    priceUnit: values.priceUnit,
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
    status: offers.status,
    lastConfirmedAt: offers.lastConfirmedAt,
  });
  const offer = rows[0];
  if (!offer) throw new Error('Offer insert did not return a row');
  return offer;
}

export async function findOfferById(database: OfferWriteDb, id: string) {
  const rows = await database.select(managementOfferSelection).from(offers).where(eq(offers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findOwnedOfferForManagement(database: OfferWriteDb, id: string, sellerId: string) {
  const rows = await database.select({
    ...managementOfferSelection,
    locationSellerId: locations.sellerId,
  }).from(offers)
    .innerJoin(locations, eq(offers.locationId, locations.id))
    .where(and(eq(offers.id, id), eq(offers.sellerId, sellerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function lockOfferById(database: OfferWriteDb, id: string) {
  const rows = await database.select(managementOfferSelection)
    .from(offers)
    .where(eq(offers.id, id))
    .for('update')
    .limit(1);
  return rows[0] ?? null;
}

export async function listOffersBySeller(database: OfferWriteDb, sellerId: string) {
  return database.select({
    ...managementOfferSelection,
    productName: products.name,
    locationName: locations.name,
    locationAddressText: locations.addressText,
    locationSellerId: locations.sellerId,
  }).from(offers)
    .innerJoin(products, eq(offers.productId, products.id))
    .innerJoin(locations, eq(offers.locationId, locations.id))
    .where(eq(offers.sellerId, sellerId))
    .orderBy(asc(offers.createdAt), asc(offers.id));
}

const managementUpdateReturning = {
  id: offers.id,
  status: offers.status,
  lastConfirmedAt: offers.lastConfirmedAt,
  revision: offers.revision,
  updatedAt: offers.updatedAt,
};

export async function applyOfferUpdateSnapshot(database: OfferWriteDb, values: {
  offerId: string;
  expectedRevision: number;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
  confirmationTime: Date;
}) {
  return database.update(offers).set({
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    priceUnit: values.priceUnit,
    sellerComment: values.sellerComment,
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
