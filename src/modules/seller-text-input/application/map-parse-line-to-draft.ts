import type { ProductResolution } from '../../catalog/application/resolve-product';
import type { OfferDraftAiHints, OfferDraftPayload } from '../../offers/drafts/offer-draft.contract';
import type { ParsedTextLine } from '../contracts/seller-text-input.contract';

export type CatalogLink = {
  productId: string | null;
  status: 'resolved' | 'ambiguous' | 'not_found';
};

export function mapParseLineToDraftPayload(
  line: ParsedTextLine,
  inputId: string,
  locationId: string | null,
  catalog: CatalogLink,
): { payload: OfferDraftPayload; uncertainFields: OfferDraftAiHints['uncertainFields'] } {
  const uncertainFields: OfferDraftAiHints['uncertainFields'] = [];
  if (line.confidence === 'low') uncertainFields.push('unit');
  if (!line.price) uncertainFields.push('price');
  if (catalog.status === 'ambiguous') uncertainFields.push('catalog');
  if (catalog.status === 'not_found' && line.title.length < 2) uncertainFields.push('title');

  const payload: OfferDraftPayload = {
    title: line.title,
    productId: catalog.status === 'resolved' ? catalog.productId : null,
    price: line.price ?? '',
    unit: line.unit,
    pack: line.pack,
    sellerComment: '',
    photoIds: [],
    points: locationId ? [{ locationId, ownPrice: null }] : [],
    aiHints: {
      source: 'text',
      inputId,
      uncertainFields,
      catalogStatus: catalog.status,
      sourceQuote: line.sourceQuote,
    },
  };
  return { payload, uncertainFields };
}

export function uncertainMessage(
  fields: OfferDraftAiHints['uncertainFields'],
  catalog: ProductResolution['status'],
): string {
  if (fields.includes('catalog') && catalog === 'ambiguous') return 'Каталог: выберите товар вручную';
  if (fields.includes('unit')) return 'Проверьте единицу измерения';
  if (fields.includes('price')) return 'Укажите цену';
  return 'Проверьте данные';
}
