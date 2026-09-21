import { and, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { locations } from '../db/locations.table';
import type { LocationGeo, LocationIdentityInput, LocationType, LocationView } from '../contracts/location.contract';

export type LocationDb = Pick<Database, 'insert' | 'select' | 'update'>;

type LocationRow = {
  id: string;
  name: string;
  addressText: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
};

const locationSelection = {
  id: locations.id,
  name: locations.name,
  addressText: locations.addressText,
  type: locations.type,
  latitude: locations.latitude,
  longitude: locations.longitude,
};

function toLocationView(row: LocationRow): LocationView {
  if ((row.latitude === null) !== (row.longitude === null)) {
    throw new Error('Location geo invariant violated');
  }

  const geo: LocationGeo | null = row.latitude === null
    ? null
    : { latitude: row.latitude, longitude: row.longitude as number };

  return {
    id: row.id,
    name: row.name,
    addressText: row.addressText,
    type: row.type as LocationType,
    geo,
  };
}

export async function createLocation(
  database: LocationDb,
  values: { sellerId: string; name: string; addressText: string; type: LocationType },
): Promise<LocationView> {
  const rows = await database
    .insert(locations)
    .values(values)
    .returning(locationSelection);
  const location = rows[0];
  if (!location) throw new Error('Location insert did not return a row');
  return toLocationView(location);
}

export async function listLocationsBySeller(database: LocationDb, sellerId: string): Promise<LocationView[]> {
  const rows = await database
    .select(locationSelection)
    .from(locations)
    .where(eq(locations.sellerId, sellerId));
  return rows.map(toLocationView);
}

export async function updateLocationGeo(
  database: LocationDb,
  values: { sellerId: string; locationId: string; latitude: number; longitude: number },
): Promise<LocationView | null> {
  const rows = await database
    .update(locations)
    .set({ latitude: values.latitude, longitude: values.longitude })
    .where(and(eq(locations.id, values.locationId), eq(locations.sellerId, values.sellerId)))
    .returning(locationSelection);

  return rows[0] ? toLocationView(rows[0]) : null;
}

export async function updateLocationIdentity(
  database: LocationDb,
  values: { sellerId: string; locationId: string; identity: LocationIdentityInput },
): Promise<LocationView | null> {
  const rows = await database
    .update(locations)
    .set({
      name: values.identity.name,
      type: values.identity.type,
      addressText: values.identity.addressText,
    })
    .where(and(eq(locations.id, values.locationId), eq(locations.sellerId, values.sellerId)))
    .returning(locationSelection);

  return rows[0] ? toLocationView(rows[0]) : null;
}
