import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import type { OtpDelivery, TestOtpDeliveryReceipt } from '../../src/modules/identity/delivery/otp-delivery';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import {
  confirmPointContactCode,
  listOwnedPointDetails,
  replaceOwnedPointDetails,
  requestPointContactCode,
} from '../../src/modules/locations/details/point-details.application';
import { InvalidPointPhoneError, PointContactNotOnPointError } from '../../src/modules/locations/details/point-details.contract';
import { templateOpeningHours, type OpeningHours } from '../../src/modules/locations/hours/opening-hours';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';
import { withMigrationTestDatabase } from './migration-test-database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-26T06:00:00.000Z');
const OWNER = { id: '72000000-0000-4000-8000-000000000001', phone: '+77010007201' };
const OTHER = { id: '72000000-0000-4000-8000-000000000002', phone: '+77010007202' };
const POINT_PHONE = '+77010007299';

const codes: string[] = [];
const capture: OtpDelivery<TestOtpDeliveryReceipt> = { async deliver({ code }) { codes.push(code); return { mode: 'test', code }; } };

const lunchBreak: OpeningHours = {
  ...templateOpeningHours(),
  days: { ...templateOpeningHours().days, mon: { kind: 'intervals', intervals: [{ open: '09:00', close: '13:00' }, { open: '14:00', close: '18:00' }] }, sun: { kind: '24h' } },
};

async function cleanup(user: { id: string; phone: string }) {
  const sellers = `SELECT id FROM sellers WHERE owner_user_id='${user.id}'`;
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`);
  await pool.query(`DELETE FROM sellers WHERE owner_user_id=$1`, [user.id]);
  await pool.query('DELETE FROM contact_verification_challenges WHERE owner_user_id=$1', [user.id]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [user.id, user.phone]);
}

async function createSeller(user: { id: string; phone: string }, label: string) {
  await cleanup(user);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [user.id, user.phone, T0]);
  return setupSeller(user.id, {
    seller: { displayName: `Hours ${label}` },
    location: { name: `Hours point ${label}`, type: 'shop', addressText: `Almaty hours ${label}` },
  }, { database: db });
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => {
  await cleanup(OWNER);
  await cleanup(OTHER);
  await pool.end();
});

describe('point contacts and verification', () => {
  it('a new number is unverified until the code; the login phone needs no code; a changed number drops verification', async () => {
    const seller = await createSeller(OWNER, 'verify');
    const pointId = seller.locations[0]!.id;

    // The first point starts with no contacts and the template hours marked for review.
    expect(await listOwnedPointDetails(OWNER.id, { database: db })).toEqual([{
      locationId: pointId, contacts: { phone: null, whatsapp: null }, openingHours: templateOpeningHours(), openingHoursNeedsReview: true,
    }]);

    const saved = await replaceOwnedPointDetails(OWNER.id, pointId, { phone: '8 701 000 72 99', whatsapp: '+7 701 000 72 01', openingHours: lunchBreak }, { database: db });
    expect(saved).toEqual({
      locationId: pointId,
      contacts: { phone: { e164: POINT_PHONE, verified: false }, whatsapp: { e164: OWNER.phone, verified: true } },
      openingHours: lunchBreak,
      openingHoursNeedsReview: false,
    });

    await expect(requestPointContactCode(OWNER.id, '+77010009999', { database: db, delivery: capture }))
      .rejects.toBeInstanceOf(PointContactNotOnPointError);
    const request = await requestPointContactCode(OWNER.id, POINT_PHONE, { database: db, delivery: capture });
    await expect(confirmPointContactCode(OWNER.id, { challengeId: request.challenge.id, code: codes.at(-1) === '000000' ? '111111' : '000000' }, { database: db }))
      .rejects.toMatchObject({ code: 'INVALID_OTP' });
    const confirmed = await confirmPointContactCode(OWNER.id, { challengeId: request.challenge.id, code: codes.at(-1)! }, { database: db });
    expect(confirmed.points[0]!.contacts.phone).toEqual({ e164: POINT_PHONE, verified: true });
    await expect(confirmPointContactCode(OWNER.id, { challengeId: request.challenge.id, code: codes.at(-1)! }, { database: db }))
      .rejects.toMatchObject({ code: 'OTP_NOT_ACTIVE' });

    const changed = await replaceOwnedPointDetails(OWNER.id, pointId, { phone: '+77010007288', whatsapp: null, openingHours: lunchBreak }, { database: db });
    expect(changed.contacts.phone).toEqual({ e164: '+77010007288', verified: false });
    // Switching back to a number already proved needs no new code.
    const back = await replaceOwnedPointDetails(OWNER.id, pointId, { phone: POINT_PHONE, whatsapp: null, openingHours: lunchBreak }, { database: db });
    expect(back.contacts.phone).toEqual({ e164: POINT_PHONE, verified: true });
  });

  it('a code of another user is not accepted and nobody can change a foreign point', async () => {
    const seller = await createSeller(OWNER, 'foreign');
    await createSeller(OTHER, 'foreign-other');
    const pointId = seller.locations[0]!.id;
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: POINT_PHONE, whatsapp: null, openingHours: lunchBreak }, { database: db });
    const request = await requestPointContactCode(OWNER.id, POINT_PHONE, { database: db, delivery: capture });
    await expect(confirmPointContactCode(OTHER.id, { challengeId: request.challenge.id, code: codes.at(-1)! }, { database: db }))
      .rejects.toMatchObject({ code: 'INVALID_OTP_CHALLENGE' });
    await expect(replaceOwnedPointDetails(OTHER.id, pointId, { phone: null, whatsapp: null, openingHours: lunchBreak }, { database: db }))
      .rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
    await expect(replaceOwnedPointDetails(OWNER.id, pointId, { phone: '12345', whatsapp: null, openingHours: lunchBreak }, { database: db }))
      .rejects.toBeInstanceOf(InvalidPointPhoneError);
  });

  it('a new point copies contacts and hours of the latest point; editing it leaves the source unchanged', async () => {
    const seller = await createSeller(OWNER, 'copy');
    const first = seller.locations[0]!.id;
    await replaceOwnedPointDetails(OWNER.id, first, { phone: OWNER.phone, whatsapp: null, openingHours: lunchBreak }, { database: db });
    const second = await createOwnedLocation(OWNER.id, { name: 'Second', type: 'market', addressText: 'Almaty second' }, { database: db });
    const points = await listOwnedPointDetails(OWNER.id, { database: db });
    expect(points.find((point) => point.locationId === second.id)).toEqual({
      locationId: second.id,
      contacts: { phone: { e164: OWNER.phone, verified: true }, whatsapp: null },
      openingHours: lunchBreak,
      openingHoursNeedsReview: false,
    });
    await replaceOwnedPointDetails(OWNER.id, second.id, { phone: null, whatsapp: null, openingHours: templateOpeningHours() }, { database: db });
    expect((await listOwnedPointDetails(OWNER.id, { database: db })).find((point) => point.locationId === first)?.openingHours).toEqual(lunchBreak);
  });

  it('buyers see hours always and only the verified number of the point', async () => {
    const seller = await createSeller(OWNER, 'buyer');
    const pointId = seller.locations[0]!.id;
    await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [pointId]);
    await replaceOwnedPointDetails(OWNER.id, pointId, { phone: POINT_PHONE, whatsapp: OWNER.phone, openingHours: lunchBreak }, { database: db });
    const product = (await pool.query("SELECT id FROM products WHERE name='Баранина'")).rows[0].id;
    await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at)
      VALUES ($1,$2,$3,'100','KZT','active',now())`, [product, seller.id, pointId]);

    const offer = (await searchOffers('Баранина', db)).offers.find((item) => item.location.id === pointId)!;
    expect(offer.location.contacts).toEqual({ whatsappPhoneE164: OWNER.phone });
    expect(offer.location.openingHours).toEqual(lunchBreak);
    expect(JSON.stringify(offer)).not.toContain(POINT_PHONE);
  });
});

async function migrateTo0014(database: ReturnType<typeof drizzle>) {
  const folder = await mkdtemp(join(tmpdir(), 'kaida-point-contacts-'));
  await mkdir(join(folder, 'meta'));
  try {
    const files = (await readdir(join(process.cwd(), 'drizzle/migrations'))).filter((file) => file.endsWith('.sql') && file < '0015').sort();
    expect(files.at(-1)).toBe('0014_offer_photos.sql');
    for (const file of files) await copyFile(join(process.cwd(), 'drizzle/migrations', file), join(folder, file));
    const journal = JSON.parse(await readFile(join(process.cwd(), 'drizzle/migrations/meta/_journal.json'), 'utf8')) as { entries: unknown[] };
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 15) }));
    await migrate(database, { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe('point contacts migration', () => {
  it('copies seller phone and WhatsApp to every point; only the login phone counts as verified; hours get the template to review', async () => {
    await withMigrationTestDatabase({ name: 'kaida_point_contacts_upgrade_test' }, async (migrationPool, database) => {
      await migrateTo0014(database);
      await migrationPool.query("INSERT INTO users (id,phone_e164,created_at) VALUES ('72000000-0000-4000-8000-000000000091','+77010007291',now())");
      await migrationPool.query(`INSERT INTO sellers (id,display_name,owner_user_id,contact_phone_e164,whatsapp_phone_e164,telegram_username)
        VALUES ('72000000-0000-4000-8000-000000000092','Legacy','72000000-0000-4000-8000-000000000091','+77010007291','+77010007293','legacy_tg')`);
      await migrationPool.query(`INSERT INTO locations (id,seller_id,name,address_text,type) VALUES
        ('72000000-0000-4000-8000-000000000093','72000000-0000-4000-8000-000000000092','A','Almaty A','shop'),
        ('72000000-0000-4000-8000-000000000094','72000000-0000-4000-8000-000000000092','B','Almaty B','shop')`);

      await migrate(database, { migrationsFolder: './drizzle/migrations' });

      const points = await migrationPool.query('SELECT phone_e164, whatsapp_phone_e164, opening_hours, opening_hours_needs_review FROM locations ORDER BY id');
      expect(points.rows).toEqual([0, 1].map(() => ({
        phone_e164: '+77010007291',
        whatsapp_phone_e164: '+77010007293',
        opening_hours: templateOpeningHours(),
        opening_hours_needs_review: true,
      })));
      expect((await migrationPool.query('SELECT count(*)::int AS n FROM seller_verified_phones')).rows[0].n).toBe(0);
      // Telegram stays stored, untouched, and is no longer read.
      expect((await migrationPool.query('SELECT telegram_username FROM sellers')).rows[0].telegram_username).toBe('legacy_tg');
    });
  });
});
