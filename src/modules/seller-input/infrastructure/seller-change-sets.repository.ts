import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import type { LocationType } from '../../locations/contracts/location.contract';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import type { OfferStatus } from '../../offers/db/offers.table';
import { sellers } from '../../sellers/db/sellers.table';
import type { SellerChangeSetView } from '../contracts/seller-change-set.contract';
import { sellerChangeItems, type SellerOfferManagementAction } from '../db/seller-change-items.table';
import { sellerChangeSets } from '../db/seller-change-sets.table';

export type SellerInputDb = Pick<Database, 'insert' | 'select' | 'update'>;

export async function findOwnedLocation(database: SellerInputDb, locationId: string, sellerId: string) {
  const rows = await database.select({
    id: locations.id,
    sellerId: locations.sellerId,
    name: locations.name,
    addressText: locations.addressText,
    type: locations.type,
  }).from(locations).where(and(eq(locations.id, locationId), eq(locations.sellerId, sellerId))).limit(1);
  const row = rows[0];
  return row ? { ...row, type: row.type as LocationType } : null;
}

export async function createChangeSet(database: SellerInputDb, sellerId: string) {
  const rows = await database.insert(sellerChangeSets).values({ sellerId, status: 'proposed' }).returning({
    id: sellerChangeSets.id,
    status: sellerChangeSets.status,
    createdAt: sellerChangeSets.createdAt,
    confirmedAt: sellerChangeSets.confirmedAt,
  });
  const changeSet = rows[0];
  if (!changeSet) throw new Error('SellerChangeSet insert did not return a row');
  return changeSet;
}

export async function createChangeItem(database: SellerInputDb, values: {
  changeSetId: string;
  productId: string;
  locationId: string;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
}) {
  const rows = await database.insert(sellerChangeItems).values({
    changeSetId: values.changeSetId,
    action: 'create_offer',
    productId: values.productId,
    locationId: values.locationId,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    priceUnit: values.priceUnit,
    sellerComment: values.sellerComment,
    targetOfferId: null,
    expectedOfferRevision: null,
  }).returning({ id: sellerChangeItems.id });
  const item = rows[0];
  if (!item) throw new Error('SellerChangeItem insert did not return a row');
  return item;
}

export async function createOfferManagementChangeItem(database: SellerInputDb, values: {
  changeSetId: string;
  action: SellerOfferManagementAction;
  productId: string;
  locationId: string;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
  targetOfferId: string;
  expectedOfferRevision: number;
}) {
  const rows = await database.insert(sellerChangeItems).values({
    changeSetId: values.changeSetId,
    action: values.action,
    productId: values.productId,
    locationId: values.locationId,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    priceUnit: values.priceUnit,
    sellerComment: values.sellerComment,
    targetOfferId: values.targetOfferId,
    expectedOfferRevision: values.expectedOfferRevision,
  }).returning({ id: sellerChangeItems.id });
  const item = rows[0];
  if (!item) throw new Error('Seller offer management item insert did not return a row');
  return item;
}

export async function findChangeSetViewByIdAndSeller(database: SellerInputDb, changeSetId: string, sellerId: string): Promise<SellerChangeSetView | null> {
  const headers = await database.select({
    id: sellerChangeSets.id,
    status: sellerChangeSets.status,
    createdAt: sellerChangeSets.createdAt,
    confirmedAt: sellerChangeSets.confirmedAt,
    sellerId: sellers.id,
    sellerDisplayName: sellers.displayName,
  }).from(sellerChangeSets)
    .innerJoin(sellers, eq(sellerChangeSets.sellerId, sellers.id))
    .where(and(eq(sellerChangeSets.id, changeSetId), eq(sellerChangeSets.sellerId, sellerId)))
    .limit(1);
  const header = headers[0];
  if (!header) return null;

  const rows = await database.select({
    id: sellerChangeItems.id,
    action: sellerChangeItems.action,
    productId: products.id,
    productName: products.name,
    locationId: locations.id,
    locationName: locations.name,
    locationAddressText: locations.addressText,
    locationType: locations.type,
    priceAmount: sellerChangeItems.priceAmount,
    priceCurrency: sellerChangeItems.priceCurrency,
    priceUnit: sellerChangeItems.priceUnit,
    sellerComment: sellerChangeItems.sellerComment,
    resultOfferId: offers.id,
    resultOfferStatus: offers.status,
    resultOfferLastConfirmedAt: offers.lastConfirmedAt,
  }).from(sellerChangeItems)
    .innerJoin(products, eq(sellerChangeItems.productId, products.id))
    .innerJoin(locations, eq(sellerChangeItems.locationId, locations.id))
    .leftJoin(offers, eq(sellerChangeItems.resultOfferId, offers.id))
    .where(eq(sellerChangeItems.changeSetId, changeSetId))
    .orderBy(asc(sellerChangeItems.id));

  return {
    id: header.id,
    status: header.status,
    createdAt: header.createdAt.toISOString(),
    confirmedAt: header.confirmedAt?.toISOString() ?? null,
    seller: { id: header.sellerId, displayName: header.sellerDisplayName },
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      product: { id: row.productId, name: row.productName },
      location: { id: row.locationId, name: row.locationName, addressText: row.locationAddressText, type: row.locationType as LocationType },
      price: row.priceAmount === null ? null : {
        amount: row.priceAmount,
        currency: row.priceCurrency as 'KZT',
        unit: row.priceUnit,
      },
      sellerComment: row.sellerComment,
      resultOffer: row.resultOfferId && row.resultOfferStatus && row.resultOfferLastConfirmedAt ? {
        id: row.resultOfferId,
        status: row.resultOfferStatus as OfferStatus,
        lastConfirmedAt: row.resultOfferLastConfirmedAt.toISOString(),
      } : null,
    })),
  };
}

export async function lockChangeSetByIdAndSeller(database: SellerInputDb, changeSetId: string, sellerId: string) {
  const rows = await database.select({
    id: sellerChangeSets.id,
    sellerId: sellerChangeSets.sellerId,
    status: sellerChangeSets.status,
    confirmedAt: sellerChangeSets.confirmedAt,
  }).from(sellerChangeSets)
    .where(and(eq(sellerChangeSets.id, changeSetId), eq(sellerChangeSets.sellerId, sellerId)))
    .for('update')
    .limit(1);
  return rows[0] ?? null;
}

export async function lockChangeItems(database: SellerInputDb, changeSetId: string) {
  return database.select({
    id: sellerChangeItems.id,
    action: sellerChangeItems.action,
    productId: sellerChangeItems.productId,
    locationId: sellerChangeItems.locationId,
    priceAmount: sellerChangeItems.priceAmount,
    priceCurrency: sellerChangeItems.priceCurrency,
    priceUnit: sellerChangeItems.priceUnit,
    sellerComment: sellerChangeItems.sellerComment,
    targetOfferId: sellerChangeItems.targetOfferId,
    expectedOfferRevision: sellerChangeItems.expectedOfferRevision,
    resultOfferId: sellerChangeItems.resultOfferId,
  }).from(sellerChangeItems)
    .where(eq(sellerChangeItems.changeSetId, changeSetId))
    .orderBy(asc(sellerChangeItems.id))
    .for('update');
}

export async function linkResultOffer(database: SellerInputDb, itemId: string, offerId: string) {
  return database.update(sellerChangeItems)
    .set({ resultOfferId: offerId })
    .where(and(eq(sellerChangeItems.id, itemId), isNull(sellerChangeItems.resultOfferId)))
    .returning({ id: sellerChangeItems.id });
}

export async function markChangeSetConfirmed(database: SellerInputDb, changeSetId: string, confirmedAt: Date) {
  return database.update(sellerChangeSets)
    .set({ status: 'confirmed', confirmedAt })
    .where(and(eq(sellerChangeSets.id, changeSetId), eq(sellerChangeSets.status, 'proposed')))
    .returning({ id: sellerChangeSets.id });
}
