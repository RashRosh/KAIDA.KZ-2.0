import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';
it('reporting migration preserves every existing public table and adds empty report storage',async()=>{
  await withMigrationTestDatabase({name:'kaida_reports_upgrade_test'},async pool=>{
    const journal=JSON.parse(await readFile('drizzle/migrations/meta/_journal.json','utf8')) as {entries:{idx:number;tag:string}[]};
    async function apply(tag:string){for(const statement of (await readFile(`drizzle/migrations/${tag}.sql`,'utf8')).split('--> statement-breakpoint'))if(statement.trim())await pool.query(statement);}
    for(const e of journal.entries.filter(e=>e.idx<26))await apply(e.tag);
    await pool.query("INSERT INTO users(id,phone_e164,created_at) VALUES('a9010000-0000-4000-8000-000000000001','+77000991999','2026-10-10T00:00:00Z')");
    await pool.query("INSERT INTO auth_sessions(id,user_id,token_digest,created_at,expires_at) VALUES('a9010000-0000-4000-8000-000000000002','a9010000-0000-4000-8000-000000000001',$1,'2026-10-10T00:00:00Z','2026-11-10T00:00:00Z')",['a'.repeat(64)]);
    const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string);
    const before=new Map<string,unknown[]>();
    for(const table of tables)before.set(table,(await pool.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows);
    await apply('0026_buyer_offer_reports');
    for(const table of tables)expect((await pool.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows).toEqual(before.get(table));
    for(const table of ['offer_reports','offer_report_photos','offer_report_receipts'])expect((await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n).toBe(0);
    expect((await pool.query("SELECT tgname FROM pg_trigger WHERE tgname='offer_reports_immutable'")).rowCount).toBe(1);
  });
});
