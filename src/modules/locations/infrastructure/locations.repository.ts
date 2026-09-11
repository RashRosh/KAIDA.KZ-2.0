import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { locations } from '../db/locations.table';
import type { LocationType, LocationView } from '../contracts/location.contract';

export type LocationDb = Pick<Database, 'insert' | 'select'>;

export async function createLocation(
  database: LocationDb,
  values: { sellerId: string; name: string; addressText: string; type: LocationType },
): Promise<LocationView> {
  const rows = await database
    .insert(locations)
    .values(values)
    .returning({ id: locations.id, name: locations.name, addressText: locations.addressText, type: locations.type });
  const location = rows[0];
  if (!location) throw new Error('Location insert did not return a row');
  return { ...location, type: location.type as LocationType };
}

export async function listLocationsBySeller(database: LocationDb, sellerId: string): Promise<LocationView[]> {
  const rows = await database
    .select({ id: locations.id, name: locations.name, addressText: locations.addressText, type: locations.type })
    .from(locations)
    .where(eq(locations.sellerId, sellerId));
  return rows.map((row) => ({ ...row, type: row.type as LocationType }));
}
