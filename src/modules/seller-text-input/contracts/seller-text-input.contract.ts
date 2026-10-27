import { z } from 'zod';
import type { OfferDraftView } from '../../offers/drafts/offer-draft.contract';
import { packInputSchema } from '../../offers/pack/pack';
import { priceUnitInputSchema } from '../../offers/price-unit/price-unit';
import type {
  AvailabilityStatement,
  AvailabilityStatementView,
} from '../../seller-input/contracts/availability.contract';

// A «нет в наличии» statement as a parser produced it; the matching against the point's cards lives in seller-input.
export type UnavailableStatement = AvailabilityStatement;

export const SELLER_TEXT_INPUT_MAX_LENGTH = 4000;

export const sellerTextInputBodySchema = z.object({
  text: z.string().trim().min(1).max(SELLER_TEXT_INPUT_MAX_LENGTH),
  // seller-ai-text-real-parser §6.4: client-chosen id of one submitted text; retries of that text reuse it.
  requestId: z.uuid().optional(),
  // The Seller's trading point the drafts are prepared for (connected journey, contract §16); must be the Seller's own.
  locationId: z.uuid().optional(),
}).strict();

export const uncertainLineFieldSchema = z.enum(['price', 'unit', 'pack', 'title']);

export const parsedTextLineSchema = z.object({
  title: z.string().trim().min(1).max(200),
  price: z.string().trim().max(40).nullable(),
  unit: priceUnitInputSchema.nullable(),
  pack: packInputSchema.nullable(),
  confidence: z.enum(['high', 'low']),
  sourceQuote: z.string().max(500).nullable(),
  // seller-ai-text-real-parser §7: set by the real parser; absent → slice-1 mapping from `confidence`.
  uncertainFields: z.array(uncertainLineFieldSchema).optional(),
  notice: z.string().trim().min(1).max(300).optional(),
}).strict();

export const skippedTextLineSchema = z.object({
  label: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(300),
  sourceQuote: z.string().max(500).nullable(),
}).strict();

export type ParsedTextLine = z.infer<typeof parsedTextLineSchema>;
export type SkippedTextLine = z.infer<typeof skippedTextLineSchema>;

export type SellerTextParser = 'fake' | 'real';

export type SellerTextParseResult = {
  lines: ParsedTextLine[];
  skipped: SkippedTextLine[];
  // Omission hints of the real parser («Строка не разобрана», «Число не использовано»); never a completeness claim.
  notices?: string[];
  // text-availability §4.1 item 1: «нет в наличии» statements; never drafts.
  unavailable?: UnavailableStatement[];
};

export type UncertainDraftNotice = {
  draftId: string;
  fields: ('price' | 'unit' | 'pack' | 'catalog' | 'title')[];
  message: string;
};

export type SellerTextInputResponse = {
  inputId: string;
  rawText: string;
  parser: SellerTextParser;
  drafts: OfferDraftView[];
  skipped: SkippedTextLine[];
  uncertain: UncertainDraftNotice[];
  notices: string[];
  // Replay (§6.4 rule 3): drafts of this submission already published or deleted; never recreated. 0 on a first answer.
  unavailableDrafts: number;
  publishedDrafts: number;
  deletedDrafts: number;
  // text-availability §4.1 items 3–4: «нет в наличии» statements with candidates from current data, and the
  // switch-off proposals of this list that still wait for confirmation.
  availability: AvailabilityStatementView[];
  pendingChangeSetIds: string[];
};

// text-availability §4.1 item 5: what the Seller saw for each statement acted on, and what they ticked.
export const availabilityProposalBodySchema = z.object({
  statements: z.array(z.object({
    index: z.number().int().min(0).max(59),
    shown: z.array(z.object({ offerId: z.uuid(), revision: z.number().int().min(1) }).strict()).max(60),
    selected: z.array(z.uuid()).max(30),
  }).strict()).min(1).max(60),
}).strict();

export type AvailabilityProposalBody = z.infer<typeof availabilityProposalBodySchema>;

// Another Seller's, an expired or an unknown review: the same answer as review recovery (seller-ai-text-real-parser §16).
export class TextInputReviewUnavailableError extends Error {
  readonly code = 'TEXT_INPUT_REVIEW_UNAVAILABLE' as const;
  constructor() {
    super('Разбор этого списка недоступен.');
    this.name = 'TextInputReviewUnavailableError';
  }
}

export class TextAvailabilityChangedError extends Error {
  readonly code = 'TEXT_AVAILABILITY_CHANGED' as const;
  constructor(readonly availability: AvailabilityStatementView[], readonly changed: number[]) {
    super('Карточки изменились — отметьте заново.');
    this.name = 'TextAvailabilityChangedError';
  }
}

// A stored submission as the review screen recovers it (§16): never the raw text, which is not kept on the server.
export type SellerTextSubmissionView = Omit<SellerTextInputResponse, 'rawText'> & {
  status: 'processing' | 'succeeded' | 'failed';
  locationId: string | null;
  createdAt: string;
  expiresAt: string;
};

export type SellerTextSubmissionSummary = {
  inputId: string;
  createdAt: string;
  expiresAt: string;
  drafts: number;
  skipped: number;
  notices: number;
};

export class TextInputPointRequiredError extends Error {
  readonly code = 'TEXT_INPUT_POINT_REQUIRED' as const;
  constructor() {
    super('Сначала создайте торговую точку.');
    this.name = 'TextInputPointRequiredError';
  }
}

export class TextInputPointNotFoundError extends Error {
  readonly code = 'TEXT_INPUT_POINT_NOT_FOUND' as const;
  constructor() {
    super('Эта торговая точка не найдена. Выберите свою точку.');
    this.name = 'TextInputPointNotFoundError';
  }
}

export class TextInputUnavailableError extends Error {
  readonly code = 'TEXT_INPUT_UNAVAILABLE' as const;
  constructor() {
    super('Текстовый ввод сейчас недоступен.');
    this.name = 'TextInputUnavailableError';
  }
}

export type TextInputFailureCode = 'TEXT_INPUT_TIMEOUT' | 'TEXT_INPUT_FAILED' | 'TEXT_INPUT_BUSY';

const FAILURE_MESSAGES: Record<TextInputFailureCode, string> = {
  TEXT_INPUT_TIMEOUT: 'Сервис разбора не ответил вовремя. Попробуйте ещё раз.',
  TEXT_INPUT_FAILED: 'Не удалось разобрать текст. Попробуйте ещё раз.',
  TEXT_INPUT_BUSY: 'Сервис занят, попробуйте через минуту.',
};

// Answer-level failure (§6.2): the whole request is rejected and nothing is created. `reason` is a short technical code
// for logs; it never contains seller text or model output.
export class TextInputParserError extends Error {
  constructor(readonly code: TextInputFailureCode, readonly reason: string) {
    super(FAILURE_MESSAGES[code]);
    this.name = 'TextInputParserError';
  }
}

export class TextInputRequestConflictError extends Error {
  readonly code = 'TEXT_INPUT_REQUEST_CONFLICT' as const;
  constructor() {
    super('Этот запрос уже отправлен с другим текстом. Отправьте текст заново.');
    this.name = 'TextInputRequestConflictError';
  }
}
