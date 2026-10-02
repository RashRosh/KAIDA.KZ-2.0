import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import type { AddressDirectoryEntry, AddressDirectoryKind, AddressDirectorySuggestion } from '../contracts/address-directory.contract';
import { ADDRESS_DIRECTORY_LIMIT } from '../contracts/address-directory.contract';
import { addressDirectoryEntries } from '../db/address-directory-entries.table';
import { addressDirectoryImports } from '../db/address-directory-imports.table';
import { normalizeAddressSearch } from '../search/normalize-address-search';

type DirectoryDb = Pick<Database, 'select'>;

const selection = {
  id: addressDirectoryEntries.sourceKey,
  kind: addressDirectoryEntries.kind,
  displayName: addressDirectoryEntries.displayName,
  addressText: addressDirectoryEntries.addressText,
  latitude: addressDirectoryEntries.latitude,
  longitude: addressDirectoryEntries.longitude,
};

function mapEntry(row: {
  id: string; kind: string; displayName: string; addressText: string; latitude: number; longitude: number;
}): AddressDirectoryEntry {
  return { ...row, kind: row.kind as AddressDirectoryKind };
}

export async function searchActiveAddressDirectory(database: DirectoryDb, query: string): Promise<AddressDirectorySuggestion[]> {
  const normalized = normalizeAddressSearch(query);
  const prefix = `${normalized}%`;
  const contains = `%${normalized}%`;
  const rows = await database
    .select(selection)
    .from(addressDirectoryEntries)
    .innerJoin(addressDirectoryImports, eq(addressDirectoryImports.id, addressDirectoryEntries.importId))
    .where(and(
      eq(addressDirectoryImports.status, 'active'),
      sql`(${addressDirectoryEntries.searchText} LIKE ${contains} OR ${addressDirectoryEntries.searchText} % ${normalized})`,
    ))
    .orderBy(
      sql`CASE WHEN ${addressDirectoryEntries.searchText} LIKE ${prefix} THEN 0 WHEN ${addressDirectoryEntries.searchText} LIKE ${contains} THEN 1 ELSE 2 END`,
      desc(sql`similarity(${addressDirectoryEntries.searchText}, ${normalized})`),
      sql`CASE ${addressDirectoryEntries.kind} WHEN 'marketplace' THEN 0 WHEN 'address' THEN 1 WHEN 'street' THEN 2 ELSE 3 END`,
      asc(addressDirectoryEntries.addressText),
      asc(addressDirectoryEntries.sourceKey),
    )
    .limit(ADDRESS_DIRECTORY_LIMIT);
  return rows.map(mapEntry);
}

export async function findActiveAddressDirectoryEntry(database: DirectoryDb, id: string): Promise<AddressDirectoryEntry | null> {
  const rows = await database
    .select(selection)
    .from(addressDirectoryEntries)
    .innerJoin(addressDirectoryImports, eq(addressDirectoryImports.id, addressDirectoryEntries.importId))
    .where(and(
      eq(addressDirectoryImports.status, 'active'),
      eq(addressDirectoryEntries.sourceKey, id),
    ))
    .limit(1);
  return rows[0] ? mapEntry(rows[0]) : null;
}
