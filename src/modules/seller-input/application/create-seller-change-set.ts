import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findProductsByCaseInsensitiveExactName } from '../../catalog/infrastructure/products.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  LocationNotFoundError,
  ProductAmbiguousError,
  ProductNotFoundError,
  SellerRequiredError,
  type SellerChangeSetCreateInput,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import { createChangeItem, createChangeSet, findOwnedLocation } from '../infrastructure/seller-change-sets.repository';

export async function createSellerChangeSet(
  ownerUserId: string,
  input: SellerChangeSetCreateInput,
  dependencies: { database?: Database } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new SellerRequiredError();

    const location = await findOwnedLocation(tx, input.locationId, seller.id);
    if (!location) throw new LocationNotFoundError();

    const productMatches = await findProductsByCaseInsensitiveExactName(tx, input.productName);
    if (productMatches.length === 0) throw new ProductNotFoundError();
    if (productMatches.length > 1) throw new ProductAmbiguousError();
    const product = productMatches[0]!;

    const priceAmount = input.price?.amount ?? null;
    const priceUnit = input.price?.unit ?? null;
    const priceCurrency = input.price ? 'KZT' as const : null;
    const sellerComment = input.sellerComment ?? null;

    const changeSet = await createChangeSet(tx, seller.id);
    const item = await createChangeItem(tx, {
      changeSetId: changeSet.id,
      productId: product.id,
      locationId: location.id,
      priceAmount,
      priceCurrency,
      priceUnit,
      sellerComment,
    });

    return {
      id: changeSet.id,
      status: changeSet.status,
      createdAt: changeSet.createdAt.toISOString(),
      confirmedAt: null,
      seller,
      items: [{
        id: item.id,
        action: 'create_offer',
        product,
        location: { id: location.id, name: location.name, addressText: location.addressText, type: location.type },
        price: priceAmount === null ? null : { amount: priceAmount, currency: 'KZT', unit: priceUnit },
        sellerComment,
        resultOffer: null,
      }],
    };
  });
}
