import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import type { LocationGeo, LocationView } from '../contracts/location.contract';
import { updateLocationGeo } from '../infrastructure/locations.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';

export class LocationNotFoundError extends Error {
  readonly code = 'LOCATION_NOT_FOUND' as const;

  constructor() {
    super('Точка не найдена.');
    this.name = 'LocationNotFoundError';
  }
}

export async function setOwnedLocationGeo(
  ownerUserId: string,
  locationId: string,
  geo: LocationGeo,
  dependencies: { database?: Database } = {},
): Promise<LocationView> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new LocationNotFoundError();

  const location = await updateLocationGeo(database, {
    sellerId: seller.id,
    locationId,
    latitude: geo.latitude,
    longitude: geo.longitude,
  });

  if (!location) throw new LocationNotFoundError();
  return location;
}
