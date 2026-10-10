import { z } from 'zod';
import { REMOVAL_REASONS } from './moderation.contract';

export const REPORT_REASONS = ['price_mismatch', 'photo_mismatch', 'description_wrong', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
export const submitReportSchema = z.object({
  submissionId: z.uuid(), offerId: z.uuid(), version: z.string().regex(/^[a-f0-9]{64}$/),
  locale: z.enum(['ru', 'kk']), reason: z.enum(REPORT_REASONS),
  text: z.string().trim().max(300).default(''), photoId: z.uuid().nullable().default(null),
}).strict().refine(v => v.reason === 'photo_mismatch' || v.photoId === null);
export type SubmitReport = z.infer<typeof submitReportSchema>;
export const resolveReportSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  disposition: z.enum(['removed', 'already_removed', 'returned', 'no_action']),
  reason: z.enum(REMOVAL_REASONS).nullable().default(null),
  sellerComment: z.string().trim().max(300).default(''),
  rationale: z.string().trim().max(300).default(''),
}).strict().refine(v => v.disposition !== 'removed' || v.reason !== null)
  .refine(v => !['returned', 'no_action'].includes(v.disposition) || v.rationale.length > 0)
  .refine(v => v.disposition === 'removed' || (v.reason === null && v.sellerComment === ''));
export type ResolveReport = z.infer<typeof resolveReportSchema>;
export type ReportPoint = { offerId: string; locationId: string; name: string; address: string; amount: string; currency: string; basis: string | null };
export type ReportEvidence = {
  cardId: string; offerId: string; locale: 'ru' | 'kk'; version: string;
  title: string; pack: string | null; originalComment: string | null; displayedComment: string | null;
  photoIds: string[]; points: ReportPoint[];
};
export type ReportContext = { evidence: ReportEvidence; available: boolean; token: string; removal: { id: string; reason: string; comment: string | null; at: string } | null };
export type OperatorReport = {
  id: string; at: string; reason: ReportReason; text: string; photoId: string | null;
  evidence: ReportEvidence; current: ReportContext | null;
  closedAt: string | null; disposition: ResolveReport['disposition'] | null; rationale: string | null;
  moderationId: string | null;
};
export type ReportPage = { rows: Pick<OperatorReport, 'id' | 'at' | 'reason' | 'evidence' | 'closedAt' | 'disposition'>[]; hasMore: boolean; openCount: number };
export class ReportError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'STALE_CONTEXT' | 'RETRY_CONFLICT' | 'REPORT_QUOTA' | 'INVALID_PHOTO' | 'DECISION_CONFLICT', readonly status: number) { super(code); }
}
// Explicit opt-in for synthetic isolated testing; no production/real-user rollout.
export function reportsEnabled() { return process.env.BUYER_REPORTS_LOCAL_TESTING === '1'; }
