import type { OfferStatus } from '../db/offers.table';
import type { PriceUnit } from '../price-unit/price-unit';

export type SellerOfferView = {
  id: string;
  product: { id: string; name: string; nameLocale?: 'ru' | 'kk' };
  location: { id: string; name: string; addressText: string };
  // unit is the display label in the requested locale; unitChoice is the stored structured value for edit forms.
  price: { amount: string; currency: 'KZT'; unit: string | null; unitChoice: PriceUnit | null } | null;
  sellerComment: string | null;
  // Ordered photos, first = cover; present only when the Offer has photos.
  photos?: { id: string }[];
  status: OfferStatus;
  lastConfirmedAt: string;
  // Whether Search and Nearby currently show this Offer, by the same policy as the buyer read.
  buyerVisible: boolean;
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
