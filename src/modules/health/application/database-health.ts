import { sql } from 'drizzle-orm';
import { getDatabase } from '../../../db/client';
import { checkHealth, type HealthResult } from './check-health';

// R3: the real database ping behind GET /api/health.
export function checkDatabaseHealth(): Promise<HealthResult> {
  return checkHealth(() => getDatabase().execute(sql`select 1`));
}
