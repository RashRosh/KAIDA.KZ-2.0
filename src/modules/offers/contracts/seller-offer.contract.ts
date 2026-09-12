import type { OfferStatus } from '../db/offers.table';

export type SellerOfferView = {
  id: string;
  product: { id: string; name: string };
  location: { id: string; name: string; addressText: string };
  price: { amount: string; currency: 'KZT'; unit: string | null } | null;
  sellerComment: string | null;
  status: OfferStatus;
  lastConfirmedAt: string;
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
