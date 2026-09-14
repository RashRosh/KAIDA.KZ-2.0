import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import {
  applyOfferActivation,
  applyOfferDeactivation,
  applyOfferUpdateSnapshot,
  createOffer,
  findOfferById,
  lockOfferById,
} from '../../offers/infrastructure/offers.repository';
import { systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  ChangeSetNotFoundError,
  OfferChangedError,
  SellerInputInvariantError,
  SellerRequiredError,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import {
  findChangeSetViewByIdAndSeller,
  findOwnedLocation,
  linkResultOffer,
  lockChangeItems,
  lockChangeSetByIdAndSeller,
  markChangeSetConfirmed,
} from '../infrastructure/seller-change-sets.repository';

type LockedOffer = NonNullable<Awaited<ReturnType<typeof lockOfferById>>>;

async function loadFinalView(
  database: Parameters<typeof findChangeSetViewByIdAndSeller>[0],
  changeSetId: string,
  sellerId: string,
): Promise<SellerChangeSetView> {
  const view = await findChangeSetViewByIdAndSeller(database, changeSetId, sellerId);
  if (!view || view.items.length < 1 || view.items.some((item) => !item.resultOffer)) {
    throw new SellerInputInvariantError('Применённый Seller Change Set не удалось восстановить из базы.');
  }
  return view;
}

async function validateConfirmedItems(
  database: Parameters<typeof findOfferById>[0],
  sellerId: string,
  items: Awaited<ReturnType<typeof lockChangeItems>>,
) {
  for (const item of items) {
    if (!item.resultOfferId) {
      throw new SellerInputInvariantError('Confirmed Seller Change Set содержит Item без result_offer_id.');
    }
    if (item.action !== 'create_offer' && item.resultOfferId !== item.targetOfferId) {
      throw new SellerInputInvariantError('Confirmed management Item связан не с target Offer.');
    }
    const resultOffer = await findOfferById(database, item.resultOfferId);
    if (!resultOffer || resultOffer.sellerId !== sellerId) {
      throw new SellerInputInvariantError('Result Offer подтверждённого Seller Change Set не существует или больше не принадлежит Seller.');
    }
  }
}

export async function confirmSellerChangeSet(
  ownerUserId: string,
  changeSetId: string,
  dependencies: { database?: Database; clock?: Clock } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  const clock = dependencies.clock ?? systemClock;

  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new SellerRequiredError();

    const changeSet = await lockChangeSetByIdAndSeller(tx, changeSetId, seller.id);
    if (!changeSet) throw new ChangeSetNotFoundError();

    const items = await lockChangeItems(tx, changeSet.id);
    if (items.length < 1) {
      throw new SellerInputInvariantError('Seller Change Set должен содержать хотя бы один Item.');
    }

    if (changeSet.status === 'confirmed') {
      await validateConfirmedItems(tx, seller.id, items);
      return loadFinalView(tx, changeSet.id, seller.id);
    }

    const targetIds = new Set<string>();
    for (const item of items) {
      if (item.action === 'create_offer') {
        if (item.targetOfferId !== null || item.expectedOfferRevision !== null) {
          throw new SellerInputInvariantError('create_offer Item не должен содержать target Offer или expected revision.');
        }
        if (item.resultOfferId !== null) {
          throw new SellerInputInvariantError('Proposed create_offer Item уже содержит result_offer_id.');
        }
        continue;
      }

      if (!item.targetOfferId || item.expectedOfferRevision === null) {
        throw new SellerInputInvariantError('Management Item не содержит target Offer или expected revision.');
      }
      if (item.resultOfferId !== null) {
        throw new SellerInputInvariantError('Proposed management Item уже содержит result_offer_id.');
      }
      if (targetIds.has(item.targetOfferId)) {
        throw new SellerInputInvariantError('Seller Change Set содержит несколько management Items для одного Offer.');
      }
      targetIds.add(item.targetOfferId);
    }

    const lockedOffers = new Map<string, LockedOffer>();
    for (const targetOfferId of [...targetIds].sort()) {
      const targetOffer = await lockOfferById(tx, targetOfferId);
      if (!targetOffer) {
        throw new SellerInputInvariantError('Target Offer Seller Change Set не существует.');
      }
      lockedOffers.set(targetOfferId, targetOffer);
    }

    for (const item of items) {
      if (item.action === 'create_offer') {
        const location = await findOwnedLocation(tx, item.locationId, seller.id);
        if (!location) {
          throw new SellerInputInvariantError('Location Seller Change Set больше не принадлежит Seller.');
        }
        continue;
      }

      const targetOffer = lockedOffers.get(item.targetOfferId!);
      if (!targetOffer) {
        throw new SellerInputInvariantError('Target Offer не был заблокирован для confirmation.');
      }
      if (targetOffer.sellerId !== seller.id) {
        throw new SellerInputInvariantError('Target Offer больше не принадлежит Seller.');
      }
      if (targetOffer.productId !== item.productId || targetOffer.locationId !== item.locationId) {
        throw new SellerInputInvariantError('Product или Location target Offer не совпадает с сохранённым proposal.');
      }
      const location = await findOwnedLocation(tx, targetOffer.locationId, seller.id);
      if (!location) {
        throw new SellerInputInvariantError('Location target Offer больше не принадлежит Seller.');
      }
      if (targetOffer.revision !== item.expectedOfferRevision) {
        throw new OfferChangedError();
      }
      if (item.action === 'deactivate_offer' && targetOffer.status !== 'active') {
        throw new SellerInputInvariantError('Deactivate proposal ожидает active target Offer на своей revision.');
      }
      if (item.action === 'update_offer' && item.priceAmount !== null && item.priceCurrency !== 'KZT') {
        throw new SellerInputInvariantError('Update Item содержит неподдерживаемую валюту.');
      }
    }

    const confirmationTime = clock();

    for (const item of items) {
      if (item.action === 'create_offer') {
        const offer = await createOffer(tx, {
          productId: item.productId,
          sellerId: seller.id,
          locationId: item.locationId,
          priceAmount: item.priceAmount,
          priceCurrency: item.priceAmount === null ? null : 'KZT',
          priceUnit: item.priceAmount === null ? null : item.priceUnit,
          sellerComment: item.sellerComment,
          confirmedAt: confirmationTime,
        });
        const linked = await linkResultOffer(tx, item.id, offer.id);
        if (linked.length !== 1) throw new SellerInputInvariantError('Result Offer не удалось связать с create_offer Item.');
        continue;
      }

      const targetOffer = lockedOffers.get(item.targetOfferId!)!;
      let applied: Array<{ id: string }>;

      if (item.action === 'update_offer') {
        applied = await applyOfferUpdateSnapshot(tx, {
          offerId: targetOffer.id,
          expectedRevision: item.expectedOfferRevision!,
          priceAmount: item.priceAmount,
          priceCurrency: item.priceAmount === null ? null : 'KZT',
          priceUnit: item.priceAmount === null ? null : item.priceUnit,
          sellerComment: item.sellerComment,
          confirmationTime,
        });
      } else if (item.action === 'deactivate_offer') {
        applied = await applyOfferDeactivation(tx, {
          offerId: targetOffer.id,
          expectedRevision: item.expectedOfferRevision!,
          confirmationTime,
        });
      } else {
        applied = await applyOfferActivation(tx, {
          offerId: targetOffer.id,
          expectedRevision: item.expectedOfferRevision!,
          confirmationTime,
        });
      }

      if (applied.length !== 1) {
        throw new OfferChangedError();
      }

      const linked = await linkResultOffer(tx, item.id, targetOffer.id);
      if (linked.length !== 1) throw new SellerInputInvariantError('Result Offer не удалось связать с management Change Item.');
    }

    const confirmed = await markChangeSetConfirmed(tx, changeSet.id, confirmationTime);
    if (confirmed.length !== 1) throw new SellerInputInvariantError('Change Set не удалось перевести в confirmed.');

    return loadFinalView(tx, changeSet.id, seller.id);
  });
}