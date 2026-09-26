import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { users } from '../../identity/db/users.table';
import { sellers } from '../../sellers/db/sellers.table';
import { sellerVerifiedPhones } from '../../sellers/db/seller-verified-phones.table';
import { locations } from '../db/locations.table';
import type { OpeningHours } from '../hours/opening-hours';
import type { PointDetailsView } from './point-details.contract';

export type PointDetailsDb = Pick<Database, 'select' | 'update' | 'insert'>;

const detailsSelection = {
  locationId: locations.id,
  phoneE164: locations.phoneE164,
  whatsappPhoneE164: locations.whatsappPhoneE164,
  openingHours: locations.openingHours,
  openingHoursNeedsReview: locations.openingHoursNeedsReview,
};

// Numbers the Seller has proved: every code-verified number plus the owner's login phone.
export async function findVerifiedPhones(database: PointDetailsDb, sellerId: string): Promise<Set<string>> {
  const proved = await database.select({ phone: sellerVerifiedPhones.phoneE164 }).from(sellerVerifiedPhones)
    .where(eq(sellerVerifiedPhones.sellerId, sellerId));
  const login = await database.select({ phone: users.phoneE164 }).from(sellers)
    .innerJoin(users, eq(users.id, sellers.ownerUserId))
    .where(eq(sellers.id, sellerId)).limit(1);
  return new Set([...proved.map((row) => row.phone), ...login.map((row) => row.phone)]);
}

function toView(row: {
  locationId: string;
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  openingHours: OpeningHours;
  openingHoursNeedsReview: boolean;
}, verified: Set<string>): PointDetailsView {
  const contact = (e164: string | null) => (e164 ? { e164, verified: verified.has(e164) } : null);
  return {
    locationId: row.locationId,
    contacts: { phone: contact(row.phoneE164), whatsapp: contact(row.whatsappPhoneE164) },
    openingHours: row.openingHours,
    openingHoursNeedsReview: row.openingHoursNeedsReview,
  };
}

export async function listPointDetails(database: PointDetailsDb, sellerId: string): Promise<PointDetailsView[]> {
  const rows = await database.select(detailsSelection).from(locations)
    .where(eq(locations.sellerId, sellerId))
    .orderBy(locations.createdAt, locations.id);
  const verified = await findVerifiedPhones(database, sellerId);
  return rows.map((row) => toView(row, verified));
}

export async function updatePointDetails(database: PointDetailsDb, sellerId: string, locationId: string, values: {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  openingHours: OpeningHours;
}): Promise<PointDetailsView | null> {
  const [row] = await database.update(locations).set({ ...values, openingHoursNeedsReview: false })
    .where(and(eq(locations.id, locationId), eq(locations.sellerId, sellerId)))
    .returning(detailsSelection);
  return row ? toView(row, await findVerifiedPhones(database, sellerId)) : null;
}

// The Seller's most recently created point: the source a new point copies contacts and hours from.
export async function findLatestPointDetails(database: PointDetailsDb, sellerId: string) {
  const [row] = await database.select({ ...detailsSelection, name: locations.name }).from(locations)
    .where(eq(locations.sellerId, sellerId))
    .orderBy(desc(locations.createdAt), desc(locations.id))
    .limit(1);
  return row ?? null;
}

export async function isNumberOnSellerPoint(database: PointDetailsDb, sellerId: string, phoneE164: string): Promise<boolean> {
  const [row] = await database.select({ id: locations.id }).from(locations).where(and(
    eq(locations.sellerId, sellerId),
    sql`(${locations.phoneE164} = ${phoneE164} OR ${locations.whatsappPhoneE164} = ${phoneE164})`,
  )).limit(1);
  return Boolean(row);
}

export async function recordVerifiedPhone(database: PointDetailsDb, sellerId: string, phoneE164: string, at: Date) {
  await database.insert(sellerVerifiedPhones).values({ sellerId, phoneE164, verifiedAt: at }).onConflictDoNothing();
}

// For buyer projections: verified numbers of many sellers at once.
export async function findVerifiedPhonesBySellers(database: PointDetailsDb, sellerIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (sellerIds.length === 0) return result;
  const add = (sellerId: string, phone: string) => result.set(sellerId, (result.get(sellerId) ?? new Set()).add(phone));
  for (const row of await database.select({ sellerId: sellerVerifiedPhones.sellerId, phone: sellerVerifiedPhones.phoneE164 })
    .from(sellerVerifiedPhones).where(inArray(sellerVerifiedPhones.sellerId, sellerIds))) add(row.sellerId, row.phone);
  for (const row of await database.select({ sellerId: sellers.id, phone: users.phoneE164 }).from(sellers)
    .innerJoin(users, eq(users.id, sellers.ownerUserId)).where(inArray(sellers.id, sellerIds))) add(row.sellerId, row.phone);
  return result;
}
