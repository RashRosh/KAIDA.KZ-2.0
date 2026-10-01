import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getSuggestions } from '../../src/app/api/seller/address-suggestions/route';
import type { Database } from '../../src/db/client';
import { AddressDirectoryEntryNotFoundError } from '../../src/modules/address-directory/application/address-directory-errors';
import { searchAddressDirectory } from '../../src/modules/address-directory/application/search-address-directory';
import { importAddressDirectory, type ImportableAddressDirectoryEntry } from '../../src/modules/address-directory/import/address-directory-import';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { setOwnedLocationGeo } from '../../src/modules/locations/application/set-owned-location-geo';
import { updateOwnedLocation } from '../../src/modules/locations/application/update-owned-location';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

const USER_ID = '50000000-0000-4000-8000-000000000201';
const PHONE = '+77000000201';
const TOKEN = 'address-directory-201';
const NOW = new Date('2026-10-01T06:00:00.000Z');
const originalDatabaseUrl = process.env.DATABASE_URL;
let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

function digest(value: string) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function request(query: string, token?: string) {
  const headers = new Headers(token ? { cookie: `kaida_session=${token}` } : undefined);
  return new NextRequest(`http://localhost/api/seller/address-suggestions?q=${encodeURIComponent(query)}`, { headers });
}

const entries: ImportableAddressDirectoryEntry[] = [
  { sourceKey: 'osm:n201', kind: 'address', displayName: 'Абая, 10', addressText: 'Алматы, Абая, 10', searchText: 'абая 10 алматы', latitude: 43.238, longitude: 76.91 },
  { sourceKey: 'osm:r202', kind: 'marketplace', displayName: 'Зелёный базар', addressText: 'Алматы, Зелёный базар', searchText: 'зеленый базар алматы', latitude: 43.263, longitude: 76.956 },
  ...Array.from({ length: 9 }, (_, index): ImportableAddressDirectoryEntry => ({
    sourceKey: `osm:w${210 + index}`, kind: 'street', displayName: `Абая ${index + 1}`, addressText: `Алматы, Абая ${index + 1}`,
    searchText: `абая ${index + 1} алматы`, latitude: 43.2 + index / 1000, longitude: 76.9,
  })),
];

async function cleanup() {
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [USER_ID]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [USER_ID]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [USER_ID]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [USER_ID, PHONE]);
  await pool.query('DELETE FROM address_directory_imports');
}

beforeAll(async () => {
  const guardedUrl = testDatabaseUrl();
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
  process.env.DATABASE_URL = guardedUrl;
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await pool.end();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('Almaty address directory on PostgreSQL 18', () => {
  it('activates an idempotent snapshot and returns ranked, normalized, bounded suggestions', async () => {
    const metadata = { sourceUrl: 'https://download.geofabrik.de/asia/kazakhstan-latest.osm.pbf', sourceTimestamp: NOW, sourceChecksum: 'a'.repeat(64), importerVersion: 'test-v1' };
    const first = await importAddressDirectory(db, metadata, entries);
    const repeat = await importAddressDirectory(db, metadata, entries);
    expect(first).toMatchObject({ activated: true, counts: { total: 11, addresses: 1, marketplaces: 1, streets: 9 } });
    expect(repeat).toMatchObject({ importId: first.importId, activated: false });
    expect(await searchAddressDirectory('ЗЕЛЁНЫЙ', { database: db })).toEqual([
      expect.objectContaining({ id: 'osm:r202', kind: 'marketplace', addressText: 'Алматы, Зелёный базар' }),
    ]);
    expect(await searchAddressDirectory('зеленый базарр', { database: db })).toEqual([
      expect.objectContaining({ id: 'osm:r202', kind: 'marketplace' }),
    ]);
    expect(await searchAddressDirectory('абая', { database: db })).toHaveLength(8);
  });

  it('requires auth and exposes only active directory suggestions', async () => {
    expect((await getSuggestions(request('абая'))).status).toBe(401);
    await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [USER_ID, PHONE, NOW]);
    await pool.query('INSERT INTO auth_sessions (id,user_id,token_digest,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)', [
      '60000000-0000-4000-8000-000000000201', USER_ID, digest(TOKEN), NOW, new Date('2030-10-01T06:00:00.000Z'),
    ]);
    const response = await getSuggestions(request('абая', TOKEN));
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions).toHaveLength(8);
  });

  it('atomically resolves selected address+geo, rejects stale IDs and preserves geo for manual text', async () => {
    const seller = await setupSeller(USER_ID, {
      seller: { displayName: 'Directory seller' },
      location: { name: 'First', type: 'market', addressText: 'untrusted client preview', addressDirectoryEntryId: 'osm:r202' },
    }, { database: db });
    expect(seller.locations[0]).toMatchObject({ addressText: 'Алматы, Зелёный базар', geo: { latitude: 43.263, longitude: 76.956 } });

    const second = await createOwnedLocation(USER_ID, {
      name: 'Second', type: 'shop', addressText: 'ignored', addressDirectoryEntryId: 'osm:n201',
    }, { database: db });
    expect(second).toMatchObject({ addressText: 'Алматы, Абая, 10', geo: { latitude: 43.238, longitude: 76.91 } });
    await expect(updateOwnedLocation(USER_ID, second.id, {
      name: 'No partial write', type: 'shop', addressText: 'No partial write', addressDirectoryEntryId: 'osm:missing',
    }, { database: db })).rejects.toBeInstanceOf(AddressDirectoryEntryNotFoundError);
    expect((await pool.query('SELECT name,address_text,latitude,longitude FROM locations WHERE id=$1', [second.id])).rows[0]).toEqual({
      name: 'Second', address_text: 'Алматы, Абая, 10', latitude: 43.238, longitude: 76.91,
    });

    await setOwnedLocationGeo(USER_ID, second.id, { latitude: 43.3, longitude: 76.8 }, { database: db });
    const manual = await updateOwnedLocation(USER_ID, second.id, { name: 'Manual', type: 'other', addressText: 'Свободный адрес' }, { database: db });
    expect(manual).toMatchObject({ addressText: 'Свободный адрес', geo: { latitude: 43.3, longitude: 76.8 } });
  });
});
