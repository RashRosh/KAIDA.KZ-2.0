import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { digestSessionToken } from '../crypto/session-token';
import { deleteSessionByDigest } from '../infrastructure/identity.repository';

export async function logout(sessionToken: string | undefined, database: Database = getDatabase()): Promise<void> {
  if (!sessionToken) return;
  await deleteSessionByDigest(database, digestSessionToken(sessionToken));
}
