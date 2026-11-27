import { createHash, createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDatabase, type Database } from '../../../db/client';
import { lockCards } from '../infrastructure/card-lock';
import { cardOfOffer, contextOf } from './offer-reports';
import {
  VISIT_OUTCOME_MATCHED_QUOTA_24H,
  VISIT_OUTCOME_PROBLEM_QUOTA_24H,
  VisitOutcomeError,
  type SubmitVisitOutcome,
  type VisitOutcomeKind,
  type VisitOutcomeResult,
} from '../contracts/visit-outcome.contract';

type Dependencies = { database?: Database; clock?: () => Date };
export type VisitOutcomeActor = { kind: 'user'; userId: string } | { kind: 'guest'; anonymousKeyHash: string };

const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function visitorKeyHashForUser(userId: string): string {
  return createHash('sha256').update(`user:${userId}`).digest('hex');
}

export function visitorKeyHashForGuest(rawToken: string, secret: string): string {
  return createHmac('sha256', secret).update(`guest:${rawToken}`).digest('hex');
}

// Convert first 16 hex chars of SHA-256 into two signed 32-bit ints for pg_advisory_xact_lock.
function advisoryPair(hashHex: string): [number, number] {
  const hi = (parseInt(hashHex.slice(0, 8), 16) << 0);
  const lo = (parseInt(hashHex.slice(8, 16), 16) << 0);
  return [hi, lo];
}

export async function submitVisitOutcome(
  actor: VisitOutcomeActor,
  offerId: string,
  input: SubmitVisitOutcome,
  deps: Dependencies = {},
): Promise<VisitOutcomeResult> {
  const db = deps.database ?? getDatabase();
  const now = (deps.clock ?? (() => new Date()))();
  const isVerified = actor.kind === 'user';
  const visitorKeyHash = actor.kind === 'user' ? visitorKeyHashForUser(actor.userId) : actor.anonymousKeyHash;
  const inputDigest = digest({ offerId, ...input });

  return db.transaction(async (tx) => {
    // Serialize quota/receipt admission for this actor across concurrent requests.
    if (actor.kind === 'user') {
      const user = await tx.execute(sql`select id from users where id=${actor.userId} for no key update`);
      if (!user.rows.length) throw new VisitOutcomeError('NOT_FOUND', 404);
    } else {
      const [hi, lo] = advisoryPair(visitorKeyHash);
      await tx.execute(sql`select pg_advisory_xact_lock(${hi}, ${lo})`);
    }

    const previous = await tx.execute<{ outcome_id: string; input_digest: string }>(
      sql`select outcome_id, input_digest from visit_outcome_receipts where visitor_key_hash=${visitorKeyHash} and submission_id=${input.submissionId}`,
    );
    if (previous.rows[0]) {
      if (previous.rows[0].input_digest !== inputDigest) throw new VisitOutcomeError('RETRY_CONFLICT', 409);
      const existing = await tx.execute<{ id: string; outcome: VisitOutcomeKind; is_verified: boolean; report_id: string | null }>(
        sql`select id, outcome, is_verified, report_id from visit_outcomes where id=${previous.rows[0].outcome_id}`,
      );
      const row = existing.rows[0]!;
      return { id: row.id, outcome: row.outcome, isVerified: row.is_verified, duplicate: true, reportId: row.report_id };
    }

    const offerMeta = await cardOfOffer(tx, offerId).catch(() => {
      throw new VisitOutcomeError('NOT_FOUND', 404);
    });
    const { card_id: cardId, location_id: locationId, seller_id: sellerId } = offerMeta;
    await lockCards(tx, [cardId]);

    // A same-version repeat stays idempotent and keeps the first recorded outcome untouched.
    const dupOutcome = await tx.execute<{ id: string; outcome: VisitOutcomeKind; is_verified: boolean; report_id: string | null }>(
      sql`select id, outcome, is_verified, report_id from visit_outcomes where visitor_key_hash=${visitorKeyHash} and card_id=${cardId} and card_version=${input.version}`,
    );
    if (dupOutcome.rows[0]) {
      const row = dupOutcome.rows[0];
      await tx.execute(
        sql`insert into visit_outcome_receipts(visitor_key_hash, submission_id, outcome_id, input_digest) values(${visitorKeyHash}, ${input.submissionId}, ${row.id}, ${inputDigest})`,
      );
      return { id: row.id, outcome: row.outcome, isVerified: row.is_verified, duplicate: true, reportId: row.report_id };
    }

    const context = await contextOf(tx, offerId, input.locale, now);
    if (!context.available || context.evidence.version !== input.version) {
      throw new VisitOutcomeError('STALE_CONTEXT', 409);
    }

    const since = new Date(now.getTime() - 86_400_000);
    if (input.outcome === 'matched') {
      const quota = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from visit_outcomes where visitor_key_hash=${visitorKeyHash} and outcome='matched' and created_at > ${since}`,
      );
      if (quota.rows[0]!.n >= VISIT_OUTCOME_MATCHED_QUOTA_24H) throw new VisitOutcomeError('OUTCOME_QUOTA', 429);

      const inserted = await tx.execute<{ id: string }>(
        sql`insert into visit_outcomes(offer_id, card_id, location_id, seller_id, card_version, outcome, reason, reporter_user_id, visitor_key_hash, is_verified, has_visit_signal, report_id, created_at)
            values(${offerId}, ${cardId}, ${locationId}, ${sellerId}, ${input.version}, 'matched', null, ${actor.kind === 'user' ? actor.userId : null}, ${visitorKeyHash}, ${isVerified}, ${input.hasVisitSignal}, null, ${now})
            returning id`,
      );
      const id = inserted.rows[0]!.id;
      await tx.execute(
        sql`insert into visit_outcome_receipts(visitor_key_hash, submission_id, outcome_id, input_digest) values(${visitorKeyHash}, ${input.submissionId}, ${id}, ${inputDigest})`,
      );
      return { id, outcome: 'matched', isVerified, duplicate: false, reportId: null };
    }

    // Problem outcome: validate photo (optional when Offer has 0 photos per CJM P1-14.2), enforce 24h problem quota,
    // create (or reuse existing same-version) offer_reports entry for operator X-03, and record visit_outcomes row.
    const selectedPhotoId = input.reason === 'photo_mismatch' ? input.photoId : null;
    if (selectedPhotoId !== null && !context.evidence.photoIds.includes(selectedPhotoId)) {
      throw new VisitOutcomeError('INVALID_PHOTO', 400);
    }
    if (input.reason === 'photo_mismatch' && selectedPhotoId === null && context.evidence.photoIds.length > 0) {
      // Auto-select the only photo if the card has exactly 1 photo; require explicit choice only if >1 photos.
      if (context.evidence.photoIds.length > 1) throw new VisitOutcomeError('INVALID_PHOTO', 400);
    }
    const effectivePhotoId = input.reason === 'photo_mismatch'
      ? (selectedPhotoId ?? (context.evidence.photoIds.length === 1 ? context.evidence.photoIds[0]! : null))
      : null;

    const dupReport = actor.kind === 'user'
      ? await tx.execute<{ id: string }>(sql`select id from offer_reports where reporter_user_id=${actor.userId} and card_id=${cardId} and card_version=${input.version}`)
      : await tx.execute<{ id: string }>(sql`select id from offer_reports where anonymous_key_hash=${actor.anonymousKeyHash} and card_id=${cardId} and card_version=${input.version}`);

    let reportId = dupReport.rows[0]?.id ?? null;
    if (!reportId) {
      const reportQuota = actor.kind === 'user'
        ? await tx.execute<{ n: number }>(sql`select count(*)::int as n from offer_reports where reporter_user_id=${actor.userId} and created_at > ${since}`)
        : await tx.execute<{ n: number }>(sql`select count(*)::int as n from offer_reports where anonymous_key_hash=${actor.anonymousKeyHash} and created_at > ${since}`);
      if (reportQuota.rows[0]!.n >= VISIT_OUTCOME_PROBLEM_QUOTA_24H) throw new VisitOutcomeError('REPORT_QUOTA', 429);

      const createdReport = await tx.execute<{ id: string }>(
        sql`insert into offer_reports(reporter_user_id, anonymous_key_hash, offer_id, card_id, card_version, reason, buyer_text, selected_photo_id, evidence, created_at)
            values(${actor.kind === 'user' ? actor.userId : null}, ${actor.kind === 'guest' ? actor.anonymousKeyHash : null}, ${offerId}, ${cardId}, ${input.version}, ${input.reason}, ${input.text}, ${effectivePhotoId}, ${JSON.stringify(context.evidence)}::jsonb, ${now})
            returning id`,
      );
      reportId = createdReport.rows[0]!.id;
      const allPhotos = await tx.execute<{ id: string }>(
        sql`select distinct photo_id::text as id from offer_photos where offer_id in (select id from offers where card_id=${cardId})`,
      );
      for (const photo of allPhotos.rows) {
        await tx.execute(sql`insert into offer_report_photos(report_id, photo_id) values(${reportId}, ${photo.id})`);
      }
    }

    const inserted = await tx.execute<{ id: string }>(
      sql`insert into visit_outcomes(offer_id, card_id, location_id, seller_id, card_version, outcome, reason, reporter_user_id, visitor_key_hash, is_verified, has_visit_signal, report_id, created_at)
          values(${offerId}, ${cardId}, ${locationId}, ${sellerId}, ${input.version}, 'problem', ${input.reason}, ${actor.kind === 'user' ? actor.userId : null}, ${visitorKeyHash}, ${isVerified}, ${input.hasVisitSignal}, ${reportId}, ${now})
          returning id`,
    );
    const id = inserted.rows[0]!.id;
    await tx.execute(
      sql`insert into visit_outcome_receipts(visitor_key_hash, submission_id, outcome_id, input_digest) values(${visitorKeyHash}, ${input.submissionId}, ${id}, ${inputDigest})`,
    );
    return { id, outcome: 'problem', isVerified, duplicate: dupReport.rows.length > 0, reportId };
  });
}
