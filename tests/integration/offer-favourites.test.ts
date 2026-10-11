import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../../src/app/api/favourites/route';
import { listFavourites, putFavourite, removeFavourite } from '../../src/modules/favourites/application/manage-favourites';
import { FavouriteUnavailable } from '../../src/modules/favourites/contracts/favourites.contract';
import { getBuyerOffer } from '../../src/modules/search/application/get-buyer-offer';
import { readPhoto } from '../../src/modules/media/application/read-photo';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';
import { connectTestDatabase } from './database';

const id = (n: number) => `fa280000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
const a=id(1),b=id(2),owner=id(3),seller=id(4),point=id(5),point2=id(6),offer=id(7),offer2=id(8),card=id(9),photo=id(10);
let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
let previous: string | undefined;
const now=new Date(),clock=()=>now;
function req(method: 'GET'|'PUT'|'DELETE',body?:unknown,token='fav-a',query='') {
  return new NextRequest('http://localhost/api/favourites'+query,{method,headers:{cookie:`${SESSION_COOKIE_NAME}=${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function cleanup(){const p=connection.pool;
  await p.query('DELETE FROM buyer_offer_favourites WHERE user_id=ANY($1::uuid[])',[[a,b,owner]]);
  await p.query('DELETE FROM offer_card_removals WHERE card_id=$1',[card]);
  await p.query('DELETE FROM offer_photos WHERE offer_id=ANY($1::uuid[])',[[offer,offer2]]);
  await p.query('DELETE FROM offers WHERE seller_id=$1',[seller]);await p.query('DELETE FROM locations WHERE seller_id=$1',[seller]);await p.query('DELETE FROM sellers WHERE id=$1',[seller]);
  await p.query('DELETE FROM photos WHERE id=$1',[photo]);await p.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[[a,b,owner]]);await p.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[a,b,owner]]);
}
beforeAll(async()=>{connection=await connectTestDatabase();previous=process.env.DATABASE_URL;process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;});
afterAll(async()=>{await cleanup();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await connection.pool.end();});
beforeEach(async()=>{await cleanup();const p=connection.pool;
  for(const [user,phone,token] of [[a,'+77000280101','fav-a'],[b,'+77000280102','fav-b'],[owner,'+77000280103','fav-seller']]){
    await p.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,now())',[user,phone]);
    await p.query("INSERT INTO auth_sessions(id,user_id,token_digest,created_at,expires_at) VALUES(gen_random_uuid(),$1,$2,now(),now()+interval '1 day')",[user,digestSessionToken(token!)]);
  }
  await p.query('INSERT INTO sellers(id,owner_user_id,display_name) VALUES($1,$2,$3)',[seller,owner,'Favourites seller']);
  for(const location of [point,point2])await p.query("INSERT INTO locations(id,seller_id,name,type,address_text) VALUES($1,$2,'Favourites point','shop','Private address never in unavailable')",[location,seller]);
  for(const [oid,lid] of [[offer,point],[offer2,point2]])await p.query("INSERT INTO offers(id,card_id,title,title_search,seller_id,location_id,price_amount,price_currency,price_unit_code,seller_comment,status,last_confirmed_at) VALUES($1,$2,'Saved honey','saved honey',$3,$4,1200,'KZT','kg','Private comment never in unavailable','active',$5)",[oid,card,seller,lid,now]);
  await p.query('INSERT INTO photos(id,owner_user_id,width,height) VALUES($1,$2,800,600)',[photo,owner]);await p.query('INSERT INTO offer_photos(offer_id,photo_id,position) VALUES($1,$2,0)',[offer,photo]);
});
const deps=()=>({database:connection.db,clock});
const media=()=>readPhoto(photo,'thumb',null,{database:connection.db,storage:{async write(){},async read(){return Buffer.from('test');}}});

describe('Offer favourites: real PostgreSQL ownership, transitions and concurrency',()=>{
  it('requires session; rejects user/point substitution, extra body/query and cross-origin writes',async()=>{
    expect((await GET(req('GET',undefined,''))).status).toBe(401);
    expect((await PUT(req('PUT',{offerId:offer,locationId:point,userId:b}))).status).toBe(400);
    expect((await PUT(req('PUT',{offerId:offer,locationId:point2}))).status).toBe(409);
    expect((await GET(req('GET',undefined,'fav-a','?userId='+b))).status).toBe(400);
    const r=req('PUT',{offerId:offer,locationId:point});r.headers.set('origin','https://foreign.invalid');expect((await PUT(r)).status).toBe(403);
    expect((await connection.pool.query('SELECT * FROM buyer_offer_favourites WHERE user_id=$1',[a])).rows).toHaveLength(0);
    const valid=req('PUT',{offerId:offer,locationId:point});valid.headers.set('host','127.0.0.1:3100');valid.headers.set('origin','http://127.0.0.1:3100');expect((await PUT(valid)).status).toBe(204);
  });
  it('isolates owner lists/deletes, no-store, preserves exact two-point identity and current price',async()=>{
    await putFavourite(a,offer,point,deps());await putFavourite(a,offer2,point2,deps());
    const r=await GET(req('GET'));expect(r.headers.get('cache-control')).toContain('no-store');const data=await r.json();expect(data.count).toBe(2);
    expect((await (await GET(req('GET',undefined,'fav-b'))).json()).count).toBe(0);
    await DELETE(req('DELETE',{id:data.favourites[0].id},'fav-b'));expect((await listFavourites(a,deps())).length).toBe(2);
    await connection.pool.query('UPDATE offers SET price_amount=1750 WHERE id=$1',[offer]);const row=(await listFavourites(a,deps())).find(f=>f.offerId===offer)!;
    expect(row.state).toBe('available');if(row.state==='available')expect(row.offer.price.amount).toBe('1750');
    const unchanged=await connection.pool.query('SELECT * FROM buyer_interests WHERE user_id=$1',[a]);expect(unchanged.rows).toEqual([]);
  });
  it('expiry exposes only approved metadata/current authorized cover; switched-off strips media and restores',async()=>{
    await putFavourite(a,offer,point,deps());await connection.pool.query("UPDATE offers SET last_confirmed_at=$2::timestamptz-interval '168 hours' WHERE id=$1",[offer,now]);
    const expired=(await listFavourites(a,deps()))[0]!;expect(expired.state).toBe('unavailable');
    expect(Object.keys(expired).sort()).toEqual(['id','offerId','locationId','savedAt','state','title','sellerName','pointName','coverPhotoId'].sort());
    if(expired.state==='unavailable')expect(expired.coverPhotoId).toBe(photo);
    expect(await getBuyerOffer(offer,deps())).toBeNull();expect((await media()).status).toBe('ok');
    await connection.pool.query("UPDATE offers SET status='inactive' WHERE id=$1",[offer]);const off=(await listFavourites(a,deps()))[0]!;
    expect(off.state).toBe('unavailable');expect(JSON.stringify(off)).not.toContain(photo);expect((await media()).status).toBe('not_found');
    await connection.pool.query("UPDATE offers SET status='active',last_confirmed_at=$2 WHERE id=$1",[offer,now]);expect((await listFavourites(a,deps()))[0]!.state).toBe('available');
    await connection.pool.query("UPDATE offers SET last_confirmed_at=$2::timestamptz-interval '15 days' WHERE id=$1",[offer,now]);expect((await listFavourites(a,deps()))[0]!.state).toBe('unavailable');
    await connection.pool.query('DELETE FROM offer_photos WHERE offer_id=$1',[offer]);expect((await listFavourites(a,deps()))[0]).not.toHaveProperty('coverPhotoId');expect((await media()).status).toBe('not_found');
  });
  it('excludes moderation/deletion and changed points, retaining only removable references',async()=>{
    await putFavourite(a,offer,point,deps());const saved=(await listFavourites(a,deps()))[0]!;
    await connection.pool.query("INSERT INTO offer_card_removals(card_id,seller_id,reason,removed_by_user_id) VALUES($1,$2,'other',$3)",[card,seller,owner]);
    expect(await listFavourites(a,deps())).toEqual([]);expect((await (await GET(req('GET'))).json()).count).toBe(0);expect((await media()).status).toBe('not_found');
    await connection.pool.query('DELETE FROM offer_card_removals WHERE card_id=$1',[card]);await connection.pool.query('UPDATE offers SET location_id=$2 WHERE id=$1',[offer,point2]);expect(await listFavourites(a,deps())).toEqual([]);
    await connection.pool.query('DELETE FROM offer_photos WHERE offer_id=$1',[offer]);
    await connection.pool.query('DELETE FROM offers WHERE id=$1',[offer]);expect(await listFavourites(a,deps())).toEqual([]);
    expect((await connection.pool.query('SELECT * FROM buyer_offer_favourites WHERE user_id=$1',[a])).rows).toHaveLength(1);
    await removeFavourite(a,saved.id,deps());await removeFavourite(a,saved.id,deps());expect((await connection.pool.query('SELECT * FROM buyer_offer_favourites WHERE user_id=$1',[a])).rows).toHaveLength(0);
  });
  it('concurrent repeated adds/removes are idempotent with stable savedAt and no duplicate',async()=>{
    await Promise.all(Array.from({length:12},()=>putFavourite(a,offer,point,deps())));let rows=await listFavourites(a,deps());expect(rows).toHaveLength(1);const ref=rows[0]!;
    await putFavourite(a,offer,point,{...deps(),clock:()=>new Date(now.getTime()+1000)});expect((await listFavourites(a,deps()))[0]!.savedAt).toBe(ref.savedAt);
    await Promise.all(Array.from({length:12},()=>removeFavourite(a,ref.id,deps())));expect(await listFavourites(a,deps())).toEqual([]);
    await Promise.all([putFavourite(a,offer,point,deps()),removeFavourite(a,ref.id,deps()),putFavourite(a,offer,point,deps())]);rows=await listFavourites(a,deps());expect(rows).toHaveLength(1);
  });
  it('rechecks eligibility after a concurrent removal holds the existing card lock',async()=>{
    const client=await connection.pool.connect();try{
      await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`moderation-card:${card}`]);
      await client.query("INSERT INTO offer_card_removals(card_id,seller_id,reason,removed_by_user_id) VALUES($1,$2,'other',$3)",[card,seller,owner]);
      const result=putFavourite(a,offer,point,deps()).then(()=>false,e=>e instanceof FavouriteUnavailable);
      await client.query('COMMIT');expect(await result).toBe(true);expect(await listFavourites(a,deps())).toEqual([]);
    }finally{await client.query('ROLLBACK');client.release();}
  });
});
