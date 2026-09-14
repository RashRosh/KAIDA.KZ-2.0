import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import type { BuyerInterest } from '../contracts/interests.contract';
import { buyerInterests } from '../db/buyer-interests.table';

export type InterestsDb = Pick<Database, 'select' | 'insert' | 'delete'>;

export async function findProductById(database: InterestsDb, productId: string) {
  const rows = await database
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listInterestsByUser(database: InterestsDb, userId: string): Promise<BuyerInterest[]> {
  const rows = await database
    .select({ productId: products.id, productName: products.name })
    .from(buyerInterests)
    .innerJoin(products, eq(products.id, buyerInterests.productId))
    .where(eq(buyerInterests.userId, userId))
    .orderBy(asc(products.name), asc(products.id));

  return rows.map((row) => ({ product: { id: row.productId, name: row.productName } }));
}

export async function insertInterest(database: InterestsDb, userId: string, productId: string): Promise<void> {
  await database
    .insert(buyerInterests)
    .values({ userId, productId })
    .onConflictDoNothing({ target: [buyerInterests.userId, buyerInterests.productId] });
}

export async function deleteInterest(database: InterestsDb, userId: string, productId: string): Promise<void> {
  await database
    .delete(buyerInterests)
    .where(and(eq(buyerInterests.userId, userId), eq(buyerInterests.productId, productId)));
}
