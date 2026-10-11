import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';
import { seedIds } from '../../src/db/seed';
import { createDiskPhotoStorage } from '../../src/modules/media/storage/photo-storage';

test('private favourites: guest intent, two points, current price, unavailable/restoration, safe return and late-session response',async({page},info)=>{
  test.skip(info.project.name!=='mobile','Approved mobile RU boundary');
  const {pool}=createDatabase(testDatabaseUrl());
  const ids={user:randomUUID(),sellerOwner:randomUUID(),seller:randomUUID(),point:randomUUID(),point2:randomUUID(),offer:randomUUID(),offer2:randomUUID(),card:randomUUID(),photo:randomUUID()};
  const buyerPhone='+77000280201',sellerPhone='+77000280202';
  await info.attach('isolated-fixture-ids',{body:JSON.stringify(ids,null,2),contentType:'application/json'});
  try{
    await pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,now()),($3,$4,now())',[ids.user,buyerPhone,ids.sellerOwner,sellerPhone]);
    await pool.query('INSERT INTO buyer_interests(user_id,product_id) VALUES($1,$2)',[ids.user,seedIds.beefProduct]);
    await pool.query("INSERT INTO sellers(id,owner_user_id,display_name) VALUES($1,$2,'Тестовый продавец избранного')",[ids.seller,ids.sellerOwner]);
    for(const [id,name] of [[ids.point,'Павильон «Мёд»'],[ids.point2,'Вторая точка']])await pool.query("INSERT INTO locations(id,seller_id,name,type,address_text,latitude,longitude) VALUES($1,$2,$3,'shop','Синтетический адрес',43.2,76.9)",[id,ids.seller,name]);
    for(const [id,point] of [[ids.offer,ids.point],[ids.offer2,ids.point2]])await pool.query("INSERT INTO offers(id,card_id,product_id,title,title_search,seller_id,location_id,price_amount,price_currency,price_unit_code,pack_amount,pack_unit,seller_comment,status,last_confirmed_at) VALUES($1,$2,$3,'Мёд цветочный тестизбранное','мёд цветочный тестизбранное',$4,$5,1200,'KZT','package',500,'g','Тестовый комментарий','active',now())",[id,ids.card,null,ids.seller,point]);
    await pool.query('INSERT INTO photos(id,owner_user_id,width,height) VALUES($1,$2,800,600)',[ids.photo,ids.sellerOwner]);
    const image=await sharp({create:{width:800,height:600,channels:3,background:'#e4bb59'}}).webp().toBuffer();
    const storage=createDiskPhotoStorage();for(const variant of ['thumb','display'] as const)await storage.write(ids.photo,variant,image);
    await pool.query('INSERT INTO offer_photos(offer_id,photo_id,position) VALUES($1,$3,0),($2,$3,0)',[ids.offer,ids.offer2,ids.photo]);
    await page.goto('/favourites');await expect(page.getByText('Войдите, чтобы открыть избранное')).toBeVisible();
    await page.goto(`/offers/${ids.offer}`);const heart=page.getByTestId('favourite-heart');await expect(heart).toBeEnabled();await expect(heart).toHaveAccessibleName('Добавить в избранное');
    await expect(page.getByRole('button',{name:'Отслеживать товар',exact:true})).toHaveCount(0);
    await heart.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
    expect((await pool.query('SELECT * FROM buyer_offer_favourites WHERE user_id=$1',[ids.user])).rows).toHaveLength(0);
    await heart.click();await page.getByLabel('Телефон', {exact:true}).fill(buyerPhone);
    const issuedResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/otp/request'));
    await page.getByRole('button',{name:'Получить код',exact:true}).click();const issued=await(await issuedResponse).json();
    await page.getByLabel('Код из 6 цифр',{exact:true}).fill(issued.delivery.code);await page.getByRole('dialog').getByRole('button',{name:'Войти',exact:true}).click();
    await expect(heart).toHaveAttribute('aria-pressed','true');await expect(heart).toHaveAccessibleName('В избранном');await expect(page.getByRole('dialog')).toHaveCount(0);
    await info.attach('heart-saved',{body:await page.screenshot(),contentType:'image/png'});
    const beforeInterest=await(await page.request.get('/api/interests')).json();expect(beforeInterest.interests.map((i:{product:{id:string}})=>i.product.id)).toEqual([seedIds.beefProduct]);
    await page.goto(`/offers/${ids.offer2}`);await page.getByTestId('favourite-heart').click();await expect(page.getByTestId('favourite-heart')).toHaveAttribute('aria-pressed','true');
    await page.goto('/more');await page.getByRole('link',{name:'Избранное',exact:true}).click();await expect(page.getByTestId('favourite-entry')).toHaveCount(2);
    await info.attach('favourites-current',{body:await page.screenshot(),contentType:'image/png'});
    const first=page.getByTestId('favourite-entry').filter({hasText:'Павильон «Мёд»'});await first.getByRole('link',{name:'Мёд цветочный тестизбранное'}).click();await expect(page).toHaveURL(/return=%2Ffavourites/);
    await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page).toHaveURL(/\/favourites$/);
    await pool.query('UPDATE offers SET price_amount=1750 WHERE id=$1',[ids.offer]);await page.reload();await expect(first).toContainText('1 750');
    await pool.query("UPDATE offers SET last_confirmed_at=now()-interval '169 hours' WHERE id=$1",[ids.offer]);await pool.query("UPDATE offers SET status='inactive' WHERE id=$1",[ids.offer2]);await page.reload();
    const rows=page.getByTestId('favourite-entry');await expect(rows).toHaveCount(2);await expect(page.getByText('Сейчас недоступно',{exact:true})).toHaveCount(2);
    expect(await first.locator('img').count()).toBe(1);const second=rows.filter({hasText:'Вторая точка'});expect(await second.locator('img').count()).toBe(0);expect(await rows.locator('a').count()).toBe(0);
    expect(await first.innerText()).not.toMatch(/1 750|Маршрут|Синтетический адрес|Тестовый комментарий/);
    const unavailable=await(await page.request.get('/api/favourites')).json();for(const row of unavailable.favourites){expect(row).not.toHaveProperty('price');expect(row).not.toHaveProperty('offer');}
    expect(unavailable.favourites.find((r:{offerId:string})=>r.offerId===ids.offer2)).not.toHaveProperty('coverPhotoId');
    await info.attach('favourites-unavailable',{body:await page.screenshot(),contentType:'image/png'});
    await page.route(`**/media/photos/${ids.photo}/thumb`,route=>route.abort());await page.reload();await expect(first.locator('img')).toHaveCount(0);await expect(first.locator('.i-logo')).toHaveCount(1);await page.unroute(`**/media/photos/${ids.photo}/thumb`);
    await page.goto(`/offers/${ids.offer}?return=%2Ffavourites`);await page.getByRole('link',{name:'Назад в избранное'}).click();await expect(page).toHaveURL(/\/favourites$/);
    // Existing public media authorization passes for expired-active, never through a favourite grant.
    expect((await page.request.get(`/media/photos/${ids.photo}/thumb`)).status()).toBe(200);
    await pool.query("UPDATE offers SET status='inactive' WHERE id=$1",[ids.offer]);await page.reload();await expect(page.getByTestId('favourite-entry').locator('img')).toHaveCount(0);
    expect((await page.request.get(`/media/photos/${ids.photo}/thumb`)).status()).toBe(404);
    await pool.query("UPDATE offers SET status='active',last_confirmed_at=now() WHERE id=$1",[ids.offer]);await page.reload();await expect(first).toContainText('1 750');await expect(first.locator('a').first()).toBeVisible();
    await pool.query("INSERT INTO offer_card_removals(card_id,seller_id,reason,removed_by_user_id) VALUES($1,$2,'other',$3)",[ids.card,ids.seller,ids.sellerOwner]);await page.reload();await expect(rows).toHaveCount(0);await expect(page.getByText('Пока нет избранных предложений')).toBeVisible();
    const hidden=await(await page.request.get('/api/favourites')).json();expect(hidden.count).toBe(0);expect(JSON.stringify(hidden)).not.toContain(ids.photo);
    await pool.query('DELETE FROM offer_card_removals WHERE card_id=$1',[ids.card]);await page.reload();
    await page.route('**/api/favourites',async route=>{if(route.request().method()==='DELETE')await route.fulfill({status:503,json:{error:{code:'FAVOURITES_UNAVAILABLE'}}});else await route.continue();});
    await second.getByRole('button',{name:'Убрать из избранного'}).click();await expect(page.getByText('Не удалось изменить избранное. Повторите.')).toBeVisible();await expect(rows).toHaveCount(2);await page.unroute('**/api/favourites');
    await second.getByRole('button',{name:'Убрать из избранного'}).click();await expect(rows).toHaveCount(1);
    expect(await(await page.request.get('/api/interests')).json()).toEqual(beforeInterest);
    // A deliberately delayed old-account GET must never restore data after the application's session-change signal.
    let release!:()=>void;const wait=new Promise<void>(r=>release=r);let seen!:()=>void;const intercepted=new Promise<void>(r=>seen=r);
    let done!:()=>void;const delivered=new Promise<void>(r=>done=r);let delayFirst=true;
    await page.route('**/api/favourites?locale=ru',async route=>{if(!delayFirst){await route.continue();return;}delayFirst=false;const response=await route.fetch();seen();await wait;await route.fulfill({response});done();});
    await page.reload({waitUntil:'domcontentloaded'});await intercepted;
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('kaida-session-change',{detail:{revalidate:false}})));release();
    await delivered;await page.unroute('**/api/favourites?locale=ru');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(rows).toHaveCount(0);
    await page.request.post('/api/auth/logout');await page.evaluate(()=>window.dispatchEvent(new Event('kaida-session-change')));await expect(page.getByText('Войдите, чтобы открыть избранное')).toBeVisible();await expect(rows).toHaveCount(0);
    await page.goto(`/offers/${ids.offer}?preview=1&return=%2Fseller`);await expect(page.getByTestId('favourite-heart')).toHaveCount(0);
    await page.goto(`/offers/${ids.offer}?return=https%3A%2F%2Fevil.invalid`);await page.getByRole('link',{name:'Назад',exact:true}).click();expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  }finally{
    await pool.query('DELETE FROM buyer_offer_favourites WHERE user_id=$1',[ids.user]);await pool.query('DELETE FROM buyer_interests WHERE user_id=$1',[ids.user]);await pool.query('DELETE FROM offer_card_removals WHERE card_id=$1',[ids.card]);await pool.query('DELETE FROM offer_photos WHERE offer_id=ANY($1::uuid[])',[[ids.offer,ids.offer2]]);await pool.query('DELETE FROM offers WHERE seller_id=$1',[ids.seller]);await pool.query('DELETE FROM locations WHERE seller_id=$1',[ids.seller]);await pool.query('DELETE FROM sellers WHERE id=$1',[ids.seller]);await pool.query('DELETE FROM photos WHERE id=$1',[ids.photo]);await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[[ids.user,ids.sellerOwner]]);await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=ANY($1::text[])',[[buyerPhone,sellerPhone]]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[ids.user,ids.sellerOwner]]);await pool.end();
  }
});

test('list login never adds; Offer expiring during heart login is not saved; list read errors permit retry',async({page},info)=>{
  test.skip(info.project.name!=='mobile','Approved mobile RU boundary');
  const {pool}=createDatabase(testDatabaseUrl());const user=randomUUID(),secondUser=randomUUID(),owner=randomUUID(),seller=randomUUID(),point=randomUUID(),offer=randomUUID(),card=randomUUID();
  await info.attach('isolated-login-race-fixture-ids',{body:JSON.stringify({user,secondUser,owner,seller,point,offer,card}),contentType:'application/json'});
  async function enterPhone(phone:string){await page.getByLabel('Телефон',{exact:true}).fill(phone);const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/otp/request'));await page.getByRole('button',{name:'Получить код',exact:true}).click();return (await(await response).json()).delivery.code as string;}
  try{
    await pool.query("INSERT INTO users(id,phone_e164,created_at) VALUES($1,'+77000280401',now()),($2,'+77000280402',now()),($3,'+77000280411',now())",[user,owner,secondUser]);await pool.query("INSERT INTO sellers(id,owner_user_id,display_name) VALUES($1,$2,'Login race test seller')",[seller,owner]);await pool.query("INSERT INTO locations(id,seller_id,name,type,address_text) VALUES($1,$2,'Login race point','shop','Synthetic address')",[point,seller]);
    await pool.query("INSERT INTO offers(id,card_id,title,title_search,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at) VALUES($1,$2,'Login race private target','login race private target',$3,$4,1300,'KZT','active',now())",[offer,card,seller,point]);
    await page.goto('/favourites');await page.getByRole('button',{name:'Войти',exact:true}).click();const code=await enterPhone('+77000280401');await page.getByLabel('Код из 6 цифр',{exact:true}).fill(code);await page.getByRole('dialog').getByRole('button',{name:'Войти',exact:true}).click();await expect(page.getByText('Пока нет избранных предложений')).toBeVisible();
    expect((await pool.query('SELECT * FROM buyer_offer_favourites WHERE user_id=$1',[user])).rows).toHaveLength(0);
    await page.request.post('/api/auth/logout');await page.goto(`/offers/${offer}?return=%2Ffavourites`);await page.getByTestId('favourite-heart').click();
    const secondCode=await enterPhone('+77000280411');
    await pool.query("UPDATE offers SET last_confirmed_at=now()-interval '169 hours' WHERE id=$1",[offer]);
    await page.getByLabel('Код из 6 цифр',{exact:true}).fill(secondCode);await page.getByRole('dialog').getByRole('button',{name:'Войти',exact:true}).click();
    await expect(page.getByText('Предложение больше недоступно',{exact:true})).toBeVisible();await page.getByRole('link',{name:'Назад в избранное'}).click();
    expect((await pool.query('SELECT * FROM buyer_offer_favourites WHERE offer_id=$1',[offer])).rows).toHaveLength(0);
    // Successful login has no saved target after server-side eligibility revalidation.
    await page.goto('/favourites');
    await page.route('**/api/favourites?locale=ru',route=>route.fulfill({status:503,json:{error:{code:'FAVOURITES_UNAVAILABLE'}}}));await page.reload();await expect(page.getByText('Не удалось загрузить избранное. Повторите.')).toBeVisible();await expect(page.getByText('Пока нет избранных предложений')).toHaveCount(0);await page.unroute('**/api/favourites?locale=ru');await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByText('Пока нет избранных предложений')).toBeVisible();
  }finally{
    await pool.query('DELETE FROM buyer_offer_favourites WHERE offer_id=$1 OR user_id=$2',[offer,user]);await pool.query('DELETE FROM offers WHERE id=$1',[offer]);await pool.query('DELETE FROM locations WHERE id=$1',[point]);await pool.query('DELETE FROM sellers WHERE id=$1',[seller]);await pool.query("DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))",[['+77000280401','+77000280402','+77000280411']]);await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=ANY($1::text[])',[['+77000280401','+77000280411']]);await pool.query('DELETE FROM users WHERE phone_e164=ANY($1::text[])',[['+77000280401','+77000280402','+77000280411']]);await pool.end();
  }
});
