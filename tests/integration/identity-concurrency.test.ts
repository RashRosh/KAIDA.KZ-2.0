import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { requestOtp } from '../../src/modules/identity/application/request-otp';
import { verifyOtp } from '../../src/modules/identity/application/verify-otp';
import type { IdentityConfig } from '../../src/modules/identity/config/identity.config';
import { testOtpDelivery } from '../../src/modules/identity/delivery/otp-delivery';
import { getOrCreateUserForPhone } from '../../src/modules/identity/infrastructure/identity.repository';
import { connectTestDatabase } from './database';

const CONFIG: IdentityConfig = {
  otpTtlSeconds: 300,
  sessionTtlSeconds: 2_592_000,
  otpHmacSecret: Buffer.from('22'.repeat(32), 'hex'),
  cookieSecure: false,
};
const NOW = new Date('2026-09-11T13:00:00.000Z');
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

afterAll(async () => pool.end());

describe('S2 Identity concurrency guarantees', () => {
  it('serializes concurrent OTP requests per canonical phone and leaves one unfinished challenge', async () => {
    const phone = '+77000000201';
    await cleanupPhone(phone);
    const [a, b] = await Promise.all([
      requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG, generateCode: () => '111111' }),
      requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG, generateCode: () => '222222' }),
    ]);
    const rows = await pool.query('SELECT id, superseded_at, consumed_at FROM auth_otp_challenges WHERE phone_e164 = $1', [phone]);
    expect(rows.rowCount).toBe(2);
    const unfinished = rows.rows.filter((row) => row.superseded_at === null && row.consumed_at === null);
    expect(unfinished).toHaveLength(1);
    expect([a.challenge.id, b.challenge.id]).toContain(unfinished[0].id);
    await cleanupPhone(phone);
  });

  it('allows exactly one successful concurrent consume of one challenge', async () => {
    const phone = '+77000000202';
    await cleanupPhone(phone);
    const requested = await requestOtp({ phone }, { delivery: testOtpDelivery, database: db, clock: () => NOW, config: CONFIG, generateCode: () => '333333' });
    const results = await Promise.allSettled([
      verifyOtp({ challengeId: requested.challenge.id, code: '333333' }, { database: db, clock: () => NOW, config: CONFIG }),
      verifyOtp({ challengeId: requested.challenge.id, code: '333333' }, { database: db, clock: () => NOW, config: CONFIG }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(Number((await pool.query('SELECT count(*) FROM users WHERE phone_e164 = $1', [phone])).rows[0].count)).toBe(1);
    expect(Number((await pool.query('SELECT count(*) FROM auth_sessions WHERE user_id = (SELECT id FROM users WHERE phone_e164 = $1)', [phone])).rows[0].count)).toBe(1);
    const challenge = (await pool.query('SELECT consumed_at, superseded_at FROM auth_otp_challenges WHERE id = $1', [requested.challenge.id])).rows[0];
    expect(challenge.consumed_at).toBeInstanceOf(Date);
    expect(challenge.superseded_at).toBeNull();
    await cleanupPhone(phone);
  });

  it('PostgreSQL UNIQUE makes concurrent User get-or-create converge on one User id', async () => {
    const phone = '+77000000203';
    await cleanupPhone(phone);
    const [a, b] = await Promise.all([
      getOrCreateUserForPhone(db, phone, NOW),
      getOrCreateUserForPhone(db, phone, NOW),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.phoneE164).toBe(phone);
    expect(Number((await pool.query('SELECT count(*) FROM users WHERE phone_e164 = $1', [phone])).rows[0].count)).toBe(1);
    await cleanupPhone(phone);
  });
});
