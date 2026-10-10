import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { otpSourceEvents, otpSourceMaintenance } from '../db/otp-source.table';
import { SOURCE_RETENTION_MS, SOURCE_WINDOW_MS, sourceRetrySeconds, sourceUnavailable, type SourceAdmission, type SourceProtection } from './source-protection';

export type IdentityTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
const maintenanceLock = '177033710021';
export async function lockSourceMaintenance(tx: IdentityTransaction, shared = false) {
  if (shared) await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(${maintenanceLock}::bigint)`);
  else await tx.execute(sql`SELECT pg_advisory_xact_lock(${maintenanceLock}::bigint)`);
}

function maintenanceReady(row: typeof otpSourceMaintenance.$inferSelect | undefined, generation: string, now: Date): boolean {
  return !!row && row.keyGeneration === generation && !!row.lastCleanupAt &&
    row.lastCleanupAt.getTime() <= now.getTime() && now.getTime() - row.lastCleanupAt.getTime() <= SOURCE_WINDOW_MS &&
    !row.retentionIncidentAt && (!row.quarantineUntil || row.quarantineUntil <= now);
}

export async function lockSourceAdmission(tx: IdentityTransaction, source: SourceAdmission) {
  await lockSourceMaintenance(tx, true);
  const key = createHash('sha256').update(`kaida-source-lock-v1\0${source.digest}`).digest().readBigInt64BE(0).toString();
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${key}::bigint)`);
}

export async function sourceAdmissionWait(tx: IdentityTransaction, source: SourceAdmission, now: Date): Promise<number> {
  const [state] = await tx.select().from(otpSourceMaintenance).where(eq(otpSourceMaintenance.id, 'singleton'));
  if (!maintenanceReady(state, source.generation, now)) throw sourceUnavailable();
  const events = await tx.select({ time: otpSourceEvents.acceptedAt }).from(otpSourceEvents)
    .where(and(eq(otpSourceEvents.sourceDigest, source.digest), gt(otpSourceEvents.acceptedAt, new Date(now.getTime() - SOURCE_WINDOW_MS))));
  return sourceRetrySeconds(events.map(e => e.time), now);
}

export async function chargeSource(tx: IdentityTransaction, source: SourceAdmission, now: Date) {
  await tx.insert(otpSourceEvents).values({ id: randomUUID(), sourceDigest: source.digest, keyGeneration: source.generation, acceptedAt: now });
}

export async function cleanupSources(db: Database, config: SourceProtection, now = new Date()) {
  return db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL statement_timeout = '60s'`);
    await lockSourceMaintenance(tx);
    await tx.insert(otpSourceMaintenance).values({ id: 'singleton', keyGeneration: config.generation }).onConflictDoNothing();
    const [state] = await tx.select().from(otpSourceMaintenance).where(eq(otpSourceMaintenance.id, 'singleton'));
    if (state.keyGeneration !== config.generation) throw sourceUnavailable();
    const overdue = await tx.select({ id: otpSourceEvents.id }).from(otpSourceEvents)
      .where(lte(otpSourceEvents.acceptedAt, new Date(now.getTime() - SOURCE_RETENTION_MS))).limit(1);
    const deleted = await tx.delete(otpSourceEvents).where(lte(otpSourceEvents.acceptedAt, new Date(now.getTime() - SOURCE_WINDOW_MS))).returning({ id: otpSourceEvents.id });
    await tx.update(otpSourceMaintenance).set({ lastCleanupAt: now,
      retentionIncidentAt: state.retentionIncidentAt ?? (overdue.length ? now : null) }).where(eq(otpSourceMaintenance.id, 'singleton'));
    return { deleted: deleted.length, retentionIncident: !!state.retentionIncidentAt || !!overdue.length };
  });
}

export async function sourceWorkerHealthy(db: Database, config: SourceProtection, now = new Date()) {
  const [state] = await db.select().from(otpSourceMaintenance).where(eq(otpSourceMaintenance.id, 'singleton'));
  // Quarantine/incident block issuance but do not pretend a live cleanup worker is dead.
  return !!state && state.keyGeneration === config.generation && !!state.lastCleanupAt &&
    state.lastCleanupAt <= now && now.getTime() - state.lastCleanupAt.getTime() <= SOURCE_WINDOW_MS;
}

export async function quarantineSourceIssuance(db: Database, config: SourceProtection, now = new Date()) {
  await db.transaction(async tx => {
    await lockSourceMaintenance(tx);
    await tx.insert(otpSourceMaintenance).values({ id: 'singleton', keyGeneration: config.generation }).onConflictDoNothing();
    const [state] = await tx.select().from(otpSourceMaintenance).where(eq(otpSourceMaintenance.id, 'singleton'));
    const until = new Date(Math.max(state.quarantineUntil?.getTime() ?? 0, now.getTime() + SOURCE_WINDOW_MS));
    await tx.update(otpSourceMaintenance).set({ quarantineUntil: until, lastCleanupAt: null }).where(eq(otpSourceMaintenance.id, 'singleton'));
  });
}

export async function finishSourceRotation(db: Database, config: SourceProtection, now = new Date()) {
  await db.transaction(async tx => {
    await lockSourceMaintenance(tx);
    const [state] = await tx.select().from(otpSourceMaintenance).where(eq(otpSourceMaintenance.id, 'singleton'));
    if (!state?.quarantineUntil || state.quarantineUntil > now) throw sourceUnavailable();
    const active = await tx.select({ id: otpSourceEvents.id }).from(otpSourceEvents)
      .where(gt(otpSourceEvents.acceptedAt, new Date(now.getTime() - SOURCE_WINDOW_MS))).limit(1);
    if (active.length) throw sourceUnavailable();
    // Consume this completed pause; a later rotation must create its own fresh pause.
    await tx.update(otpSourceMaintenance).set({ keyGeneration: config.generation, lastCleanupAt: null, quarantineUntil: null }).where(eq(otpSourceMaintenance.id, 'singleton'));
  });
}

export async function acknowledgeSourceRetention(db: Database, config: SourceProtection, now = new Date()) {
  await db.transaction(async tx => {
    await lockSourceMaintenance(tx);
    const [state] = await tx.select().from(otpSourceMaintenance).where(eq(otpSourceMaintenance.id, 'singleton'));
    if (!sourceWorkerReadyForAcknowledgement(state, config, now)) throw sourceUnavailable();
    await tx.update(otpSourceMaintenance).set({ retentionIncidentAt: null }).where(eq(otpSourceMaintenance.id, 'singleton'));
  });
}
function sourceWorkerReadyForAcknowledgement(state: typeof otpSourceMaintenance.$inferSelect | undefined, config: SourceProtection, now: Date) {
  return maintenanceReady(state ? { ...state, retentionIncidentAt: null } : undefined, config.generation, now);
}
