import { and, desc, eq, sql } from 'drizzle-orm';
import { getDatabase, type Database } from '../../../db/client';
import { buyerOfferFavourites as saved } from '../db/favourites.table';
import { offers } from '../../offers/db/offers.table';
import { lockCards } from '../../moderation/infrastructure/card-lock';
import { getBuyerOffer } from '../../search/application/get-buyer-offer';
import { calculateOfferCutoff, systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import { readOfferValidityPeriodHours } from '../../offers/config/offer-lifecycle.config';
import { findPhotoAccess } from '../../media/infrastructure/photos.repository';
import { findOfferPhotoIds } from '../../offers/infrastructure/offers.repository';
import { FavouriteUnavailable, type Favourite } from '../contracts/favourites.contract';
import type { Locale } from '../../../i18n/config';

type Dependencies = { database?: Database; clock?: Clock; locale?: Locale };
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
const lockOwner = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`favourites-owner:${userId}`},0))`);

async function lockTargets(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  const cards = await tx.select({ id: offers.cardId }).from(offers).where(sql`${offers.id} in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`,`)})`);
  await lockCards(tx, cards.map(c => c.id));
  await tx.execute(sql`select id from offers where id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`,`)}) order by id for share`);
  await tx.execute(sql`select id from locations where id in (select location_id from offers where id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`,`)})) order by id for share`);
}

export async function putFavourite(userId: string, offerId: string, pointId: string, deps: Dependencies = {}) {
  return (deps.database ?? getDatabase()).transaction(async tx => {
    await lockOwner(tx, userId);
    await lockTargets(tx, [offerId]);
    const offer = await getBuyerOffer(offerId, { database: tx as unknown as Database, clock: deps.clock, locale: deps.locale });
    if (!offer || offer.location.id !== pointId) throw new FavouriteUnavailable();
    await tx.insert(saved).values({ userId, offerId, locationId: pointId, savedAt: (deps.clock ?? systemClock)() }).onConflictDoNothing();
  });
}

export async function removeFavourite(userId: string, id: string, deps: Dependencies = {}) {
  await (deps.database ?? getDatabase()).transaction(async tx => {
    await lockOwner(tx, userId);
    await tx.delete(saved).where(and(eq(saved.userId, userId), eq(saved.id, id)));
  });
}

export async function listFavourites(userId: string, deps: Dependencies = {}): Promise<Favourite[]> {
  return (deps.database ?? getDatabase()).transaction(async tx => {
    await lockOwner(tx, userId);
    const refs = await tx.select().from(saved).where(eq(saved.userId, userId)).orderBy(desc(saved.savedAt), desc(saved.id));
    await lockTargets(tx, refs.map(r => r.offerId));
    const now = (deps.clock ?? systemClock)(), cutoff = calculateOfferCutoff(now, readOfferValidityPeriodHours());
    const db = tx as unknown as Database;
    const rows: Favourite[] = [];
    for (const ref of refs) {
      // Read after card/Offer/point locks; exclusion takes precedence and a changed point never retargets.
      const metadata = await tx.execute<{ title: string; status: string; last_confirmed_at: Date; seller_name: string; point_name: string }>(sql`
        select o.title,o.status,o.last_confirmed_at,s.display_name as seller_name,l.name as point_name
        from offers o join sellers s on s.id=o.seller_id join locations l on l.id=o.location_id and l.seller_id=o.seller_id
        where o.id=${ref.offerId} and o.location_id=${ref.locationId}
        and not exists(select 1 from offer_card_removals r where r.card_id=o.card_id and r.restored_at is null and r.cleared_at is null)`);
      const current = metadata.rows[0];
      if (!current) continue;
      const reference = { id: ref.id, offerId: ref.offerId, locationId: ref.locationId, savedAt: ref.savedAt.toISOString() };
      const offer = await getBuyerOffer(ref.offerId, { database: db, clock: () => now, locale: deps.locale });
      if (offer) { rows.push({ ...reference, state: 'available', offer }); continue; }
      if (current.status !== 'inactive' && !(current.status === 'active' && new Date(current.last_confirmed_at) <= cutoff)) continue;
      const row: Favourite = { ...reference, state: 'unavailable', title: current.title, sellerName: current.seller_name, pointName: current.point_name };
      if (current.status === 'active') {
        const cover = (await findOfferPhotoIds(db, ref.offerId))[0];
        if (cover && (await findPhotoAccess(db, cover))?.publicViaActiveOffer) row.coverPhotoId = cover;
      }
      rows.push(row);
    }
    return rows;
  });
}
