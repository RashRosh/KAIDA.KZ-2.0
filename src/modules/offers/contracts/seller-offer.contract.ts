import type { OfferStatus } from '../db/offers.table';
import type { PriceUnit } from '../price-unit/price-unit';
import type { Pack } from '../pack/pack';
import type { SellerRemovalView } from '../../moderation/contracts/moderation.contract';
import type { ActualityView } from '../actuality/actuality';

export type SellerOfferView = {
  id: string;
  // name is the Seller's own title; id is the optional catalog link.
  product: { id: string | null; name: string; nameLocale?: 'ru' | 'kk' };
  // Offers of one product in several points share cardId and title, unit, pack, comment and photos.
  cardId: string;
  revision: number;
  priceOwn: boolean;
  pack: Pack | null;
  packLabel: string | null;
  location: { id: string; name: string; addressText: string };
  // unit is the display label in the requested locale; unitChoice is the stored structured value for edit forms.
  price: { amount: string; currency: 'KZT'; unit: string | null; unitChoice: PriceUnit | null } | null;
  sellerComment: string | null;
  // Ordered photos, first = cover; present only when the Offer has photos.
  photos?: { id: string }[];
  status: OfferStatus;
  lastConfirmedAt: string;
  updatedAt: string;
  // Whether Search and Nearby currently show this Offer, by the same policy as the buyer read.
  buyerVisible: boolean;
  // offer-actuality: age of this point since its last confirmation, by the server's thresholds.
  actuality: ActualityView;
  // operator-post-check: set while an operator has the whole card removed from the showcase.
  removal: SellerRemovalView | null;
};

export class SellerOffersSellerRequiredError extends Error {
  readonly code = 'SELLER_REQUIRED' as const;
  constructor() {
    super('Сначала создайте продавца и точку.');
    this.name = 'SellerOffersSellerRequiredError';
  }
}

export class SellerOfferInvariantError extends Error {
  readonly code = 'SELLER_OFFER_INVARIANT' as const;
  constructor(message = 'Нарушена целостность предложения продавца.') {
    super(message);
    this.name = 'SellerOfferInvariantError';
  }
}
