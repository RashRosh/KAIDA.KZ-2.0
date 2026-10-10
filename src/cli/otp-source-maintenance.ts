import 'dotenv/config';
import { createDatabase } from '../db/client';
import { runSourceCleanupWorker } from '../modules/identity/source/cleanup-worker';
import { acknowledgeSourceRetention, cleanupSources, finishSourceRotation, quarantineSourceIssuance, sourceWorkerHealthy } from '../modules/identity/source/source.repository';
import { loadSourceProtection } from '../modules/identity/source/source-protection';

async function main() {
  const config = loadSourceProtection();
  if (!config || !process.env.DATABASE_URL) throw new Error('Protected source maintenance configuration required');
  const command = process.argv[2] ?? 'worker';
  const { db, pool } = createDatabase(process.env.DATABASE_URL);
  const abort = new AbortController();
  process.once('SIGTERM', () => abort.abort());
  process.once('SIGINT', () => abort.abort());
  try {
    if (command === 'worker') await runSourceCleanupWorker(db, config, { signal: abort.signal,
      onSweep: r => console.log(`OTP source cleanup: deleted=${r.deleted}; retentionIncident=${r.retentionIncident}`) });
    else if (command === 'health') { if (!await sourceWorkerHealthy(db, config)) throw new Error('OTP source cleanup stale'); }
    else if (command === 'sweep') await cleanupSources(db, config);
    else if (command === 'quarantine') await quarantineSourceIssuance(db, config);
    else if (command === 'finish-rotation') await finishSourceRotation(db, config);
    else if (command === 'ack-retention' && process.argv.includes('--operator-remediation-confirmed')) await acknowledgeSourceRetention(db, config);
    else throw new Error('Unknown OTP source maintenance command');
  } finally { await pool.end(); }
}
main().catch(() => { console.error('OTP source maintenance unavailable; check configuration, database and cleanup health.'); process.exitCode = 1; });
