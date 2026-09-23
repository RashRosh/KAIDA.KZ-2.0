import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { readOfferValidityPeriodHours, validateOfferValidityPeriodHours } from '../config/offer-lifecycle.config';
import {
  SellerOfferInvariantError,
  SellerOffersSellerRequiredError,
  type SellerOfferView,
} from '../contracts/seller-offer.contract';
import { listOffersBySeller } from '../infrastructure/offers.repository';
import { calculateOfferCutoff, systemClock, type Clock } from '../lifecycle/offer-lifecycle';

export async function listOwnedOffers(
  ownerUserId: string,
  dependencies: { database?: Database; clock?: Clock; validityPeriodHours?: number; locale?: 'ru' | 'kk' } = {},
): Promise<SellerOfferView[]> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerOffersSellerRequiredError();

  const validityPeriodHours = dependencies.validityPeriodHours === undefined
    ? readOfferValidityPeriodHours()
    : validateOfferValidityPeriodHours(dependencies.validityPeriodHours);
  const cutoff = calculateOfferCutoff((dependencies.clock ?? systemClock)(), validityPeriodHours);
  const locale = dependencies.locale ?? 'ru';

  const rows = await listOffersBySeller(database, seller.id, locale);
  return rows.map((row) => {
    if (row.locationSellerId !== seller.id) {
      throw new SellerOfferInvariantError('Location предложения больше не принадлежит Seller.');
    }
    if (row.priceAmount !== null && row.priceCurrency !== 'KZT') {
      throw new SellerOfferInvariantError('Цена предложения имеет неподдерживаемую валюту.');
    }
    // Mirrors buyerVisibleOffersPredicate: active, confirmed within the validity period, public phone, point geo.
    const buyerVisible = row.status === 'active'
      && row.lastConfirmedAt > cutoff
      && row.sellerHasPublicPhone
      && row.locationHasGeo;
    return {
      id: row.id,
      product: {
        id: row.productId,
        name: row.productName,
        ...(locale === 'kk' ? { nameLocale: row.productNameLocale } : {}),
      },
      location: { id: row.locationId, name: row.locationName, addressText: row.locationAddressText },
      price: row.priceAmount === null ? null : {
        amount: row.priceAmount,
        currency: 'KZT' as const,
        unit: row.priceUnit,
      },
      sellerComment: row.sellerComment,
      status: row.status,
      lastConfirmedAt: row.lastConfirmedAt.toISOString(),
      buyerVisible,
    };
  });
}
