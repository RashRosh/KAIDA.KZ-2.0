import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import type { CurrentUser } from '../contracts/auth.contract';
import { digestSessionToken } from '../crypto/session-token';
import { findCurrentUserBySessionDigest } from '../infrastructure/identity.repository';
import { systemIdentityClock, type IdentityClock } from '../time/identity-clock';

export async function resolveCurrentUser(
  sessionToken: string | undefined,
  dependencies: { database?: Database; clock?: IdentityClock } = {},
): Promise<CurrentUser | null> {
  if (!sessionToken) return null;
  const db = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? systemIdentityClock)();
  return findCurrentUserBySessionDigest(db, digestSessionToken(sessionToken), now);
}
