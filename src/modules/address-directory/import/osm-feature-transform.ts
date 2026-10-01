import type { AddressDirectoryKind } from '../contracts/address-directory.contract';
import { addressSearchText, normalizeAddressSearch } from '../search/normalize-address-search';
import type { ImportableAddressDirectoryEntry } from './address-directory-import';

type Coordinates = number[] | Coordinates[];
type OsmFeature = {
  id?: string | number;
  geometry?: { type?: string; coordinates?: Coordinates } | null;
  properties?: Record<string, unknown> | null;
};

function text(properties: Record<string, unknown>, key: string): string | undefined {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function coordinatePairs(coordinates: Coordinates | undefined, output: Array<[number, number]> = []): Array<[number, number]> {
  if (!coordinates) return output;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    output.push([coordinates[0], coordinates[1]] as [number, number]);
    return output;
  }
  for (const nested of coordinates as Coordinates[]) coordinatePairs(nested, output);
  return output;
}

function center(feature: OsmFeature): { latitude: number; longitude: number } | null {
  const points = coordinatePairs(feature.geometry?.coordinates);
  if (points.length === 0) return null;
  const longitude = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const latitude = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function cityPrefix(properties: Record<string, unknown>): string {
  return text(properties, 'addr:city') ?? 'Алматы';
}

function namedAddress(properties: Record<string, unknown>, name: string): string {
  const street = text(properties, 'addr:street') ?? text(properties, 'addr:place');
  const house = text(properties, 'addr:housenumber');
  const explicit = [cityPrefix(properties), street, house].filter(Boolean).join(', ');
  return street || house ? explicit : `${cityPrefix(properties)}, ${name}`;
}

export function transformOsmFeature(feature: OsmFeature): ImportableAddressDirectoryEntry | null {
  const properties = feature.properties ?? {};
  const geo = center(feature);
  if (!geo || geo.latitude < -90 || geo.latitude > 90 || geo.longitude < -180 || geo.longitude > 180) return null;

  const name = text(properties, 'name:ru') ?? text(properties, 'name') ?? text(properties, 'name:kk');
  const street = text(properties, 'addr:street') ?? text(properties, 'addr:place');
  const house = text(properties, 'addr:housenumber');
  let kind: AddressDirectoryKind;
  let displayName: string;
  let addressText: string;

  if ((text(properties, 'amenity') === 'marketplace' || text(properties, 'type') === 'marketplace') && name) {
    kind = 'marketplace';
    displayName = name;
    addressText = namedAddress(properties, name);
  } else if ((text(properties, 'shop') === 'mall' || text(properties, 'building') === 'retail') && name) {
    kind = 'retail';
    displayName = name;
    addressText = namedAddress(properties, name);
  } else if (house && street) {
    kind = 'address';
    displayName = `${street}, ${house}`;
    addressText = `${cityPrefix(properties)}, ${street}, ${house}`;
  } else if (text(properties, 'highway') && name) {
    kind = 'street';
    displayName = name;
    addressText = `${cityPrefix(properties)}, ${name}`;
  } else {
    return null;
  }

  const osmType = text(properties, '@type');
  const osmId = properties['@id'];
  const rawId = osmType && (typeof osmId === 'string' || typeof osmId === 'number')
    ? `${osmType[0]}${osmId}`
    : String(feature.id ?? '');
  if (!rawId) return null;
  const sourceKey = kind === 'street' ? `street:${normalizeAddressSearch(displayName)}` : `osm:${rawId}`;
  const searchText = addressSearchText([
    displayName,
    addressText,
    text(properties, 'name'),
    text(properties, 'name:ru'),
    text(properties, 'name:kk'),
    text(properties, 'alt_name'),
    text(properties, 'official_name'),
  ]);
  return { sourceKey, kind, displayName, addressText, searchText, ...geo };
}

export function deduplicateAddressDirectoryEntries(entries: ImportableAddressDirectoryEntry[]): ImportableAddressDirectoryEntry[] {
  const unique = new Map<string, ImportableAddressDirectoryEntry>();
  for (const entry of entries) {
    const visibleKey = entry.kind === 'street'
      ? entry.sourceKey
      : `${entry.kind}:${normalizeAddressSearch(entry.displayName)}:${normalizeAddressSearch(entry.addressText)}`;
    if (!unique.has(visibleKey)) unique.set(visibleKey, entry);
  }
  return [...unique.values()];
}
