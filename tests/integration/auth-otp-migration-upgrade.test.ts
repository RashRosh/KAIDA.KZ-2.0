import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

describe('OTP protection additive migration', () => {
  it('upgrades the current chain without changing existing challenges, users or sessions', async () => {
    await withMigrationTestDatabase({ name: 'kaida_auth_otp_upgrade_test', maxConnections: 2 }, async (pool) => {
      const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8')) as { entries: { idx: number; tag: string }[] };
      async function apply(tag: string) {
        for (const sql of (await readFile(`drizzle/migrations/${tag}.sql`, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await pool.query(sql);
      }
      for (const entry of journal.entries.filter((entry) => entry.idx < 25)) await apply(entry.tag);
      const user = '16600000-0000-4000-8000-000000000001', challenge = '16600000-0000-4000-8000-000000000002';
      await pool.query("INSERT INTO users(id,phone_e164,created_at) VALUES($1,'+77000016999','2026-10-09T12:00:00Z')", [user]);
      await pool.query("INSERT INTO auth_otp_challenges(id,phone_e164,otp_digest,created_at,expires_at) VALUES($1,'+77000016999',$2,'2026-10-09T12:00:00Z','2026-10-09T12:05:00Z')", [challenge, 'a'.repeat(64)]);
      await pool.query("INSERT INTO auth_sessions(id,user_id,token_digest,created_at,expires_at) VALUES($1,$2,$3,'2026-10-09T12:00:00Z','2026-11-09T12:00:00Z')", ['16600000-0000-4000-8000-000000000003', user, 'b'.repeat(64)]);
      const before = (await pool.query('SELECT * FROM auth_otp_challenges')).rows;
      const users = (await pool.query('SELECT * FROM users')).rows, sessions = (await pool.query('SELECT * FROM auth_sessions')).rows;
      await apply('0025_auth_otp_protection');
      const after = (await pool.query('SELECT * FROM auth_otp_challenges')).rows;
      expect(after.map(({ failed_attempts, ...row }) => { expect(failed_attempts).toBe(0); return row; })).toEqual(before);
      expect((await pool.query('SELECT * FROM users')).rows).toEqual(users);
      expect((await pool.query('SELECT * FROM auth_sessions')).rows).toEqual(sessions);
      await expect(pool.query('UPDATE auth_otp_challenges SET failed_attempts=-1 WHERE id=$1', [challenge])).rejects.toMatchObject({ code: '23514' });
      expect((await pool.query("SELECT indexname FROM pg_indexes WHERE indexname='auth_otp_challenges_phone_created_at'")).rowCount).toBe(1);
    });
  });
});
