import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PROBLEM_REASONS, submitVisitOutcomeSchema } from '../../src/modules/moderation/contracts/visit-outcome.contract';
import { REPORT_REASONS } from '../../src/modules/moderation/contracts/report.contract';

const VERSION = 'a'.repeat(64);
const base = { submissionId: randomUUID(), version: VERSION, locale: 'ru' as const };

describe('visit-outcome contract (CJM 24.11 #2)', () => {
  it('exposes the exact 5 PO 24.11 problem reasons and keeps legacy description_wrong in REPORT_REASONS', () => {
    expect(PROBLEM_REASONS).toEqual(['out_of_stock', 'price_mismatch', 'photo_mismatch', 'point_closed', 'other']);
    expect(REPORT_REASONS).toContain('description_wrong');
    for (const reason of PROBLEM_REASONS) expect(REPORT_REASONS).toContain(reason);
  });

  it('accepts matched outcome cleanly and rejects reason/text/photoId on matched', () => {
    expect(submitVisitOutcomeSchema.parse({ ...base, outcome: 'matched' })).toEqual({
      ...base,
      outcome: 'matched',
      hasVisitSignal: false,
    });
    expect(submitVisitOutcomeSchema.parse({ ...base, outcome: 'matched', hasVisitSignal: true }).hasVisitSignal).toBe(true);
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'matched', reason: 'other' }).success).toBe(false);
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'matched', text: 'hi' }).success).toBe(false);
  });

  it('accepts every problem reason with optional comment, allows photo_mismatch without photoId, and forbids photoId on other reasons', () => {
    for (const reason of PROBLEM_REASONS) {
      const parsed = submitVisitOutcomeSchema.parse({ ...base, outcome: 'problem', reason, text: '  проверка  ' });
      expect(parsed.outcome).toBe('problem');
      if (parsed.outcome === 'problem') {
        expect(parsed.reason).toBe(reason);
        expect(parsed.text).toBe('проверка');
        expect(parsed.photoId).toBeNull();
      }
    }
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'problem', reason: 'photo_mismatch', photoId: randomUUID() }).success).toBe(true);
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'problem', reason: 'price_mismatch', photoId: randomUUID() }).success).toBe(false);
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'problem', reason: 'description_wrong' }).success).toBe(false);
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'problem', reason: 'other', text: 'x'.repeat(301) }).success).toBe(false);
    expect(submitVisitOutcomeSchema.safeParse({ ...base, outcome: 'problem', reason: 'other', reporterUserId: randomUUID() }).success).toBe(false);
  });
});
