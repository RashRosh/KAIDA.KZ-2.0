import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { requestOtp } from '../../src/modules/identity/application/request-otp';
import { verifyOtp } from '../../src/modules/identity/application/verify-otp';
import { resolveCurrentUser } from '../../src/modules/identity/application/resolve-current-user';
import { logout } from '../../src/modules/identity/application/logout';
import type { IdentityConfig } from '../../src/modules/identity/config/identity.config';
import { testOtpDelivery } from '../../src/modules/identity/delivery/otp-delivery';
import { connectTestDatabase } from './database';

const CONFIG: IdentityConfig = {
  otpTtlSeconds: 300,
  sessionTtlSeconds: 2_592_000,
  otpHmacSecret: Buffer.from('11'.repeat(32), 'hex'),
  cookieSecure: false,
};
const NOW = new Date('2026-09-11T12:00:00.000Z');

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

async function cleanupPhone(phone: string) {
  await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164 = $1)', [phone]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164 = $1', [phone]);
  await pool.query('DELETE FROM users WHERE phone_e164 = $1', [phone]);
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await pool.end();
});

describe('S2 Identity auth on PostgreSQL 18', () => {
  it('requests a challenge without creating User and stores only OTP HMAC material', async () => {
    const phone = '+77000000101';
    await cleanupPhone(phone);
    const result = await requestOtp({ phone: '8 700 000 01 01' }, {
      delivery: testOtpDelivery,
      database: db,
      clock: () => NOW,
      config: CONFIG,
      generateChallengeId: () => '10000000-0000-4000-8000-000000000101',
      generateCode: () => '004281',
    });

    expect(result.delivery).toEqual({ mode: 'test', code: '004281' });
    const challenge = (await pool.query('SELECT * FROM auth_otp_challenges WHERE id = $1', [result.challenge.id])).rows[0];
    expect(challenge.phone_e164).toBe(phone);
    expect(challenge.otp_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(challenge.otp_digest).not.toBe('004281');
    expect(challenge.created_at).toEqual(NOW);
    expect(challenge.expires_at).toEqual(new Date(NOW.getTime() + 300_000));
    expect(Number((await pool.query('SELECT count(*) FROM users WHERE phone_e164 = $1', [phone])).rows[0].count)).toBe(0);
    await cleanupPhone(phone);
  });

  it('wrong OTP does not consume challenge or create User/session', async () => {
    const phone = '+77000000102';
    await cleanupPhone(phone);
    const requested = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG });
    await expect(verifyOtp({ challengeId: requested.challenge.id, code: '999999' }, { database: db, clock: () => NOW, config: CONFIG }))
      .rejects.toMatchObject({ code: 'INVALID_OTP', status: 401 });
    const row = (await pool.query('SELECT consumed_at FROM auth_otp_challenges WHERE id = $1', [requested.challenge.id])).rows[0];
    expect(row.consumed_at).toBeNull();
    expect(Number((await pool.query('SELECT count(*) FROM users WHERE phone_e164 = $1', [phone])).rows[0].count)).toBe(0);
    expect(Number((await pool.query('SELECT count(*) FROM auth_sessions')).rows[0].count)).toBeGreaterThanOrEqual(0);
    await cleanupPhone(phone);
  });

  it('expiry boundary rejects == expires_at and later without sleep', async () => {
    for (const offset of [300_000, 300_001]) {
      const phone = offset === 300_000 ? '+77000000103' : '+77000000104';
      await cleanupPhone(phone);
      const requested = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG });
      await expect(verifyOtp({ challengeId: requested.challenge.id, code: requested.delivery.code }, {
        database: db,
        clock: () => new Date(NOW.getTime() + offset),
        config: CONFIG,
      })).rejects.toMatchObject({ code: 'OTP_EXPIRED', status: 410 });
      await cleanupPhone(phone);
    }
  });

  it('new OTP supersedes previous unfinished challenge and only the new code works', async () => {
    const phone = '+77000000105';
    await cleanupPhone(phone);
    const first = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG, generateCode: () => '111111' });
    const secondNow = new Date(NOW.getTime() + 1000);
    const second = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => secondNow, config: CONFIG, generateCode: () => '222222' });
    await expect(verifyOtp({ challengeId: first.challenge.id, code: '111111' }, { database: db, clock: () => secondNow, config: CONFIG }))
      .rejects.toMatchObject({ code: 'OTP_NOT_ACTIVE', status: 409 });
    const login = await verifyOtp({ challengeId: second.challenge.id, code: '222222' }, { database: db, clock: () => secondNow, config: CONFIG });
    expect(login.user.phoneE164).toBe(phone);
    expect(Number((await pool.query('SELECT count(*) FROM users WHERE phone_e164 = $1', [phone])).rows[0].count)).toBe(1);
    await cleanupPhone(phone);
  });

  it('creates one User, reuses it on later login, resolves sessions and logs out one session only', async () => {
    const phone = '+77000000106';
    await cleanupPhone(phone);
    const firstRequest = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG });
    const first = await verifyOtp({ challengeId: firstRequest.challenge.id, code: firstRequest.delivery.code }, { database: db, clock: () => NOW, config: CONFIG });
    const secondNow = new Date(NOW.getTime() + 10_000);
    const secondRequest = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => secondNow, config: CONFIG });
    const second = await verifyOtp({ challengeId: secondRequest.challenge.id, code: secondRequest.delivery.code }, { database: db, clock: () => secondNow, config: CONFIG });

    expect(second.user.id).toBe(first.user.id);
    expect(Number((await pool.query('SELECT count(*) FROM users WHERE phone_e164 = $1', [phone])).rows[0].count)).toBe(1);
    expect(await resolveCurrentUser(first.sessionToken, { database: db, clock: () => new Date(NOW.getTime() + 20_000) })).toEqual(first.user);
    expect(await resolveCurrentUser('unknown-token', { database: db, clock: () => NOW })).toBeNull();
    expect(await resolveCurrentUser(first.sessionToken, { database: db, clock: () => first.sessionExpiresAt })).toBeNull();

    await logout(first.sessionToken, db);
    expect(await resolveCurrentUser(first.sessionToken, { database: db, clock: () => secondNow })).toBeNull();
    expect(await resolveCurrentUser(second.sessionToken, { database: db, clock: () => secondNow })).toEqual(second.user);
    await logout(first.sessionToken, db);
    await cleanupPhone(phone);
  });
});
