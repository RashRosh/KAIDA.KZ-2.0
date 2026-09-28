import { z } from 'zod';

// operator-post-check: the reasons of M06 (PO decision d) and the operator API shapes.
export const REMOVAL_REASONS = ['prohibited_item', 'photo_mismatch', 'contacts_or_ads', 'other'] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

export const removalBodySchema = z.object({
  reason: z.enum(REMOVAL_REASONS),
  comment: z.string().trim().max(300)
    .transform((value) => value === '' ? null : value)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
}).strict();

export const feedQuerySchema = z.object({
  tab: z.enum(['new', 'all']).default('new'),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const seenBodySchema = z.object({ until: z.iso.datetime({ offset: true }) }).strict();

export const cardIdSchema = z.uuid();

// What the Seller sees about a removal: no operator identity (contract §2 «Remove and return»).
export type SellerRemovalView = {
  reason: RemovalReason;
  comment: string | null;
  removedAt: string;
};

export type OperatorRemovalView = SellerRemovalView;

export type FeedEventKind = 'new' | 'changed' | 'republished';

export type OperatorFeedRow = {
  eventId: string;
  cardId: string;
  kind: FeedEventKind;
  at: string;
  title: string;
  packLabel: string | null;
  price: { amount: string; unit: string } | null;
  pointName: string;
  morePoints: number;
  sellerPhone: string;
  coverPhotoId: string | null;
  removal: OperatorRemovalView | null;
};

export type OperatorFeedPage = {
  rows: OperatorFeedRow[];
  hasMore: boolean;
  newCount: number;
  seenUntil: string | null;
};

export type OperatorCardView = {
  cardId: string;
  title: string;
  packLabel: string | null;
  sellerComment: string | null;
  photoIds: string[];
  sellerPhone: string;
  points: { offerId: string; name: string; addressText: string; price: { amount: string; unit: string } | null; active: boolean }[];
  removal: OperatorRemovalView | null;
};

export class OperatorCardNotFoundError extends Error {
  readonly code = 'CARD_NOT_FOUND' as const;
  constructor() {
    super('Карточка не найдена.');
    this.name = 'OperatorCardNotFoundError';
  }
}

export class CardRemovedByOperatorError extends Error {
  readonly code = 'CARD_REMOVED_BY_OPERATOR' as const;
  constructor() {
    super('Карточку снял оператор. Исправьте её и опубликуйте снова.');
    this.name = 'CardRemovedByOperatorError';
  }
}

// «+7 707 ··· 12»: enough for an operator to tell Sellers apart, not a usable number.
export function maskPhone(phoneE164: string | null): string {
  if (!phoneE164) return '—';
  if (/^\+7\d{10}$/.test(phoneE164)) return `+7 ${phoneE164.slice(2, 5)} ··· ${phoneE164.slice(-2)}`;
  return `${phoneE164.slice(0, 4)} ··· ${phoneE164.slice(-2)}`;
}
