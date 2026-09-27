import { randomUUID } from 'node:crypto';
import type { Pack } from '../../offers/pack/pack';
import type { ChangeItemCardFields } from '../infrastructure/seller-change-sets.repository';

// seller-showcase-editor: a catalog-only create (single S4 create, S12 batch) is a new one-point card titled with the
// catalog's Russian name.
export function newCatalogCard(product: { id: string; name: string }): ChangeItemCardFields {
  return { title: product.name, productId: product.id, cardId: randomUUID(), priceOwn: false, pack: null };
}

// A per-Offer change (S5, S12) keeps the Offer's card fields as they are.
export function currentCardFields(offer: {
  title: string;
  productId: string | null;
  cardId: string;
  priceOwn: boolean;
  pack: Pack | null;
}): ChangeItemCardFields {
  return { title: offer.title, productId: offer.productId, cardId: offer.cardId, priceOwn: offer.priceOwn, pack: offer.pack };
}
