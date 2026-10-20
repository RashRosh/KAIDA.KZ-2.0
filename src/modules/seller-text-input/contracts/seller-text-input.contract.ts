import { z } from 'zod';
import type { OfferDraftView } from '../../offers/drafts/offer-draft.contract';
import { packInputSchema } from '../../offers/pack/pack';
import { priceUnitInputSchema } from '../../offers/price-unit/price-unit';

export const SELLER_TEXT_INPUT_MAX_LENGTH = 4000;

export const sellerTextInputBodySchema = z.object({
  text: z.string().trim().min(1).max(SELLER_TEXT_INPUT_MAX_LENGTH),
}).strict();

export const parsedTextLineSchema = z.object({
  title: z.string().trim().min(1).max(200),
  price: z.string().trim().max(40).nullable(),
  unit: priceUnitInputSchema.nullable(),
  pack: packInputSchema.nullable(),
  confidence: z.enum(['high', 'low']),
  sourceQuote: z.string().max(500).nullable(),
}).strict();

export const skippedTextLineSchema = z.object({
  label: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(300),
  sourceQuote: z.string().max(500).nullable(),
}).strict();

export type ParsedTextLine = z.infer<typeof parsedTextLineSchema>;
export type SkippedTextLine = z.infer<typeof skippedTextLineSchema>;

export type SellerTextParseResult = {
  lines: ParsedTextLine[];
  skipped: SkippedTextLine[];
};

export type UncertainDraftNotice = {
  draftId: string;
  fields: ('price' | 'unit' | 'pack' | 'catalog' | 'title')[];
  message: string;
};

export type SellerTextInputResponse = {
  inputId: string;
  rawText: string;
  drafts: OfferDraftView[];
  skipped: SkippedTextLine[];
  uncertain: UncertainDraftNotice[];
};

export class TextInputUnavailableError extends Error {
  readonly code = 'TEXT_INPUT_UNAVAILABLE' as const;
  constructor() {
    super('Текстовый ввод сейчас недоступен.');
    this.name = 'TextInputUnavailableError';
  }
}
