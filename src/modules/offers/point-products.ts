import type { SellerOfferView } from './contracts/seller-offer.contract';
import type { OfferDraftView } from './drafts/offer-draft.contract';

// seller-ai-text-real-parser §21: the products of ONE trading point as the Seller's point workspace lists them — the
// point's cards (its offers, archived ones excluded) and the drafts prepared for it. `total` is exactly what the default
// list shows, so «Товары точки · N» and the list never disagree.
export function pointProducts(offers: SellerOfferView[], drafts: OfferDraftView[], locationId: string) {
  const pointOffers = offers.filter((offer) => offer.location.id === locationId && offer.actuality.stage !== 'archived');
  const pointDrafts = drafts.filter((draft) => draft.payload.points.some((point) => point.locationId === locationId));
  return {
    offers: pointOffers,
    drafts: pointDrafts,
    total: new Set(pointOffers.map((offer) => offer.cardId)).size + pointDrafts.length,
  };
}
