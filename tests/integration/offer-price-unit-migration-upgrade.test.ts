import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import { withMigrationTestDatabase } from './migration-test-database';

async function migrateToSellerCommentTranslation(db: ReturnType<typeof drizzle>) {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-offer-price-unit-'));
  await mkdir(join(folder, 'meta'));
  try {
    const files = (await readdir(join(process.cwd(), 'drizzle/migrations')))
      .filter((file) => file.endsWith('.sql') && file < '0013')
      .sort();
    expect(files.at(-1)).toBe('0012_seller_comment_translation.sql');
    for (const file of files) await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
    const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { entries: unknown[] };
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 13) }));
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

// [legacy price_unit, expected code, expected custom value]
const cases: Array<[string | null, string | null, string | null]> = [
  [null, null, null],
  ['', null, null],
  ['   ', null, null],
  ['кг', 'kg', null],
  [' КГ ', 'kg', null],
  ['шт', 'piece', null],
  ['Шт', 'piece', null],
  ['дана', 'piece', null],
  ['л', 'liter', null],
  ['упак.', 'package', null],
  ['қапт.', 'package', null],
  ['  ведро  ', 'other', 'ведро'],
  ['500 г', 'other', '500 г'],
  ['упак', 'other', 'упак'],
];

describe('Offer price unit migration upgrade', () => {
  it('maps null, every recognized label and unknown legacy text losslessly without touching anything else', async () => {
    await withMigrationTestDatabase({ name: 'kaida_offer_price_unit_upgrade_test' }, async (pool, db) => {
      await migrateToSellerCommentTranslation(db);
      const productId = '10000000-0000-4000-8000-000000001301';
      const sellerId = '20000000-0000-4000-8000-000000001301';
      const locationId = '30000000-0000-4000-8000-000000001301';
      const changeSetId = '60000000-0000-4000-8000-000000001301';
      const now = new Date('2026-09-24T00:00:00.000Z');
      const offerId = (index: number) => `40000000-0000-4000-8000-${String(1301 + index).padStart(12, '0')}`;
      const itemId = (index: number) => `70000000-0000-4000-8000-${String(1301 + index).padStart(12, '0')}`;

      await pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, 'Unit Upgrade Product']);
      await pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, 'Unit Upgrade Seller']);
      await pool.query('INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,$5)', [locationId, sellerId, 'Unit Point', 'Unit Address', 'shop']);
      await pool.query('INSERT INTO seller_change_sets (id,seller_id,status) VALUES ($1,$2,$3)', [changeSetId, sellerId, 'proposed']);
      for (const [index, [legacy]] of cases.entries()) {
        await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit,seller_comment,status,last_confirmed_at,revision)
          VALUES ($1,$2,$3,$4,$5,'KZT',$6,$7,'active',$8,$9)`, [offerId(index), productId, sellerId, locationId, `${100 + index}.50`, legacy, `c${index}`, now, index + 1]);
        // Change items were validated to 1–32 trimmed characters before this slice; blanks never existed there.
        if (legacy !== null && legacy.trim() !== '') {
          await pool.query(`INSERT INTO seller_change_items (id,change_set_id,action,product_id,location_id,price_amount,price_currency,price_unit,seller_comment,target_offer_id,expected_offer_revision)
            VALUES ($1,$2,'update_offer',$3,$4,'1','KZT',$5,NULL,$6,$7)`, [itemId(index), changeSetId, productId, locationId, legacy, offerId(index), index + 1]);
        }
      }
      const untouchedColumns = 'id,product_id,seller_id,location_id,price_amount,price_currency,seller_comment,seller_comment_version,status,last_confirmed_at,revision,created_at,updated_at';
      const offersBefore = (await pool.query(`SELECT ${untouchedColumns} FROM offers ORDER BY id`)).rows;
      const itemColumns = 'id,change_set_id,action,product_id,location_id,price_amount,price_currency,seller_comment,target_offer_id,expected_offer_revision,result_offer_id';
      const itemsBefore = (await pool.query(`SELECT ${itemColumns} FROM seller_change_items ORDER BY id`)).rows;

      await migrate(db, { migrationsFolder: './drizzle/migrations' });

      expect((await pool.query(`SELECT ${untouchedColumns} FROM offers ORDER BY id`)).rows).toEqual(offersBefore);
      expect((await pool.query(`SELECT ${itemColumns} FROM seller_change_items ORDER BY id`)).rows).toEqual(itemsBefore);
      for (const [index, [legacy, code, value]] of cases.entries()) {
        expect((await pool.query('SELECT price_unit_code,price_unit_value FROM offers WHERE id=$1', [offerId(index)])).rows[0], `offer ${JSON.stringify(legacy)}`)
          .toEqual({ price_unit_code: code, price_unit_value: value });
        if (legacy !== null && legacy.trim() !== '') {
          expect((await pool.query('SELECT price_unit_code,price_unit_value FROM seller_change_items WHERE id=$1', [itemId(index)])).rows[0], `item ${JSON.stringify(legacy)}`)
            .toEqual({ price_unit_code: code, price_unit_value: value });
        }
      }
      const legacyColumns = await pool.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='price_unit'");
      expect(legacyColumns.rows).toEqual([]);

      await expect(pool.query("UPDATE offers SET price_unit_code='gram' WHERE id=$1", [offerId(0)])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query("UPDATE offers SET price_unit_code='other', price_unit_value=NULL WHERE id=$1", [offerId(0)])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query("UPDATE offers SET price_unit_code='kg', price_unit_value='x' WHERE id=$1", [offerId(0)])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query("UPDATE seller_change_items SET price_unit_code='other', price_unit_value=' x ' WHERE id=$1", [itemId(3)])).rejects.toMatchObject({ code: '23514' });
    });
  });
});
