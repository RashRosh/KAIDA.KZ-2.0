export const NEARBY_RADIUS_METERS_DEFAULT = 5000;

export type DiscoveryEnvironment = Readonly<Record<string, string | undefined>>;

export function validateNearbyRadiusMeters(value: unknown): number {
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value > 0) return value;
    throw new Error('Nearby radius must be a positive integer number of meters');
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }

  throw new Error('Nearby radius must be a positive integer number of meters');
}

export function readNearbyRadiusMeters(
  env: DiscoveryEnvironment = process.env,
): number {
  const raw = env.NEARBY_RADIUS_METERS;
  return raw === undefined
    ? NEARBY_RADIUS_METERS_DEFAULT
    : validateNearbyRadiusMeters(raw);
}
