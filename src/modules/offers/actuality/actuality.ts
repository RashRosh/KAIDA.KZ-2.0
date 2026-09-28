import { readOfferValidityPeriodHours, validateOfferValidityPeriodHours } from '../config/offer-lifecycle.config';

// offer-actuality §2: the age of one offer (point) since its last confirmation decides what buyers and the Seller see.
// Thresholds are server settings in hours; changing them needs no data migration.

export type ActualityStage = 'fresh' | 'ageing' | 'hidden' | 'archived';

export type ActualityPolicy = {
  dueHours: number;
  ageingHours: number;
  hiddenHours: number;
  archiveHours: number;
};

export const ACTUALITY_DEFAULTS = { dueHours: 24, ageingHours: 48, archiveHours: 336 } as const;

const HOUR_MS = 60 * 60 * 1000;

export function validateActualityPolicy(policy: ActualityPolicy): ActualityPolicy {
  const { dueHours, ageingHours, hiddenHours, archiveHours } = policy;
  for (const value of [dueHours, ageingHours, hiddenHours, archiveHours]) validateOfferValidityPeriodHours(value);
  if (!(dueHours <= ageingHours && ageingHours < hiddenHours && hiddenHours < archiveHours)) {
    throw new Error('Actuality thresholds must grow: due ≤ ageing < hidden < archive');
  }
  return policy;
}

function hoursSetting(env: Readonly<Record<string, string | undefined>>, name: string, fallback: number): number {
  const raw = env[name];
  return raw === undefined || raw === '' ? fallback : validateOfferValidityPeriodHours(raw);
}

export function readActualityPolicy(env: Readonly<Record<string, string | undefined>> = process.env): ActualityPolicy {
  return validateActualityPolicy({
    dueHours: hoursSetting(env, 'ACTUALITY_DUE_HOURS', ACTUALITY_DEFAULTS.dueHours),
    ageingHours: hoursSetting(env, 'ACTUALITY_AGEING_HOURS', ACTUALITY_DEFAULTS.ageingHours),
    hiddenHours: readOfferValidityPeriodHours(env),
    archiveHours: hoursSetting(env, 'ACTUALITY_ARCHIVE_HOURS', ACTUALITY_DEFAULTS.archiveHours),
  });
}

export function actualityAgeMs(lastConfirmedAt: Date, now: Date): number {
  return Math.max(0, now.getTime() - lastConfirmedAt.getTime());
}

export function actualityStage(ageMs: number, policy: ActualityPolicy): ActualityStage {
  if (ageMs >= policy.archiveHours * HOUR_MS) return 'archived';
  if (ageMs >= policy.hiddenHours * HOUR_MS) return 'hidden';
  if (ageMs >= policy.ageingHours * HOUR_MS) return 'ageing';
  return 'fresh';
}

// Whole days of age: 0 «Сегодня», 1 «Вчера», 2…6 «N дней».
export function actualityDays(ageMs: number): number {
  return Math.floor(ageMs / (24 * HOUR_MS));
}

export function actualityDue(ageMs: number, policy: ActualityPolicy): boolean {
  return ageMs >= policy.dueHours * HOUR_MS;
}

export type ActualityView = { days: number; stage: ActualityStage; due: boolean };

export function actualityView(lastConfirmedAt: Date, now: Date, policy: ActualityPolicy): ActualityView {
  const age = actualityAgeMs(lastConfirmedAt, now);
  return { days: actualityDays(age), stage: actualityStage(age, policy), due: actualityDue(age, policy) };
}

// Buyer side: what a result shows and its tier — fresh offers rank before ageing ones (offer-actuality §2 «Buyer»).
export type BuyerActuality = { days: number; ageing: boolean };

export function buyerActuality(lastConfirmedAt: Date, now: Date, policy: Pick<ActualityPolicy, 'ageingHours'>): BuyerActuality {
  const age = actualityAgeMs(lastConfirmedAt, now);
  return { days: actualityDays(age), ageing: age >= policy.ageingHours * HOUR_MS };
}

// Confirmations at or before this moment are ageing.
export function ageingSince(now: Date, policy: Pick<ActualityPolicy, 'ageingHours'>): Date {
  return new Date(now.getTime() - policy.ageingHours * HOUR_MS);
}
