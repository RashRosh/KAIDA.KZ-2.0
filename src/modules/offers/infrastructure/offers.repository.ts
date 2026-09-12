import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { offers } from '../db/offers.table';

export type OfferWriteDb = Pick<Database, 'insert' | 'select'>;

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
  const rows = await database.select({
    id: offers.id,
    sellerId: offers.sellerId,
    productId: offers.productId,
    locationId: offers.locationId,
    status: offers.status,
    lastConfirmedAt: offers.lastConfirmedAt,
  }).from(offers).where(eq(offers.id, id)).limit(1);
  return rows[0] ?? null;
}
