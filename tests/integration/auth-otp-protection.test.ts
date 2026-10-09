import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestOtp } from '../../src/modules/identity/application/request-otp';
import { verifyOtp } from '../../src/modules/identity/application/verify-otp';
import { createDatabase } from '../../src/db/client';
import { testOtpDelivery } from '../../src/modules/identity/delivery/otp-delivery';
import { connectTestDatabase, testDatabaseUrl } from './database';

const config = { otpTtlSeconds: 300, sessionTtlSeconds: 2592000, otpHmacSecret: Buffer.from('11'.repeat(32), 'hex'), cookieSecure: false };
const base = new Date('2026-10-09T12:00:00Z');
const clock = (seconds = 0) => () => new Date(base.getTime() + seconds * 1000);
let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
let sequence = 0;
const phones: string[] = [];
function phone() { const value = `+77000016${String(++sequence).padStart(3, '0')}`; phones.push(value); return value; }
function request(value: string, seconds = 0) {
  return requestOtp({ phone: value }, { database: connection.db, config, clock: clock(seconds), delivery: testOtpDelivery, generateCode: () => '123456' });
}
function verify(id: string, code: string, seconds = 0) { return verifyOtp({ challengeId: id, code }, { database: connection.db, config, clock: clock(seconds) }); }
beforeAll(async () => { connection = await connectTestDatabase(); });
afterAll(async () => {
  for (const value of phones) {
    await connection.pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [value]);
    await connection.pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [value]);
    await connection.pool.query('DELETE FROM users WHERE phone_e164=$1', [value]);
  }
  await connection.pool.end();
});

describe('persisted phone-based OTP protections', () => {
  it('normalizes aliases before admission; denied requests preserve the usable challenge and do not call delivery', async () => {
    const value = phone(), first = await request(value);
    let deliveries = 0;
    const alias = `8 (${value.slice(2, 5)}) ${value.slice(5, 8)}-${value.slice(8, 10)}-${value.slice(10)}`;
    await expect(requestOtp({ phone: alias }, { database: connection.db, config, clock: clock(59.999), delivery: { deliver: async () => { deliveries++; } } }))
      .rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED', status: 429, retryAfterSeconds: 1 });
    expect(deliveries).toBe(0);
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_challenges WHERE phone_e164=$1', [value])).rows[0].count).toBe('1');
    expect((await verify(first.challenge.id, first.delivery.code, 59.999)).user.phoneE164).toBe(value);
    expect((await request(value, 60)).retryAfterSeconds).toBe(60);
  });
  it('enforces five requests across consumed/superseded/expired history and admits exactly at rolling expiry', async () => {
    const value = phone();
    for (const seconds of [0, 60, 120, 180, 240]) { const r = await request(value, seconds); await verify(r.challenge.id, r.delivery.code, seconds); }
    await expect(request(value, 300)).rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED', retryAfterSeconds: 600 });
    await expect(request(value, 899.999)).rejects.toMatchObject({ retryAfterSeconds: 1 });
    expect((await request(value, 900)).challenge.id).toBeTruthy();
  });
  it('admits only one simultaneous initial request and one final rolling-window slot', async () => {
    for (const initialCount of [0, 4]) {
      const value = phone();
      for (let n = 0; n < initialCount; n++) await request(value, n * 60);
      const results = await Promise.allSettled(Array.from({ length: 12 }, () => request(value, 300)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected' && r.reason.code === 'OTP_REQUEST_THROTTLED')).toHaveLength(11);
      expect((await connection.pool.query('SELECT count(*) FROM auth_otp_challenges WHERE phone_e164=$1', [value])).rows[0].count).toBe(String(initialCount + 1));
    }
  });
  it('commits failure counters, allows a correct fifth submission, and prevents all login after five wrong codes', async () => {
    for (const exhausted of [false, true]) {
      const value = phone(), r = await request(value);
      for (let n = 0; n < 4; n++) await expect(verify(r.challenge.id, '654321')).rejects.toMatchObject({ code: 'INVALID_OTP' });
      if (!exhausted) { expect((await verify(r.challenge.id, r.delivery.code)).user.phoneE164).toBe(value); continue; }
      await expect(verify(r.challenge.id, '654321')).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXHAUSTED' });
      await expect(verify(r.challenge.id, r.delivery.code)).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXHAUSTED' });
      const row = (await connection.pool.query('SELECT failed_attempts,consumed_at FROM auth_otp_challenges WHERE id=$1', [r.challenge.id])).rows[0];
      expect(row).toMatchObject({ failed_attempts: 5, consumed_at: null });
      await expect(request(value, 59)).rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED' });
      const replacement = await request(value, 60);
      await expect(verify(r.challenge.id, r.delivery.code, 60)).rejects.toMatchObject({ code: 'OTP_NOT_ACTIVE' });
      expect((await verify(replacement.challenge.id, replacement.delivery.code, 60)).user.phoneE164).toBe(value);
    }
  });
  it('serializes simultaneous wrong guesses and a correct/wrong final-slot race', async () => {
    const value = phone(), r = await request(value);
    const wrong = await Promise.allSettled(Array.from({ length: 12 }, () => verify(r.challenge.id, '654321')));
    expect(wrong.filter((v) => v.status === 'rejected' && v.reason.code === 'INVALID_OTP')).toHaveLength(4);
    expect(wrong.filter((v) => v.status === 'rejected' && v.reason.code === 'OTP_ATTEMPTS_EXHAUSTED')).toHaveLength(8);
    expect((await connection.pool.query('SELECT failed_attempts FROM auth_otp_challenges WHERE id=$1', [r.challenge.id])).rows[0].failed_attempts).toBe(5);
    for (let repeat = 0; repeat < 8; repeat++) {
      const p = phone(), c = await request(p);
      for (let n = 0; n < 4; n++) await verify(c.challenge.id, '654321').catch(() => {});
      const race = await Promise.allSettled([verify(c.challenge.id, '654321'), verify(c.challenge.id, c.delivery.code)]);
      const row = (await connection.pool.query('SELECT failed_attempts,consumed_at FROM auth_otp_challenges WHERE id=$1', [c.challenge.id])).rows[0];
      expect(row.failed_attempts).toBeLessThanOrEqual(5);
      if (row.failed_attempts === 5) { expect(row.consumed_at).toBeNull(); expect(race.every((v) => v.status === 'rejected')).toBe(true); }
      else { expect(row.failed_attempts).toBe(4); expect(row.consumed_at).toBeInstanceOf(Date); expect(race.filter((v) => v.status === 'fulfilled')).toHaveLength(1); }
    }
  });
  it('a committed replacement remains charged and invalidates old code even when delivery fails', async () => {
    const value = phone(), first = await request(value);
    await expect(requestOtp({ phone: value }, { database: connection.db, config, clock: clock(60), delivery: { deliver: async () => { throw new Error('synthetic delivery failure'); } } })).rejects.toThrow('synthetic delivery failure');
    await expect(verify(first.challenge.id, first.delivery.code, 60)).rejects.toMatchObject({ code: 'OTP_NOT_ACTIVE' });
    await expect(request(value, 61)).rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED', retryAfterSeconds: 59 });
    expect((await connection.pool.query('SELECT count(*) FROM auth_otp_challenges WHERE phone_e164=$1', [value])).rows[0].count).toBe('2');
  });
  it('pre-commit failure rolls back replacement; correct-code/replacement races follow serialized order', async () => {
    const value = phone(), first = await request(value);
    await expect(requestOtp({ phone: value }, { database: connection.db, config, clock: clock(60), delivery: testOtpDelivery, generateChallengeId: () => first.challenge.id })).rejects.toMatchObject({ cause: { code: '23505' } });
    expect((await verify(first.challenge.id, first.delivery.code, 60)).user.phoneE164).toBe(value);
    expect((await request(value, 60)).challenge.id).toBeTruthy();
    for (let repeat = 0; repeat < 8; repeat++) {
      const p = phone(), r = await request(p);
      const results = await Promise.allSettled([request(p, 60), verify(r.challenge.id, r.delivery.code, 60)]);
      expect(results[0].status).toBe('fulfilled');
      const old = (await connection.pool.query('SELECT consumed_at,superseded_at FROM auth_otp_challenges WHERE id=$1', [r.challenge.id])).rows[0];
      if (results[1].status === 'fulfilled') { expect(old.consumed_at).toBeInstanceOf(Date); expect(old.superseded_at).toBeNull(); }
      else { expect(results[1].reason.code).toBe('OTP_NOT_ACTIVE'); expect(old.superseded_at).toBeInstanceOf(Date); }
      expect((await connection.pool.query('SELECT count(*) FROM auth_sessions WHERE user_id IN(SELECT id FROM users WHERE phone_e164=$1)', [p])).rows[0].count).toBe(results[1].status === 'fulfilled' ? '1' : '0');
    }
  });
  it('new connections preserve budgets; malformed/terminal attempts never increment failures', async () => {
    const value = phone(), r = await request(value);
    const restarted = createDatabase(testDatabaseUrl());
    try { await expect(requestOtp({ phone: value }, { database: restarted.db, config, clock: clock(), delivery: testOtpDelivery })).rejects.toMatchObject({ code: 'OTP_REQUEST_THROTTLED' }); }
    finally { await restarted.pool.end(); }
    await expect(verify(r.challenge.id, 'bad')).rejects.toMatchObject({ code: 'INVALID_AUTH_REQUEST' });
    await expect(verify(r.challenge.id, r.delivery.code, 300)).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
    expect((await connection.pool.query('SELECT failed_attempts FROM auth_otp_challenges WHERE id=$1', [r.challenge.id])).rows[0].failed_attempts).toBe(0);
  });
});
