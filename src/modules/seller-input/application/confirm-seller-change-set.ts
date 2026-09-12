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

async function loadFinalView(database: Parameters<typeof findChangeSetViewByIdAndSeller>[0], changeSetId: string, sellerId: string): Promise<SellerChangeSetView> {
  const view = await findChangeSetViewByIdAndSeller(database, changeSetId, sellerId);
  if (!view || view.items.length !== 1 || !view.items[0]?.resultOffer) {
    throw new SellerInputInvariantError('Применённый Seller Change Set не удалось восстановить из базы.');
  }
  return view;
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
    if (items.length !== 1) {
      throw new SellerInputInvariantError('Seller Change Set должен содержать ровно один Item.');
    }
    const item = items[0]!;

    if (item.action === 'create_offer') {
      if (item.targetOfferId !== null || item.expectedOfferRevision !== null) {
        throw new SellerInputInvariantError('S4 create_offer Item не должен содержать target Offer или expected revision.');
      }

      if (changeSet.status === 'confirmed') {
        if (!item.resultOfferId) {
          throw new SellerInputInvariantError('Confirmed Seller Change Set не содержит result_offer_id.');
        }
        const resultOffer = await findOfferById(tx, item.resultOfferId);
        if (!resultOffer) {
          throw new SellerInputInvariantError('Result Offer подтверждённого Seller Change Set не существует.');
        }
        return loadFinalView(tx, changeSet.id, seller.id);
      }

      if (item.resultOfferId !== null) {
        throw new SellerInputInvariantError('Proposed Seller Change Set уже содержит result_offer_id.');
      }

      const location = await findOwnedLocation(tx, item.locationId, seller.id);
      if (!location) {
        throw new SellerInputInvariantError('Location Seller Change Set больше не принадлежит Seller.');
      }

      const confirmationTime = clock();
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
      if (linked.length !== 1) throw new SellerInputInvariantError('Result Offer не удалось связать с Change Item.');

      const confirmed = await markChangeSetConfirmed(tx, changeSet.id, confirmationTime);
      if (confirmed.length !== 1) throw new SellerInputInvariantError('Change Set не удалось перевести в confirmed.');

      return loadFinalView(tx, changeSet.id, seller.id);
    }

    if (!item.targetOfferId || item.expectedOfferRevision === null) {
      throw new SellerInputInvariantError('S5 Item не содержит target Offer или expected revision.');
    }

    if (changeSet.status === 'confirmed') {
      if (!item.resultOfferId) {
        throw new SellerInputInvariantError('Confirmed S5 Seller Change Set не содержит result_offer_id.');
      }
      if (item.resultOfferId !== item.targetOfferId) {
        throw new SellerInputInvariantError('Confirmed S5 Seller Change Set связан не с target Offer.');
      }
      const resultOffer = await findOfferById(tx, item.resultOfferId);
      if (!resultOffer || resultOffer.sellerId !== seller.id) {
        throw new SellerInputInvariantError('Result Offer подтверждённого S5 Seller Change Set не существует или больше не принадлежит Seller.');
      }
      return loadFinalView(tx, changeSet.id, seller.id);
    }

    if (item.resultOfferId !== null) {
      throw new SellerInputInvariantError('Proposed S5 Seller Change Set уже содержит result_offer_id.');
    }

    const targetOffer = await lockOfferById(tx, item.targetOfferId);
    if (!targetOffer) {
      throw new SellerInputInvariantError('Target Offer Seller Change Set не существует.');
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

    const confirmationTime = clock();
    let applied: Array<{ id: string }>;

    if (item.action === 'update_offer') {
      if (item.priceAmount !== null && item.priceCurrency !== 'KZT') {
        throw new SellerInputInvariantError('Update Item содержит неподдерживаемую валюту.');
      }
      applied = await applyOfferUpdateSnapshot(tx, {
        offerId: targetOffer.id,
        expectedRevision: item.expectedOfferRevision,
        priceAmount: item.priceAmount,
        priceCurrency: item.priceAmount === null ? null : 'KZT',
        priceUnit: item.priceAmount === null ? null : item.priceUnit,
        sellerComment: item.sellerComment,
        confirmationTime,
      });
    } else if (item.action === 'deactivate_offer') {
      if (targetOffer.status !== 'active') {
        throw new SellerInputInvariantError('Deactivate proposal ожидает active target Offer на своей revision.');
      }
      applied = await applyOfferDeactivation(tx, {
        offerId: targetOffer.id,
        expectedRevision: item.expectedOfferRevision,
        confirmationTime,
      });
    } else {
      applied = await applyOfferActivation(tx, {
        offerId: targetOffer.id,
        expectedRevision: item.expectedOfferRevision,
        confirmationTime,
      });
    }

    if (applied.length !== 1) {
      throw new SellerInputInvariantError('Target Offer не удалось применить на ожидаемой revision.');
    }

    const linked = await linkResultOffer(tx, item.id, targetOffer.id);
    if (linked.length !== 1) throw new SellerInputInvariantError('Result Offer не удалось связать с S5 Change Item.');

    const confirmed = await markChangeSetConfirmed(tx, changeSet.id, confirmationTime);
    if (confirmed.length !== 1) throw new SellerInputInvariantError('S5 Change Set не удалось перевести в confirmed.');

    return loadFinalView(tx, changeSet.id, seller.id);
  });
}
