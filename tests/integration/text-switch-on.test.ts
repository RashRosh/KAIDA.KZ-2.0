import { removeCard } from '../../src/modules/moderation/application/operator-post-check';
import { CardRemovedByOperatorError } from '../../src/modules/moderation/contracts/moderation.contract';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createBatchSellerChangeSet } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { OfferChangedError } from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import {
  applySellerTextInput, getSellerTextSubmission, proposeTextPrices, proposeTextAvailability,
} from '../../src/modules/seller-text-input/application/apply-seller-text-input';
import {
  type HeldLineView, TextInputReviewUnavailableError, TextPriceChangedError, TextPriceRejectedError,
} from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase, testDatabaseUrl } from './database';

// text-price-update (docs/slices/text-price-update/SLICE_CONTRACT.md §7, §9): one line → one card, server-side
// admissibility, idempotency per set of changes, stale data before proposal and at confirm, rollback. Fake parser.
const T0 = new Date('2026-10-27T08:00:00.000Z');
const A = { id: '50000000-0000-4000-8000-000000009701', phoneE164: '+77000009701' };
const B = { id: '50000000-0000-4000-8000-000000009702', phoneE164: '+77000009702' };
const env = { SELLER_TEXT_INPUT: 'fake' };

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];
const originalDatabaseUrl = process.env.DATABASE_URL;
const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';

async function cleanup(userId: string) {
  await pool.query('DELETE FROM offer_card_removals WHERE seller_id IN ('+bySeller+')', [userId]);
  await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [userId]);
  await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM seller_text_submissions WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

async function seller(u: typeof A, points: string[]) {
  await cleanup(u.id);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, $3)', [u.id, u.phoneE164, T0]);
  await setupSeller(u.id, { seller: { displayName: 'Price' }, location: { name: points[0]!, type: 'shop', addressText: 'Almaty' } }, { database: db });
  const sellerId = (await pool.query(bySeller, [u.id])).rows[0].id as string;
  for (const name of points.slice(1)) await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, $2, 'shop', 'Almaty')", [sellerId, name]);
  const rows = (await pool.query('SELECT id, name FROM locations WHERE seller_id=$1', [sellerId])).rows as { id: string; name: string }[];
  return { sellerId, points: Object.fromEntries(rows.map((r) => [r.name, r.id])) as Record<string, string> };
}

async function offer(sellerId: string, locationId: string, title: string, pack: [string, 'g' | 'kg'], price: string, extra: { status?: string; cardId?: string } = {}) {
  return (await pool.query(`INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency,
      price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'KZT', 'package', $7, $8, $9, $10) RETURNING id`,
  [sellerId, locationId, title, offerTitleSearchText(title), extra.cardId ?? randomUUID(), price, pack[0], pack[1], extra.status ?? 'active', T0])).rows[0].id as string;
}

const row = async (id: string) => (await pool.query('SELECT price_amount, revision, status, last_confirmed_at FROM offers WHERE id=$1', [id])).rows[0] as
  { price_amount: string; revision: number; status: string; last_confirmed_at: Date };
const changeSets = async (userId: string) => Number((await pool.query(`SELECT count(*)::int AS n FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [userId])).rows[0].n);
const pick = (line: HeldLineView, offerId: string, price: string) => ({
  index: line.index, shown: line.candidates.map((c) => ({ offerId: c.offerId, revision: c.revision })), offerId, price,
});

let seed: { sellerId: string; a: string; b: string; pelmA: string; pelmB: string; prosto: string; domash: string; syr: string };

beforeAll(async () => {
  ({ db, pool } = await connectTestDatabase());
  process.env.DATABASE_URL = testDatabaseUrl();
});

beforeEach(async () => {
  await cleanup(B.id);
  const { sellerId, points } = await seller(A, ['А', 'Б']);
  const card = randomUUID();
  seed = {
    sellerId, a: points['А']!, b: points['Б']!,
    pelmA: await offer(sellerId, points['А']!, 'Пельмени', ['500', 'g'], '1400', { cardId: card }),
    pelmB: await offer(sellerId, points['Б']!, 'Пельмени', ['500', 'g'], '1400', { cardId: card }),
    prosto: await offer(sellerId, points['А']!, 'Сметана Простоквашино', ['400', 'g'], '1200'),
    domash: await offer(sellerId, points['А']!, 'Сметана Домашняя', ['400', 'g'], '1300'),
    syr: await offer(sellerId, points['А']!, 'Сыр', ['400', 'g'], '2900', { status: 'inactive' }),
  };
});

afterAll(async () => {
  for (const u of [A, B]) await cleanup(u.id);
  await pool.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

const submit = (text: string) => applySellerTextInput(A.id, text, { database: db, env, locationId: seed.a });


const returnPick = (line: HeldLineView, id: string, price: string | null) => ({ ...pick(line, id, price ?? ''), price, action: 'activate_offer' as const });
describe('text return: atomic selected-point management', () => {
  it.each(['2900', '3000'])('returns at %s only after confirmation, idempotent across tabs and reload', async (price) => {
    const card = (await pool.query('SELECT card_id FROM offers WHERE id=$1', [seed.syr])).rows[0].card_id;
    const elsewhere = await offer(seed.sellerId, seed.b, 'Сыр', ['400','g'], '2900', {status:'inactive',cardId:card});
    const result = await submit('Сыр '+price+' за упаковку 400 г.');
    const line=result.held[0]!; expect(line.returnPreselect).toBe(seed.syr);
    const body={lines:[returnPick(line,seed.syr,price)]};
    const responses=await Promise.all([0,1].map(()=>proposeTextPrices(A.id,result.inputId,body,{database:db})));
    expect(new Set(responses.map(r=>r.changeSetId)).size).toBe(1);
    expect((await row(seed.syr)).status).toBe('inactive');
    const restored=(await getSellerTextSubmission(A.id,result.inputId,{database:db}))!;
    expect(restored.held[0]!.priceProposal?.state).toBe('pending');
    await confirmSellerChangeSet(A.id,responses[0]!.changeSetId,{database:db});
    const applied=await row(seed.syr); expect([applied.price_amount,applied.status,applied.last_confirmed_at>T0]).toEqual([price,'active',true]);
    expect(await row(elsewhere)).toMatchObject({price_amount:'2900',status:'inactive',revision:1});
    const again=await proposeTextPrices(A.id,result.inputId,body,{database:db});expect(again.state).toBe('applied');
    expect((await row(seed.syr)).revision).toBe(applied.revision);
  });
  it('no text price uses the shown card price; fixture only', async()=>{
    const id=await offer(seed.sellerId,seed.a,'Кефир',['1','kg'],'600',{status:'inactive'});
    await pool.query("UPDATE offers SET pack_unit='l' WHERE id=$1",[id]);
    const result=await submit('[fixture:switch-on-no-price]');expect(result.held[0]!.returnPreselect).toBe(id);
    const proposal=await proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,id,null)]},{database:db});
    const view = await import('../../src/modules/seller-input/infrastructure/seller-change-sets.repository').then(m=>m.findChangeSetViewByIdAndSeller(db,proposal.changeSetId,seed.sellerId));
    expect(view!.items[0]!.priceFromCard).toBe(true);
    await confirmSellerChangeSet(A.id,proposal.changeSetId,{database:db});expect(await row(id)).toMatchObject({status:'active',price_amount:'600'});
  });
  it('mixed list applies return and active price together, contradiction only blocks affected cards', async()=>{
    const result=await submit('Сыр 3000 за упаковку 400 г. Пельмени 1500 за упаковку 500 г. Сметана нет. Сметана 1400 за упаковку 400 г. Картошка 250 за кг.');
    expect(result.drafts).toHaveLength(1);expect(result.held[2]!.candidates.every(c=>c.blocked?.kind==='contradiction')).toBe(true);
    expect(result.availability[0]!.candidates.every(c=>!c.selectable)).toBe(true);
    await expect(proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000'),pick(result.held[2]!,seed.prosto,'1400')]},{database:db})).rejects.toBeInstanceOf(TextPriceChangedError);
    expect(await changeSets(A.id)).toBe(0);
    const valid=await proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000'),pick(result.held[1]!,seed.pelmA,'1500')]},{database:db});
    await confirmSellerChangeSet(A.id,valid.changeSetId,{database:db});expect(await row(seed.syr)).toMatchObject({status:'active',price_amount:'3000'});expect((await row(seed.pelmA)).price_amount).toBe('1500');
  });
  it('pending return blocks a different-price proposal for the same card; other candidates remain available', async()=>{
    const result=await submit('Сыр 3000 за упаковку 400 г.');
    const first=await proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000')]},{database:db});
    const restored=(await getSellerTextSubmission(A.id,result.inputId,{database:db}))!;expect(restored.held[0]!.candidates[0]!.blocked).toMatchObject({kind:'pending',changeSetId:first.changeSetId});
    await expect(proposeTextPrices(A.id,result.inputId,{lines:[pick(result.held[0]!,seed.syr,'3000')]},{database:db})).rejects.toBeInstanceOf(TextPriceChangedError);
    expect(await changeSets(A.id)).toBe(1);
  });
  it('stale confirmation refuses the whole mixed proposal and never reselects the return', async()=>{
    const result=await submit('Сыр 3000 за упаковку 400 г. Пельмени 1500 за упаковку 500 г.');
    const proposal=await proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000'),pick(result.held[1]!,seed.pelmA,'1500')]},{database:db});
    await pool.query('UPDATE offers SET revision=revision+1 WHERE id=$1',[seed.syr]);
    await expect(confirmSellerChangeSet(A.id,proposal.changeSetId,{database:db})).rejects.toBeInstanceOf(OfferChangedError);
    expect(await row(seed.syr)).toMatchObject({status:'inactive',price_amount:'2900'});expect((await row(seed.pelmA)).price_amount).toBe('1400');
    const restored=(await getSellerTextSubmission(A.id,result.inputId,{database:db}))!;expect(restored.held[0]!.returnPreselect).toBeNull();expect(restored.held[1]!.pricePreselect).toBeNull();
  });
  it('unit mismatch, forged price, foreign review and expired review refuse with zero persistence',async()=>{
    const result=await submit('Сыр 3000 за кг.');expect(result.held[0]!.candidates[0]!.returnEligible).toBe(false);
    await expect(proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000')]},{database:db})).rejects.toBeInstanceOf(TextPriceChangedError);
    const valid=await submit('Сыр 3000 за упаковку 400 г.');const body={lines:[returnPick(valid.held[0]!,seed.syr,'3000')]};
    await expect(proposeTextPrices(B.id,valid.inputId,body,{database:db})).rejects.toBeInstanceOf(TextInputReviewUnavailableError);
    await expect(proposeTextPrices(A.id,valid.inputId,{lines:[returnPick(valid.held[0]!,seed.syr,'1')]},{database:db})).rejects.toBeInstanceOf(TextPriceRejectedError);
    await expect(proposeTextPrices(A.id,valid.inputId,body,{database:db,clock:()=>new Date(Date.now()+25*3600e3)})).rejects.toBeInstanceOf(TextInputReviewUnavailableError);expect(await changeSets(A.id)).toBe(0);
  });
});

describe('activation regressions and defensive cross-section gate',()=>{
 it('showcase and batch activation keep price/comment; numeric equality does not change price-own',async()=>{
   await pool.query("UPDATE offers SET seller_comment='kept', price_own=true WHERE id=$1",[seed.syr]);
   const single=await createOfferManagementChangeSet(A.id,seed.syr,{action:'activate_offer'},{database:db});
   await pool.query("UPDATE seller_change_items SET price_amount='2900.00' WHERE change_set_id=$1",[single.id]);
   await confirmSellerChangeSet(A.id,single.id,{database:db});
   expect((await pool.query('SELECT price_amount,seller_comment,price_own FROM offers WHERE id=$1',[seed.syr])).rows[0]).toEqual({price_amount:'2900',seller_comment:'kept',price_own:true});
   await pool.query("UPDATE offers SET status='inactive', revision=revision+1 WHERE id=ANY($1::uuid[])",[[seed.syr,seed.pelmA]]);
   const batch=await createBatchSellerChangeSet(A.id,{items:[{action:'activate_offer',offerId:seed.syr},{action:'activate_offer',offerId:seed.pelmA}]},{database:db});
   await confirmSellerChangeSet(A.id,batch.id,{database:db});expect(await row(seed.syr)).toMatchObject({status:'active',price_amount:'2900'});expect(await row(seed.pelmA)).toMatchObject({status:'active',price_amount:'1400'});
 });
 it('incompatible cross-section requests are refused even with synthetic inconsistent stored rows',async()=>{
   const result=await submit('Сыр 3000 за упаковку 400 г.');
   const proposal=await proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000')]},{database:db});
   // This state cannot be produced by the review UI: exercise the defensive server gate explicitly.
   await pool.query(`UPDATE seller_text_submissions SET result=jsonb_set(result,'{unavailable}',$2::jsonb) WHERE request_id=$1`,[result.inputId,JSON.stringify([{label:'Сыр',sourceQuote:'Сыр нет',variant:{state:'none'}}])]);
   const restored=(await getSellerTextSubmission(A.id,result.inputId,{database:db}))!;
   expect(restored.availability[0]!.candidates.every(c=>!c.selectable)).toBe(true);
   await expect(proposeTextAvailability(A.id,result.inputId,{statements:[{index:0,shown:restored.availability[0]!.candidates.map(c=>({offerId:c.offerId,revision:c.revision})),selected:[seed.syr]}]},{database:db})).rejects.toThrow();
   expect(await changeSets(A.id)).toBe(1);expect(proposal.created).toBe(true);
 });
 it('an injected item-write failure rolls back the complete mixed proposal',async()=>{
   const result=await submit('Сыр 3000 за упаковку 400 г. Пельмени 1500 за упаковку 500 г.');
   await pool.query(`CREATE FUNCTION switch_on_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.seller_comment = 'switch-on-fail' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$`);
   await pool.query('CREATE TRIGGER switch_on_test_fail BEFORE INSERT ON seller_change_items FOR EACH ROW EXECUTE FUNCTION switch_on_test_fail()');
   try{
     await pool.query("UPDATE offers SET seller_comment='switch-on-fail' WHERE id=$1",[seed.syr]);
     await expect(proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000'),pick(result.held[1]!,seed.pelmA,'1500')]},{database:db})).rejects.toThrow();
     expect(await changeSets(A.id)).toBe(0);expect(await row(seed.syr)).toMatchObject({status:'inactive',price_amount:'2900'});
   }finally{await pool.query('DROP TRIGGER switch_on_test_fail ON seller_change_items');await pool.query('DROP FUNCTION switch_on_test_fail()');}
 });
 it('a changed card before proposal stays unselected on server recovery, including reload',async()=>{
   const result=await submit('Сыр 3000 за упаковку 400 г.');await pool.query('UPDATE offers SET revision=revision+1 WHERE id=$1',[seed.syr]);
   await expect(proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000')]},{database:db})).rejects.toBeInstanceOf(TextPriceChangedError);
   for(let i=0;i<2;i++)expect((await getSellerTextSubmission(A.id,result.inputId,{database:db}))!.held[0]!.returnPreselect).toBeNull();
 });
});

describe('operator and ambiguous returns',()=>{
 it('operator-removed card cannot be returned; a proposal made before removal cannot confirm',async()=>{
   const result=await submit('Сыр 3000 за упаковку 400 г.');const proposed=await proposeTextPrices(A.id,result.inputId,{lines:[returnPick(result.held[0]!,seed.syr,'3000')]},{database:db});
   const card=(await pool.query('SELECT card_id FROM offers WHERE id=$1',[seed.syr])).rows[0].card_id;
   await removeCard(A.id,card,{reason:'other',comment:null},{database:db});
   await expect(confirmSellerChangeSet(A.id,proposed.changeSetId,{database:db})).rejects.toSatisfy((e:unknown)=>e instanceof OfferChangedError || e instanceof CardRemovedByOperatorError);
   const fresh=await submit('Сыр 3000 за упаковку 400 г.');expect(fresh.held[0]!.candidates[0]!.returnEligible).toBe(false);
   await expect(proposeTextPrices(A.id,fresh.inputId,{lines:[returnPick(fresh.held[0]!,seed.syr,'3000')]},{database:db})).rejects.toBeInstanceOf(TextPriceChangedError);expect((await row(seed.syr)).status).toBe('inactive');
 });
 it('ambiguous cards require manual selection and the server refuses two cards for one line',async()=>{
   await pool.query("UPDATE offers SET status='inactive' WHERE id=ANY($1::uuid[])",[[seed.prosto,seed.domash]]);
   const result=await submit('Сметана 1400 за упаковку 400 г.');const line=result.held[0]!;expect(line.returnPreselect).toBeNull();
   await expect(proposeTextPrices(A.id,result.inputId,{lines:[returnPick(line,seed.prosto,'1400'),returnPick(line,seed.domash,'1400')]},{database:db})).rejects.toBeInstanceOf(TextPriceRejectedError);expect(await changeSets(A.id)).toBe(0);
 });
});
