import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { addressDirectoryEntries } from '../db/address-directory-entries.table';
import { addressDirectoryImports, type AddressDirectoryImportCounts } from '../db/address-directory-imports.table';
import type { AddressDirectoryKind } from '../contracts/address-directory.contract';

export type ImportableAddressDirectoryEntry = {
  sourceKey: string;
  kind: AddressDirectoryKind;
  displayName: string;
  addressText: string;
  searchText: string;
  latitude: number;
  longitude: number;
};

export type AddressDirectoryImportMetadata = {
  sourceUrl: string;
  sourceTimestamp: Date;
  sourceChecksum: string;
  importerVersion: string;
};

function countEntries(entries: ImportableAddressDirectoryEntry[]): AddressDirectoryImportCounts {
  return entries.reduce<AddressDirectoryImportCounts>((counts, entry) => {
    counts.total += 1;
    if (entry.kind === 'address') counts.addresses += 1;
    else if (entry.kind === 'street') counts.streets += 1;
    else if (entry.kind === 'marketplace') counts.marketplaces += 1;
    else counts.retail += 1;
    return counts;
  }, { addresses: 0, streets: 0, marketplaces: 0, retail: 0, total: 0 });
}

export async function importAddressDirectory(
  database: Database,
  metadata: AddressDirectoryImportMetadata,
  entries: ImportableAddressDirectoryEntry[],
): Promise<{ importId: string; activated: boolean; counts: AddressDirectoryImportCounts }> {
  const counts = countEntries(entries);
  const existing = await database.select({ id: addressDirectoryImports.id, status: addressDirectoryImports.status })
    .from(addressDirectoryImports)
    .where(eq(addressDirectoryImports.sourceChecksum, metadata.sourceChecksum))
    .limit(1);
  if (existing[0]?.status === 'active' || existing[0]?.status === 'superseded') {
    return { importId: existing[0].id, activated: false, counts };
  }
  if (existing[0]?.status === 'loading') throw new Error('The same address-directory snapshot is already loading');

  let importId = existing[0]?.id;
  if (importId) {
    await database.update(addressDirectoryImports).set({
      ...metadata,
      status: 'loading',
      entryCount: entries.length,
      counts,
      startedAt: new Date(),
      finishedAt: null,
      failureMessage: null,
    }).where(eq(addressDirectoryImports.id, importId));
  } else {
    const inserted = await database.insert(addressDirectoryImports).values({
      ...metadata,
      status: 'loading',
      entryCount: entries.length,
      counts,
    }).returning({ id: addressDirectoryImports.id });
    importId = inserted[0]?.id;
  }
  if (!importId) throw new Error('Address directory import record was not created');

  try {
    await database.transaction(async (tx) => {
      for (let offset = 0; offset < entries.length; offset += 500) {
        const chunk = entries.slice(offset, offset + 500).map((entry) => ({ importId, ...entry }));
        if (chunk.length > 0) await tx.insert(addressDirectoryEntries).values(chunk);
      }
      await tx.update(addressDirectoryImports)
        .set({ status: 'superseded' })
        .where(and(eq(addressDirectoryImports.status, 'active'), ne(addressDirectoryImports.id, importId)));
      await tx.update(addressDirectoryImports)
        .set({ status: 'active', finishedAt: new Date() })
        .where(eq(addressDirectoryImports.id, importId));
    });
    return { importId, activated: true, counts };
  } catch (error) {
    await database.update(addressDirectoryImports)
      .set({ status: 'failed', finishedAt: new Date(), failureMessage: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown error' })
      .where(eq(addressDirectoryImports.id, importId));
    throw error;
  }
}
