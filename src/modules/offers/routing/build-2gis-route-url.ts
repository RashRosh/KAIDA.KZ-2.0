import { locationGeoSchema } from '../../locations/contracts/location.contract';
import type { BuyerOfferRouteDestination } from '../infrastructure/buyer-offer-route.repository';

// A Location currently stores a human-entered address and coordinates, not a canonical city ID.
// Only accept explicit recognized city names from the address, never a guessed coordinate-to-city
// mapping or a free-form segment in a third-party URL. Unknown cities use the KZ country entry.
const CITY_SLUGS: Readonly<Record<string, string>> = {
  'алматы': 'almaty',
  'алма-ата': 'almaty',
  'almaty': 'almaty',
  'астана': 'astana',
  'astana': 'astana',
  'шымкент': 'shymkent',
  'shymkent': 'shymkent',
};

function citySlugFromAddress(addressText?: string): string | null {
  if (!addressText) return null;
  for (const part of addressText.split(',')) {
    const label = part.trim().toLocaleLowerCase('ru').replace(/^(?:г\.?|город)\s+/u, '');
    for (const [name, slug] of Object.entries(CITY_SLUGS)) {
      if (label === name || label.startsWith(`${name} `)) return slug;
    }
  }
  return null;
}

export function build2GisRouteUrl(destination: BuyerOfferRouteDestination): string {
  const point = locationGeoSchema.parse({ latitude: destination.latitude, longitude: destination.longitude });
  const longitude = encodeURIComponent(String(point.longitude));
  const latitude = encodeURIComponent(String(point.latitude));
  const city = citySlugFromAddress(destination.addressText);
  // Actual 2GIS web navigation observed by PO: 2gis.ru without city opened Moscow for an
  // Almaty seller; 2gis.kz/almaty opened Kazakhstan. Only seller destination is passed.
  return `https://2gis.kz/${city ? `${city}/` : ''}directions/points/|${longitude},${latitude}`;
}
