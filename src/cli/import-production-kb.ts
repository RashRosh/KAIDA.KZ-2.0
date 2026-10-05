import 'dotenv/config';
import { createDatabase } from '../db/client';
import { importProductionKbPackage } from '../modules/catalog/kb-import/production-kb-importer';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const { db, pool } = createDatabase(url);
  try {
    const result = await importProductionKbPackage(db);
    console.log(`Production KB import complete: ${result.products} products, ${result.aliases} aliases, ${result.categories} categories.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Production KB import failed');
  process.exitCode = 1;
});

