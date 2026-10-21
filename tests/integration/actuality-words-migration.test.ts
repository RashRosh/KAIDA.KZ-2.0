import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

// actuality-words 0029: the undo storage is additive. Every existing table and row — including existing ChangeSet items and the
// legacy S13 selections — is unchanged; the whole chain also applies from scratch.

const ID = (suffix: string) => `a2900000-0000-4000-8000-${suffix.padStart(12, '0')}`;

it('0029 upgrades data that has reconfirm items and S13 selections without changing it, and applies from scratch', async () => {
  await withMigrationTestDatabase({ name: 'kaida_actuality_words_upgrade_test' }, async (pool) => {
    const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8')) as { entries: { idx: number; tag: string }[] };
    async function apply(tag: string) {
      for (const statement of (await readFile(`drizzle/migrations/${tag}.sql`, 'utf8')).split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
    expect(journal.entries.find((entry) => entry.idx === 29)!.tag).toBe('0029_actuality_words_undo');
    for (const entry of journal.entries.filter((item) => item.idx < 29)) await apply(entry.tag);

    // Existing data: a Seller with a confirmed ChangeSet whose item is a pre-0029 reconfirm_offer, and an S13 selection.
    await pool.query("INSERT INTO users(id,phone_e164,created_at) VALUES ($1,'+77000290001',now())", [ID('1')]);
    await pool.query("INSERT INTO products(id,name) VALUES ($1,'Actuality migration Product')", [ID('2')]);
    await pool.query('INSERT INTO buyer_interests(user_id,product_id) VALUES ($1,$2)', [ID('1'), ID('2')]);
    await pool.query("INSERT INTO sellers(id,owner_user_id,display_name) VALUES ($1,$2,'Migration seller')", [ID('3'), ID('1')]);
    await pool.query("INSERT INTO locations(id,seller_id,name,address_text,type) VALUES ($1,$2,'Point','Address','shop')", [ID('4'), ID('3')]);
    await pool.query("INSERT INTO offers(id,seller_id,location_id,status,last_confirmed_at,title,title_search,card_id,price_amount,price_currency,price_unit_code) VALUES ($1,$2,$3,'active',now(),'Offer','offer',$4,1000,'KZT','kg')", [ID('5'), ID('3'), ID('4'), ID('6')]);
    await pool.query("INSERT INTO seller_change_sets(id,seller_id,status,confirmed_at) VALUES ($1,$2,'confirmed',now())", [ID('7'), ID('3')]);
    await pool.query("INSERT INTO seller_change_items(id,change_set_id,action,location_id,title,card_id,price_amount,price_currency,price_unit_code,target_offer_id,expected_offer_revision,result_offer_id) VALUES ($1,$2,'reconfirm_offer',$3,'Offer',$4,1000,'KZT','kg',$5,1,$5)", [ID('8'), ID('7'), ID('4'), ID('6'), ID('5')]);

    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((row) => row.tablename as string);
    const snapshot = async () => {
      const result = new Map<string, unknown[]>();
      for (const table of tables) {
        const rows = (await pool.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows;
        result.set(table, rows.map((row) => {
          const value = { ...(row.value as Record<string, unknown>) };
          delete value.previous_confirmed_at; // the only new key (seller_change_items)
          return value;
        }));
      }
      return result;
    };
    const before = await snapshot();
    await apply('0029_actuality_words_undo');
    expect(await snapshot()).toEqual(before);
    expect((await pool.query('SELECT previous_confirmed_at FROM seller_change_items WHERE id=$1', [ID('8')])).rows).toEqual([{ previous_confirmed_at: null }]);
    expect((await pool.query('SELECT count(*)::int AS n FROM buyer_interests')).rows[0].n).toBe(1);

    // New rules: an undo needs the time it restores; the column belongs to reconfirm / undo items only.
    const insertItem = (id: string, action: string, previous: string | null) => pool.query(
      "INSERT INTO seller_change_items(id,change_set_id,action,location_id,title,card_id,price_amount,price_currency,price_unit_code,target_offer_id,expected_offer_revision,previous_confirmed_at) VALUES ($1,$2,$3,$4,'Offer',$5,1000,'KZT','kg',$6,2,$7)",
      [id, ID('7'), action, ID('4'), ID('6'), ID('5'), previous],
    );
    await expect(insertItem(ID('9'), 'undo_reconfirm_offer', null)).rejects.toThrow(/seller_change_items_undo_restore_time_required/);
    await expect(insertItem(ID('a'), 'update_offer', '2026-09-20T07:00:00Z')).rejects.toThrow(/seller_change_items_previous_confirmed_scope/);
    await insertItem(ID('b'), 'undo_reconfirm_offer', '2026-09-20T07:00:00Z');
    await insertItem(ID('c'), 'reconfirm_offer', '2026-09-20T07:00:00Z');
    expect((await pool.query("SELECT count(*)::int AS n FROM seller_change_items WHERE action IN ('undo_reconfirm_offer','reconfirm_offer')")).rows[0].n).toBe(3);
  });

  // From scratch: the whole chain on an empty database.
  await withMigrationTestDatabase({ name: 'kaida_actuality_words_scratch_test' }, async (pool) => {
    const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8')) as { entries: { idx: number; tag: string }[] };
    for (const entry of journal.entries) {
      for (const statement of (await readFile(`drizzle/migrations/${entry.tag}.sql`, 'utf8')).split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
    expect((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='seller_change_items' AND column_name='previous_confirmed_at'")).rows).toHaveLength(1);
  });
}, 120_000);
