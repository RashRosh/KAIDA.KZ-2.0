import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import {
  findTelegramSuggestion,
  listOwnedPointDetails,
  replaceOwnedPointDetails,
} from '../../src/modules/locations/details/point-details.application';
import { InvalidTelegramUsernameError } from '../../src/modules/locations/details/telegram-username';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';
import { withMigrationTestDatabase } from './migration-test-database';

// seller-ai-text-real-parser §17: per-point Telegram username — saved normalized, kept, removed, rejected, offered for
// reuse; migration 0031 is additive.
let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const OWNER = { id: '72000000-0000-4000-8000-000000000171', phone: '+77010007171' };
const T0 = new Date('2026-10-21T06:00:00.000Z');

async function cleanup() {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${OWNER.id}'`;
  await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [OWNER.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [OWNER.id, OWNER.phone]);
}

async function seller() {
  await cleanup();
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [OWNER.id, OWNER.phone, T0]);
  const created = await setupSeller(OWNER.id, { seller: { displayName: 'Telegram' }, location: { name: 'TG point', type: 'shop', addressText: 'Almaty' } }, { database: db });
  return created.locations[0]!.id;
}

const details = { phone: null, whatsapp: null, openingHours: templateOpeningHours() };
const stored = async (id: string) => (await pool.query('SELECT telegram_username FROM locations WHERE id=$1', [id])).rows[0].telegram_username;

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('point Telegram', () => {
  it('saves the normalized username, keeps it when an older client omits it, removes it on null', async () => {
    const id = await seller();
    const saved = await replaceOwnedPointDetails(OWNER.id, id, { ...details, telegram: 'https://t.me/Kaida_Shop' }, { database: db });
    expect(saved.contacts.telegram).toBe('kaida_shop');
    expect(await stored(id)).toBe('kaida_shop');
    await replaceOwnedPointDetails(OWNER.id, id, details, { database: db });
    expect(await stored(id)).toBe('kaida_shop');
    expect((await listOwnedPointDetails(OWNER.id, { database: db }))[0]!.contacts.telegram).toBe('kaida_shop');
    await replaceOwnedPointDetails(OWNER.id, id, { ...details, telegram: null }, { database: db });
    expect(await stored(id)).toBeNull();
  });

  it('rejects invite links and malformed input; nothing is stored', async () => {
    const id = await seller();
    await expect(replaceOwnedPointDetails(OWNER.id, id, { ...details, telegram: 'https://t.me/+AbCd123' }, { database: db }))
      .rejects.toBeInstanceOf(InvalidTelegramUsernameError);
    await expect(replaceOwnedPointDetails(OWNER.id, id, { ...details, telegram: 'https://example.com/x' }, { database: db }))
      .rejects.toBeInstanceOf(InvalidTelegramUsernameError);
    expect(await stored(id)).toBeNull();
  });

  it('the database refuses a username that is not normalized', async () => {
    const id = await seller();
    await expect(pool.query("UPDATE locations SET telegram_username='@Bad' WHERE id=$1", [id])).rejects.toMatchObject({ code: '23514' });
  });

  it('offers a username saved before: another point first, else a still-valid legacy seller value', async () => {
    const id = await seller();
    expect(await findTelegramSuggestion(OWNER.id, { database: db })).toBeNull();
    await pool.query("UPDATE sellers SET telegram_username='legacy_shop' WHERE owner_user_id=$1", [OWNER.id]);
    expect(await findTelegramSuggestion(OWNER.id, { database: db })).toBe('legacy_shop');
    await pool.query("UPDATE sellers SET telegram_username='ab' WHERE owner_user_id=$1", [OWNER.id]);
    expect(await findTelegramSuggestion(OWNER.id, { database: db })).toBeNull();
    await replaceOwnedPointDetails(OWNER.id, id, { ...details, telegram: '@point_shop' }, { database: db });
    expect(await findTelegramSuggestion(OWNER.id, { database: db })).toBe('point_shop');
    // Offering never writes anything.
    expect((await pool.query("SELECT telegram_username FROM sellers WHERE owner_user_id=$1", [OWNER.id])).rows[0].telegram_username).toBe('ab');
  });
});

describe('migration 0031', () => {
  it('adds an empty Telegram column and changes no existing row', async () => {
    await withMigrationTestDatabase({ name: 'kaida_point_telegram_upgrade_test' }, async (migrationPool) => {
      const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8')) as { entries: { idx: number; tag: string }[] };
      const apply = async (tag: string) => {
        for (const statement of (await readFile(`drizzle/migrations/${tag}.sql`, 'utf8')).split('--> statement-breakpoint')) {
          if (statement.trim()) await migrationPool.query(statement);
        }
      };
      for (const entry of journal.entries.filter((e) => e.idx < 31)) await apply(entry.tag);
      await migrationPool.query("INSERT INTO sellers(id,display_name,telegram_username) VALUES('a9310000-0000-4000-8000-000000000001','Old','old_shop')");
      await migrationPool.query("INSERT INTO locations(id,seller_id,name,address_text,type,phone_e164) VALUES('a9310000-0000-4000-8000-000000000002','a9310000-0000-4000-8000-000000000001','P','A','shop','+77010000001')");
      const before = (await migrationPool.query('SELECT to_jsonb(l) AS row FROM locations l')).rows;
      await apply('0031_point_telegram');
      const after = (await migrationPool.query('SELECT to_jsonb(l) - \'telegram_username\' AS row, l.telegram_username FROM locations l')).rows;
      expect(after.map((r) => r.row)).toEqual(before.map((r) => r.row));
      expect(after.map((r) => r.telegram_username)).toEqual([null]);
      expect((await migrationPool.query('SELECT telegram_username FROM sellers')).rows).toEqual([{ telegram_username: 'old_shop' }]);
    });
  });
});
