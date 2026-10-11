import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/client';
import { requestOtp } from '../../src/modules/identity/application/request-otp';
import { verifyOtp } from '../../src/modules/identity/application/verify-otp';
import { testOtpDelivery } from '../../src/modules/identity/delivery/otp-delivery';
import { acknowledgeSourceRetention, cleanupSources, finishSourceRotation, quarantineSourceIssuance, sourceWorkerHealthy } from '../../src/modules/identity/source/source.repository';
import { loadSourceProtection, sourceAdmission } from '../../src/modules/identity/source/source-protection';
import { runSourceCleanupWorker } from '../../src/modules/identity/source/cleanup-worker';
import { connectTestDatabase, testDatabaseUrl } from './database';

const env = { IDENTITY_OTP_SOURCE_PROTECTION: 'trusted-proxy', IDENTITY_OTP_SOURCE_INGRESS: 'isolated-proxy', IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX: '22'.repeat(32), IDENTITY_OTP_SOURCE_KEY_GENERATION: 'integration' };
const protectedConfig = loadSourceProtection(env);
if (!protectedConfig) throw new Error('test config');
const protection = protectedConfig;
const config = { otpTtlSeconds: 300, sessionTtlSeconds: 2592000, otpHmacSecret: Buffer.from('11'.repeat(32), 'hex'), cookieSecure: false };
const base = new Date('2026-10-11T00:00:00Z');
const clock = (seconds = 0) => () => new Date(+base + seconds * 1000);
let connection: Awaited<ReturnType<typeof connectTestDatabase>>, sequence = 0;
const phones: string[] = [];
function phone() { const p = `+77000018${String(++sequence).padStart(3, '0')}`; phones.push(p); return p; }
function request(p: string, seconds = 0, ip = '192.0.2.1') {
  return requestOtp({ phone: p, sourceIp: ip }, { database: connection.db, config, sourceProtection: protection, clock: clock(seconds), delivery: testOtpDelivery, generateCode: () => '123456' });
}
beforeAll(async () => { connection = await connectTestDatabase(); });
beforeEach(async () => {
  await connection.pool.query('TRUNCATE auth_otp_source_events, auth_otp_source_maintenance');
  await cleanupSources(connection.db, protection, base);
});
afterAll(async () => {
  await connection.pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1))', [phones]);
  await connection.pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=ANY($1)', [phones]);
  await connection.pool.query('DELETE FROM users WHERE phone_e164=ANY($1)', [phones]);
  await connection.pool.query('TRUNCATE auth_otp_source_events, auth_otp_source_maintenance');
  await connection.pool.end();
});

describe('atomic persisted source/phone admission', () => {
  it('serializes one phone across competing sources without partial source charges', async () => {
    const p = phone();
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => request(p, 0, `192.0.2.${i + 1}`)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(9);
    for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'OTP_REQUEST_THROTTLED' });
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_source_events')).rows[0].count).toBe('1');
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_challenges WHERE phone_e164=$1', [p])).rows[0].count).toBe('1');
  });
  it('admits20 different phones concurrently without source cooldown, denies21st, another source works', async () => {
    const results = await Promise.allSettled(Array.from({ length: 21 }, () => request(phone())));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(20);
    const denied = results.find(r => r.status === 'rejected');
    expect(denied).toMatchObject({ reason: { code: 'OTP_SOURCE_THROTTLED', retryAfterSeconds: 900 } });
    expect((await request(phone(), 0, '192.0.2.2')).challenge.id).toBeTruthy();
  });
  it('phone denial consumes no source slot; source denial consumes no phone slot/replacement/delivery', async () => {
    const p = phone(), first = await request(p);
    await expect(request(p, 1, '192.0.2.2')).rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED' });
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_source_events')).rows[0].count).toBe('1');
    for (let i = 0; i < 19; i++) await request(phone());
    let delivery = 0;
    await expect(requestOtp({ phone: p, sourceIp: '192.0.2.1' }, { database: connection.db, config, sourceProtection: protection, clock: clock(60), delivery: { deliver: async () => { delivery++; return null; } } })).rejects.toMatchObject({ code: 'OTP_SOURCE_THROTTLED', retryAfterSeconds: 840 });
    expect(delivery).toBe(0);
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_challenges WHERE phone_e164=$1', [p])).rows[0].count).toBe('1');
    expect((await verifyOtp({ challengeId: first.challenge.id, code: first.delivery.code }, { database: connection.db, config, clock: clock(60) })).user.phoneE164).toBe(p);
    expect((await request(p, 60, '192.0.2.3')).challenge.id).toBeTruthy();
  });
  it('IPv4-mapped aliases share the cap; budgets persist in another connection', async () => {
    for (let i = 0; i < 20; i++) await request(phone());
    const restarted = createDatabase(testDatabaseUrl());
    try { await expect(requestOtp({ phone: phone(), sourceIp: '::ffff:c000:201' }, { database: restarted.db, config, sourceProtection: protection, clock: clock(), delivery: testOtpDelivery })).rejects.toMatchObject({ code: 'OTP_SOURCE_THROTTLED' }); }
    finally { await restarted.pool.end(); }
  });
  it('rollback charges neither budget; committed delivery failure retains both charges', async () => {
    const p = phone(), first = await request(p);
    await expect(requestOtp({ phone: p, sourceIp: '192.0.2.1' }, { database: connection.db, config, sourceProtection: protection, clock: clock(60), delivery: testOtpDelivery, generateChallengeId: () => first.challenge.id })).rejects.toBeTruthy();
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_source_events')).rows[0].count).toBe('1');
    await expect(requestOtp({ phone: p, sourceIp: '192.0.2.1' }, { database: connection.db, config, sourceProtection: protection, clock: clock(60), delivery: { deliver: async () => { throw new Error('synthetic delivery failure'); } } })).rejects.toThrow('synthetic delivery failure');
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_source_events')).rows[0].count).toBe('2');
    await expect(request(p, 61, '192.0.2.2')).rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED' });
  });
  it('stale/missing/key-mismatched cleanup blocks issuance only; fresh sweep recovers without resetting active quotas', async () => {
    const p = phone(), first = await request(p, 899);
    await expect(request(phone(), 901)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE', preservesCurrentCode: true });
    await cleanupSources(connection.db, protection, clock(901)());
    expect((await request(phone(), 901)).challenge.id).toBeTruthy();
    await connection.pool.query('UPDATE auth_otp_source_maintenance SET last_cleanup_at=NULL');
    await expect(request(phone(), 903)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    expect((await verifyOtp({ challengeId: first.challenge.id, code: first.delivery.code }, { database: connection.db, config, clock: clock(903) })).user.phoneE164).toBe(p);
    const otherKey = loadSourceProtection({ ...env, IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX: '33'.repeat(32) });
    if (!otherKey) throw new Error('test config');
    await expect(cleanupSources(connection.db, otherKey, clock(902)())).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
  });
  it('source normalization failure preserves the active challenge and no raw source fields are stored', async () => {
    const p = phone(), first = await request(p);
    await expect(request(p, 60, '192.0.2.2, 192.0.2.3')).rejects.toMatchObject({ preservesCurrentCode: true });
    const rows = (await connection.pool.query('SELECT * FROM auth_otp_source_events')).rows;
    expect(Object.keys(rows[0]).sort()).toEqual(['accepted_at', 'id', 'key_generation', 'source_digest']);
    expect(rows[0].source_digest).toBe(sourceAdmission(protection, '192.0.2.1').digest);
    expect((await verifyOtp({ challengeId: first.challenge.id, code: first.delivery.code }, { database: connection.db, config, clock: clock(60) })).user.phoneE164).toBe(p);
  });
  it('independent running worker purges with no requests and retains active evidence', async () => {
    await request(phone());
    const controller = new AbortController(); let sweeps = 0;
    await runSourceCleanupWorker(connection.db, protection, { signal: controller.signal, intervalMs: 5,
      clock: () => clock(sweeps === 0 ? 899 : 900)(), onSweep: r => { sweeps++; if (sweeps === 1) expect(r.deleted).toBe(0); else { expect(r.deleted).toBe(1); controller.abort(); } } });
    expect(sweeps).toBe(2);
    expect(await sourceWorkerHealthy(connection.db, protection, clock(900)())).toBe(true);
  });
  it('latches retention incidents through cleanup, requiring explicit acknowledgement', async () => {
    await request(phone());
    expect((await cleanupSources(connection.db, protection, clock(86400)())).retentionIncident).toBe(true);
    await expect(request(phone(), 86400)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    await acknowledgeSourceRetention(connection.db, protection, clock(86400)());
    expect((await request(phone(), 86400)).challenge.id).toBeTruthy();
  });
  it('quarantine survives restart and coordinated key rotation cannot shorten the15min pause', async () => {
    await request(phone()); await quarantineSourceIssuance(connection.db, protection, clock(60)());
    await cleanupSources(connection.db, protection, clock(61)());
    await expect(request(phone(), 61)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    const next = loadSourceProtection({ ...env, IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX: '33'.repeat(32) });
    if (!next) throw new Error('test config');
    await expect(finishSourceRotation(connection.db, next, clock(959)())).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    await cleanupSources(connection.db, protection, clock(960)());
    await finishSourceRotation(connection.db, next, clock(960)());
    await cleanupSources(connection.db, next, clock(960)());
    expect(await sourceWorkerHealthy(connection.db, next, clock(960)())).toBe(true);
    await expect(finishSourceRotation(connection.db, protection, clock(961)())).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    await expect(request(phone(), 960)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
  });
});
