import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

it('0027 upgrades0026 additively without altering existing auth/session rows; repeat migration is safe', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-source-pre-migrations-'));
  try {
    await mkdir(join(folder, 'meta'));
    const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8'));
    const old = journal.entries.filter((e: { idx: number }) => e.idx <= 26);
    for (const e of old) await copyFile(`drizzle/migrations/${e.tag}.sql`, join(folder, `${e.tag}.sql`));
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: old }));
    await withMigrationTestDatabase({ name: 'kaida_otp_source_upgrade_test' }, async (pool, db) => {
      await migrate(db, { migrationsFolder: folder });
      const user = '50000000-0000-4000-8000-000000017001', challenge = '60000000-0000-4000-8000-000000017001';
      await pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,now())', [user, '+77000017001']);
      await pool.query("INSERT INTO auth_otp_challenges(id,phone_e164,otp_digest,created_at,expires_at,failed_attempts) VALUES($1,$2,$3,now(),now()+interval '5min',2)", [challenge, '+77000017001', '11'.repeat(32)]);
      await pool.query("INSERT INTO auth_sessions(id,user_id,token_digest,created_at,expires_at) VALUES($1,$2,$3,now(),now()+interval '1day')", ['70000000-0000-4000-8000-000000017001', user, '33'.repeat(32)]);
      const before: Record<string, unknown> = {};
      const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename as string);
      for (const table of tables) before[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows;
      await migrate(db, { migrationsFolder: 'drizzle/migrations' });
      await migrate(db, { migrationsFolder: 'drizzle/migrations' });
      for (const table of tables) expect((await pool.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows).toEqual(before[table]);
      expect((await pool.query('SELECT count(*) FROM auth_otp_source_events')).rows[0].count).toBe('0');
      expect((await pool.query('SELECT count(*) FROM auth_otp_source_maintenance')).rows[0].count).toBe('0');
    });
  } finally { await rm(folder, { recursive: true, force: true }); }
}, 30000);
