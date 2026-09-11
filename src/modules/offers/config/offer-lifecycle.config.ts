export const OFFER_VALIDITY_PERIOD_HOURS_DEFAULT = 168;

export type OfferLifecycleEnvironment = Readonly<Record<string, string | undefined>>;

export function validateOfferValidityPeriodHours(value: unknown): number {
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value > 0) return value;
    throw new Error('Offer validity period must be a positive integer number of hours');
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }

  throw new Error('Offer validity period must be a positive integer number of hours');
}

export function readOfferValidityPeriodHours(
  env: OfferLifecycleEnvironment = process.env,
): number {
  const raw = env.OFFER_VALIDITY_PERIOD_HOURS;
  return raw === undefined
    ? OFFER_VALIDITY_PERIOD_HOURS_DEFAULT
    : validateOfferValidityPeriodHours(raw);
}
