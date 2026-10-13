import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

it('0028 adds minimal empty storage and preserves every existing table including S13/photos',async()=>{
  await withMigrationTestDatabase({name:'kaida_favourites_upgrade_test'},async pool=>{
    const journal=JSON.parse(await readFile('drizzle/migrations/meta/_journal.json','utf8')) as {entries:{idx:number;tag:string}[]};
    async function apply(tag:string){for(const statement of (await readFile(`drizzle/migrations/${tag}.sql`,'utf8')).split('--> statement-breakpoint'))if(statement.trim())await pool.query(statement);}
    for(const e of journal.entries.filter(e=>e.idx<28))await apply(e.tag);
    await pool.query("INSERT INTO users(id,phone_e164,created_at) VALUES('fa280000-0000-4000-8000-000000000001','+77000280999',now())");
    await pool.query("INSERT INTO products(id,name) VALUES('fa280000-0000-4000-8000-000000000002','Favourites migration Product')");
    await pool.query("INSERT INTO buyer_interests(user_id,product_id) VALUES('fa280000-0000-4000-8000-000000000001','fa280000-0000-4000-8000-000000000002')");
    await pool.query("INSERT INTO photos(id,owner_user_id,width,height) VALUES('fa280000-0000-4000-8000-000000000003','fa280000-0000-4000-8000-000000000001',800,600)");
    const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string);
    const before=new Map<string,unknown[]>();for(const table of tables)before.set(table,(await pool.query(`SELECT to_jsonb(t) value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows);
    await apply('0028_offer_favourites');for(const table of tables)expect((await pool.query(`SELECT to_jsonb(t) value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows).toEqual(before.get(table));
    expect((await pool.query('SELECT * FROM buyer_offer_favourites')).rows).toEqual([]);
    expect((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='buyer_offer_favourites' ORDER BY ordinal_position")).rows.map(r=>r.column_name)).toEqual(['id','user_id','offer_id','location_id','saved_at']);
  });
});
