import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import {
  applyOfferActivation,
  applyOfferDeactivation,
  applyOfferUpdateSnapshot,
  createOffer,
  findOfferById,
  lockOfferById,
  replaceOfferPhotos,
} from '../../offers/infrastructure/offers.repository';
import { assertPhotosOwnedBy } from './assert-photos-owned';
import { systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import {
  disabledSellerCommentTranslationScheduler,
  type PublishedSellerComment,
  type ScheduleSellerCommentTranslations,
} from '../../offers/translation/seller-comment-translator';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  ChangeSetNotFoundError,
  OfferChangedError,
  OfferPriceRequiredError,
  SellerInputInvariantError,
  SellerRequiredError,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import {
  findChangeSetViewByIdAndSeller,
  findItemPhotoIds,
  findOwnedLocation,
  linkResultOffer,
  lockChangeItems,
  lockChangeSetByIdAndSeller,
  markChangeSetConfirmed,
} from '../infrastructure/seller-change-sets.repository';

type LockedOffer = NonNullable<Awaited<ReturnType<typeof lockOfferById>>>;
type LockedItem = Awaited<ReturnType<typeof lockChangeItems>>[number];

function assertPricedItem(item: LockedItem): asserts item is LockedItem & { priceAmount: string; priceCurrency: 'KZT' } {
  if (item.priceAmount === null || item.priceCurrency !== 'KZT') {
    throw new OfferPriceRequiredError();
  }
}

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
  dependencies: {
    database?: Database;
    clock?: Clock;
    scheduleCommentTranslations?: ScheduleSellerCommentTranslations;
  } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  const clock = dependencies.clock ?? systemClock;
  const scheduleCommentTranslations = dependencies.scheduleCommentTranslations
    ?? disabledSellerCommentTranslationScheduler;

  const result = await database.transaction(async (tx) => {
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
      return { view: await loadFinalView(tx, changeSet.id, seller.id), comments: [] as PublishedSellerComment[] };
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
        assertPricedItem(item);
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
      assertPricedItem(item);
      if (item.action === 'activate_offer' && (targetOffer.priceAmount === null || targetOffer.priceCurrency !== 'KZT')) {
        throw new OfferPriceRequiredError();
      }
    }

    // Photos are re-checked at confirm: ownership is part of the proposal's validity, like its Location.
    const itemPhotos = await findItemPhotoIds(tx, items.map((item) => item.id));
    for (const item of items) {
      if (item.photosSpecified && item.action !== 'update_offer') {
        throw new SellerInputInvariantError('photos_specified допустим только у update_offer Item.');
      }
      await assertPhotosOwnedBy(tx, itemPhotos.get(item.id) ?? [], ownerUserId);
    }

    const confirmationTime = clock();
    const comments: PublishedSellerComment[] = [];

    for (const item of items) {
      assertPricedItem(item);
      if (item.action === 'create_offer') {
        const offer = await createOffer(tx, {
          productId: item.productId,
          sellerId: seller.id,
          locationId: item.locationId,
          priceAmount: item.priceAmount,
          priceCurrency: 'KZT',
          priceUnit: item.priceUnit,
          sellerComment: item.sellerComment,
          confirmedAt: confirmationTime,
        });
        if (offer.sellerComment) {
          comments.push({
            offerId: offer.id,
            commentVersion: offer.sellerCommentVersion,
            comment: offer.sellerComment,
          });
        }
        await replaceOfferPhotos(tx, offer.id, itemPhotos.get(item.id) ?? []);
        const linked = await linkResultOffer(tx, item.id, offer.id);
        if (linked.length !== 1) throw new SellerInputInvariantError('Result Offer не удалось связать с create_offer Item.');
        continue;
      }

      const targetOffer = lockedOffers.get(item.targetOfferId!)!;
      let applied: Awaited<ReturnType<typeof applyOfferUpdateSnapshot>>;

      if (item.action === 'update_offer') {
        applied = await applyOfferUpdateSnapshot(tx, {
          offerId: targetOffer.id,
          expectedRevision: item.expectedOfferRevision!,
          priceAmount: item.priceAmount,
          priceCurrency: 'KZT',
          priceUnit: item.priceUnit,
          sellerComment: item.sellerComment,
          sellerCommentChanged: item.sellerComment !== targetOffer.sellerComment,
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

      if (item.action === 'update_offer' && item.photosSpecified) {
        await replaceOfferPhotos(tx, targetOffer.id, itemPhotos.get(item.id) ?? []);
      }

      const appliedOffer = applied[0]!;
      if (item.action === 'update_offer' && item.sellerComment !== targetOffer.sellerComment && appliedOffer.sellerComment) {
        comments.push({
          offerId: appliedOffer.id,
          commentVersion: appliedOffer.sellerCommentVersion,
          comment: appliedOffer.sellerComment,
        });
      }

      const linked = await linkResultOffer(tx, item.id, targetOffer.id);
      if (linked.length !== 1) throw new SellerInputInvariantError('Result Offer не удалось связать с management Change Item.');
    }

    const confirmed = await markChangeSetConfirmed(tx, changeSet.id, confirmationTime);
    if (confirmed.length !== 1) throw new SellerInputInvariantError('Change Set не удалось перевести в confirmed.');

    return { view: await loadFinalView(tx, changeSet.id, seller.id), comments };
  });

  if (result.comments.length > 0) {
    // Translation is best effort: neither a synchronous throw nor a rejection may fail the confirmed ChangeSet.
    try {
      void Promise.resolve(scheduleCommentTranslations(result.comments)).catch(() => {
        console.error('Seller comment translation scheduling failed');
      });
    } catch {
      console.error('Seller comment translation scheduling failed');
    }
  }

  return result.view;
}
