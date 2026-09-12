import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  SellerOfferInvariantError,
  SellerOffersSellerRequiredError,
  type SellerOfferView,
} from '../contracts/seller-offer.contract';
import { listOffersBySeller } from '../infrastructure/offers.repository';

export async function listOwnedOffers(
  ownerUserId: string,
  dependencies: { database?: Database } = {},
): Promise<SellerOfferView[]> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerOffersSellerRequiredError();

  const rows = await listOffersBySeller(database, seller.id);
  return rows.map((row) => {
    if (row.locationSellerId !== seller.id) {
      throw new SellerOfferInvariantError('Location предложения больше не принадлежит Seller.');
    }
    if (row.priceAmount !== null && row.priceCurrency !== 'KZT') {
      throw new SellerOfferInvariantError('Цена предложения имеет неподдерживаемую валюту.');
    }
    return {
      id: row.id,
      product: { id: row.productId, name: row.productName },
      location: { id: row.locationId, name: row.locationName, addressText: row.locationAddressText },
      price: row.priceAmount === null ? null : {
        amount: row.priceAmount,
        currency: 'KZT' as const,
        unit: row.priceUnit,
      },
      sellerComment: row.sellerComment,
      status: row.status,
      lastConfirmedAt: row.lastConfirmedAt.toISOString(),
    };
  });
}
