import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { createOffer, findOfferById } from '../../offers/infrastructure/offers.repository';
import { systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  ChangeSetNotFoundError,
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
    if (items.length !== 1 || items[0]?.action !== 'create_offer') {
      throw new SellerInputInvariantError('S4 Seller Change Set должен содержать ровно один create_offer Item.');
    }
    const item = items[0];

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
  });
}
