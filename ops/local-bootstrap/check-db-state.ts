import 'dotenv/config';
import { Pool } from 'pg';
import { PRODUCTION_KB_PACKAGE_V1 } from '../../src/modules/catalog/kb-import/package-metadata';
import { assertIsolatedDatabase } from './isolation';

// R1: explicit database-state checks for the two bootstrap modes (docs/ops/LOCAL_BOOTSTRAP.md). Read-only.
//   clean — migrations + Production KB import only: the catalog is installed and every business-data table is empty.
//   demo  — clean + `pnpm db:seed`: the fictional demo records exist; seed/KB name overlaps are reported.
// Catalog tables are the Production KB content; `kb_package_install` is the importer's own technical record.
const CATALOG_TABLES = ['products', 'product_aliases', 'product_localized_names', 'product_categories', 'product_category_links'];
const TECHNICAL_TABLES = ['kb_package_install'];

const mode = process.argv[2];
if (mode !== 'clean' && mode !== 'demo') {
  console.error('Usage: tsx ops/local-bootstrap/check-db-state.ts <clean|demo>');
  process.exit(2);
}

const url = assertIsolatedDatabase();
const pool = new Pool({ connectionString: url, max: 1 });
const failures: string[] = [];
const expect = (ok: boolean, message: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failures.push(message);
};

async function count(table: string) {
  return Number((await pool.query(`SELECT count(*) AS n FROM public."${table}"`)).rows[0].n);
}

async function main() {
  const tables = (await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  )).rows.map((row) => row.table_name);
  const counts = new Map<string, number>();
  for (const table of tables) counts.set(table, await count(table));
  console.log(`Tables in public: ${tables.length}`);
  for (const table of tables) console.log(`  ${table.padEnd(40)} ${counts.get(table)}`);
  const migrations = Number((await pool.query('SELECT count(*) AS n FROM drizzle.__drizzle_migrations')).rows[0].n);
  console.log(`Applied migrations (drizzle metadata, exempt): ${migrations}`);

  const kb = PRODUCTION_KB_PACKAGE_V1.counts;
  const distinctCategories = Number((await pool.query('SELECT count(*) AS n FROM product_categories')).rows[0].n);
  expect(distinctCategories === kb.categories, `categories = ${kb.categories} (found ${distinctCategories})`);
  expect((counts.get('product_aliases') ?? 0) >= kb.aliases, `aliases >= ${kb.aliases} (found ${counts.get('product_aliases')})`);
  expect((counts.get('kb_package_install') ?? 0) === 1, 'Production KB install record present (1 technical row)');

  if (mode === 'clean') {
    expect(counts.get('products') === kb.products, `products = ${kb.products} (found ${counts.get('products')})`);
    expect(counts.get('product_aliases') === kb.aliases, `aliases = ${kb.aliases} (found ${counts.get('product_aliases')})`);
    const business = tables.filter((table) => !CATALOG_TABLES.includes(table) && !TECHNICAL_TABLES.includes(table));
    const filled = business.filter((table) => (counts.get(table) ?? 0) > 0);
    expect(filled.length === 0, `all ${business.length} business-data tables are empty${filled.length ? ` (not empty: ${filled.join(', ')})` : ''}`);
  } else {
    expect((counts.get('sellers') ?? 0) === 1 && (counts.get('locations') ?? 0) === 1, 'demo seller and point present');
    expect((counts.get('offers') ?? 0) === 2, 'two demo offers present');
    const duplicates = (await pool.query<{ name: string; n: string }>(
      'SELECT lower(name) AS name, count(*) AS n FROM products GROUP BY lower(name) HAVING count(*) > 1 ORDER BY 1',
    )).rows;
    console.log(duplicates.length === 0
      ? 'INFO  no duplicate canonical product names between seed and Production KB'
      : `INFO  duplicate canonical product names (seed vs KB): ${duplicates.map((row) => `${row.name} x${row.n}`).join(', ')}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Database state check failed');
    failures.push('check crashed');
  })
  .finally(async () => {
    await pool.end();
    if (failures.length > 0) {
      console.error(`\n${failures.length} check(s) failed.`);
      process.exitCode = 1;
    } else {
      console.log(`\nDatabase state check (${mode}) passed.`);
    }
  });
