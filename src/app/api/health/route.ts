import { checkDatabaseHealth } from '@/modules/health/application/database-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

// R3 (docs/slices/r3-deployment-preparation): 200 when the process and the database answer, otherwise 503. No data, no auth.
export async function GET() {
  const result = await checkDatabaseHealth();
  return Response.json({ status: result.ok ? 'ok' : 'unavailable' }, { status: result.ok ? 200 : 503, headers: noStoreHeaders });
}
