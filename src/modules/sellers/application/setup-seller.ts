import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { createLocation } from '../../locations/infrastructure/locations.repository';
import type { SellerSetupInput, SellerView } from '../contracts/seller.contract';
import { createSeller, findSellerByOwner } from '../infrastructure/sellers.repository';

export class SellerAlreadyExistsError extends Error {
  readonly code = 'SELLER_ALREADY_EXISTS' as const;

  constructor() {
    super('У этого пользователя уже есть продавец.');
    this.name = 'SellerAlreadyExistsError';
  }
}

function isOwnedSellerUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === '23505' && candidate.constraint === 'sellers_owner_user_id_owned_unique';
}

export async function setupSeller(
  ownerUserId: string,
  input: SellerSetupInput,
  dependencies: { database?: Database } = {},
): Promise<SellerView> {
  const database = dependencies.database ?? getDatabase();
  try {
    return await database.transaction(async (tx) => {
      const existing = await findSellerByOwner(tx, ownerUserId);
      if (existing) throw new SellerAlreadyExistsError();

      const seller = await createSeller(tx, {
        ownerUserId,
        displayName: input.seller.displayName.trim(),
      });
      const location = await createLocation(tx, {
        sellerId: seller.id,
        name: input.location.name.trim(),
        addressText: input.location.addressText.trim(),
        type: input.location.type,
      });
      return { ...seller, locations: [location] };
    });
  } catch (error) {
    if (error instanceof SellerAlreadyExistsError) throw error;
    if (isOwnedSellerUniqueViolation(error)) throw new SellerAlreadyExistsError();
    throw error;
  }
}
