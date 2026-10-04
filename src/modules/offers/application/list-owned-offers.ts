import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { readOfferValidityPeriodHours, validateOfferValidityPeriodHours } from '../config/offer-lifecycle.config';
import {
  SellerOfferInvariantError,
  SellerOffersSellerRequiredError,
  type SellerOfferView,
} from '../contracts/seller-offer.contract';
import { findOfferPhotoIdsByOffer, listOffersBySeller } from '../infrastructure/offers.repository';
import { calculateOfferCutoff, systemClock, type Clock } from '../lifecycle/offer-lifecycle';
import { formatPriceUnit } from '../price-unit/price-unit';
import { formatPack } from '../pack/pack';
import { findActiveRemovalsBySeller } from '../../moderation/infrastructure/moderation.repository';
import { actualityView, readActualityPolicy, validateActualityPolicy, type ActualityPolicy } from '../actuality/actuality';

export async function listOwnedOffers(
  ownerUserId: string,
  dependencies: {
    database?: Database;
    clock?: Clock;
    validityPeriodHours?: number;
    actualityPolicy?: ActualityPolicy;
    locale?: 'ru' | 'kk';
  } = {},
): Promise<SellerOfferView[]> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerOffersSellerRequiredError();

  const validityPeriodHours = dependencies.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(dependencies.validityPeriodHours);
  const now = (dependencies.clock ?? systemClock)();
  const cutoff = calculateOfferCutoff(now, validityPeriodHours);
  const policy = dependencies.actualityPolicy
    ? validateActualityPolicy(dependencies.actualityPolicy)
    : { ...readActualityPolicy(), hiddenHours: validityPeriodHours };
  const locale = dependencies.locale ?? 'ru';

  const rows = await listOffersBySeller(database, seller.id);
  const photosByOffer = await findOfferPhotoIdsByOffer(database, rows.map((row) => row.id));
  const removals = await findActiveRemovalsBySeller(database, seller.id);
  return rows.map((row) => {
    if (row.locationSellerId !== seller.id) {
      throw new SellerOfferInvariantError('Location предложения больше не принадлежит Seller.');
    }
    if (row.priceAmount !== null && row.priceCurrency !== 'KZT') {
      throw new SellerOfferInvariantError('Цена предложения имеет неподдерживаемую валюту.');
    }
    const removal = removals.get(row.cardId);
    // Mirrors buyerVisibleOffersPredicate (stage 5A): active, confirmed within the validity period, not removed.
    // Location coordinates are no longer part of ordinary Search / buyer Offer page visibility; the point's geo
    // status stays a separate point characteristic in the Seller workspace.
    const buyerVisible = row.status === 'active'
      && row.lastConfirmedAt > cutoff
      && !removal;
    return {
      id: row.id,
      product: { id: row.productId, name: row.title },
      cardId: row.cardId,
      revision: row.revision,
      priceOwn: row.priceOwn,
      pack: row.pack,
      packLabel: formatPack(row.pack, locale),
      location: { id: row.locationId, name: row.locationName, addressText: row.locationAddressText },
      price: row.priceAmount === null ? null : {
        amount: row.priceAmount,
        currency: 'KZT' as const,
        unit: formatPriceUnit(row.priceUnit, locale),
        unitChoice: row.priceUnit,
      },
      sellerComment: row.sellerComment,
      ...(photosByOffer.has(row.id) ? { photos: photosByOffer.get(row.id)!.map((id) => ({ id })) } : {}),
      status: row.status,
      lastConfirmedAt: row.lastConfirmedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      buyerVisible,
      actuality: actualityView(row.lastConfirmedAt, now, policy),
      removal: removal ? { reason: removal.reason, comment: removal.comment, removedAt: removal.removedAt.toISOString() } : null,
    };
  });
}
