import { createDatabase } from '../../src/db/client';
import { importProductionKbPackage } from '../../src/modules/catalog/kb-import/production-kb-importer';
import { testDatabaseUrl } from '../integration/database';

// The E2E database mirrors production: migrated, seeded, with Production KB v1 installed by the existing importer
// (idempotent; no catalog data is copied into seed or fixtures).
export default async function globalSetup() {
  const { db, pool } = createDatabase(testDatabaseUrl());
  try {
    await importProductionKbPackage(db);
  } finally {
    await pool.end();
  }
}
