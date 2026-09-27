import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { findPhotosOwnedBy } from '../../media/infrastructure/photos.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { offerDrafts } from '../db/offer-drafts.table';
import type { OfferDraftPayload, OfferDraftView } from './offer-draft.contract';

// seller-showcase-editor §2 «Drafts»: private to the Seller, never visible to buyers, never creates Offers.

export class DraftSellerRequiredError extends Error {
  readonly code = 'SELLER_REQUIRED' as const;
  constructor() {
    super('Сначала создайте продавца и точку.');
    this.name = 'DraftSellerRequiredError';
  }
}

export class DraftNotFoundError extends Error {
  readonly code = 'DRAFT_NOT_FOUND' as const;
  constructor() {
    super('Черновик не найден.');
    this.name = 'DraftNotFoundError';
  }
}

type Row = typeof offerDrafts.$inferSelect;

function view(row: Row): OfferDraftView {
  return { id: row.id, payload: row.payload, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

async function sellerIdOf(database: Database, ownerUserId: string) {
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new DraftSellerRequiredError();
  return seller.id;
}

// A photo kept in a draft must be the owner's; ids of photos that are gone are dropped instead of failing.
async function ownedPhotoIds(database: Database, payload: OfferDraftPayload, ownerUserId: string) {
  if (payload.photoIds.length === 0) return payload;
  const owned = new Set((await findPhotosOwnedBy(database, payload.photoIds, ownerUserId)).map((photo) => photo.id));
  return { ...payload, photoIds: payload.photoIds.filter((id) => owned.has(id)) };
}

export async function listOfferDrafts(ownerUserId: string, dependencies: { database?: Database } = {}) {
  const database = dependencies.database ?? getDatabase();
  const sellerId = await sellerIdOf(database, ownerUserId);
  const rows = await database.select().from(offerDrafts).where(eq(offerDrafts.sellerId, sellerId))
    .orderBy(desc(offerDrafts.updatedAt), desc(offerDrafts.id));
  return rows.map(view);
}

export async function saveOfferDraft(
  ownerUserId: string,
  draftId: string | null,
  payload: OfferDraftPayload,
  dependencies: { database?: Database; now?: Date } = {},
) {
  const database = dependencies.database ?? getDatabase();
  const sellerId = await sellerIdOf(database, ownerUserId);
  const clean = await ownedPhotoIds(database, payload, ownerUserId);
  const now = dependencies.now ?? new Date();
  if (draftId === null) {
    const rows = await database.insert(offerDrafts).values({ sellerId, payload: clean, createdAt: now, updatedAt: now }).returning();
    return view(rows[0]!);
  }
  const rows = await database.update(offerDrafts).set({ payload: clean, updatedAt: now })
    .where(and(eq(offerDrafts.id, draftId), eq(offerDrafts.sellerId, sellerId))).returning();
  if (!rows[0]) throw new DraftNotFoundError();
  return view(rows[0]);
}

export async function deleteOfferDraft(ownerUserId: string, draftId: string, dependencies: { database?: Database } = {}) {
  const database = dependencies.database ?? getDatabase();
  const sellerId = await sellerIdOf(database, ownerUserId);
  const rows = await database.delete(offerDrafts)
    .where(and(eq(offerDrafts.id, draftId), eq(offerDrafts.sellerId, sellerId))).returning({ id: offerDrafts.id });
  if (!rows[0]) throw new DraftNotFoundError();
}

export async function findOwnedDraft(database: Pick<Database, 'select'>, draftId: string, sellerId: string) {
  const rows = await database.select({ id: offerDrafts.id }).from(offerDrafts)
    .where(and(eq(offerDrafts.id, draftId), eq(offerDrafts.sellerId, sellerId))).limit(1);
  return rows[0] ?? null;
}

export async function removeDraftById(database: Pick<Database, 'delete'>, draftId: string, sellerId: string) {
  await database.delete(offerDrafts).where(and(eq(offerDrafts.id, draftId), eq(offerDrafts.sellerId, sellerId)));
}
