import { getDatabase, type Database } from '../../../db/client';
import type { BuyerInterest } from '../contracts/interests.contract';
import {
  deleteInterest,
  findProductById,
  insertInterest,
  listInterestsByUser,
} from '../infrastructure/interests.repository';

export class ProductNotFoundError extends Error {
  readonly code = 'PRODUCT_NOT_FOUND' as const;

  constructor() {
    super('Товар не найден.');
  }
}

type Dependencies = { database?: Database };

export async function listBuyerInterests(userId: string, dependencies: Dependencies = {}): Promise<BuyerInterest[]> {
  return listInterestsByUser(dependencies.database ?? getDatabase(), userId);
}

export async function putBuyerInterest(
  userId: string,
  productId: string,
  dependencies: Dependencies = {},
): Promise<BuyerInterest> {
  const database = dependencies.database ?? getDatabase();
  const product = await findProductById(database, productId);
  if (!product) throw new ProductNotFoundError();
  await insertInterest(database, userId, productId);
  return { product };
}

export async function removeBuyerInterest(
  userId: string,
  productId: string,
  dependencies: Dependencies = {},
): Promise<void> {
  await deleteInterest(dependencies.database ?? getDatabase(), userId, productId);
}
