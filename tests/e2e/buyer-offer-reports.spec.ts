import { expect,test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';
import { returningVisitorState } from './browser-state';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';

test('buyer draft survives Back/login; operator disposition keeps buyer text private and stays closed after return',async({page,browser},info)=>{
  test.skip(info.project.name!=='mobile','Approved mobile RU acceptance boundary');
  const connection=createDatabase(testDatabaseUrl()),pool=connection.pool,db=connection.db;
  const sellerId=randomUUID(),sellerPhone='+77000991301',buyerPhone='+77000991302',operatorPhone='+77000991303';
  let cardId:string|undefined;
  const operator=await browser.newContext({baseURL:'http://127.0.0.1:3100',storageState:returningVisitorState,viewport:{width:390,height:844}});
  const op=await operator.newPage();
  try {
    const fixturePhones=[sellerPhone,buyerPhone,operatorPhone];
    await pool.query('DELETE FROM operator_feed_marks WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))',[fixturePhones]);
    await pool.query('DELETE FROM users WHERE phone_e164=ANY($1::text[])',[fixturePhones]);
    await pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,now())',[sellerId,sellerPhone]);
    const seller=await setupSeller(sellerId,{seller:{displayName:'Синтетический продавец жалоб'},location:{name:'Точка жалоб E2E',type:'shop',addressText:'Синтетический адрес'}},{database:db});
    const set=await createCardChangeSet(sellerId,cardCreateBodySchema.parse({title:'Абрикосы отчётэ2е',productId:null,price:'1200',unit:{code:'package'},pack:{amount:'500',unit:'g'},sellerComment:'Синтетический товар',photoIds:[],points:[{locationId:seller.locations[0]!.id}]}),{database:db});
    const confirmed=await confirmSellerChangeSet(sellerId,set.id,{database:db});const offerId=confirmed.items[0]!.resultOffer!.id;
    cardId=(await pool.query('SELECT card_id FROM offers WHERE id=$1',[offerId])).rows[0].card_id;
    await page.goto(`/offers/${offerId}`);await page.getByRole('button',{name:'Пожаловаться на карточку'}).click();
    await page.getByRole('button',{name:'Цена не совпадает',exact:true}).click();
    await expect(page.getByLabel('Комментарий · необязательно')).toBeVisible();await expect(page.getByRole('button',{name:'Далее',exact:true})).toHaveCount(0);
    const privateText='PRIVATE покупатель: персональные сведения';await page.getByLabel('Комментарий · необязательно').fill(privateText);
    await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('button',{name:'Неверное описание',exact:true}).click();
    await expect(page.getByLabel('Комментарий · необязательно')).toHaveValue(privateText);
    expect((await pool.query('SELECT count(*)::int n FROM offer_reports WHERE card_id=$1',[cardId])).rows[0].n).toBe(0);
    await page.getByRole('button',{name:'Отправить жалобу',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    await dialog.locator('#auth-phone').fill(buyerPhone);
    const issued=page.waitForResponse(r=>r.url().endsWith('/api/auth/otp/request')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Получить код'}).click();
    const challenge=await(await issued).json();await dialog.locator('#auth-otp').fill(challenge.delivery.code);await dialog.getByRole('button',{name:'Войти',exact:true}).click();await expect(dialog).toBeHidden();
    await expect(page.getByLabel('Комментарий · необязательно')).toHaveValue(privateText);
    expect((await pool.query('SELECT count(*)::int n FROM offer_reports WHERE card_id=$1',[cardId])).rows[0].n).toBe(0);
    await page.getByRole('button',{name:'Отправить жалобу',exact:true}).click();await expect(page.getByText('Жалоба отправлена',{exact:true})).toBeVisible();await expect(page.getByText('Спасибо, мы проверим предложение.',{exact:true})).toBeVisible();
    await info.attach('buyer-acknowledgement',{body:await page.screenshot(),contentType:'image/png'});
    const issuedOp=await(await op.request.post('/api/auth/otp/request',{data:{phone:operatorPhone}})).json();expect((await op.request.post('/api/auth/otp/verify',{data:{challengeId:issuedOp.challenge.id,code:issuedOp.delivery.code}})).ok()).toBe(true);
    await op.goto('/operator/reports');await op.getByRole('article').filter({hasText:'Абрикосы отчётэ2е'}).getByRole('button',{name:'Рассмотреть'}).click();
    await expect(op.getByRole('region',{name:'Сообщение покупателя'})).toContainText(privateText);
    await expect(op.getByRole('region',{name:'При отправке'})).toContainText('1 200');await expect(op.getByRole('region',{name:'Сейчас'})).toContainText('1 200');
    await op.getByRole('button',{name:'Снять карточку',exact:true}).click();await op.getByRole('radio',{name:'Другое',exact:true}).check();
    await op.getByLabel('Отдельный комментарий продавцу · необязательно').fill('Исправьте описание товара.');
    await op.getByRole('button',{name:'Снять карточку и закрыть жалобу'}).click();await expect(op.getByRole('region',{name:'Исторический итог'})).toContainText('Карточка снята');
    await page.goto(`/offers/${offerId}`);await expect(page.getByText('Предложение больше недоступно',{exact:true})).toBeVisible();
    const sellerBrowser=await browser.newContext({baseURL:'http://127.0.0.1:3100',storageState:returningVisitorState});
    try {
      const issuedSeller=await(await sellerBrowser.request.post('/api/auth/otp/request',{data:{phone:sellerPhone}})).json();expect((await sellerBrowser.request.post('/api/auth/otp/verify',{data:{challengeId:issuedSeller.challenge.id,code:issuedSeller.delivery.code}})).ok()).toBe(true);
      const sellerPage=await sellerBrowser.newPage();await sellerPage.goto('/seller');await expect(sellerPage.getByText('Снято оператором',{exact:true}).first()).toBeVisible();
      expect(await sellerPage.locator('body').innerText()).not.toContain('PRIVATE');const offers=await(await sellerBrowser.request.get('/api/seller/offers')).text();expect(offers).not.toContain(privateText);expect(offers).not.toContain(buyerPhone);
    }finally{await sellerBrowser.close();}
    await op.getByRole('link',{name:'Открыть текущую карточку'}).click();await op.getByRole('button',{name:'Вернуть на витрину',exact:true}).click();
    await op.goto('/operator/reports');await op.getByRole('button',{name:'Закрытые',exact:true}).click();await op.getByRole('article').filter({hasText:'Абрикосы отчётэ2е'}).getByRole('button',{name:'Рассмотреть'}).click();
    await expect(op.getByRole('region',{name:'Исторический итог'})).toContainText('Карточка снята');await expect(op.getByRole('region',{name:'Сейчас'})).toContainText('На витрине');await expect(op.getByRole('region',{name:'Сейчас'})).toContainText('Позднее возвращена оператором');
    await info.attach('operator-returned-card-closed-report',{body:await op.screenshot(),contentType:'image/png'});
    await page.goto(`/offers/${offerId}`);await page.getByRole('button',{name:'Пожаловаться на карточку'}).click();await page.getByRole('button',{name:'Другое',exact:true}).click();await page.getByLabel('Комментарий · необязательно').fill('Повторное сообщение');await page.getByRole('button',{name:'Отправить жалобу',exact:true}).click();
    await expect(page.getByText('Вы уже сообщили об этом предложении. Первое сообщение сохранено.',{exact:true})).toBeVisible();
    const saved=await pool.query('SELECT buyer_text FROM offer_reports WHERE card_id=$1',[cardId]);expect(saved.rows).toHaveLength(1);expect(saved.rows[0].buyer_text).toBe(privateText);
  }finally{
    await operator.close();
    if(cardId){await pool.query('DELETE FROM offer_reports WHERE card_id=$1',[cardId]);await pool.query('DELETE FROM offer_card_removals WHERE card_id=$1',[cardId]);}
    const own='SELECT id FROM sellers WHERE owner_user_id=$1';await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${own}))`,[sellerId]);await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${own})`,[sellerId]);await pool.query(`DELETE FROM offers WHERE seller_id IN (${own})`,[sellerId]);await pool.query(`DELETE FROM locations WHERE seller_id IN (${own})`,[sellerId]);await pool.query('DELETE FROM sellers WHERE owner_user_id=$1',[sellerId]);
    const phones=[sellerPhone,buyerPhone,operatorPhone];await pool.query('DELETE FROM operator_feed_marks WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))',[phones]);await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))',[phones]);await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=ANY($1::text[])',[phones]);await pool.query('DELETE FROM users WHERE phone_e164=ANY($1::text[])',[phones]);await pool.end();
  }
});
