import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { actualityRemindersSent } from '../db/actuality-reminders-sent.table';
import { pushSubscriptions } from '../db/push-subscriptions.table';

type Db = Pick<Database, 'select' | 'insert' | 'delete' | 'execute'>;

export type DueOffer = { offerId: string; cardId: string; sellerId: string; ownerUserId: string; confirmedAt: Date };

// Switched-on, not operator-removed points whose age is in [moment, until) and that have not had this moment in
// this confirmation cycle. Only Sellers with an owner login can be reached.
export async function findDueOffers(database: Db, values: { now: Date; momentHours: number; untilHours: number }): Promise<DueOffer[]> {
  const result = await database.execute<{ offer_id: string; card_id: string; seller_id: string; owner_user_id: string; confirmed_at: string | Date }>(sql`
    select o.id as offer_id, o.card_id, o.seller_id, s.owner_user_id, o.last_confirmed_at as confirmed_at
    from offers o
    join sellers s on s.id = o.seller_id
    where o.status = 'active'
      and s.owner_user_id is not null
      and o.last_confirmed_at <= ${values.now}::timestamptz - make_interval(hours => ${values.momentHours})
      and o.last_confirmed_at > ${values.now}::timestamptz - make_interval(hours => ${values.untilHours})
      and not exists (
        select 1 from offer_card_removals r
        where r.card_id = o.card_id and r.restored_at is null and r.cleared_at is null
      )
      and not exists (
        select 1 from actuality_reminders_sent x
        where x.offer_id = o.id and x.moment_hours = ${values.momentHours} and x.confirmed_at = o.last_confirmed_at
      )
    order by o.seller_id, o.id`);
  return result.rows.map((row) => ({
    offerId: row.offer_id,
    cardId: row.card_id,
    sellerId: row.seller_id,
    ownerUserId: row.owner_user_id,
    confirmedAt: new Date(row.confirmed_at),
  }));
}

export async function recordSent(database: Db, momentHours: number, offers: DueOffer[]) {
  if (offers.length === 0) return;
  await database.insert(actualityRemindersSent).values(offers.map((offer) => ({
    sellerId: offer.sellerId,
    offerId: offer.offerId,
    momentHours,
    confirmedAt: offer.confirmedAt,
  }))).onConflictDoNothing();
}

export async function listSubscriptions(database: Db, userId: string) {
  return database.select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

// A device belongs to the login that enabled push last.
export async function saveSubscription(database: Db, userId: string, subscription: { endpoint: string; p256dh: string; auth: string }) {
  await database.insert(pushSubscriptions).values({ userId, ...subscription })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: subscription.p256dh, auth: subscription.auth } });
}

export async function deleteSubscription(database: Db, endpoint: string, userId?: string) {
  await database.delete(pushSubscriptions).where(userId
    ? and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId))
    : eq(pushSubscriptions.endpoint, endpoint));
}

// One run at a time across server instances: the lock lives as long as the caller's transaction.
export async function tryRunLock(database: Db): Promise<boolean> {
  const result = await database.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('actuality-reminders')) as locked`);
  return result.rows[0]?.locked === true;
}
