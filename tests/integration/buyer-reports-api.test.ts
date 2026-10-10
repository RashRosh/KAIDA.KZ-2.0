import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { connectTestDatabase } from './database';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { loadReportContext, submitReport } from '../../src/modules/moderation/application/offer-reports';
import { submitReportSchema } from '../../src/modules/moderation/contracts/report.contract';
import { getPhotoStorage } from '../../src/modules/media/storage/photo-storage';
import { POST as send } from '../../src/app/api/reports/route';
import { GET as list } from '../../src/app/api/operator/reports/route';
import { GET as read,POST as resolve } from '../../src/app/api/operator/reports/[id]/route';
import { GET as photo } from '../../src/app/api/operator/reports/[id]/photos/[photoId]/[variant]/route';
import { GET as context } from '../../src/app/api/offers/[id]/report-context/route';

let conn:Awaited<ReturnType<typeof connectTestDatabase>>;
const ids=[0,1,2].map(n=>`a9020000-0000-4000-8000-00000000000${n+1}`);
const phones=['+77000991201','+77000991202','+77000991203'],tokens=ids.map(()=>randomUUID());
let offerId:string,receipt:string,photoId:string;
const old={url:process.env.DATABASE_URL,operators:process.env.OPERATOR_PHONES,flag:process.env.BUYER_REPORTS_LOCAL_TESTING};
function req(path:string,role:number|null=null,body?:unknown,headers:Record<string,string>={}) {
  return new NextRequest(`http://localhost${path}`,{method:body===undefined?'GET':'POST',headers:{...(role===null?{}:{cookie:`${SESSION_COOKIE_NAME}=${tokens[role]}`}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const params=()=>({params:Promise.resolve({id:receipt})});
beforeAll(async()=>{
  conn=await connectTestDatabase();
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.OPERATOR_PHONES=phones[2];process.env.BUYER_REPORTS_LOCAL_TESTING='1';
  const now=new Date();
  for(let i=0;i<ids.length;i++) {
    await conn.pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,$3)',[ids[i],phones[i],now]);
    await conn.pool.query('INSERT INTO auth_sessions(id,user_id,token_digest,created_at,expires_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),ids[i],digestSessionToken(tokens[i]!),now,new Date(now.getTime()+3600000)]);
  }
  const seller=await setupSeller(ids[0]!,{seller:{displayName:'API synthetic'},location:{name:'API point',type:'shop',addressText:'Synthetic'}},{database:conn.db});
  photoId=randomUUID();await conn.pool.query('INSERT INTO photos(id,owner_user_id,width,height) VALUES($1,$2,600,400)',[photoId,ids[0]]);
  await getPhotoStorage().write(photoId,'thumb',Buffer.from('synthetic-private-photo'));
  const set=await createCardChangeSet(ids[0]!,cardCreateBodySchema.parse({title:'API report',productId:null,unit:{code:'piece'},pack:null,sellerComment:null,price:'1200',photoIds:[photoId],points:[{locationId:seller.locations[0]!.id}]}),{database:conn.db});
  offerId=(await confirmSellerChangeSet(ids[0]!,set.id,{database:conn.db})).items[0]!.resultOffer!.id;
  const ctx=await loadReportContext(offerId,'ru',{database:conn.db});
  receipt=(await submitReport(ids[1]!,submitReportSchema.parse({submissionId:randomUUID(),offerId,version:ctx.evidence.version,locale:'ru',reason:'photo_mismatch',photoId,text:'PRIVATE identity text +77000000000'}),{database:conn.db})).receipt;
});
afterAll(async()=>{
  process.env.DATABASE_URL=old.url;process.env.OPERATOR_PHONES=old.operators;process.env.BUYER_REPORTS_LOCAL_TESTING=old.flag;
  await conn.pool.query('DELETE FROM offer_reports WHERE reporter_user_id=$1',[ids[1]]);
  const own='SELECT id FROM sellers WHERE owner_user_id=$1';
  await conn.pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${own}))`,[ids[0]]);
  await conn.pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${own}))`,[ids[0]]);
  await conn.pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${own})`,[ids[0]]);
  await conn.pool.query('DELETE FROM offer_photos WHERE offer_id=$1',[offerId]);await conn.pool.query('DELETE FROM offers WHERE id=$1',[offerId]);
  await conn.pool.query(`DELETE FROM locations WHERE seller_id IN (${own})`,[ids[0]]);await conn.pool.query('DELETE FROM sellers WHERE owner_user_id=$1',[ids[0]]);
  await conn.pool.query('DELETE FROM photos WHERE id=$1',[photoId]);await conn.pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[ids]);await conn.pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);await conn.pool.end();
});
it('each operator report route denies guest, buyer and seller; only allowlisted operator reads private evidence',async()=>{
  for(const role of [null,0,1]) {
    expect((await list(req('/api/operator/reports',role))).status).toBe(404);
    expect((await read(req(`/api/operator/reports/${receipt}`,role),params())).status).toBe(404);
    expect((await resolve(req(`/api/operator/reports/${receipt}`,role,{}),params())).status).toBe(404);
    expect((await photo(req('/private',role),{params:Promise.resolve({id:receipt,photoId,variant:'thumb'})})).status).toBe(404);
  }
  const response=await read(req(`/api/operator/reports/${receipt}`,2),params());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
  const result=await response.json();expect(result.report.text).toContain('PRIVATE');expect(JSON.stringify(result)).not.toContain(ids[1]);expect(result.report).not.toHaveProperty('reporterUserId');
  expect((await photo(req('/private',2),{params:Promise.resolve({id:receipt,photoId,variant:'thumb'})})).headers.get('cache-control')).toBe('private, no-store');
  expect((await photo(req('/private',2),{params:Promise.resolve({id:randomUUID(),photoId,variant:'thumb'})})).status).toBe(404);
  process.env.OPERATOR_PHONES='';expect((await read(req('/private',2),params())).status).toBe(404);process.env.OPERATOR_PHONES=phones[2];
});
it('requires auth and same origin for writes, rejects forged fields, and public context contains no buyer data',async()=>{
  expect((await send(req('/api/reports',null,{}))).status).toBe(401);
  expect((await send(req('/api/reports',1,{}, {origin:'https://foreign.invalid'}))).status).toBe(403);
  expect((await resolve(req('/api/operator/reports/'+receipt,2,{}, {origin:'https://foreign.invalid'}),params())).status).toBe(403);
  const publicRead=await context(req('/api/offers/'+offerId+'/report-context'),{params:Promise.resolve({id:offerId})});expect(publicRead.status).toBe(200);
  const data=await publicRead.json();expect(JSON.stringify(data)).not.toContain('PRIVATE');expect(JSON.stringify(data)).not.toContain('reporter');
  const forged={submissionId:randomUUID(),offerId,version:data.evidence.version,locale:'ru',reason:'other',reporterUserId:ids[2],evidence:{title:'forged'}};
  expect((await send(req('/api/reports',1,forged))).status).toBe(400);
});
it('default-off gate hides submission, context, list, detail and media',async()=>{
  process.env.BUYER_REPORTS_LOCAL_TESTING='0';
  try {
    expect((await send(req('/api/reports',1,{}))).status).toBe(404);expect((await list(req('/api/operator/reports',2))).status).toBe(404);
    expect((await read(req('/private',2),params())).status).toBe(404);
    expect((await context(req('/private'),{params:Promise.resolve({id:offerId})})).status).toBe(404);
    expect((await photo(req('/private',2),{params:Promise.resolve({id:receipt,photoId,variant:'thumb'})})).status).toBe(404);
  }finally{process.env.BUYER_REPORTS_LOCAL_TESTING='1';}
});
