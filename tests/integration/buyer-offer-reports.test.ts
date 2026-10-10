import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase } from './database';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { createCardChangeSet, updateCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { loadReportContext, loadReport, submitReport, resolveReport, listReports, readReportPhoto } from '../../src/modules/moderation/application/offer-reports';
import { removeCard, restoreCard } from '../../src/modules/moderation/application/operator-post-check';
import { readPhoto } from '../../src/modules/media/application/read-photo';
import { cardCreateBodySchema, cardUpdateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { sellerOfferChangeBodySchema } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { reconfirmCards } from '../../src/modules/seller-input/application/reconfirm-actuality';
import { resolveReportSchema, submitReportSchema } from '../../src/modules/moderation/contracts/report.contract';

let connection:Awaited<ReturnType<typeof connectTestDatabase>>;
const users=['a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003'];
const [seller,buyer,operator]=users as [string,string,string];
const photos=['a9000000-0000-4000-8000-000000000004','a9000000-0000-4000-8000-000000000005'];
const T0=new Date('2026-10-10T07:00:00Z'),clock=()=>T0;
const deps=()=>({database:connection.db,clock});
const base={productId:null,unit:{code:'package'},pack:{amount:'500',unit:'g'},sellerComment:'Исходное описание',photoIds:[] as string[]};
let locationId:string;
async function clean(){
  const p=connection.pool;
  await p.query('DELETE FROM offer_reports WHERE reporter_user_id=ANY($1::uuid[])',[users]);
  await p.query('DELETE FROM offer_card_removals WHERE removed_by_user_id=$1',[operator]);
  const sellers='SELECT id FROM sellers WHERE owner_user_id=$1';
  await p.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${sellers}))`,[seller]);
  await p.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${sellers}))`,[seller]);
  await p.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${sellers})`,[seller]);
  await p.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${sellers}))`,[seller]);
  await p.query(`DELETE FROM offers WHERE seller_id IN (${sellers})`,[seller]);
  await p.query(`DELETE FROM locations WHERE seller_id IN (${sellers})`,[seller]);
  await p.query('DELETE FROM sellers WHERE owner_user_id=$1',[seller]);
  await p.query('DELETE FROM photos WHERE owner_user_id=$1',[seller]);
  await p.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
}
beforeAll(async()=>{connection=await connectTestDatabase();});
beforeEach(async()=>{
  await clean();
  for(let i=0;i<users.length;i++)await connection.pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,$3)',[users[i],`+7700099100${i}`,T0]);
  const setup=await setupSeller(seller,{seller:{displayName:'Synthetic reports'},location:{name:'Точка жалоб',type:'shop',addressText:'Синтетический адрес'}},deps());
  locationId=setup.locations[0]!.id;
  for(const id of photos)await connection.pool.query('INSERT INTO photos(id,owner_user_id,width,height) VALUES($1,$2,600,400)',[id,seller]);
});
afterAll(async()=>{await clean();await connection.pool.end();});
async function publish(title='Синтетические абрикосы',photoIds:string[]=[]){
  const set=await createCardChangeSet(seller,cardCreateBodySchema.parse({...base,title,photoIds,price:'1200',points:[{locationId}]}),deps());
  const confirmed=await confirmSellerChangeSet(seller,set.id,deps());
  const offerId=confirmed.items[0]!.resultOffer!.id;
  const context=await loadReportContext(offerId,'ru',deps());
  return {offerId,context,cardId:context.evidence.cardId};
}
function input(c:Awaited<ReturnType<typeof publish>>,extra={}){return submitReportSchema.parse({submissionId:randomUUID(),offerId:c.offerId,version:c.context.evidence.version,locale:'ru',reason:'price_mismatch',text:'PRIVATE buyer text',...extra});}
async function edit(c:Awaited<ReturnType<typeof publish>>,price='1400',photoIds:string[]=[]){
  const offers=(await listOwnedOffers(seller,deps())).filter(o=>o.cardId===c.cardId);
  const set=await updateCardChangeSet(seller,c.cardId,cardUpdateBodySchema.parse({...base,title:'Синтетические абрикосы',price,photoIds,
    offers:offers.map(o=>({offerId:o.id,revision:o.revision,applyPrice:true})),addPoints:[]}),deps());
  await confirmSellerChangeSet(seller,set.id,deps());
}
describe('atomic buyer report and operator handling',()=>{
  it('language, actuality and off/on do not renew duplicate allowance; invalid photo references cannot create evidence',async()=>{
    const c=await publish('Синтетические абрикосы',photos);
    await expect(submitReport(buyer,input(c,{reason:'photo_mismatch',photoId:randomUUID()}),deps())).rejects.toMatchObject({code:'INVALID_PHOTO'});
    const {receipt}=await submitReport(buyer,input(c),deps());
    expect((await loadReportContext(c.offerId,'kk',deps())).evidence.version).toBe(c.context.evidence.version);
    await reconfirmCards(seller,[c.cardId],deps());
    for(const action of ['deactivate_offer','activate_offer']) {
      const set=await createOfferManagementChangeSet(seller,c.offerId,sellerOfferChangeBodySchema.parse({action}),deps());
      await confirmSellerChangeSet(seller,set.id,deps());
    }
    const current=await loadReportContext(c.offerId,'ru',deps());expect(current.evidence.version).toBe(c.context.evidence.version);
    expect(await submitReport(buyer,input(c),deps())).toMatchObject({receipt,duplicate:true});
  });
  it('already-removed links the existing event; explicit report return records a separate closure without losing that event',async()=>{
    const c=await publish();const {receipt}=await submitReport(buyer,input(c),deps());const second=await submitReport(operator,input(c),deps());
    await removeCard(operator,c.cardId,{reason:'other',comment:'Seller-only'},deps());
    const before=await loadReport(receipt,deps());
    const closed=await resolveReport(operator,receipt,resolveReportSchema.parse({token:before.current!.token,disposition:'already_removed'}),deps());
    expect(closed.moderationId).toBe(before.current!.removal!.id);
    const review=await loadReport(second.receipt,deps());
    const returned=await resolveReport(operator,second.receipt,resolveReportSchema.parse({token:review.current!.token,disposition:'returned',rationale:'Проверено исправление'}),deps());
    expect(returned.disposition).toBe('returned');expect(returned.current!.available).toBe(true);
    expect((await loadReport(receipt,deps())).disposition).toBe('already_removed');
    expect((await connection.pool.query('SELECT count(*)::int n FROM offer_card_removals WHERE card_id=$1',[c.cardId])).rows[0].n).toBe(1);
    await connection.pool.query('DELETE FROM offer_reports WHERE id=$1',[second.receipt]);
  });
  it('concurrent retries/duplicates preserve the first immutable evidence and receipt even after removal',async()=>{
    const c=await publish();const request=input(c);
    const results=await Promise.all(Array.from({length:12},()=>submitReport(buyer,request,deps())));
    expect(new Set(results.map(r=>r.receipt)).size).toBe(1);
    expect((await connection.pool.query('SELECT count(*)::int n FROM offer_reports WHERE reporter_user_id=$1',[buyer])).rows[0].n).toBe(1);
    await removeCard(operator,c.cardId,{reason:'other',comment:'Seller-safe comment'},deps());
    expect(await submitReport(buyer,request,deps())).toMatchObject({receipt:results[0]!.receipt});
    expect(await submitReport(buyer,input(c,{text:'Different message'}),deps())).toMatchObject({receipt:results[0]!.receipt,duplicate:true});
    await expect(submitReport(buyer,{...request,text:'Changed retry'},deps())).rejects.toMatchObject({code:'RETRY_CONFLICT'});
    const report=await loadReport(results[0]!.receipt,deps());
    expect(report.text).toBe('PRIVATE buyer text');expect(report.evidence.points[0]!.amount).toBe('1200');expect(report).not.toHaveProperty('reporter_user_id');
    await expect(connection.pool.query("UPDATE offer_reports SET buyer_text='tampered' WHERE id=$1",[report.id])).rejects.toThrow(/immutable/);
  });
  it('admits exactly five of six concurrent new cards; closure never frees quota, rolling expiry does',async()=>{
    const cards:Awaited<ReturnType<typeof publish>>[]=[];for(let i=0;i<6;i++)cards.push(await publish(`Quota ${i}`));
    const results=await Promise.allSettled(cards.map(c=>submitReport(buyer,input(c),deps())));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(5);
    expect(results.filter(r=>r.status==='rejected')).toMatchObject([{reason:{code:'REPORT_QUOTA'}}]);
    const page=await listReports('open',0,deps());const own=page.rows.find(r=>r.evidence.cardId===cards[0]!.cardId) ?? page.rows.find(r=>cards.some(c=>c.cardId===r.evidence.cardId))!;
    const report=await loadReport(own.id,deps());
    await resolveReport(operator,report.id,resolveReportSchema.parse({token:report.current!.token,disposition:'no_action',rationale:'No issue'}),deps());
    const rejected=cards[results.findIndex(r=>r.status==='rejected')]!;
    await expect(submitReport(buyer,input(rejected),deps())).rejects.toMatchObject({code:'REPORT_QUOTA'});
    expect(await submitReport(buyer,input(rejected),{database:connection.db,clock:()=>new Date(T0.getTime()+86400000)})).toHaveProperty('receipt');
  });
  it('rejects stale buyer context and operator decisions; restoring earlier values still creates a new reporting version',async()=>{
    const c=await publish();const submitted=await submitReport(buyer,input(c),deps());const before=await loadReport(submitted.receipt,deps());
    await edit(c);
    await expect(submitReport(buyer,input(c),deps())).resolves.toMatchObject({duplicate:true});
    await expect(submitReport(operator,input(c),deps())).rejects.toMatchObject({code:'STALE_CONTEXT'});
    await expect(resolveReport(operator,before.id,resolveReportSchema.parse({token:before.current!.token,disposition:'removed',reason:'other'}),deps())).rejects.toMatchObject({code:'STALE_CONTEXT'});
    const changed=await loadReport(before.id,deps());expect(changed.evidence.points[0]!.amount).toBe('1200');expect(changed.current!.evidence.points[0]!.amount).toBe('1400');
    await edit(c,'1200');expect((await loadReportContext(c.offerId,'ru',deps())).evidence.version).not.toBe(c.context.evidence.version);
  });
  it('one concurrent disposition wins; audit commits atomically and closed history survives return/photo detachment',async()=>{
    const c=await publish('Синтетические абрикосы',photos);
    const submitted=await submitReport(buyer,input(c,{reason:'photo_mismatch',photoId:photos[1]}),deps());const report=await loadReport(submitted.receipt,deps());
    const remove=resolveReportSchema.parse({token:report.current!.token,disposition:'removed',reason:'photo_mismatch',sellerComment:'Replace inappropriate photo'});
    const outcomes=await Promise.allSettled([resolveReport(operator,report.id,remove,deps()),resolveReport(operator,report.id,resolveReportSchema.parse({token:report.current!.token,disposition:'no_action',rationale:'Other view'}),deps())]);
    expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(r=>r.status==='rejected')).toHaveLength(1);
    let closed=await loadReport(report.id,deps());
    if(closed.disposition==='no_action') {expect(closed.moderationId).toBeNull();return;}
    expect((await resolveReport(operator,report.id,remove,deps())).moderationId).toBe(closed.moderationId);
    const audit=(await connection.pool.query('SELECT * FROM offer_card_removals WHERE id=$1',[closed.moderationId])).rows[0];
    expect(audit.comment).toBe('Replace inappropriate photo');expect(JSON.stringify(audit)).not.toContain('PRIVATE');
    await restoreCard(operator,c.cardId,deps());closed=await loadReport(report.id,deps());expect(closed.disposition).toBe('removed');expect(closed.closedAt).not.toBeNull();expect(closed.current!.available).toBe(true);
    expect(closed.current!.evidence.version).toBe(c.context.evidence.version);
    await edit(c,'1400',[photos[0]!]);
    const storage={read:async()=>Buffer.from('immutable-evidence'),write:async()=>{}};
    expect(await readReportPhoto(report.id,photos[1]!,'display',{database:connection.db,storage})).toEqual(Buffer.from('immutable-evidence'));
    expect(await readReportPhoto(randomUUID(),photos[1]!,'display',{database:connection.db,storage})).toBeNull();
    expect(await readPhoto(photos[1]!,'display',operator,{database:connection.db,storage,viewerIsOperator:true})).toEqual({status:'not_found'});
    expect((await loadReport(report.id,deps())).evidence.photoIds).toEqual(photos);
    await expect(connection.pool.query("UPDATE offer_reports SET disposition='returned' WHERE id=$1",[report.id])).rejects.toThrow(/immutable/);
  });
  it('a failure recording disposition rolls back removal/audit as one transaction',async()=>{
    const c=await publish();const {receipt}=await submitReport(buyer,input(c),deps());const report=await loadReport(receipt,deps());
    // Inject a failure at the final disposition write, AFTER the valid moderation insert.
    await connection.pool.query(`CREATE FUNCTION reports_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${receipt}' THEN RAISE EXCEPTION 'injected disposition failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reports_test_fail BEFORE UPDATE ON offer_reports FOR EACH ROW EXECUTE FUNCTION reports_test_fail()`);
    try {
      await expect(resolveReport(operator,receipt,resolveReportSchema.parse({token:report.current!.token,disposition:'removed',reason:'other'}),deps())).rejects.toThrow();
    } finally {await connection.pool.query('DROP TRIGGER reports_test_fail ON offer_reports; DROP FUNCTION reports_test_fail()');}
    expect((await loadReport(receipt,deps())).closedAt).toBeNull();
    expect((await connection.pool.query('SELECT count(*)::int n FROM offer_card_removals WHERE card_id=$1',[c.cardId])).rows[0].n).toBe(0);
  });
  it('detached historical evidence remains report-scoped after deterministic removal, return and republish',async()=>{
    const c=await publish('Синтетические абрикосы',photos);const {receipt}=await submitReport(buyer,input(c,{reason:'photo_mismatch',photoId:photos[1]}),deps());
    const first=await loadReport(receipt,deps());
    const closed=await resolveReport(operator,receipt,resolveReportSchema.parse({token:first.current!.token,disposition:'removed',reason:'photo_mismatch',sellerComment:'Seller-safe explanation'}),deps());
    await restoreCard(operator,c.cardId,deps());
    expect((await loadReport(receipt,deps())).current!.evidence.version).toBe(c.context.evidence.version);
    await edit(c,'1400',[photos[0]!]);
    const after=await loadReport(receipt,deps());expect(after.closedAt).toBe(closed.closedAt);expect(after.disposition).toBe('removed');expect(after.current!.available).toBe(true);
    expect(after.evidence.photoIds).toEqual(photos);expect(after.current!.evidence.photoIds).toEqual([photos[0]]);
    const storage={read:async()=>Buffer.from('historic'),write:async()=>{}};
    expect(await readReportPhoto(receipt,photos[1]!,'thumb',{database:connection.db,storage})).toEqual(Buffer.from('historic'));
    expect(await readPhoto(photos[1]!,'thumb',operator,{database:connection.db,storage,viewerIsOperator:true})).toEqual({status:'not_found'});
    const newer={...c,context:await loadReportContext(c.offerId,'ru',deps())};expect((await submitReport(buyer,input(newer),deps())).duplicate).toBe(false);
    await expect(connection.pool.query("UPDATE offer_reports SET disposition='returned' WHERE id=$1",[receipt])).rejects.toThrow(/immutable/);
  });
});
