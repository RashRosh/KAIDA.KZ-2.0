import { sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../db/products.table';

export type ProductReadDb = Pick<Database, 'select'>;

export async function findProductsByCaseInsensitiveExactName(database: ProductReadDb, name: string) {
  return database
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`lower(${products.name}) = lower(${name})`)
    .limit(2);
}
