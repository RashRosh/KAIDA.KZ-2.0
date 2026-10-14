import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { CardRemovedByOperatorError } from '../../moderation/contracts/moderation.contract';
import { findActiveRemovals } from '../../moderation/infrastructure/moderation.repository';
import { lockCardOffers, lockOfferById } from '../../offers/infrastructure/offers.repository';
import { systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { currentCardFields } from './card-fields';
import { confirmSellerChangeSet } from './confirm-seller-change-set';
import {
  OfferAlreadyInactiveError,
  OfferChangedError,
  OfferNotFoundError,
  OfferPriceRequiredError,
  SellerRequiredError,
  UndoWouldHideError,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import { createChangeSet, createOfferManagementChangeItem, lockChangeItems, lockChangeSetByIdAndSeller } from '../infrastructure/seller-change-sets.repository';

// offer-actuality §2 «Reconfirmation mechanics»: «Подтвердить актуальность» on a card and «Всё актуально» on the list.
// One ChangeSet with a reconfirm item per switched-on point of every chosen card, confirmed at once: nothing but the
// confirmation time changes, so there is no review page. Removed or fully switched-off cards are refused.
export async function reconfirmCards(
  ownerUserId: string,
  cardIds: string[],
  dependencies: { database?: Database; clock?: Clock } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  const proposal = await database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new SellerRequiredError();

    const unique = [...new Set(cardIds)].sort();
    if ((await findActiveRemovals(tx, unique)).size > 0) throw new CardRemovedByOperatorError();

    const changeSet = await createChangeSet(tx, seller.id);
    for (const cardId of unique) {
      const offers = await lockCardOffers(tx, cardId, seller.id);
      if (offers.length === 0) throw new OfferNotFoundError();
      const active = offers.filter((offer) => offer.status === 'active');
      if (active.length === 0) throw new OfferAlreadyInactiveError();
      for (const offer of active) {
        if (offer.priceAmount === null || offer.priceCurrency !== 'KZT') throw new OfferPriceRequiredError();
        await createOfferManagementChangeItem(tx, {
          changeSetId: changeSet.id,
          action: 'reconfirm_offer',
          card: currentCardFields(offer),
          locationId: offer.locationId,
          priceAmount: offer.priceAmount,
          priceCurrency: 'KZT',
          priceUnit: offer.priceUnit,
          sellerComment: offer.sellerComment,
          targetOfferId: offer.id,
          expectedOfferRevision: offer.revision,
        });
      }
    }
    return changeSet;
  });
  return confirmSellerChangeSet(ownerUserId, proposal.id, { database, clock: dependencies.clock });
}

// actuality-words §7.3: the one-tap «Всё актуально» confirms card by card (each card its own ChangeSet, exactly as the
// single-card action); a card that cannot be confirmed is reported and left unchanged, the rest are confirmed.
export type BulkReconfirmFailure = { cardId: string; code: string; message: string };
export type BulkReconfirmResult = {
  confirmed: { cardId: string; changeSetId: string }[];
  failed: BulkReconfirmFailure[];
};

function cardFailure(error: unknown): { code: string; message: string } | null {
  if (
    error instanceof OfferNotFoundError
    || error instanceof CardRemovedByOperatorError
    || error instanceof OfferAlreadyInactiveError
    || error instanceof OfferChangedError
    || error instanceof OfferPriceRequiredError
  ) return { code: error.code, message: error.message };
  return null;
}

export async function reconfirmCardsPerCard(
  ownerUserId: string,
  cardIds: string[],
  dependencies: { database?: Database; clock?: Clock } = {},
): Promise<BulkReconfirmResult> {
  const result: BulkReconfirmResult = { confirmed: [], failed: [] };
  for (const cardId of [...new Set(cardIds)].sort()) {
    try {
      const view = await reconfirmCards(ownerUserId, [cardId], dependencies);
      result.confirmed.push({ cardId, changeSetId: view.id });
    } catch (error) {
      const failure = cardFailure(error);
      // A missing Seller or an infrastructure failure is not a per-card outcome: it fails the whole request.
      if (!failure) throw error;
      result.failed.push({ cardId, ...failure });
    }
  }
  return result;
}

// actuality-words §7.2: undo window = the 8 s toast + 4 s for latency (PO 2026-10-13, R5).
export const UNDO_RECONFIRM_WINDOW_MS = 12_000;

export type UndoFailure = { changeSetId: string; code: string; message: string };
export type UndoResult = { undone: { changeSetId: string; undoChangeSetId: string }[]; failed: UndoFailure[] };

class UndoRefusedError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'UndoRefusedError';
  }
}

// Restores the previous confirmation time of exactly the cards the given reconfirmation ChangeSets confirmed. Each undo is
// a new ChangeSet; the original is never edited. A card changed since (revision moved), a ChangeSet past the window or one
// that is not a reconfirmation is refused and reported.
export async function undoReconfirmations(
  ownerUserId: string,
  changeSetIds: string[],
  dependencies: { database?: Database; clock?: Clock } = {},
): Promise<UndoResult> {
  const database = dependencies.database ?? getDatabase();
  const clock = dependencies.clock ?? systemClock;
  const result: UndoResult = { undone: [], failed: [] };
  for (const changeSetId of [...new Set(changeSetIds)].sort()) {
    try {
      const proposal = await database.transaction(async (tx) => {
        const seller = await findSellerByOwner(tx, ownerUserId);
        if (!seller) throw new SellerRequiredError();
        const original = await lockChangeSetByIdAndSeller(tx, changeSetId, seller.id);
        if (!original || original.status !== 'confirmed' || !original.confirmedAt) {
          throw new UndoRefusedError('CHANGE_SET_NOT_UNDOABLE', 'Это подтверждение нельзя отменить.');
        }
        if (clock().getTime() - original.confirmedAt.getTime() > UNDO_RECONFIRM_WINDOW_MS) {
          throw new UndoRefusedError('UNDO_WINDOW_EXPIRED', 'Время для отмены прошло.');
        }
        const items = await lockChangeItems(tx, original.id);
        if (items.length === 0 || items.some((item) => item.action !== 'reconfirm_offer' || !item.previousConfirmedAt || !item.targetOfferId || item.expectedOfferRevision === null)) {
          throw new UndoRefusedError('CHANGE_SET_NOT_UNDOABLE', 'Это подтверждение нельзя отменить.');
        }
        const undo = await createChangeSet(tx, seller.id);
        for (const item of items) {
          const offer = await lockOfferById(tx, item.targetOfferId!);
          if (!offer || offer.sellerId !== seller.id) throw new OfferNotFoundError();
          // The reconfirmation produced revision expected + 1; anything later (edit, switch-off, another confirmation) blocks the undo.
          if (offer.revision !== item.expectedOfferRevision! + 1) throw new OfferChangedError();
          if (offer.priceAmount === null || offer.priceCurrency !== 'KZT') throw new OfferPriceRequiredError();
          await createOfferManagementChangeItem(tx, {
            changeSetId: undo.id,
            action: 'undo_reconfirm_offer',
            card: currentCardFields(offer),
            locationId: offer.locationId,
            priceAmount: offer.priceAmount,
            priceCurrency: 'KZT',
            priceUnit: offer.priceUnit,
            sellerComment: offer.sellerComment,
            targetOfferId: offer.id,
            expectedOfferRevision: offer.revision,
            previousConfirmedAt: item.previousConfirmedAt!,
          });
        }
        return undo;
      });
      const view = await confirmSellerChangeSet(ownerUserId, proposal.id, { database, clock: dependencies.clock });
      result.undone.push({ changeSetId, undoChangeSetId: view.id });
    } catch (error) {
      if (error instanceof UndoRefusedError) {
        result.failed.push({ changeSetId, code: error.code, message: error.message });
      } else if (error instanceof UndoWouldHideError || error instanceof OfferChangedError || error instanceof OfferNotFoundError
        || error instanceof OfferPriceRequiredError || error instanceof OfferAlreadyInactiveError || error instanceof CardRemovedByOperatorError) {
        result.failed.push({ changeSetId, code: error.code, message: error.message });
      } else {
        throw error;
      }
    }
  }
  return result;
}
