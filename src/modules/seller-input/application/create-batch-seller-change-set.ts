import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { currentCardFields, newCatalogCard, perOfferUpdateCardFields } from './card-fields';
import { findOwnedOfferForManagement } from '../../offers/infrastructure/offers.repository';
import type { PriceUnit } from '../../offers/price-unit/price-unit';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { offerUpdateIsNoOp } from './create-offer-management-change-set';
import {
  BatchOfferConflictError,
  LocationNotFoundError,
  OfferAlreadyInactiveError,
  OfferChangedError,
  OfferNotFoundError,
  OfferPriceRequiredError,
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
  type ChangeItemCardFields,
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
  priceUnit: PriceUnit | null;
}) {
  if (offer.priceAmount === null) {
    if (offer.priceCurrency !== null || offer.priceUnit !== null) {
      throw new SellerInputInvariantError('Target Offer содержит некорректную форму цены.');
    }
    return null;
  }
  if (offer.priceCurrency !== 'KZT') {
    throw new SellerInputInvariantError('Цена target Offer имеет неподдерживаемую валюту.');
  }
  return {
    amount: offer.priceAmount,
    currency: 'KZT' as const,
    unit: offer.priceUnit,
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
  card: ChangeItemCardFields;
  locationId: string;
  priceAmount: string;
  priceCurrency: 'KZT';
  priceUnit: PriceUnit | null;
  sellerComment: string | null;
};

type PreparedManagementItem = {
  action: 'update_offer' | 'deactivate_offer' | 'activate_offer';
  card: ChangeItemCardFields;
  locationId: string;
  priceAmount: string;
  priceCurrency: 'KZT';
  priceUnit: PriceUnit | null;
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
      card: newCatalogCard(resolution.product),
      locationId: location.id,
      priceAmount: input.price.amount,
      priceCurrency: 'KZT',
      priceUnit: input.price.unit,
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

  if (input.action === 'update_offer') {
    if (offerUpdateIsNoOp(offer, input)) throw new OfferUpdateNoChangesError();
    return {
      action: input.action,
      card: await perOfferUpdateCardFields(database, offer, {
        price: input.price.amount, unit: input.price.unit, sellerComment: input.sellerComment, photosChanged: false,
      }),
      locationId: offer.locationId,
      priceAmount: input.price.amount,
      priceCurrency: 'KZT',
      priceUnit: input.price.unit,
      sellerComment: input.sellerComment,
      targetOfferId: offer.id,
      expectedOfferRevision: offer.revision,
    };
  }

  if (input.action === 'deactivate_offer' && offer.status === 'inactive') {
    throw new OfferAlreadyInactiveError();
  }

  const currentPrice = normalizedCurrentPrice(offer);
  if (!currentPrice) throw new OfferPriceRequiredError();

  return {
    action: input.action,
    card: currentCardFields(offer),
    locationId: offer.locationId,
    priceAmount: currentPrice.amount,
    priceCurrency: 'KZT',
    priceUnit: currentPrice.unit,
    sellerComment: normalizeNullableText(offer.sellerComment),
    targetOfferId: offer.id,
    expectedOfferRevision: offer.revision,
  };
}

// text-availability §4.1 item 5: one proposal switching off the offers the Seller ticked, inside the caller's
// transaction. Each item expects the revision the Seller saw; an offer that changed since then is refused here, and the
// existing confirm guard refuses any later change. No row is locked: nothing stronger is needed for a correct confirm.
export async function createDeactivationChangeSet(
  tx: Parameters<typeof findOwnedLocation>[0],
  sellerId: string,
  targets: { offerId: string; expectedRevision: number }[],
): Promise<string> {
  const items = targets.map((target) => ({ action: 'deactivate_offer' as const, offerId: target.offerId }));
  assertNoBatchOfferConflicts(items);
  const prepared: PreparedManagementItem[] = [];
  for (const [index, item] of items.entries()) {
    let next: PreparedItem;
    try {
      next = await prepareItem(tx, sellerId, item);
    } catch (error) {
      if (error instanceof OfferAlreadyInactiveError) throw new OfferChangedError();
      throw error;
    }
    if (next.action === 'create_offer' || next.expectedOfferRevision !== targets[index]!.expectedRevision) throw new OfferChangedError();
    prepared.push(next);
  }
  const changeSet = await createChangeSet(tx, sellerId);
  for (const item of prepared) {
    await createOfferManagementChangeItem(tx, {
      changeSetId: changeSet.id,
      action: item.action,
      card: item.card,
      locationId: item.locationId,
      priceAmount: item.priceAmount,
      priceCurrency: item.priceCurrency,
      priceUnit: item.priceUnit,
      sellerComment: item.sellerComment,
      targetOfferId: item.targetOfferId,
      expectedOfferRevision: item.expectedOfferRevision,
    });
  }
  return changeSet.id;
}

// text-price-update §3.5: one proposal of `update_offer` items setting a new price on the chosen offers, inside the
// caller's transaction. The comment and the card's shared fields stay as they are (existing preparation, which locks the
// card's offers); each item expects the revision the Seller saw, and an offer that changed, was switched off or already
// has that price is refused here. Confirmation stays the existing guarded step.
export async function createPriceUpdateChangeSet(
  tx: Parameters<typeof findOwnedLocation>[0],
  sellerId: string,
  targets: { offerId: string; expectedRevision: number; price: string }[],
): Promise<string> {
  assertNoBatchOfferConflicts(targets.map((target) => ({ action: 'update_offer' as const, offerId: target.offerId,
    price: { amount: target.price, unit: null }, sellerComment: null })));
  const prepared: PreparedManagementItem[] = [];
  for (const target of targets) {
    const offer = await findOwnedOfferForManagement(tx, target.offerId, sellerId);
    if (!offer || offer.status !== 'active' || offer.revision !== target.expectedRevision) throw new OfferChangedError();
    let next: PreparedItem;
    try {
      next = await prepareItem(tx, sellerId, {
        action: 'update_offer',
        offerId: offer.id,
        price: { amount: target.price, unit: offer.priceUnit },
        sellerComment: normalizeNullableText(offer.sellerComment),
      });
    } catch (error) {
      if (error instanceof OfferUpdateNoChangesError) throw new OfferChangedError();
      throw error;
    }
    if (next.action !== 'update_offer' || next.expectedOfferRevision !== target.expectedRevision) throw new OfferChangedError();
    prepared.push(next);
  }
  const changeSet = await createChangeSet(tx, sellerId);
  for (const item of prepared) {
    await createOfferManagementChangeItem(tx, {
      changeSetId: changeSet.id,
      action: item.action,
      card: item.card,
      locationId: item.locationId,
      priceAmount: item.priceAmount,
      priceCurrency: item.priceCurrency,
      priceUnit: item.priceUnit,
      sellerComment: item.sellerComment,
      targetOfferId: item.targetOfferId,
      expectedOfferRevision: item.expectedOfferRevision,
    });
  }
  return changeSet.id;
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
          card: item.card,
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
        card: item.card,
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
