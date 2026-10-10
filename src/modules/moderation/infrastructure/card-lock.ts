import { sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';

// All card confirmation/removal/return/report decisions take this lock BEFORE Offer locks.
// It also covers inserting another point into an existing card (a row lock cannot cover a new row).
export async function lockCards(db: Pick<Database, 'execute'>, cardIds: string[]) {
  for (const id of [...new Set(cardIds)].sort()) await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`moderation-card:${id}`}, 0))`);
}
