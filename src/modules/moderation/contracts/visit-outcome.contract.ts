import { z } from 'zod';

// CJM 24.11 #2 (P1-14): the 5 standard buyer problem reasons (PO 24.11.2026).
export const PROBLEM_REASONS = ['out_of_stock', 'price_mismatch', 'photo_mismatch', 'point_closed', 'other'] as const;
export type ProblemReason = typeof PROBLEM_REASONS[number];
export type VisitOutcomeKind = 'matched' | 'problem';

export const VISIT_OUTCOME_PROBLEM_QUOTA_24H = 5;
export const VISIT_OUTCOME_MATCHED_QUOTA_24H = 20;

const baseFields = {
  submissionId: z.uuid(),
  version: z.string().regex(/^[a-f0-9]{64}$/),
  locale: z.enum(['ru', 'kk']),
  hasVisitSignal: z.boolean().default(false),
};

export const submitVisitOutcomeSchema = z.discriminatedUnion('outcome', [
  z.object({
    ...baseFields,
    outcome: z.literal('matched'),
  }).strict(),
  z.object({
    ...baseFields,
    outcome: z.literal('problem'),
    reason: z.enum(PROBLEM_REASONS),
    text: z.string().trim().max(300).default(''),
    photoId: z.uuid().nullable().default(null),
  }).strict(),
]).superRefine((value, ctx) => {
  if (value.outcome === 'problem' && value.reason !== 'photo_mismatch' && value.photoId !== null) {
    ctx.addIssue({ code: 'custom', message: 'photoId is only allowed for photo_mismatch', path: ['photoId'] });
  }
});

export type SubmitVisitOutcome = z.infer<typeof submitVisitOutcomeSchema>;

export type VisitOutcomeResult = {
  id: string;
  outcome: VisitOutcomeKind;
  isVerified: boolean;
  duplicate: boolean;
  reportId: string | null;
};

export class VisitOutcomeError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'STALE_CONTEXT' | 'RETRY_CONFLICT' | 'REPORT_QUOTA' | 'OUTCOME_QUOTA' | 'INVALID_PHOTO',
    readonly status: number,
  ) {
    super(code);
  }
}
