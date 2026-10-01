import type { LocationGeo } from './location.contract';

export type ManualLocationInput = LocationGeo & {
  source: 'coordinates' | '2gis' | 'google-maps' | 'yandex-maps';
};

const COORDINATE_PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/;

function geo(latitude: number, longitude: number, source: ManualLocationInput['source']): ManualLocationInput | null {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude, source };
}

function pair(value: string): [number, number] | null {
  const match = COORDINATE_PAIR.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function isGoogleMaps(hostname: string) {
  return hostname === 'google.com'
    || hostname.endsWith('.google.com')
    || hostname.startsWith('google.')
    || hostname.startsWith('maps.google.');
}

function isYandexMaps(hostname: string) {
  return hostname === 'yandex.ru'
    || hostname.endsWith('.yandex.ru')
    || hostname.startsWith('yandex.')
    || hostname.startsWith('maps.yandex.');
}

function isTwoGis(hostname: string) {
  return hostname.startsWith('2gis.') || hostname.includes('.2gis.');
}

/**
 * Parses only self-contained coordinates. Short map links intentionally stay invalid:
 * resolving them would require a network request to an external map provider.
 */
export function parseManualLocationInput(input: string): ManualLocationInput | null {
  const value = input.trim();
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    const coordinates = pair(value);
    return coordinates ? geo(coordinates[0], coordinates[1], 'coordinates') : null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const decoded = (() => {
    try { return decodeURIComponent(`${url.pathname}${url.search}${url.hash}`); }
    catch { return `${url.pathname}${url.search}${url.hash}`; }
  })();

  if (isGoogleMaps(hostname)) {
    const at = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(decoded);
    if (at) return geo(Number(at[1]), Number(at[2]), 'google-maps');
    const query = url.searchParams.get('q') ?? url.searchParams.get('query');
    const coordinates = query ? pair(query) : null;
    return coordinates ? geo(coordinates[0], coordinates[1], 'google-maps') : null;
  }

  if (isYandexMaps(hostname)) {
    const coordinates = pair(url.searchParams.get('ll') ?? url.searchParams.get('pt') ?? '');
    return coordinates ? geo(coordinates[1], coordinates[0], 'yandex-maps') : null;
  }

  if (isTwoGis(hostname)) {
    const queryCoordinates = pair(url.searchParams.get('m') ?? '');
    if (queryCoordinates) return geo(queryCoordinates[1], queryCoordinates[0], '2gis');
    const pathCoordinates = pair(decoded);
    return pathCoordinates ? geo(pathCoordinates[1], pathCoordinates[0], '2gis') : null;
  }

  return null;
}
