import type { ProductResolution } from '../../catalog/application/resolve-product';
import type { OfferDraftAiHints, OfferDraftPayload } from '../../offers/drafts/offer-draft.contract';
import type { ParsedTextLine, SellerTextParser } from '../contracts/seller-text-input.contract';

export type CatalogLink = {
  productId: string | null;
  status: 'resolved' | 'ambiguous' | 'not_found';
};

export type DraftProvenance = { parser: SellerTextParser; parserConfig?: string };

export function mapParseLineToDraftPayload(
  line: ParsedTextLine,
  inputId: string,
  locationId: string | null,
  catalog: CatalogLink,
  provenance?: DraftProvenance,
): { payload: OfferDraftPayload; uncertainFields: OfferDraftAiHints['uncertainFields'] } {
  const uncertainFields: OfferDraftAiHints['uncertainFields'] = [];
  if (line.uncertainFields) {
    // Real parser (seller-ai-text-real-parser §6.3): fields the code could not bind to this product.
    uncertainFields.push(...line.uncertainFields);
    if (!line.price && !uncertainFields.includes('price')) uncertainFields.push('price');
  } else {
    if (line.confidence === 'low') uncertainFields.push('unit');
    if (!line.price) uncertainFields.push('price');
  }
  if (catalog.status === 'ambiguous') uncertainFields.push('catalog');
  if (catalog.status === 'not_found' && line.title.length < 2 && !uncertainFields.includes('title')) uncertainFields.push('title');

  const aiHints: OfferDraftAiHints = {
    source: 'text',
    inputId,
    uncertainFields,
    catalogStatus: catalog.status,
    sourceQuote: line.sourceQuote,
  };
  if (provenance) {
    aiHints.parser = provenance.parser;
    if (provenance.parserConfig) aiHints.parserConfig = provenance.parserConfig;
  }

  const payload: OfferDraftPayload = {
    title: line.title,
    productId: catalog.status === 'resolved' ? catalog.productId : null,
    price: line.price ?? '',
    unit: line.unit,
    pack: line.pack,
    sellerComment: '',
    photoIds: [],
    points: locationId ? [{ locationId, ownPrice: null }] : [],
    aiHints,
  };
  return { payload, uncertainFields };
}

export function uncertainMessage(
  fields: OfferDraftAiHints['uncertainFields'],
  catalog: ProductResolution['status'],
  notice?: string,
): string {
  const catalogNote = fields.includes('catalog') && catalog === 'ambiguous' ? 'Каталог: выберите товар вручную' : null;
  if (notice) return catalogNote ? `${catalogNote}; ${notice}` : notice;
  if (catalogNote) return catalogNote;
  if (fields.includes('unit')) return 'Проверьте единицу измерения';
  if (fields.includes('price')) return 'Укажите цену';
  return 'Проверьте данные';
}
