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

export async function findCatalogProductById(database: ProductReadDb, id: string) {
  const rows = await database.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

// S15B-1: every catalog name, localized name and alias that contains all query words as substrings, with the product's
// name in the interface language. No ordering or LIMIT here: relevance ranking and the top-5 cut happen after the exact
// word-prefix filter (application layer), so no eligible product is lost to an early alphabetical cut.
export async function findCatalogSuggestionCandidates(
  database: Pick<Database, 'execute'>,
  words: string[],
  locale: 'ru' | 'kk',
) {
  const escape = (word: string) => word.replace(/[\\%_]/g, (character) => `\\${character}`);
  const likes = words.map((word) => sql`replace(lower(n.matched), 'ё', 'е') like ${`%${escape(word)}%`}`);
  const result = await database.execute<{ id: string; name: string; matched: string; kind: 'name' | 'alias' }>(sql`
    select p.id,
      case when ${locale} = 'kk'
        then coalesce((select pln.name from product_localized_names pln where pln.product_id = p.id and pln.locale = 'kk'), p.name)
        else p.name end as name,
      n.matched, n.kind
    from (
      select id as product_id, name as matched, 'name' as kind from products
      union all select product_id, name, 'name' from product_localized_names
      union all select product_id, name, 'alias' from product_aliases
    ) n
    inner join products p on p.id = n.product_id
    where ${sql.join(likes, sql` and `)}
  `);
  return result.rows;
}
