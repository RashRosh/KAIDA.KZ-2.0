import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findOfferPhotoIds, findOwnedOfferForManagement } from '../../offers/infrastructure/offers.repository';
import { samePriceUnit, type PriceUnit } from '../../offers/price-unit/price-unit';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { assertPhotosOwnedBy } from './assert-photos-owned';
import {
  OfferAlreadyInactiveError,
  OfferNotFoundError,
  OfferPriceRequiredError,
  OfferUpdateNoChangesError,
  SellerInputInvariantError,
  SellerRequiredError,
  type SellerChangeSetView,
  type SellerOfferChangeInput,
} from '../contracts/seller-change-set.contract';
import {
  createChangeSet,
  createOfferManagementChangeItem,
  findChangeSetViewByIdAndSeller,
  insertItemPhotos,
} from '../infrastructure/seller-change-sets.repository';

function normalizeNullableText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function canonicalDecimal(value: string): string {
  const [rawWhole, rawFraction = ''] = value.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  const fraction = rawFraction.replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

export function offerUpdateIsNoOp(
  offer: {
    priceAmount: string | null;
    priceCurrency: string | null;
    priceUnit: PriceUnit | null;
    sellerComment: string | null;
  },
  input: Extract<SellerOfferChangeInput, { action: 'update_offer' }>,
  currentPhotoIds: string[] = [],
): boolean {
  const currentComment = normalizeNullableText(offer.sellerComment);
  if (offer.priceAmount === null || offer.priceCurrency !== 'KZT') return false;
  const samePhotos = input.photoIds === undefined
    || (input.photoIds.length === currentPhotoIds.length && input.photoIds.every((id, index) => id === currentPhotoIds[index]));

  return canonicalDecimal(offer.priceAmount) === canonicalDecimal(input.price.amount)
    && samePriceUnit(offer.priceUnit, input.price.unit)
    && currentComment === input.sellerComment
    && samePhotos;
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

export async function createOfferManagementChangeSet(
  ownerUserId: string,
  offerId: string,
  input: SellerOfferChangeInput,
  dependencies: { database?: Database } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();

  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new SellerRequiredError();

    const offer = await findOwnedOfferForManagement(tx, offerId, seller.id);
    if (!offer) throw new OfferNotFoundError();
    if (offer.locationSellerId !== seller.id) {
      throw new SellerInputInvariantError('Location target Offer не принадлежит Seller.');
    }
    if (!Number.isInteger(offer.revision) || offer.revision < 1) {
      throw new SellerInputInvariantError('Target Offer содержит некорректную revision.');
    }

    let priceAmount: string;
    let priceUnit: PriceUnit | null;
    let sellerComment: string | null;
    let photoIds: string[] | undefined;

    if (input.action === 'update_offer') {
      if (offerUpdateIsNoOp(offer, input, await findOfferPhotoIds(tx, offer.id))) throw new OfferUpdateNoChangesError();
      photoIds = input.photoIds;
      if (photoIds) await assertPhotosOwnedBy(tx, photoIds, ownerUserId);
      priceAmount = input.price.amount;
      priceUnit = input.price.unit;
      sellerComment = input.sellerComment;
    } else {
      if (input.action === 'deactivate_offer' && offer.status === 'inactive') {
        throw new OfferAlreadyInactiveError();
      }
      const currentPrice = normalizedCurrentPrice(offer);
      if (!currentPrice) throw new OfferPriceRequiredError();
      priceAmount = currentPrice.amount;
      priceUnit = currentPrice.unit;
      sellerComment = normalizeNullableText(offer.sellerComment);
    }

    const changeSet = await createChangeSet(tx, seller.id);
    const item = await createOfferManagementChangeItem(tx, {
      changeSetId: changeSet.id,
      action: input.action,
      productId: offer.productId,
      locationId: offer.locationId,
      priceAmount,
      priceCurrency: 'KZT',
      priceUnit,
      sellerComment,
      targetOfferId: offer.id,
      expectedOfferRevision: offer.revision,
      photosSpecified: photoIds !== undefined,
    });
    if (photoIds) await insertItemPhotos(tx, item.id, photoIds);

    const view = await findChangeSetViewByIdAndSeller(tx, changeSet.id, seller.id);
    if (!view || view.items.length !== 1 || view.items[0]?.resultOffer !== null) {
      throw new SellerInputInvariantError('Созданный S5 Seller Change Set не удалось восстановить из базы.');
    }
    return view;
  });
}
