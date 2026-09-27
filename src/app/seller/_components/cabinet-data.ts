import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import { formatAmount } from '../../_components/OfferCard';

export function formatOfferPrice(price: SellerOfferView['price']) {
  if (!price) return null;
  return { amount: `${formatAmount(price.amount)} ₸`, unit: price.unit };
}
