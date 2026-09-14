import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { findOwnedOfferForManagement } from '../../offers/infrastructure/offers.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { offerUpdateIsNoOp } from './create-offer-management-change-set';
import {
  BatchOfferConflictError,
  LocationNotFoundError,
  OfferAlreadyInactiveError,
  OfferNotFoundError,
  OfferUpdateNoChangesError,
  ProductAmbiguousError,
  ProductNotFoundError,
  SellerInputInvariantError,
  SellerRequiredError,
  type SellerBatchChangeItemInput,
  type SellerBatchChangeSetCreateInput,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import {
  createChangeItem,
  createChangeSet,
  createOfferManagementChangeItem,
  findChangeSetViewByIdAndSeller,
  findOwnedLocation,
} from '../infrastructure/seller-change-sets.repository';

function normalizeNullableText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function normalizedCurrentPrice(offer: {
  priceAmount: string | null;
  priceCurrency: string | null;
  priceUnit: string | null;
}) {
  if (offer.priceAmount === null) {
    if (offer.priceCurrency !== null || offer.priceUnit !== null) {
      throw new SellerInputInvariantError('Target Offer содержит некорректную форму цены.');
    }
    return { amount: null, currency: null, unit: null } as const;
  }
  if (offer.priceCurrency !== 'KZT') {
    throw new SellerInputInvariantError('Цена target Offer имеет неподдерживаемую валюту.');
  }
  return {
    amount: offer.priceAmount,
    currency: 'KZT' as const,
    unit: normalizeNullableText(offer.priceUnit),
  };
}

export function assertNoBatchOfferConflicts(items: SellerBatchChangeItemInput[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (item.action === 'create_offer') continue;
    if (seen.has(item.offerId)) throw new BatchOfferConflictError();
    seen.add(item.offerId);
  }
}

type PreparedCreateItem = {
  action: 'create_offer';
  productId: string;
  locationId: string;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
};

type PreparedManagementItem = {
  action: 'update_offer' | 'deactivate_offer' | 'activate_offer';
  productId: string;
  locationId: string;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
  targetOfferId: string;
  expectedOfferRevision: number;
};

type PreparedItem = PreparedCreateItem | PreparedManagementItem;

async function prepareItem(
  database: Parameters<typeof findOwnedLocation>[0],
  sellerId: string,
  input: SellerBatchChangeItemInput,
): Promise<PreparedItem> {
  if (input.action === 'create_offer') {
    const location = await findOwnedLocation(database, input.locationId, sellerId);
    if (!location) throw new LocationNotFoundError();

    const resolution = await resolveProduct(database, input.productName);
    if (resolution.status === 'not_found') throw new ProductNotFoundError();
    if (resolution.status === 'ambiguous') throw new ProductAmbiguousError();

    return {
      action: 'create_offer',
      productId: resolution.product.id,
      locationId: location.id,
      priceAmount: input.price?.amount ?? null,
      priceCurrency: input.price ? 'KZT' : null,
      priceUnit: input.price?.unit ?? null,
      sellerComment: input.sellerComment ?? null,
    };
  }

  const offer = await findOwnedOfferForManagement(database, input.offerId, sellerId);
  if (!offer) throw new OfferNotFoundError();
  if (offer.locationSellerId !== sellerId) {
    throw new SellerInputInvariantError('Location target Offer не принадлежит Seller.');
  }
  if (!Number.isInteger(offer.revision) || offer.revision < 1) {
    throw new SellerInputInvariantError('Target Offer содержит некорректную revision.');
  }

  const currentPrice = normalizedCurrentPrice(offer);
  if (input.action === 'update_offer') {
    if (offerUpdateIsNoOp(offer, input)) throw new OfferUpdateNoChangesError();
    return {
      action: input.action,
      productId: offer.productId,
      locationId: offer.locationId,
      priceAmount: input.price?.amount ?? null,
      priceCurrency: input.price ? 'KZT' : null,
      priceUnit: input.price?.unit ?? null,
      sellerComment: input.sellerComment,
      targetOfferId: offer.id,
      expectedOfferRevision: offer.revision,
    };
  }

  if (input.action === 'deactivate_offer' && offer.status === 'inactive') {
    throw new OfferAlreadyInactiveError();
  }

  return {
    action: input.action,
    productId: offer.productId,
    locationId: offer.locationId,
    priceAmount: currentPrice.amount,
    priceCurrency: currentPrice.amount === null ? null : 'KZT',
    priceUnit: currentPrice.amount === null ? null : currentPrice.unit,
    sellerComment: normalizeNullableText(offer.sellerComment),
    targetOfferId: offer.id,
    expectedOfferRevision: offer.revision,
  };
}

export async function createBatchSellerChangeSet(
  ownerUserId: string,
  input: SellerBatchChangeSetCreateInput,
  dependencies: { database?: Database } = {},
): Promise<SellerChangeSetView> {
  assertNoBatchOfferConflicts(input.items);
  const database = dependencies.database ?? getDatabase();

  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new SellerRequiredError();

    const prepared: PreparedItem[] = [];
    for (const item of input.items) {
      prepared.push(await prepareItem(tx, seller.id, item));
    }

    const changeSet = await createChangeSet(tx, seller.id);
    for (const item of prepared) {
      if (item.action === 'create_offer') {
        await createChangeItem(tx, {
          changeSetId: changeSet.id,
          productId: item.productId,
          locationId: item.locationId,
          priceAmount: item.priceAmount,
          priceCurrency: item.priceCurrency,
          priceUnit: item.priceUnit,
          sellerComment: item.sellerComment,
        });
        continue;
      }

      await createOfferManagementChangeItem(tx, {
        changeSetId: changeSet.id,
        action: item.action,
        productId: item.productId,
        locationId: item.locationId,
        priceAmount: item.priceAmount,
        priceCurrency: item.priceCurrency,
        priceUnit: item.priceUnit,
        sellerComment: item.sellerComment,
        targetOfferId: item.targetOfferId,
        expectedOfferRevision: item.expectedOfferRevision,
      });
    }

    const view = await findChangeSetViewByIdAndSeller(tx, changeSet.id, seller.id);
    if (!view || view.items.length !== input.items.length || view.items.some((item) => item.resultOffer !== null)) {
      throw new SellerInputInvariantError('Созданный S12 Seller Change Set не удалось восстановить из базы.');
    }
    return view;
  });
}