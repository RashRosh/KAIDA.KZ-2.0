import { and, eq, gt } from 'drizzle-orm';
import { validateOfferValidityPeriodHours } from '../config/offer-lifecycle.config';
import { offers } from '../db/offers.table';

export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function calculateOfferCutoff(now: Date, validityPeriodHours: number): Date {
  const validatedHours = validateOfferValidityPeriodHours(validityPeriodHours);
  return new Date(now.getTime() - validatedHours * 60 * 60 * 1000);
}

export function visibleOffersPredicate(cutoff: Date) {
  return and(
    eq(offers.status, 'active'),
    gt(offers.lastConfirmedAt, cutoff),
  );
}
