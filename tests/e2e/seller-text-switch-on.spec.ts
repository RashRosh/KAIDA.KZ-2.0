import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { offerEditor, publishButton } from './offer-editor-helpers';
import { testDatabaseUrl } from '../integration/database';

// text-price-update (docs/slices/text-price-update/SLICE_CONTRACT.md §9) on the default server (fake parser), mobile RU:
// a clear match is pre-selected → «Обновить цены» → existing confirm with point, pack, unit and old → new price →
// applied only at the selected point; a double tap and a reload reopen the same pending proposal.
function phoneFor(slot: number) {
  // Band 4997: free among the E2E phone bands.
  return `+7700004997${slot}`;
}

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function cleanup(phone: string) {
  await withPool(async (pool) => {
    const bySeller = 'SELECT s.id FROM sellers s JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1';
    await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [phone]);
    await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM seller_text_submissions WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query('DELETE FROM sellers WHERE owner_user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

// «Точка А» and «Точка Б» share one Пельмени card (500 г, 1 400 ₸); «А» also has two Сметана cards.
async function seed(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  expect((await page.request.post('/api/seller/setup', {
    data: { seller: { displayName: 'Продавец' }, location: { name: 'Точка А', type: 'shop', addressText: 'Алматы' } },
  })).ok()).toBe(true);
  return withPool(async (pool) => {
    const { seller_id: sellerId, id: pointA } = (await pool.query(
      'SELECT l.id, l.seller_id FROM locations l JOIN sellers s ON s.id = l.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
    )).rows[0] as { id: string; seller_id: string };
    const pointB = (await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, 'Точка Б', 'shop', 'Алматы') RETURNING id", [sellerId])).rows[0].id as string;
    const card = (await pool.query('SELECT gen_random_uuid() AS id')).rows[0].id as string;
    const offer = async (location: string, title: string, search: string, pack: [string, string], price: string, cardId: string | null = null) => (await pool.query(
      `INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
       VALUES ($1, $2, $3, $4, COALESCE($9::uuid, gen_random_uuid()), $5, 'KZT', 'package', $6, $7, $8, now()) RETURNING id`,
      [sellerId, location, title, search, price, pack[0], pack[1], 'active', cardId],
    )).rows[0].id as string;
    return {
      pointA, pointB,
      pelmA: await offer(pointA, 'Пельмени', 'пельмени', ['500', 'g'], '1400', card),
      pelmB: await offer(pointB, 'Пельмени', 'пельмени', ['500', 'g'], '1400', card),
      prosto: await offer(pointA, 'Сметана Простоквашино', 'сметана простоквашино', ['400', 'g'], '1200'),
      domash: await offer(pointA, 'Сметана Домашняя', 'сметана домашняя', ['400', 'g'], '1300'),
    };
  });
}

const priceOf = (id: string) => withPool(async (pool) => (await pool.query('SELECT price_amount FROM offers WHERE id=$1', [id])).rows[0].price_amount as string);
const changeSets = (phone: string) => withPool(async (pool) => Number((await pool.query(
  'SELECT count(*)::int AS n FROM seller_change_sets cs JOIN sellers s ON s.id = cs.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
)).rows[0].n));

async function submitList(page: Page, pointA: string, text: string) {
  await page.goto(`/seller/text-input?point=${pointA}`);
  await page.getByLabel('Список товаров').fill(text);
  await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
  await expect(page).toHaveURL(/text-input\/review\?input=/);
  await expect(page.getByTestId('held-block')).toBeVisible();
}


async function returns(page: Page, phone: string) {
 const ids=await seed(page,phone);
 return withPool(async pool=>{
   const card=(await pool.query('SELECT gen_random_uuid() as id')).rows[0].id;
   const insert=async(point:string,title:string,amount:string,unit:string,price:string,cardId:string|null=null)=>(await pool.query(`INSERT INTO offers(seller_id,location_id,title,title_search,card_id,price_amount,price_currency,price_unit_code,pack_amount,pack_unit,status,last_confirmed_at) SELECT seller_id,$2,$3,lower($3),coalesce($7::uuid,gen_random_uuid()),$6,'KZT','package',$4,$5,'inactive',now() FROM locations WHERE id=$1 RETURNING id,card_id`,[ids.pointA,point,title,amount,unit,price,cardId])).rows[0] as {id:string;card_id:string};
   const syr=await insert(ids.pointA,'Сыр','400','g','2900');const tvorog=await insert(ids.pointA,'Творог','500','g','1100',card);const tvorogB=await insert(ids.pointB,'Творог','500','g','1100',card);const kefir=await insert(ids.pointA,'Кефир','1','l','600');
   return {...ids,syr,tvorog,tvorogB,kefir};
 });
}
test.describe('text return through confirmation',()=>{
 test.skip(({isMobile})=>!isMobile,'mobile RU');
 test('mixed list, pending reload, selected point, no-price return',async({page})=>{
  const ids=await returns(page,phoneFor(1));
  await submitList(page,ids.pointA,'Сыр 2900 за упаковку 400 г. Творог 1200 за упаковку 500 г. Пельмени 1500 за упаковку 500 г. Сметана нет. Сметана 1400 за упаковку 400 г. Картошка 250 за кг.');
  await expect(page.getByTestId('price-submit')).toHaveText('Применить изменения · 3');
  await expect(page.getByTestId('availability-0')).toContainText('и «нет», и предложение');
  await expect(page.getByTestId('availability-0').getByRole('checkbox')).toHaveCount(0);
  await page.getByTestId('price-submit').dblclick();await expect(page).toHaveURL(/change-sets/);expect(await changeSets(phoneFor(1))).toBe(1);
  await expect(page.getByText('Выключено → На витрине')).toHaveCount(2);await expect(page.getByText('1 100 ₸ → 1 200 ₸')).toBeVisible();
  await page.getByRole('link',{name:'Отмена',exact:true}).click();await page.reload();await expect(page.getByTestId('price-pending')).toBeVisible();
  await page.getByTestId('price-pending').getByRole('link').click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
  await expect(page.getByText('На витрине: 2 900 ₸')).toBeVisible();expect([await priceOf(ids.tvorog.id),await priceOf(ids.tvorogB.id)]).toEqual(['1200','1100']);
  await submitList(page,ids.pointA,'[fixture:switch-on-no-price]');await expect(page.getByTestId('price-submit')).toHaveText('Вернуть на витрину · 1');await expect(page.getByTestId('held-block')).toContainText('по цене карточки');
  await page.getByTestId('price-submit').click();await expect(page.getByText('600 ₸ · по цене карточки',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await expect(page.getByText('На витрине: 600 ₸')).toBeVisible();
 });
 test('second tab ordinary editor makes the proposal stale, cancel and reload never reselect',async({page,context})=>{
  const ids=await returns(page,phoneFor(2));await submitList(page,ids.pointA,'Сыр 3000 за упаковку 400 г.');
  await page.getByTestId('price-submit').click();await expect(page).toHaveURL(/change-sets/);
  const second=await context.newPage();await second.goto('/seller?edit='+ids.syr.card_id);const editor=offerEditor(second);await editor.getByRole('textbox',{name:'Цена',exact:true}).fill('2950');await editor.getByRole('button',{name:'Проверить и сохранить'}).click();await second.getByRole('button',{name:publishButton}).click();
  await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await page.getByRole('button',{name:'Отмена',exact:true}).click();await page.reload();
  await expect(page.getByTestId('held-0').getByRole('radio')).toHaveAttribute('aria-checked','false');await expect(page.getByTestId('price-submit')).toBeDisabled();expect(await priceOf(ids.syr.id)).toBe('2950');await second.close();
 });
});
