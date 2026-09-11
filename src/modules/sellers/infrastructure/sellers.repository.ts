import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { sellers } from '../db/sellers.table';

export type SellerDb = Pick<Database, 'insert' | 'select'>;

export async function findSellerByOwner(database: SellerDb, ownerUserId: string) {
  const rows = await database
    .select({ id: sellers.id, displayName: sellers.displayName })
    .from(sellers)
    .where(eq(sellers.ownerUserId, ownerUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSeller(database: SellerDb, values: { ownerUserId: string; displayName: string }) {
  const rows = await database
    .insert(sellers)
    .values(values)
    .returning({ id: sellers.id, displayName: sellers.displayName });
  const seller = rows[0];
  if (!seller) throw new Error('Seller insert did not return a row');
  return seller;
}
