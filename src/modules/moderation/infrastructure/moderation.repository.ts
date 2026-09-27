import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { offerCardRemovals } from '../db/offer-card-removals.table';
import { operatorFeedMarks } from '../db/operator-feed-marks.table';
import type { RemovalReason } from '../contracts/moderation.contract';

type Db = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

const activeRemoval = and(isNull(offerCardRemovals.restoredAt), isNull(offerCardRemovals.clearedAt));

const removalSelection = {
  id: offerCardRemovals.id,
  cardId: offerCardRemovals.cardId,
  reason: offerCardRemovals.reason,
  comment: offerCardRemovals.comment,
  removedAt: offerCardRemovals.removedAt,
};

export type ActiveRemoval = { id: string; cardId: string; reason: RemovalReason; comment: string | null; removedAt: Date };

export async function findActiveRemovals(database: Db, cardIds: string[]): Promise<Map<string, ActiveRemoval>> {
  const result = new Map<string, ActiveRemoval>();
  if (cardIds.length === 0) return result;
  const rows = await database.select(removalSelection).from(offerCardRemovals)
    .where(and(inArray(offerCardRemovals.cardId, [...new Set(cardIds)]), activeRemoval));
  for (const row of rows) result.set(row.cardId, row);
  return result;
}

export async function findActiveRemovalsBySeller(database: Db, sellerId: string): Promise<Map<string, ActiveRemoval>> {
  const rows = await database.select(removalSelection).from(offerCardRemovals)
    .where(and(eq(offerCardRemovals.sellerId, sellerId), activeRemoval));
  return new Map(rows.map((row) => [row.cardId, row]));
}

// Locks the active removals of these cards inside the caller's transaction (ChangeSet confirmation).
export async function lockActiveRemovals(database: Db, cardIds: string[]): Promise<ActiveRemoval[]> {
  if (cardIds.length === 0) return [];
  return database.select(removalSelection).from(offerCardRemovals)
    .where(and(inArray(offerCardRemovals.cardId, [...new Set(cardIds)].sort()), activeRemoval))
    .for('update');
}

export async function clearRemovals(database: Db, removalIds: string[], changeSetId: string, at: Date) {
  if (removalIds.length === 0) return;
  await database.update(offerCardRemovals)
    .set({ clearedAt: at, clearedByChangeSetId: changeSetId })
    .where(and(inArray(offerCardRemovals.id, removalIds), activeRemoval));
}

// One row per card; the active-card unique index turns a concurrent second removal into a no-op.
export async function insertRemoval(database: Db, values: {
  cardId: string; sellerId: string; reason: RemovalReason; comment: string | null; operatorUserId: string;
}): Promise<boolean> {
  const rows = await database.insert(offerCardRemovals).values({
    cardId: values.cardId,
    sellerId: values.sellerId,
    reason: values.reason,
    comment: values.comment,
    removedByUserId: values.operatorUserId,
  }).onConflictDoNothing().returning({ id: offerCardRemovals.id });
  return rows.length === 1;
}

export async function restoreRemoval(database: Db, cardId: string, operatorUserId: string): Promise<boolean> {
  const rows = await database.update(offerCardRemovals)
    .set({ restoredAt: sql`now()`, restoredByUserId: operatorUserId })
    .where(and(eq(offerCardRemovals.cardId, cardId), activeRemoval))
    .returning({ id: offerCardRemovals.id });
  return rows.length === 1;
}

export async function findSellerOfCard(database: Db, cardId: string): Promise<string | null> {
  const result = await database.execute<{ seller_id: string }>(sql`select seller_id from offers where card_id = ${cardId} limit 1`);
  return result.rows[0]?.seller_id ?? null;
}

// ---------- feed ----------

// A feed event = one confirmed ChangeSet's create/update Items of one card. «new» = the first such event of the card;
// «republished» = the ChangeSet that cleared a removal.
const feedEvents = sql`
  select cs.id as change_set_id, i.card_id, cs.confirmed_at
  from seller_change_sets cs
  join seller_change_items i on i.change_set_id = cs.id
  where cs.status = 'confirmed' and i.action in ('create_offer', 'update_offer')
  group by cs.id, i.card_id, cs.confirmed_at`;

export type FeedEventRow = { change_set_id: string; card_id: string; confirmed_at: Date; is_first: boolean; republished: boolean };

export async function listFeedEvents(database: Db, values: { since: Date | null; limit: number; offset: number }): Promise<FeedEventRow[]> {
  const result = await database.execute<FeedEventRow>(sql`
    with ev as (${feedEvents})
    select ev.change_set_id, ev.card_id, ev.confirmed_at,
      not exists (
        select 1 from seller_change_sets cs2 join seller_change_items i2 on i2.change_set_id = cs2.id
        where cs2.status = 'confirmed' and i2.card_id = ev.card_id and i2.action in ('create_offer', 'update_offer')
          and (cs2.confirmed_at, cs2.id) < (ev.confirmed_at, ev.change_set_id)
      ) as is_first,
      exists (
        select 1 from offer_card_removals r where r.cleared_by_change_set_id = ev.change_set_id and r.card_id = ev.card_id
      ) as republished
    from ev
    where ${values.since === null ? sql`true` : sql`ev.confirmed_at > ${values.since}`}
    order by ev.confirmed_at desc, ev.change_set_id desc, ev.card_id
    limit ${values.limit} offset ${values.offset}`);
  return result.rows.map((row) => ({ ...row, confirmed_at: new Date(row.confirmed_at) }));
}

export async function countFeedEvents(database: Db, since: Date | null): Promise<number> {
  const result = await database.execute<{ count: string }>(sql`
    with ev as (${feedEvents})
    select count(*)::text as count from ev
    where ${since === null ? sql`true` : sql`ev.confirmed_at > ${since}`}`);
  return Number(result.rows[0]?.count ?? 0);
}

export async function findFeedMark(database: Db, userId: string): Promise<Date | null> {
  const rows = await database.select({ seenUntil: operatorFeedMarks.seenUntil }).from(operatorFeedMarks)
    .where(eq(operatorFeedMarks.userId, userId)).limit(1);
  return rows[0]?.seenUntil ?? null;
}

// The mark only moves forward and never past now.
export async function moveFeedMark(database: Db, userId: string, until: Date): Promise<void> {
  await database.insert(operatorFeedMarks)
    .values({ userId, seenUntil: sql`least(${until}::timestamptz, now())` })
    .onConflictDoUpdate({
      target: operatorFeedMarks.userId,
      set: { seenUntil: sql`greatest(${operatorFeedMarks.seenUntil}, least(${until}::timestamptz, now()))`, updatedAt: sql`now()` },
    });
}

// ---------- cards as the operator sees them ----------

export type OperatorOfferRow = {
  id: string; card_id: string; title: string; pack_amount: string | null; pack_unit: string | null;
  price_amount: string | null; price_unit_code: string | null; price_unit_value: string | null;
  seller_comment: string | null; status: 'active' | 'inactive'; location_name: string; location_address: string;
  seller_phone: string | null;
};

export async function listCardOffers(database: Db, cardIds: string[]): Promise<OperatorOfferRow[]> {
  if (cardIds.length === 0) return [];
  const result = await database.execute<OperatorOfferRow>(sql`
    select o.id, o.card_id, o.title, o.pack_amount::text, o.pack_unit, o.price_amount::text, o.price_unit_code,
      o.price_unit_value, o.seller_comment, o.status, l.name as location_name, l.address_text as location_address,
      coalesce(u.phone_e164, s.contact_phone_e164) as seller_phone
    from offers o
    join locations l on l.id = o.location_id
    join sellers s on s.id = o.seller_id
    left join users u on u.id = s.owner_user_id
    where o.card_id in (${sql.join([...new Set(cardIds)].map((id) => sql`${id}`), sql`, `)})
    order by l.name, o.id`);
  return result.rows;
}

export async function listCardPhotoIds(database: Db, offerIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (offerIds.length === 0) return map;
  const result = await database.execute<{ offer_id: string; photo_id: string }>(sql`
    select offer_id, photo_id from offer_photos
    where offer_id in (${sql.join(offerIds.map((id) => sql`${id}`), sql`, `)})
    order by offer_id, position`);
  for (const row of result.rows) map.set(row.offer_id, [...(map.get(row.offer_id) ?? []), row.photo_id]);
  return map;
}

