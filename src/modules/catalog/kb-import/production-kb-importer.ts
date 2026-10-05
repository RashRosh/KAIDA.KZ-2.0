import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { kbPackageInstall, productAliases, productCategories, productCategoryLinks, productLocalizedNames, products } from '../../../db/schema';
import { PRODUCTION_KB_PACKAGE_V1 } from './package-metadata';

export class ProductionKbImportError extends Error {}

type Locale = 'ru' | 'kk';

type Manifest = {
  package_name: string;
  package_version: string;
  package_schema_version: number;
  source_checkpoint_tag: string;
  source_commit_sha: string;
  file_hashes: Record<string, string>;
  counts: { exported_products: number; exported_aliases: number; categories: number };
};

type PackageProduct = {
  product_id: string;
  canonical_name_ru: string;
  canonical_name_kk: string;
  category_code: string;
  category_ru: string;
  category_kk: string;
};

type PackageAlias = {
  alias_id: string;
  product_id: string;
  alias: string;
  language: Locale;
};

type PackageCategory = { category_code: string; category_ru: string; category_kk: string };

type LoadedPackage = {
  manifest: Manifest;
  products: PackageProduct[];
  aliases: PackageAlias[];
  categories: PackageCategory[];
};

export type ProductionKbImportResult = {
  products: number;
  aliases: number;
  categories: number;
  adoptedProducts: number;
  createdProducts: number;
};

const defaultPackageDir = fileURLToPath(new URL('../kb-package/v1/', import.meta.url));
const requiredFiles = ['products.csv', 'aliases.csv', 'categories.csv', 'CONTRACT.md', 'manifest.json'] as const;

function fail(message: string): never {
  throw new ProductionKbImportError(message);
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data.filter((values) => values.some((value) => value !== '')).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function requireString(row: Record<string, string>, field: string) {
  const value = row[field]?.trim();
  if (!value) fail(`Package row missing ${field}`);
  return value;
}

function productFrom(row: Record<string, string>): PackageProduct {
  const product = {
    product_id: requireString(row, 'product_id'),
    canonical_name_ru: requireString(row, 'canonical_name_ru'),
    canonical_name_kk: requireString(row, 'canonical_name_kk'),
    category_code: requireString(row, 'category_code'),
    category_ru: requireString(row, 'category_ru'),
    category_kk: requireString(row, 'category_kk'),
  };
  if (!/^KAIDA-P[0-9]{4}$/.test(product.product_id)) fail(`Invalid product_id ${product.product_id}`);
  return product;
}

function aliasFrom(row: Record<string, string>): PackageAlias {
  const rawLanguage = requireString(row, 'language');
  if (rawLanguage !== 'ru' && rawLanguage !== 'kk') fail(`Unsupported alias language ${rawLanguage}`);
  const language: Locale = rawLanguage;
  const alias = {
    alias_id: requireString(row, 'alias_id'),
    product_id: requireString(row, 'product_id'),
    alias: requireString(row, 'alias'),
    language,
  };
  if (!/^A-[0-9]{5}$/.test(alias.alias_id)) fail(`Invalid alias_id ${alias.alias_id}`);
  return alias;
}

function categoryFrom(row: Record<string, string>): PackageCategory {
  const category = {
    category_code: requireString(row, 'category_code'),
    category_ru: requireString(row, 'category_ru'),
    category_kk: requireString(row, 'category_kk'),
  };
  if (!/^[A-Z0-9_]+$/.test(category.category_code)) fail(`Invalid category_code ${category.category_code}`);
  return category;
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) fail(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

async function readPackageFile(packageDir: string, name: typeof requiredFiles[number]) {
  return await readFile(join(packageDir, name));
}

export async function loadProductionKbPackage(packageDir = defaultPackageDir): Promise<LoadedPackage> {
  const manifestBytes = await readPackageFile(packageDir, 'manifest.json');
  const manifestSha = sha256(manifestBytes);
  if (manifestSha !== PRODUCTION_KB_PACKAGE_V1.manifestSha256) {
    fail(`Production KB manifest SHA mismatch: ${manifestSha}`);
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
  } catch {
    fail('Production KB manifest is not valid JSON');
  }

  if (
    manifest.package_name !== PRODUCTION_KB_PACKAGE_V1.packageName ||
    manifest.package_version !== PRODUCTION_KB_PACKAGE_V1.packageVersion ||
    manifest.package_schema_version !== PRODUCTION_KB_PACKAGE_V1.packageSchemaVersion ||
    manifest.source_checkpoint_tag !== PRODUCTION_KB_PACKAGE_V1.sourceCheckpointTag ||
    manifest.source_commit_sha !== PRODUCTION_KB_PACKAGE_V1.sourceCommitSha
  ) fail('Production KB manifest identity mismatch');

  for (const file of requiredFiles) {
    if (file === 'manifest.json') continue;
    const expected = manifest.file_hashes[file];
    if (!expected) fail(`Production KB manifest missing hash for ${file}`);
    const actual = sha256(await readPackageFile(packageDir, file));
    if (actual !== expected) fail(`Production KB file hash mismatch for ${file}`);
  }

  const packageProducts = parseCsv((await readPackageFile(packageDir, 'products.csv')).toString('utf8')).map(productFrom);
  const packageAliases = parseCsv((await readPackageFile(packageDir, 'aliases.csv')).toString('utf8')).map(aliasFrom);
  const packageCategories = parseCsv((await readPackageFile(packageDir, 'categories.csv')).toString('utf8')).map(categoryFrom);

  if (packageProducts.length !== PRODUCTION_KB_PACKAGE_V1.counts.products || manifest.counts.exported_products !== packageProducts.length) fail('Production KB product count mismatch');
  if (packageAliases.length !== PRODUCTION_KB_PACKAGE_V1.counts.aliases || manifest.counts.exported_aliases !== packageAliases.length) fail('Production KB alias count mismatch');
  if (packageCategories.length !== PRODUCTION_KB_PACKAGE_V1.counts.categories || manifest.counts.categories !== packageCategories.length) fail('Production KB category count mismatch');

  assertUnique(packageProducts.map((product) => product.product_id), 'product_id');
  assertUnique(packageAliases.map((alias) => alias.alias_id), 'alias_id');
  assertUnique(packageCategories.map((category) => category.category_code), 'category_code');

  const productIds = new Set(packageProducts.map((product) => product.product_id));
  const categoryCodes = new Set(packageCategories.map((category) => category.category_code));
  for (const product of packageProducts) {
    if (!categoryCodes.has(product.category_code)) fail(`Product ${product.product_id} references missing category ${product.category_code}`);
  }
  for (const alias of packageAliases) {
    if (!productIds.has(alias.product_id)) fail(`Alias ${alias.alias_id} references missing product ${alias.product_id}`);
  }

  return { manifest, products: packageProducts, aliases: packageAliases, categories: packageCategories };
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

async function candidatesByNormalizedTerm(tx: Tx, term: string) {
  const result = await tx.execute<{ id: string }>(sql`
    select id from products
    where normalize(casefold(normalize(btrim(name), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
      = normalize(casefold(normalize(btrim(${term}), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
    union
    select product_id as id from product_localized_names
    where normalize(casefold(normalize(btrim(name), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
      = normalize(casefold(normalize(btrim(${term}), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
    union
    select product_id as id from product_aliases
    where normalize(casefold(normalize(btrim(name), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
      = normalize(casefold(normalize(btrim(${term}), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
    limit 2
  `);
  return result.rows.map((row) => row.id);
}

async function assertTermSafeForProduct(tx: Tx, term: string, productId: string, context: string) {
  const candidates = new Set(await candidatesByNormalizedTerm(tx, term));
  for (const candidate of candidates) {
    if (candidate !== productId) fail(`${context} conflicts with another Product: ${term}`);
  }
}

async function upsertAlias(tx: Tx, input: { kbAliasId?: string; productId: string; name: string; locale: Locale | null }) {
  await assertTermSafeForProduct(tx, input.name, input.productId, 'Alias');
  if (input.kbAliasId) {
    const byKb = await tx.select().from(productAliases).where(eq(productAliases.kbAliasId, input.kbAliasId)).limit(1);
    if (byKb[0] && byKb[0].productId !== input.productId) fail(`KB alias ${input.kbAliasId} already belongs to another Product`);
  }
  const existing = await tx.execute<{ id: string; product_id: string }>(sql`
    select id, product_id from product_aliases
    where product_id = ${input.productId}
      and normalize(casefold(normalize(btrim(name), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
        = normalize(casefold(normalize(btrim(${input.name}), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
    limit 1
  `);
  const current = existing.rows[0];
  if (current) {
    await tx.update(productAliases)
      .set({ locale: input.locale, kbAliasId: input.kbAliasId ?? null })
      .where(eq(productAliases.id, current.id));
    return current.id;
  }
  const id = randomUUID();
  await tx.insert(productAliases).values({ id, productId: input.productId, name: input.name, locale: input.locale, kbAliasId: input.kbAliasId ?? null });
  return id;
}

async function preserveLocalizedNameAsAlias(tx: Tx, productId: string, locale: Locale, existingName: string, packageName: string) {
  if (existingName.trim() === packageName.trim()) return;
  await upsertAlias(tx, { productId, name: existingName, locale });
}

async function resolveRuntimeProduct(tx: Tx, product: PackageProduct, resolved: Map<string, string>) {
  const byKb = await tx.select().from(products).where(eq(products.kbProductId, product.product_id)).limit(1);
  if (byKb[0]) {
    await tx.update(products).set({ name: product.canonical_name_ru }).where(eq(products.id, byKb[0].id));
    resolved.set(product.product_id, byKb[0].id);
    return { id: byKb[0].id, adopted: false, created: false };
  }

  const canonicalCandidates = await tx.execute<{ id: string; kb_product_id: string | null }>(sql`
    select id, kb_product_id from products
    where normalize(casefold(normalize(btrim(name), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
      = normalize(casefold(normalize(btrim(${product.canonical_name_ru}), NFC) collate pg_catalog.pg_unicode_fast), NFC) collate pg_catalog.pg_unicode_fast
    limit 2
  `);
  if (canonicalCandidates.rows.length > 1) fail(`Ambiguous Product adoption for ${product.product_id}`);
  const existing = canonicalCandidates.rows[0];
  if (existing) {
    if (existing.kb_product_id && existing.kb_product_id !== product.product_id) fail(`Product ${existing.id} already has another KB ID`);
    await tx.update(products).set({ kbProductId: product.product_id, name: product.canonical_name_ru }).where(eq(products.id, existing.id));
    resolved.set(product.product_id, existing.id);
    return { id: existing.id, adopted: true, created: false };
  }

  const id = randomUUID();
  await tx.insert(products).values({ id, name: product.canonical_name_ru, kbProductId: product.product_id });
  resolved.set(product.product_id, id);
  return { id, adopted: false, created: true };
}

export async function importProductionKbPackage(db: Database, packageDir?: string): Promise<ProductionKbImportResult> {
  const loaded = await loadProductionKbPackage(packageDir);
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(420021)`);
    let adoptedProducts = 0;
    let createdProducts = 0;
    const resolved = new Map<string, string>();

    for (const category of loaded.categories) {
      await tx.insert(productCategories).values({ code: category.category_code, labelRu: category.category_ru, labelKk: category.category_kk })
        .onConflictDoUpdate({ target: productCategories.code, set: { labelRu: category.category_ru, labelKk: category.category_kk } });
    }

    for (const product of loaded.products) {
      const resolution = await resolveRuntimeProduct(tx, product, resolved);
      if (resolution.adopted) adoptedProducts += 1;
      if (resolution.created) createdProducts += 1;
      const currentLocalized = await tx.select().from(productLocalizedNames).where(eq(productLocalizedNames.productId, resolution.id));
      for (const localized of currentLocalized) {
        if (localized.locale === 'ru') await preserveLocalizedNameAsAlias(tx, resolution.id, 'ru', localized.name, product.canonical_name_ru);
        if (localized.locale === 'kk') await preserveLocalizedNameAsAlias(tx, resolution.id, 'kk', localized.name, product.canonical_name_kk);
      }
      for (const localized of [
        { locale: 'ru' as const, name: product.canonical_name_ru },
        { locale: 'kk' as const, name: product.canonical_name_kk },
      ]) {
        await tx.insert(productLocalizedNames).values({ productId: resolution.id, locale: localized.locale, name: localized.name })
          .onConflictDoUpdate({
            target: [productLocalizedNames.productId, productLocalizedNames.locale],
            set: { name: localized.name },
          });
      }
      await tx.insert(productCategoryLinks).values({ productId: resolution.id, categoryCode: product.category_code })
        .onConflictDoUpdate({ target: productCategoryLinks.productId, set: { categoryCode: product.category_code } });
    }

    for (const alias of loaded.aliases) {
      const productId = resolved.get(alias.product_id);
      if (!productId) fail(`Alias ${alias.alias_id} references unresolved Product ${alias.product_id}`);
      await upsertAlias(tx, { kbAliasId: alias.alias_id, productId, name: alias.alias, locale: alias.language });
    }

    await tx.insert(kbPackageInstall).values({
      id: true,
      packageName: loaded.manifest.package_name,
      packageVersion: loaded.manifest.package_version,
      packageSchemaVersion: loaded.manifest.package_schema_version,
      sourceCheckpointTag: loaded.manifest.source_checkpoint_tag,
      sourceCommitSha: loaded.manifest.source_commit_sha,
      manifestSha256: PRODUCTION_KB_PACKAGE_V1.manifestSha256,
      productsCount: loaded.products.length,
      aliasesCount: loaded.aliases.length,
      categoriesCount: loaded.categories.length,
    }).onConflictDoUpdate({
      target: kbPackageInstall.id,
      set: {
        packageName: loaded.manifest.package_name,
        packageVersion: loaded.manifest.package_version,
        packageSchemaVersion: loaded.manifest.package_schema_version,
        sourceCheckpointTag: loaded.manifest.source_checkpoint_tag,
        sourceCommitSha: loaded.manifest.source_commit_sha,
        manifestSha256: PRODUCTION_KB_PACKAGE_V1.manifestSha256,
        productsCount: loaded.products.length,
        aliasesCount: loaded.aliases.length,
        categoriesCount: loaded.categories.length,
        installedAt: new Date(),
      },
    });

    const representedProducts = Number((await tx.execute<{ count: string }>(sql`select count(*)::text as count from products where kb_product_id is not null`)).rows[0]?.count ?? '0');
    const representedAliases = Number((await tx.execute<{ count: string }>(sql`select count(*)::text as count from product_aliases where kb_alias_id is not null`)).rows[0]?.count ?? '0');
    const representedCategories = Number((await tx.execute<{ count: string }>(sql`select count(*)::text as count from product_categories`)).rows[0]?.count ?? '0');
    if (representedProducts < loaded.products.length || representedAliases < loaded.aliases.length || representedCategories !== loaded.categories.length) {
      fail('Production KB representation counts mismatch after import');
    }

    return {
      products: loaded.products.length,
      aliases: loaded.aliases.length,
      categories: loaded.categories.length,
      adoptedProducts,
      createdProducts,
    };
  });
}
