import { randomUUID } from 'node:crypto';
import { lockCardOffers, type OfferWriteDb } from '../../offers/infrastructure/offers.repository';
import { samePriceUnit, type PriceUnit } from '../../offers/price-unit/price-unit';
import { CardSharedFieldsError, WholesaleReviewRequiredError } from '../contracts/seller-card.contract';
import type { Pack } from '../../offers/pack/pack';
import { wholesaleNeedsPerContainer, type Wholesale } from '../../offers/wholesale/wholesale';
import type { ChangeItemCardFields } from '../infrastructure/seller-change-sets.repository';

// seller-showcase-editor: a catalog-only create (single S4 create, S12 batch) is a new one-point card titled with the
// catalog's Russian name.
export function newCatalogCard(product: { id: string; name: string }): ChangeItemCardFields {
  return { title: product.name, productId: product.id, cardId: randomUUID(), priceOwn: false, pack: null, wholesale: null };
}

// A per-Offer change (S5, S12) keeps the Offer's card fields as they are.
export function currentCardFields(offer: {
  title: string;
  productId: string | null;
  cardId: string;
  priceOwn: boolean;
  pack: Pack | null;
  wholesale: Wholesale | null;
}): ChangeItemCardFields {
  return { title: offer.title, productId: offer.productId, cardId: offer.cardId, priceOwn: offer.priceOwn, pack: offer.pack, wholesale: offer.wholesale };
}

function amount(value: string) {
  return Number(value);
}

// A per-Offer price change (S5 / S12) on a card sold in several points: shared fields stay equal across the card,
// so only the price may change here; a price different from the card's common price becomes this point's own price.
export async function perOfferUpdateCardFields(
  database: OfferWriteDb,
  offer: { id: string; sellerId: string; title: string; productId: string | null; cardId: string; priceOwn: boolean; pack: Pack | null; wholesale: Wholesale | null; priceUnit: PriceUnit | null; sellerComment: string | null },
  next: { price: string; unit: PriceUnit | null; sellerComment: string | null; photosChanged: boolean },
): Promise<ChangeItemCardFields> {
  // wholesale-price §3.4 / wholesale-only: a per-Offer path cannot change the unit of a card with wholesale,
  // nor add a retail price onto a wholesale-only card that has no container conversion.
  if (offer.wholesale !== null && (!samePriceUnit(offer.priceUnit, next.unit) || wholesaleNeedsPerContainer(offer.wholesale))) {
    throw new WholesaleReviewRequiredError();
  }
  const card = await lockCardOffers(database, offer.cardId, offer.sellerId);
  if (card.length <= 1) return currentCardFields(offer);
  const sharedChanged = !samePriceUnit(offer.priceUnit, next.unit)
    || (offer.sellerComment?.trim() || null) !== next.sellerComment
    || next.photosChanged;
  if (sharedChanged) throw new CardSharedFieldsError();
  const common = card.find((other) => other.id !== offer.id && !other.priceOwn)?.priceAmount ?? null;
  return { ...currentCardFields(offer), priceOwn: common === null || amount(common) !== amount(next.price) };
}
