import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { CardRemovedByOperatorError } from '../../moderation/contracts/moderation.contract';
import { findActiveRemovals } from '../../moderation/infrastructure/moderation.repository';
import { lockCardOffers } from '../../offers/infrastructure/offers.repository';
import type { Clock } from '../../offers/lifecycle/offer-lifecycle';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { currentCardFields } from './card-fields';
import { confirmSellerChangeSet } from './confirm-seller-change-set';
import {
  OfferAlreadyInactiveError,
  OfferNotFoundError,
  OfferPriceRequiredError,
  SellerRequiredError,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import { createChangeSet, createOfferManagementChangeItem } from '../infrastructure/seller-change-sets.repository';

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
