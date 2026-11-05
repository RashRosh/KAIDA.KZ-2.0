import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';

// D3 · B08 source parity on the real Offer page: three photos, no photo, a failed photo, the heart states, the sticky
// route, the unavailable Offer; screenshots at 360 px for the PO's acceptance (docs/slices/design-offer).

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try { return await run(pool); } finally { await pool.end(); }
}

const ids = { user: randomUUID(), seller: randomUUID(), location: randomUUID(), photos: randomUUID(), bare: randomUUID(), photo: [randomUUID(), randomUUID(), randomUUID()] };
const TITLE = 'Помидоры розовые тепличные';

test.beforeAll(async () => {
  await withPool(async (pool) => {
    await pool.query("INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,now())", [ids.user, `+7700009${String(Date.now()).slice(-4)}`]);
    await pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [ids.seller, 'Айгерим К.']);
    await pool.query('INSERT INTO seller_verified_phones (seller_id,phone_e164,verified_at) VALUES ($1,$2,now())', [ids.seller, '+77001234567']);
    await pool.query(
      "INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude,phone_e164,whatsapp_phone_e164,opening_hours_needs_review) VALUES ($1,$2,'Павильон 12 · Зелёный базар','ул. Рыскулова, 58','shop',43.25,76.95,'+77001234567','+77001234567',false)",
      [ids.location, ids.seller],
    );
    for (const [id, comment] of [[ids.photos, 'Собираем утром, привозим к 10:00. Можно выбрать с ящика.'], [ids.bare, null]] as const) {
      await pool.query(
        `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id,seller_comment)
         VALUES ($1,NULL,$2,$3,'1450','KZT','kg','active',now()-interval '2 hours',now(),now(),$4,$5,gen_random_uuid(),$6)`,
        [id, ids.seller, ids.location, TITLE, offerTitleSearchText(TITLE), comment],
      );
    }
    for (const [position, photo] of ids.photo.entries()) {
      await pool.query('INSERT INTO photos (id,owner_user_id,width,height) VALUES ($1,$2,800,800)', [photo, ids.user]);
      await pool.query('INSERT INTO offer_photos (offer_id,photo_id,position) VALUES ($1,$2,$3)', [ids.photos, photo, position]);
    }
  });
});

test.afterAll(async () => {
  await withPool(async (pool) => {
    await pool.query('DELETE FROM offer_photos WHERE offer_id=$1', [ids.photos]);
    await pool.query('DELETE FROM photos WHERE owner_user_id=$1', [ids.user]);
    await pool.query('DELETE FROM offers WHERE seller_id=$1', [ids.seller]);
    await pool.query('DELETE FROM locations WHERE seller_id=$1', [ids.seller]);
    await pool.query('DELETE FROM seller_verified_phones WHERE seller_id=$1', [ids.seller]);
    await pool.query('DELETE FROM sellers WHERE id=$1', [ids.seller]);
    await pool.query('DELETE FROM users WHERE id=$1', [ids.user]);
  });
});

async function photos(page: Page, broken = false) {
  for (const [n, file] of ['tomatoes', 'bullheart', 'ground'].entries()) {
    const svg = await readFile(`tests/fixtures/design-search/${file}.svg`, 'utf8');
    await page.route(`**/media/photos/${ids.photo[n]}/display*`, (route) => (broken && n === 0 ? route.fulfill({ status: 500 }) : route.fulfill({ contentType: 'image/svg+xml', body: svg })));
  }
}

async function shot(page: Page, info: { outputPath: (name: string) => string }, name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  // The page scrolls inside the app frame, not the document: a full shot is a tall viewport.
  const size = page.viewportSize()!;
  if (fullPage) await page.setViewportSize({ width: size.width, height: 1500 });
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
  if (fullPage) await page.setViewportSize(size);
}

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Source viewport driven explicitly.');
  await page.setViewportSize({ width: 360, height: 800 });
});

test('B08.ST01–ST03: top bar, gallery 1 / 3, price, freshness, point card, contacts, comment, links, sticky route; no bottom nav', async ({ page }, info) => {
  await photos(page);
  await page.goto(`/offers/${ids.photos}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Предложение' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Поделиться/ })).toHaveCount(0);
  await expect(page.locator('#offer-title')).toHaveText(TITLE);
  await expect(page.getByText('1 / 3')).toBeVisible();
  await expect(page.getByText('От продавца')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пожаловаться на карточку' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Построить маршрут|Маршрут до/ })).toBeVisible();
  await expect(page.getByTestId('opening-hours').first()).toBeVisible();
  const m = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const style = (s: string) => getComputedStyle(document.querySelector(s)!);
    const frame = document.querySelector('[aria-roledescription="carousel"] > div')!;
    const route = [...document.querySelectorAll('a')].find((a) => a.href.includes('/route'))!;
    return {
      top: Math.round(box('header').height), back: Math.round(box('header a').width),
      frame: [Math.round(frame.getBoundingClientRect().width), Math.round(frame.getBoundingClientRect().height), getComputedStyle(frame).borderRadius],
      title: [style('#offer-title').fontSize, style('#offer-title').lineHeight],
      price: [getComputedStyle(document.querySelector('#offer-title + div b')!).fontSize, getComputedStyle(document.querySelector('#offer-title + div b')!).fontWeight],
      heart: Math.round(box('[data-testid="favourite-heart"]').width),
      route: Math.round(route.getBoundingClientRect().height),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(await page.evaluate(() => getComputedStyle([...document.querySelectorAll('a')].find((a) => a.href.includes('/route'))!).color)).toBe('rgb(255, 255, 255)');
  expect(m).toEqual({ top: 68, back: 48, frame: [328, 328, '20px'], title: ['22px', '28px'], price: ['32px', '700'], heart: 44, route: 52, overflow: false });
  await shot(page, info, 'B08-ST01-photos-360');
  await page.getByRole('button', { name: 'Следующее фото' }).click();
  await expect(page.getByText('2 / 3')).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  }
});

test('B08.ST04/ST05: no photo and a failed photo keep the data; Retry reloads it', async ({ page }, info) => {
  await page.goto(`/offers/${ids.bare}`);
  await expect(page.getByTestId('offer-no-photo')).toHaveAccessibleName('Продавец не добавил фото');
  await shot(page, info, 'B08-ST04-no-photo-360', false);
  await photos(page, true);
  await page.goto(`/offers/${ids.photos}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Фото не загрузилось' })).toBeVisible();
  await expect(page.locator('#offer-title')).toHaveText(TITLE);
  await shot(page, info, 'B08-ST05-photo-error-360', false);
  await page.unrouteAll();
  await photos(page);
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('img', { name: `${TITLE}, фото 1 из 3` })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Фото не загрузилось' })).toHaveCount(0);
});

test('B15: heart saved with the note, busy, and a write error', async ({ page }, info) => {
  await photos(page);
  let saved = true;
  let release: (() => void) | null = null;
  await page.route('**/api/favourites?*', (route) => route.fulfill({ json: { userId: ids.user, count: saved ? 1 : 0, favourites: saved ? [{ id: randomUUID(), offerId: ids.photos, locationId: ids.location, savedAt: new Date().toISOString(), state: 'unavailable', title: TITLE, sellerName: 'Айгерим К.', pointName: 'Павильон 12' }] : [] } }));
  await page.route('**/api/favourites', (route) => new Promise<void>((resolve) => { release = () => { void route.fulfill({ status: 500, json: {} }).then(resolve); }; }));
  await page.goto(`/offers/${ids.photos}`);
  const heart = page.getByTestId('favourite-heart');
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Сохранено в Избранном: это предложение и эта точка')).toBeVisible();
  await shot(page, info, 'B15-saved-360', false);
  saved = false;
  await page.reload();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-busy', 'true');
  await page.screenshot({ path: info.outputPath('B15-busy-360.png'), clip: { x: 0, y: 360, width: 360, height: 200 }, animations: 'disabled' });
  release!();
  await expect(heart).toHaveAttribute('data-error', 'true');
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('B15-error-360.png'), clip: { x: 0, y: 360, width: 360, height: 200 }, animations: 'disabled' });
});

test('B08.ST08: an unavailable Offer: title, text, back to the results', async ({ page }, info) => {
  await page.goto(`/offers/${randomUUID()}`);
  await expect(page.getByRole('heading', { name: 'Предложение недоступно' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Вернуться к выдаче' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  expect(await page.getByRole('link', { name: 'Вернуться к выдаче' }).evaluate((a) => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
  await shot(page, info, 'B08-ST08-unavailable-360', false);
});
