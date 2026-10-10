import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDatabase, type Database } from '../../../db/client';
import { readOfferValidityPeriodHours } from '../../offers/config/offer-lifecycle.config';
import { formatPack, packFromColumns } from '../../offers/pack/pack';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import { isSellerCommentTranslationEnabled } from '../../offers/translation/seller-comment-translation.config';
import { getPhotoStorage, type PhotoStorage } from '../../media/storage/photo-storage';
import type { PhotoVariant } from '../../media/contracts/photo.contract';
import { lockCards } from '../infrastructure/card-lock';
import { insertRemoval, restoreRemoval } from '../infrastructure/moderation.repository';
import { ReportError, type ReportContext, type ReportEvidence, type OperatorReport, type ReportPage, type SubmitReport, type ResolveReport } from '../contracts/report.contract';

type Db = Pick<Database, 'execute' | 'select' | 'insert' | 'update'>;
type Dependencies = { database?: Database; clock?: () => Date };
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
type CardRow = {
  id: string; card_id: string; seller_id: string; title: string; pack_amount: string | null; pack_unit: string | null;
  price_amount: string; price_currency: string; price_unit_code: string | null; price_unit_value: string | null;
  seller_comment: string | null; display_comment: string | null; status: string; last_confirmed_at: Date; revision: number;
  location_id: string; location_name: string; address_text: string; photo_ids: string[];
};
type ReportRow = {
  id: string; offer_id: string; card_id: string; created_at: Date; reason: OperatorReport['reason']; buyer_text: string;
  selected_photo_id: string | null; evidence: ReportEvidence; closed_at: Date | null; disposition: OperatorReport['disposition'];
  rationale: string | null; moderation_id: string | null; decision_digest: string | null;
};

async function cardOf(db: Db, offerId: string) {
  const result = await db.execute<{ card_id: string }>(sql`select card_id from offers where id=${offerId}`);
  if (!result.rows[0]) throw new ReportError('NOT_FOUND', 404);
  return result.rows[0].card_id;
}

// Caller holds the shared card lock. Lock Offers and Location identities too: location edits do not use card locks.
async function contextOf(db: Db, offerId: string, locale: 'ru' | 'kk', now: Date): Promise<ReportContext> {
  const cardId = await cardOf(db, offerId);
  await db.execute(sql`select id from offers where card_id=${cardId} order by id for update`);
  await db.execute(sql`select id from locations where id in (select location_id from offers where card_id=${cardId}) order by id for share`);
  const result = await db.execute<CardRow>(sql`
    select o.id,o.card_id,o.seller_id,o.title,o.pack_amount::text,o.pack_unit,o.price_amount::text,o.price_currency,
      o.price_unit_code,o.price_unit_value,o.seller_comment,o.status,o.last_confirmed_at,o.revision,
      l.id as location_id,l.name as location_name,l.address_text,
      case when ${isSellerCommentTranslationEnabled()} and t.status='available' then t.translated_text else o.seller_comment end as display_comment,
      coalesce((select array_agg(op.photo_id::text order by op.position) from offer_photos op where op.offer_id=o.id),array[]::text[]) as photo_ids
    from offers o join locations l on l.id=o.location_id
    left join offer_comment_translations t on t.offer_id=o.id and t.comment_version=o.seller_comment_version and t.target_locale=${locale}
    where o.card_id=${cardId} order by o.id`);
  const rows = result.rows;
  const chosen = rows.find(r => r.id === offerId)!;
  const events = await db.execute<{ id: string }>(sql`select cs.id from seller_change_sets cs join seller_change_items i on i.change_set_id=cs.id
    where cs.status='confirmed' and i.card_id=${cardId} and i.action in ('create_offer','update_offer')
    order by cs.confirmed_at desc,cs.created_at desc,cs.id desc limit 1`);
  const history = await db.execute<{ id: string; reason: string; comment: string | null; removed_at: Date; restored_at: Date | null; cleared_at: Date | null }>(sql`
    select id,reason,comment,removed_at,restored_at,cleared_at from offer_card_removals where card_id=${cardId} order by removed_at,id`);
  const active = history.rows.find(r => r.restored_at === null && r.cleared_at === null);
  const version = digest({ event: events.rows[0]?.id ?? 'legacy', content: rows.map(r => ({
    id:r.id, locationId:r.location_id, name:r.location_name, address:r.address_text,
    title:r.title, pack:[r.pack_amount,r.pack_unit], price:[r.price_amount,r.price_currency,r.price_unit_code,r.price_unit_value],
    comment:r.seller_comment, photos:r.photo_ids,
  })) });
  const pack = formatPack(packFromColumns(chosen.pack_amount, chosen.pack_unit), locale);
  const evidence: ReportEvidence = {
    cardId, offerId, locale, version, title:chosen.title, pack, originalComment:chosen.seller_comment,
    displayedComment:chosen.display_comment, photoIds:chosen.photo_ids,
    points:rows.map(r => ({ offerId:r.id, locationId:r.location_id, name:r.location_name, address:r.address_text,
      amount:r.price_amount, currency:r.price_currency,
      basis:formatPack(packFromColumns(r.pack_amount,r.pack_unit),locale) ?? formatPriceUnit(priceUnitFromColumns(r.price_unit_code,r.price_unit_value),locale) })),
  };
  const available = chosen.status === 'active' && new Date(chosen.last_confirmed_at).getTime() > now.getTime()-readOfferValidityPeriodHours()*3600000 && !active;
  return { evidence, available, token:digest({ version, rows:rows.map(r=>[r.id,r.status,r.revision]), history:history.rows, available }),
    removal:active ? {id:active.id,reason:active.reason,comment:active.comment,at:new Date(active.removed_at).toISOString()} : null };
}

export async function loadReportContext(offerId: string, locale: 'ru' | 'kk', deps: Dependencies = {}) {
  const db=deps.database ?? getDatabase();
  return db.transaction(async tx=>{
    await lockCards(tx,[await cardOf(tx,offerId)]);
    return contextOf(tx,offerId,locale,(deps.clock ?? (()=>new Date()))());
  });
}

export async function submitReport(userId: string, input: SubmitReport, deps: Dependencies = {}) {
  const db=deps.database ?? getDatabase(), now=(deps.clock ?? (()=>new Date()))(), inputDigest=digest(input);
  return db.transaction(async tx=>{
    // Serializes quota/receipt admission for this authenticated User across every card and process.
    // NO KEY UPDATE still serializes admissions, while permitting FK KEY SHARE reads by moderation/session writes.
    const user=await tx.execute(sql`select id from users where id=${userId} for no key update`);
    if (!user.rows.length) throw new ReportError('NOT_FOUND',404);
    const previous=await tx.execute<{ report_id:string; input_digest:string }>(sql`select report_id,input_digest from offer_report_receipts where user_id=${userId} and submission_id=${input.submissionId}`);
    if(previous.rows[0]) {
      if(previous.rows[0].input_digest!==inputDigest) throw new ReportError('RETRY_CONFLICT',409);
      return {receipt:previous.rows[0].report_id,duplicate:true};
    }
    const cardId=await cardOf(tx,input.offerId);
    await lockCards(tx,[cardId]);
    // A same-version duplicate remains acknowledged even after removal/return; it never replaces evidence.
    const duplicate=await tx.execute<{ id:string }>(sql`select id from offer_reports where reporter_user_id=${userId} and card_id=${cardId} and card_version=${input.version}`);
    let reportId=duplicate.rows[0]?.id;
    if(!reportId) {
      const context=await contextOf(tx,input.offerId,input.locale,now);
      if(!context.available || context.evidence.version!==input.version) throw new ReportError('STALE_CONTEXT',409);
      if(input.reason==='photo_mismatch' && (!input.photoId || !context.evidence.photoIds.includes(input.photoId))) throw new ReportError('INVALID_PHOTO',400);
      const quota=await tx.execute<{ n:number }>(sql`select count(*)::int as n from offer_reports where reporter_user_id=${userId} and created_at > ${new Date(now.getTime()-86400000)}`);
      if(quota.rows[0]!.n>=5) throw new ReportError('REPORT_QUOTA',429);
      const inserted=await tx.execute<{ id:string }>(sql`insert into offer_reports(reporter_user_id,offer_id,card_id,card_version,reason,buyer_text,selected_photo_id,evidence,created_at)
        values(${userId},${input.offerId},${cardId},${input.version},${input.reason},${input.text},${input.photoId},${JSON.stringify(context.evidence)}::jsonb,${now}) returning id`);
      reportId=inserted.rows[0]!.id;
      const allPhotos=await tx.execute<{ id:string }>(sql`select distinct photo_id::text as id from offer_photos where offer_id in (select id from offers where card_id=${cardId})`);
      for(const photo of allPhotos.rows) await tx.execute(sql`insert into offer_report_photos(report_id,photo_id) values(${reportId},${photo.id})`);
    }
    await tx.execute(sql`insert into offer_report_receipts(user_id,submission_id,report_id,input_digest) values(${userId},${input.submissionId},${reportId},${inputDigest})`);
    return {receipt:reportId,duplicate:duplicate.rows.length>0};
  });
}

async function findReport(db: Db,id:string,lock=false) {
  const result=await db.execute<ReportRow>(sql`select * from offer_reports where id=${id} ${lock ? sql`for update` : sql``}`);
  if(!result.rows[0]) throw new ReportError('NOT_FOUND',404);
  return result.rows[0];
}
function view(row:ReportRow,current:ReportContext|null,laterCardEvent:OperatorReport['laterCardEvent']):OperatorReport {
  // Explicit privacy projection: no reporter User ID, phone or receipt input digest.
  return {id:row.id,at:new Date(row.created_at).toISOString(),reason:row.reason,text:row.buyer_text,photoId:row.selected_photo_id,evidence:row.evidence,current,
    closedAt:row.closed_at ? new Date(row.closed_at).toISOString():null,disposition:row.disposition,rationale:row.rationale,moderationId:row.moderation_id,laterCardEvent};
}
export async function loadReport(id:string,deps:Dependencies={}) {
  const db=deps.database ?? getDatabase();
  return db.transaction(async tx=>{
    const first=await findReport(tx,id);
    await lockCards(tx,[first.card_id]);
    const row=await findReport(tx,id);
    let laterCardEvent:OperatorReport['laterCardEvent']=null;
    if(row.moderation_id) {
      const event=await tx.execute<{restored_at:Date|null;cleared_at:Date|null}>(sql`select restored_at,cleared_at from offer_card_removals where id=${row.moderation_id}`);
      const e=event.rows[0];
      if(e?.restored_at)laterCardEvent={kind:'returned',at:new Date(e.restored_at).toISOString()};
      else if(e?.cleared_at)laterCardEvent={kind:'republished',at:new Date(e.cleared_at).toISOString()};
    }
    return view(row,await contextOf(tx,row.offer_id,row.evidence.locale,(deps.clock ?? (()=>new Date()))()),laterCardEvent);
  });
}
export async function listReports(state:'open'|'closed',offset:number,deps:Dependencies={}):Promise<ReportPage> {
  const db=deps.database ?? getDatabase();
  const result=await db.execute<ReportRow>(sql`select id,created_at,reason,evidence,closed_at,disposition from offer_reports
    where ${state==='open'?sql`closed_at is null`:sql`closed_at is not null`} order by created_at,id limit 31 offset ${offset}`);
  const count=await db.execute<{ n:number }>(sql`select count(*)::int as n from offer_reports where closed_at is null`);
  return {rows:result.rows.slice(0,30).map(r=>({id:r.id,at:new Date(r.created_at).toISOString(),reason:r.reason,evidence:r.evidence,
    closedAt:r.closed_at?new Date(r.closed_at).toISOString():null,disposition:r.disposition})),hasMore:result.rows.length>30,openCount:count.rows[0]!.n};
}
export async function resolveReport(operatorId:string,id:string,input:ResolveReport,deps:Dependencies={}) {
  const db=deps.database ?? getDatabase(), now=(deps.clock ?? (()=>new Date()))(), decisionDigest=digest(input);
  await db.transaction(async tx=>{
    const first=await findReport(tx,id);
    await lockCards(tx,[first.card_id]);
    const row=await findReport(tx,id,true);
    if(row.closed_at) {
      if(row.decision_digest!==decisionDigest) throw new ReportError('DECISION_CONFLICT',409);
      return;
    }
    const current=await contextOf(tx,row.offer_id,row.evidence.locale,now);
    if(current.token!==input.token) throw new ReportError('STALE_CONTEXT',409);
    let moderationId=current.removal?.id ?? null;
    if(input.disposition==='removed') {
      if(current.removal) throw new ReportError('DECISION_CONFLICT',409);
      const seller=await tx.execute<{seller_id:string}>(sql`select seller_id from offers where id=${row.offer_id}`);
      await insertRemoval(tx,{cardId:row.card_id,sellerId:seller.rows[0]!.seller_id,operatorUserId:operatorId,reason:input.reason!,comment:input.sellerComment || null});
      const active=await tx.execute<{id:string}>(sql`select id from offer_card_removals where card_id=${row.card_id} and restored_at is null and cleared_at is null`);
      moderationId=active.rows[0]!.id;
    } else if(input.disposition==='already_removed' || input.disposition==='returned') {
      if(!moderationId) throw new ReportError('DECISION_CONFLICT',409);
      if(input.disposition==='returned') await restoreRemoval(tx,row.card_id,operatorId);
    } else moderationId=null;
    await tx.execute(sql`update offer_reports set closed_at=${now},closed_by_user_id=${operatorId},disposition=${input.disposition},
      rationale=${input.rationale || null},moderation_id=${moderationId},decision_digest=${decisionDigest} where id=${id}`);
  });
  return loadReport(id,deps);
}

// This capability is separate from ordinary/public media URLs and never authorizes arbitrary orphan photos.
// The HTTP caller must recheck operator allowlist on EACH read; this function also verifies the report reference.
export async function readReportPhoto(reportId:string,photoId:string,variant:PhotoVariant,deps:{database?:Database;storage?:PhotoStorage}={}) {
  const db=deps.database ?? getDatabase();
  const linked=await db.execute(sql`select 1 from offer_report_photos where report_id=${reportId} and photo_id=${photoId}`);
  if(!linked.rows.length) return null;
  return (deps.storage ?? getPhotoStorage()).read(photoId,variant);
}
