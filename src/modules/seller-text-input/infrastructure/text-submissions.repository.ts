import { and, eq, inArray, lt } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { offerDrafts } from '../../offers/db/offer-drafts.table';
import {
  type SellerTextSubmissionResult,
  type SellerTextSubmissionStatus,
  sellerTextSubmissions,
} from '../db/seller-text-submissions.table';

type Db = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;
export type SubmissionRow = typeof sellerTextSubmissions.$inferSelect;
export type SubmissionKey = { sellerId: string; requestId: string };

const byKey = (key: SubmissionKey) => and(
  eq(sellerTextSubmissions.sellerId, key.sellerId),
  eq(sellerTextSubmissions.requestId, key.requestId),
);

export async function purgeExpiredSubmissions(db: Db, now: Date): Promise<void> {
  await db.delete(sellerTextSubmissions).where(lt(sellerTextSubmissions.expiresAt, now));
}

// Rule 6: the database decides the single winner of a race for a new key.
export async function insertProcessingSubmission(db: Db, row: SubmissionKey & {
  textDigest: string; parser: 'fake' | 'real'; attemptId: string; now: Date; expiresAt: Date;
}): Promise<boolean> {
  const inserted = await db.insert(sellerTextSubmissions).values({
    sellerId: row.sellerId,
    requestId: row.requestId,
    textDigest: row.textDigest,
    parser: row.parser,
    status: 'processing',
    attemptId: row.attemptId,
    attemptStartedAt: row.now,
    createdAt: row.now,
    expiresAt: row.expiresAt,
  }).onConflictDoNothing().returning({ requestId: sellerTextSubmissions.requestId });
  return inserted.length === 1;
}

export async function findSubmission(db: Db, key: SubmissionKey, lock = false): Promise<SubmissionRow | null> {
  const query = db.select().from(sellerTextSubmissions).where(byKey(key)).limit(1);
  const rows = lock ? await query.for('update') : await query;
  return rows[0] ?? null;
}

// Rule 5: take over a failed or stale attempt — only if nobody else changed the row since it was read.
export async function takeOverSubmission(db: Db, key: SubmissionKey, seen: { attemptId: string; status: SellerTextSubmissionStatus },
  attemptId: string, now: Date): Promise<boolean> {
  const rows = await db.update(sellerTextSubmissions)
    .set({ status: 'processing', attemptId, attemptStartedAt: now, failureCode: null })
    .where(and(byKey(key), eq(sellerTextSubmissions.attemptId, seen.attemptId), eq(sellerTextSubmissions.status, seen.status)))
    .returning({ requestId: sellerTextSubmissions.requestId });
  return rows.length === 1;
}

// Rule 8: only the attempt that still owns the row records the failure.
export async function markSubmissionFailed(db: Db, key: SubmissionKey, attemptId: string, failureCode: string): Promise<void> {
  await db.update(sellerTextSubmissions)
    .set({ status: 'failed', failureCode })
    .where(and(byKey(key), eq(sellerTextSubmissions.attemptId, attemptId), eq(sellerTextSubmissions.status, 'processing')));
}

export async function markSubmissionSucceeded(db: Db, key: SubmissionKey, result: SellerTextSubmissionResult, now: Date): Promise<void> {
  await db.update(sellerTextSubmissions)
    .set({ status: 'succeeded', result, completedAt: now, failureCode: null })
    .where(byKey(key));
}

export async function findSellerDraftsByIds(db: Db, sellerId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(offerDrafts).where(and(eq(offerDrafts.sellerId, sellerId), inArray(offerDrafts.id, ids)));
}
