import { z } from 'zod';
import { buyerLocationSchema, type BuyerLocation } from '../search/contracts/buyer-location.contract';

type RoadDestination = { locationId: string; point: BuyerLocation };
type RoadDistances = ReadonlyMap<string, number>;
type RoadDistanceConfig = {
  baseUrl: URL;
  graphVersion: string;
  maxDestinations: number;
  maxConcurrent: number;
  timeoutMs: number;
  maxSnapMeters: number;
  cacheMs: number;
};

const meters = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const waypoint = z.object({ distance: meters });
const matrix = z.object({
  code: z.literal('Ok'),
  distances: z.array(z.array(meters)),
  sources: z.array(waypoint),
  destinations: z.array(waypoint),
  fallback_speed_cells: z.array(z.unknown()).max(0).optional(),
});
const cacheLimit = 128;

function coordinates(point: BuyerLocation): string {
  return `${point.longitude},${point.latitude}`;
}

export function createRoadDistanceResolver(config: RoadDistanceConfig, request: typeof fetch = fetch) {
  const pending = new Map<string, Promise<RoadDistances | null>>();
  const cache = new Map<string, { result: RoadDistances | null; timer: ReturnType<typeof setTimeout> }>();

  async function fetchMatrix(origin: BuyerLocation, destinations: RoadDestination[]): Promise<RoadDistances | null> {
    try {
      const points = [coordinates(origin), ...destinations.map(({ point }) => coordinates(point))];
      const url = new URL(`table/v1/driving/${points.join(';')}`, config.baseUrl);
      url.searchParams.set('sources', '0');
      url.searchParams.set('destinations', destinations.map((_, index) => index + 1).join(';'));
      url.searchParams.set('annotations', 'distance');
      url.searchParams.set('generate_hints', 'false');
      const response = await request(url, {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok) return null;
      const parsed = matrix.safeParse(await response.json());
      if (!parsed.success) return null;
      const { distances, sources, destinations: snapped } = parsed.data;
      if (distances.length !== 1 || distances[0].length !== destinations.length
        || sources.length !== 1 || snapped.length !== destinations.length
        || [...sources, ...snapped].some(({ distance }) => distance > config.maxSnapMeters)) return null;
      return new Map(destinations.map(({ locationId }, index) => [locationId, Math.round(distances[0][index])]));
    } catch {
      return null;
    }
  }

  return async (origin: BuyerLocation | undefined, points: Iterable<RoadDestination>): Promise<RoadDistances | null> => {
    if (!buyerLocationSchema.safeParse(origin).success || origin === undefined) return null;
    const unique = new Map<string, RoadDestination>();
    for (const destination of points) {
      if (!buyerLocationSchema.safeParse(destination.point).success) return null;
      const previous = unique.get(destination.locationId);
      if (previous && coordinates(previous.point) !== coordinates(destination.point)) return null;
      unique.set(destination.locationId, destination);
      if (unique.size > config.maxDestinations) return null;
    }
    if (!unique.size) return null;
    const destinations = [...unique.values()].sort((a, b) => a.locationId.localeCompare(b.locationId));
    const key = JSON.stringify([config.graphVersion, coordinates(origin), destinations.map(({ locationId, point }) => [locationId, coordinates(point)])]);
    const cached = cache.get(key);
    if (cached) return cached.result;
    const existing = pending.get(key);
    if (existing) return existing;
    if (pending.size >= config.maxConcurrent) return null;

    const work = fetchMatrix(origin, destinations).then((result) => {
      if (cache.size >= cacheLimit) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          clearTimeout(cache.get(oldest)?.timer);
          cache.delete(oldest);
        }
      }
      const timer = setTimeout(() => cache.delete(key), result === null ? Math.min(config.cacheMs, 2000) : config.cacheMs);
      timer.unref();
      cache.set(key, { result, timer });
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, work);
    return work;
  };
}

const routingSettings = z.object({
  url: z.url({ protocol: /^https?$/ }),
  graphVersion: z.string().trim().min(1),
  maxDestinations: z.coerce.number().int().min(1).max(99).default(6),
  maxConcurrent: z.coerce.number().int().min(1).max(16).default(2),
  timeoutMs: z.coerce.number().int().min(25).max(2000).default(400),
  maxSnapMeters: z.coerce.number().int().min(1).max(200).default(50),
  cacheMs: z.coerce.number().int().min(1000).max(60000).default(15000),
});

function configureResolver() {
  if (process.env.ROAD_DISTANCE_ENABLED !== '1') return null;
  const parsed = routingSettings.safeParse({
    url: process.env.OSRM_BASE_URL,
    graphVersion: process.env.OSRM_GRAPH_VERSION,
    maxDestinations: process.env.OSRM_MAX_DESTINATIONS,
    maxConcurrent: process.env.OSRM_MAX_CONCURRENT,
    timeoutMs: process.env.OSRM_TIMEOUT_MS,
    maxSnapMeters: process.env.OSRM_MAX_SNAP_METERS,
    cacheMs: process.env.OSRM_CACHE_MS,
  });
  if (!parsed.success) return null;
  const url = new URL(parsed.data.url);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
  return createRoadDistanceResolver({ ...parsed.data, baseUrl: url });
}

const resolveRoadDistances = configureResolver();

export async function roadDistancesForOffers(
  origin: BuyerLocation | undefined,
  candidates: Iterable<{ offer: { location: { id: string } }; locationGeo: BuyerLocation | null }>,
): Promise<RoadDistances | null> {
  if (!resolveRoadDistances || !origin) return null;
  function* destinations() {
    for (const { offer, locationGeo } of candidates) {
      if (locationGeo) yield { locationId: offer.location.id, point: locationGeo };
    }
  }
  return resolveRoadDistances(origin, destinations());
}
