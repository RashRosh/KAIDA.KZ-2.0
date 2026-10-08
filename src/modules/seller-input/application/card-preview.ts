import { and, eq, inArray } from 'drizzle-orm';
import { getDatabase, type Database } from '../../../db/client';
import type { Locale } from '../../../i18n/config';
import { locations } from '../../locations/db/locations.table';
import { findVerifiedPhonesBySellers } from '../../locations/details/point-details.repository';
import { buyerActuality, readActualityPolicy } from '../../offers/actuality/actuality';
import { offers } from '../../offers/db/offers.table';
import { systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import type { BuyerOfferPage } from '../../search/application/get-buyer-offer';
import { projectBuyerOffer } from '../../search/projection/buyer-offer-projection';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { LocationNotFoundError, OfferNotFoundError, SellerRequiredError } from '../contracts/seller-change-set.contract';
import type { CardPreviewInput } from '../contracts/card-preview.contract';
import { assertPhotosOwnedBy } from './assert-photos-owned';

// pre-publication-buyer-preview (docs/slices/pre-publication-buyer-preview, contract rev 1 §3.3, §3.10): the buyer's view of a card
// BEFORE it is published, built from the editor values. Read-only by construction: nothing is inserted, updated or attached, the
// result is not stored and has no address; identifiers are synthetic (`preview:<n>`, not uuids, resolved by no route). Only the
// signed-in Seller's own points, Offers and photos can be used.

export type CardPreviewPage = { locationId: string; offer: BuyerOfferPage };

// the stored price has two decimals (numeric(…,2)); the preview shows it the same way
function twoDecimals(amount: string): string {
  const [whole = '0', fraction = ''] = amount.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function isPreviewOfferId(value: string): boolean {
  return /^preview:\d+$/u.test(value);
}

export async function buildCardPreview(
  ownerUserId: string,
  input: CardPreviewInput,
  dependencies: { database?: Database; clock?: Clock; locale?: Locale } = {},
): Promise<CardPreviewPage[]> {
  const db = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? systemClock)();
  const locale = dependencies.locale ?? 'ru';
  const seller = await findSellerByOwner(db, ownerUserId);
  if (!seller) throw new SellerRequiredError();
  await assertPhotosOwnedBy(db, input.photoIds, ownerUserId);

  // one row per point that would be on the showcase: where, at what price, since when confirmed
  type Row = { locationId: string; priceAmount: string; confirmedAt: Date };
  let rows: Row[];
  if (input.kind === 'create') {
    rows = input.points.map((point) => ({ locationId: point.locationId, priceAmount: twoDecimals(point.ownPrice ?? input.price), confirmedAt: now }));
  } else {
    const ids = input.offers.map((offer) => offer.offerId);
    const owned = await db.select({
      id: offers.id,
      locationId: offers.locationId,
      status: offers.status,
      priceAmount: offers.priceAmount,
      lastConfirmedAt: offers.lastConfirmedAt,
    }).from(offers).where(and(inArray(offers.id, ids), eq(offers.sellerId, seller.id)));
    if (owned.length !== ids.length) throw new OfferNotFoundError();
    const byId = new Map(owned.map((row) => [row.id, row]));
    rows = [
      // the card's Offers that are on the showcase: the common price where the Seller applies it, their own price otherwise
      ...input.offers.flatMap((offer) => {
        const row = byId.get(offer.offerId)!;
        if (row.status !== 'active' || row.priceAmount === null) return [];
        return [{ locationId: row.locationId, priceAmount: offer.applyPrice ? twoDecimals(input.price) : row.priceAmount, confirmedAt: row.lastConfirmedAt }];
      }),
      ...input.addPoints.map((locationId) => ({ locationId, priceAmount: twoDecimals(input.price), confirmedAt: now })),
    ];
  }

  const locationIds = [...new Set(rows.map((row) => row.locationId))];
  const places = locationIds.length === 0 ? [] : await db.select({
    id: locations.id,
    name: locations.name,
    addressText: locations.addressText,
    openingHours: locations.openingHours,
    phoneE164: locations.phoneE164,
    whatsappPhoneE164: locations.whatsappPhoneE164,
    latitude: locations.latitude,
    longitude: locations.longitude,
  }).from(locations).where(and(inArray(locations.id, locationIds), eq(locations.sellerId, seller.id)));
  if (places.length !== locationIds.length) throw new LocationNotFoundError();
  const place = new Map(places.map((row) => [row.id, row]));
  const verifiedPhones = (await findVerifiedPhonesBySellers(db, [seller.id])).get(seller.id);
  const policy = readActualityPolicy();
  const unit = input.unit;

  return rows.map((row, index) => {
    const where = place.get(row.locationId)!;
    const { offer } = projectBuyerOffer({
      id: `preview:${index}`,
      productId: null,
      title: input.title,
      packAmount: input.pack?.amount ?? null,
      packUnit: input.pack?.unit ?? null,
      seller: { id: seller.id, displayName: seller.displayName },
      location: { id: where.id, name: where.name, addressText: where.addressText, openingHours: where.openingHours },
      locationPhoneE164: where.phoneE164,
      locationWhatsappPhoneE164: where.whatsappPhoneE164,
      verifiedPhones,
      priceAmount: row.priceAmount,
      priceUnitCode: unit === null ? null : unit.code,
      priceUnitValue: unit !== null && unit.code === 'other' ? unit.value : null,
      sellerComment: input.sellerComment,
      coverPhotoId: input.photoIds[0] ?? null,
      locationLatitude: where.latitude,
      locationLongitude: where.longitude,
    }, locale);
    return {
      locationId: row.locationId,
      offer: {
        ...offer,
        actuality: buyerActuality(row.confirmedAt, now, policy),
        photos: input.photoIds.map((id) => ({ id })),
        lastConfirmedAt: row.confirmedAt.toISOString(),
      },
    };
  });
}
