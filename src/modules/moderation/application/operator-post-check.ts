import { getDatabase, type Database } from '../../../db/client';
import { formatPack, packFromColumns } from '../../offers/pack/pack';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import {
  maskPhone,
  OperatorCardNotFoundError,
  type OperatorCardView,
  type OperatorFeedPage,
  type OperatorFeedRow,
  type OperatorRemovalView,
  type RemovalReason,
} from '../contracts/moderation.contract';
import {
  countFeedEvents,
  findActiveRemovals,
  findFeedMark,
  findSellerOfCard,
  insertRemoval,
  listCardOffers,
  listCardPhotoIds,
  listFeedEvents,
  moveFeedMark,
  restoreRemoval,
  type ActiveRemoval,
  type OperatorOfferRow,
} from '../infrastructure/moderation.repository';

// operator-post-check: the post-check feed, the operator card screen, removal and return. Callers have already checked
// that the user is an operator.

export const FEED_PAGE_SIZE = 30;

function removalView(removal: ActiveRemoval | undefined): OperatorRemovalView | null {
  return removal ? { reason: removal.reason, comment: removal.comment, removedAt: removal.removedAt.toISOString() } : null;
}

function offerPrice(row: OperatorOfferRow) {
  if (row.price_amount === null) return null;
  return { amount: row.price_amount, unit: formatPriceUnit(priceUnitFromColumns(row.price_unit_code, row.price_unit_value)) ?? '' };
}

function packLabel(row: OperatorOfferRow) {
  return formatPack(packFromColumns(row.pack_amount, row.pack_unit));
}

function groupByCard(rows: OperatorOfferRow[]) {
  const map = new Map<string, OperatorOfferRow[]>();
  for (const row of rows) map.set(row.card_id, [...(map.get(row.card_id) ?? []), row]);
  return map;
}

export async function loadOperatorFeed(
  operatorUserId: string,
  query: { tab: 'new' | 'all'; offset: number },
  dependencies: { database?: Database } = {},
): Promise<OperatorFeedPage> {
  const database = dependencies.database ?? getDatabase();
  const seenUntil = await findFeedMark(database, operatorUserId);
  const events = await listFeedEvents(database, {
    since: query.tab === 'new' ? seenUntil : null,
    limit: FEED_PAGE_SIZE + 1,
    offset: query.offset,
  });
  const page = events.slice(0, FEED_PAGE_SIZE);
  const cardIds = page.map((event) => event.card_id);
  const offers = groupByCard(await listCardOffers(database, cardIds));
  const leads = [...offers.values()].map((group) => group[0]!);
  const photos = await listCardPhotoIds(database, leads.map((lead) => lead.id));
  const removals = await findActiveRemovals(database, cardIds);

  const rows: OperatorFeedRow[] = page.flatMap((event) => {
    const group = offers.get(event.card_id);
    if (!group) return [];
    const lead = group[0]!;
    return [{
      eventId: `${event.change_set_id}:${event.card_id}`,
      cardId: event.card_id,
      kind: event.republished ? 'republished' : event.is_first ? 'new' : 'changed',
      at: event.confirmed_at.toISOString(),
      title: lead.title,
      packLabel: packLabel(lead),
      price: offerPrice(lead),
      pointName: lead.location_name,
      morePoints: group.length - 1,
      sellerPhone: maskPhone(lead.seller_phone),
      coverPhotoId: photos.get(lead.id)?.[0] ?? null,
      removal: removalView(removals.get(event.card_id)),
    }];
  });

  return {
    rows,
    hasMore: events.length > FEED_PAGE_SIZE,
    newCount: await countFeedEvents(database, seenUntil),
    seenUntil: seenUntil?.toISOString() ?? null,
  };
}

export async function markOperatorFeedSeen(operatorUserId: string, until: Date, dependencies: { database?: Database } = {}) {
  await moveFeedMark(dependencies.database ?? getDatabase(), operatorUserId, until);
}

export async function loadOperatorCard(cardId: string, dependencies: { database?: Database } = {}): Promise<OperatorCardView> {
  const database = dependencies.database ?? getDatabase();
  const group = await listCardOffers(database, [cardId]);
  const lead = group[0];
  if (!lead) throw new OperatorCardNotFoundError();
  const photos = await listCardPhotoIds(database, [lead.id]);
  const removals = await findActiveRemovals(database, [cardId]);
  return {
    cardId,
    title: lead.title,
    packLabel: packLabel(lead),
    sellerComment: lead.seller_comment,
    photoIds: photos.get(lead.id) ?? [],
    sellerPhone: maskPhone(lead.seller_phone),
    points: group.map((row) => ({
      offerId: row.id,
      name: row.location_name,
      addressText: row.location_address,
      price: offerPrice(row),
      active: row.status === 'active',
    })),
    removal: removalView(removals.get(cardId)),
  };
}

// A second tap (or a second operator) finds the card already removed and changes nothing.
export async function removeCard(
  operatorUserId: string,
  cardId: string,
  input: { reason: RemovalReason; comment: string | null },
  dependencies: { database?: Database } = {},
): Promise<OperatorCardView> {
  const database = dependencies.database ?? getDatabase();
  const sellerId = await findSellerOfCard(database, cardId);
  if (!sellerId) throw new OperatorCardNotFoundError();
  await insertRemoval(database, { cardId, sellerId, reason: input.reason, comment: input.comment, operatorUserId });
  return loadOperatorCard(cardId, { database });
}

export async function restoreCard(operatorUserId: string, cardId: string, dependencies: { database?: Database } = {}): Promise<OperatorCardView> {
  const database = dependencies.database ?? getDatabase();
  if (!await findSellerOfCard(database, cardId)) throw new OperatorCardNotFoundError();
  await restoreRemoval(database, cardId, operatorUserId);
  return loadOperatorCard(cardId, { database });
}
