import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { productAliases } from '../db/product-aliases.table';
import { productLocalizedNames } from '../db/product-localized-names.table';
import { products } from '../db/products.table';

export type ProductReadDb = Pick<Database, 'select'>;

export async function findProductCandidatesByNormalizedTerm(database: ProductReadDb, term: string) {
  const canonicalMatches = await database
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`
      normalize(casefold(normalize(btrim(${products.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
      =
      normalize(casefold(normalize(btrim(${term}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
    `)
    .limit(2);

  const aliasMatches = await database
    .select({ id: products.id, name: products.name })
    .from(productAliases)
    .innerJoin(products, eq(products.id, productAliases.productId))
    .where(sql`
      normalize(casefold(normalize(btrim(${productAliases.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
      =
      normalize(casefold(normalize(btrim(${term}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
    `)
    .limit(2);

  const localizedNameMatches = await database
    .select({ id: products.id, name: products.name })
    .from(productLocalizedNames)
    .innerJoin(products, eq(products.id, productLocalizedNames.productId))
    .where(sql`
      normalize(casefold(normalize(btrim(${productLocalizedNames.name}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
      =
      normalize(casefold(normalize(btrim(${term}), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
    `)
    .limit(2);

  return [...canonicalMatches, ...localizedNameMatches, ...aliasMatches];
}
