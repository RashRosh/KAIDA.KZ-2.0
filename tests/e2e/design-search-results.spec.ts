import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';

const NOW = new Date('2026-11-05T08:00:00Z');
const id = (n: number) => `a4700000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data = [
  ['Помидоры розовые тепличные', '1450', 'Павильон 12 · Зелёный базар', 'ул. Рыскулова, 58', 'Айгерим К.', 120, 1200],
  ['Помидоры «Бычье сердце» отборные, крупные, ящик 3 кг, сорт Малиновый гигант', '650', 'Магазин «Свежий ряд»', 'пр. Абая, 150', 'Нурлан Б.', 4320, 2800],
  ['Помидоры черри, упаковка 250 г', '1190', 'Дом. точка «Алмагуль»', 'мкр. Орбита-2, 14', 'Алмагуль С.', 40, 5100],
  ['Помидоры алматинские, грунт', '890', 'Рынок «Жетысу», ряд 7', 'ул. Тастак, 21', 'Серик Т.', 1440, 3400],
] as const;
const offers: SearchOffer[] = data.map((row, i) => ({
  id:id(i+1), product:{id:null,name:row[0]}, seller:{id:id(20+i),displayName:row[4]},
  location:{id:id(30+i),name:row[2],addressText:row[3],openingHours:templateOpeningHours(),contacts:{
    ...(i !== 2 ? {phoneE164:'+77000000001'} : {}), ...(i === 0 || i === 2 ? {whatsappPhoneE164:'+77000000001'} : {}), ...(i === 0 ? {telegramUsername:'kaida_test'} : {}),
  }}, price:{amount:row[1],currency:'KZT',unit:i===1?'500 г':i===2?'упак.':'кг'},
  sellerComment:null, routeAvailable:true, ...(i!==2 ? {coverPhotoId:id(40+i)} : {}),
  actuality:{days:Math.floor(row[5]/1440),ageing:row[5]>=2880},
  lastConfirmedAt:new Date(NOW.getTime()-row[5]*60000).toISOString(),distanceMeters:row[6],
}));

test('B03/B04 source parity: four cards, real age labels, one favourites load, 4nav, known/denied distance and320px menu', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Source viewport driven explicitly.');
  await page.setViewportSize({width:360,height:1060});
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_ok: unknown,fail: PositionErrorCallback){fail({code:1,message:'Denied',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});}}});
  });
  let denied = false, loads = 0;
  await page.route('**/api/search?*',route=>route.fulfill({json:{query:'помидоры',resolvedProduct:null,offers:denied ? [offers[0], offers[3]].map((offer,i)=>({...offer,distanceMeters:undefined,...(i===1?{lastConfirmedAt:new Date(NOW.getTime()-300*60000).toISOString(),actuality:{days:0,ageing:false}}:{})})) : offers}}));
  await page.route('**/api/favourites?*',route=>{ loads++; return route.fulfill({json:{userId:id(80),count:2,favourites:offers.slice(0,2).map((offer,i)=>({id:id(90+i),offerId:offer.id,locationId:offer.location.id,savedAt:NOW.toISOString(),state:'available',offer}))}}); });
  for(const [n,file] of [[40,'tomatoes'],[41,'bullheart'],[43,'ground']] as const) {
    const svg=await readFile(`tests/fixtures/design-search/${file}.svg`,'utf8');
    await page.route(`**/media/photos/${id(n)}/thumb`,route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
  }
  await page.goto('/?q=помидоры');
  await expect(page.getByRole('article')).toHaveCount(4);
  await expect(page.getByTestId('favourite-heart').first()).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('group',{name:'Популярные запросы'})).toHaveCount(0);
  await expect(page.getByTestId('opening-hours')).toHaveCount(0);
  for(const text of ['2 ч','3 дня','40 мин','1 день']) await expect(page.getByRole('article').getByRole('img',{name:`Продавец подтвердил: ${text}`})).toBeVisible();
  expect(loads).toBe(1);
  // Independent source measurements: catches legacy CSS winning the cascade (including centred hearts).
  const metrics=await page.getByRole('article').first().evaluate(card=>{
    const heart=card.querySelector<HTMLElement>('[data-testid="favourite-heart"]')!;
    const photo=heart.parentElement!;
    const hb=heart.getBoundingClientRect(), pb=photo.getBoundingClientRect();
    return {photo:[pb.width,pb.height],heartTop:hb.top-pb.top,heartRight:pb.right-hb.right,
      price:getComputedStyle(card.querySelector('.pr')!).fontSize,
      pointWeight:getComputedStyle(card.querySelector('[data-testid="card-point"]')!).fontWeight,
      addressSize:getComputedStyle(card.querySelector('[data-testid="card-place"]')!).fontSize,
      radius:getComputedStyle(card).borderRadius};
  });
  expect(metrics).toEqual({photo:[104,104],heartTop:0,heartRight:0,price:'22px',pointWeight:'500',addressSize:'13px',radius:'14px'});
  await expect(page.getByRole('article').first().getByRole('link',{name:/Маршрут до/})).toHaveText('1,2 км');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:info.outputPath('B03-normal-360.png'),animations:'disabled'});
  denied=true;
  const trigger=page.getByRole('button',{name:/^Порядок результатов:/});
  await trigger.click();
  await page.getByRole('button',{name:/^По цене, применить/}).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await trigger.click();
  await page.getByRole('button',{name:/^По расстоянию, применить/}).click();
  const notice=page.getByRole('alert').filter({hasText:'Расстояние недоступно.'});
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('button',{name:'Попробовать снова'})).toBeVisible();
  expect(await trigger.locator('span').first().evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  expect((await notice.boundingBox())!.y).toBeLessThan((await trigger.boundingBox())!.y);
  await expect(page.getByRole('article')).toHaveCount(2);
  const navBox=(await page.getByRole('navigation').boundingBox())!;
  expect(navBox.y+navBox.height).toBeLessThanOrEqual(1060);
  expect(navBox.y).toBeGreaterThanOrEqual(990);
  await expect(page.getByRole('group',{name:'Порядок результатов'})).toHaveCount(0);
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.screenshot({path:info.outputPath('B04-denied-360.png'),animations:'disabled'});
  await page.setViewportSize({width:320,height:800});
  await trigger.click();
  const menu=page.getByRole('group',{name:'Порядок результатов'});
  await expect(menu).toBeVisible();
  const box=(await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(320);
});

test('B03 loading/error/retry/correction: matching state screenshots and the correction above order', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile', 'Source viewport driven explicitly.');
  await page.setViewportSize({width:360,height:1060});
  await page.clock.setFixedTime(NOW);
  let release:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{release=resolve;});
  let stage='loading';
  await page.route('**/api/favourites?*',route=>route.fulfill({status:401,json:{}}));
  await page.route('**/api/search?*',async route=>{
    if(stage==='loading') await waiting;
    return stage==='error' ? route.fulfill({status:503,json:{}}) : route.fulfill({json:{query:stage==='correction'?'помидорі':'помидоры',resolvedProduct:null,offers, ...(stage==='correction'?{correction:{from:'помидорі',to:'помидоры'}}:{})}});
  });
  for(const [n,file] of [[40,'tomatoes'],[41,'bullheart'],[43,'ground']] as const) {
    const svg=await readFile(`tests/fixtures/design-search/${file}.svg`,'utf8');
    await page.route(`**/media/photos/${id(n)}/thumb`,route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
  }
  await page.goto('/?q=помидоры');
  await expect(page.getByTestId('search-skeleton')).toHaveCount(4);
  await page.screenshot({path:info.outputPath('B03-loading-360.png'),animations:'disabled'});
  stage='error'; release();
  await expect(page.getByRole('alert').filter({hasText:'Не удалось выполнить поиск.'})).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('B03-error-360.png'),animations:'disabled'});
  stage='ready';
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByRole('article')).toHaveCount(4);
  stage='correction';
  await page.goto('/?q=помидорі');
  const link=page.getByRole('link',{name:'Искать «помидорі» как введено',exact:true});
  await expect(link).toBeVisible();
  const order=page.getByRole('button',{name:/^Порядок результатов:/});
  expect((await link.boundingBox())!.y).toBeLessThan((await order.boundingBox())!.y);
  await page.screenshot({path:info.outputPath('B03-correction-360.png'),animations:'disabled'});
});
