import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { testDatabaseUrl } from '../integration/database';
import { resultCard, setLocaleCookie } from './buyer-helpers';

// buyer-readability (docs/slices/buyer-readability, D1–D3): the point, address · distance and seller lines on the result
// card, the offer page and the unavailable Favourites card are 14/20 px in --ink2 at the default font size, grow with the
// root font size and stay usable at 200 %; everything else, and every seller screen, keeps the mockup's 13 px `.c`.
// Automated evidence here is root-font-size emulation only, not a real browser or phone setting.

const INK2 = 'rgb(97, 91, 100)';
const INK3 = 'rgb(110, 104, 113)';
const LONG_POINT = 'Павильон «Мясо, молочные продукты и мёд от фермерского хозяйства Жаксылык»';
const LONG_ADDRESS = 'Алматы, ул. Райымбека батыра, 351/1, торговый центр «Алтын Орда», второй этаж, павильон 12, ряд 4, место 31';
const LONG_SELLER = 'Ержан Абдрахманович Жаксылыков и сыновья';

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try { return await run(pool); } finally { await pool.end(); }
}

function textStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: style.fontSize, line: style.lineHeight, color: style.color };
  });
}

async function expectReadable(locator: Locator, size = '14px', line = '20px') {
  expect(await textStyle(locator)).toEqual({ size, line, color: INK2 });
}

// No horizontal page scroll, no changed line wider than its box, every action visible inside the viewport and ≥ 44 × 44.
async function expectUsable(page: Page) {
  const report = await page.evaluate(() => {
    const lines = [...document.querySelectorAll<HTMLElement>('[data-testid="card-point"], [data-testid="card-place"], [data-testid="offer-address"], [data-testid="offer-seller"], [data-testid="unavailable-line"]')];
    const actions = [...document.querySelectorAll<HTMLElement>('article .ct, [data-testid="favourite-heart"]')];
    const vw = window.innerWidth;
    return {
      page: document.documentElement.scrollWidth <= vw,
      wideLines: lines.filter((element) => element.scrollWidth > element.clientWidth + 1).length,
      badActions: actions.map((element) => element.getBoundingClientRect())
        .filter((box) => box.width < 43.5 || box.height < 43.5 || box.left < -0.5 || box.right > vw + 0.5).length,
      actions: actions.length,
    };
  });
  expect(report.page).toBe(true);
  expect(report.wideLines).toBe(0);
  expect(report.badActions).toBe(0);
  return report.actions;
}

test('buyer point, address and seller lines: 14/20 px --ink2, long text, ru and kk, 320/360 px, 200 % text; other texts and seller screens unchanged', async ({ page }, info) => {
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const title = `Читаемость ${suffix}`;
  const sellerId = randomUUID();
  const locationId = randomUUID();
  const offerId = randomUUID();
  const sellerPhone = `+7700007${info.project.name === 'mobile' ? '1' : '2'}${String(Date.now()).slice(-3)}`;
  await withPool(async (pool) => {
    await pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, LONG_SELLER]);
    await pool.query('INSERT INTO seller_verified_phones (seller_id,phone_e164,verified_at) VALUES ($1,$2,now())', [sellerId, '+77001234567']);
    await pool.query(
      "INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude,phone_e164,whatsapp_phone_e164,opening_hours_needs_review) VALUES ($1,$2,$3,$4,'shop',43.25,76.95,'+77001234567','+77001234567',false)",
      [locationId, sellerId, LONG_POINT, LONG_ADDRESS],
    );
    await pool.query(
      `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
       VALUES ($1,NULL,$2,$3,'4500','KZT','kg','active',now(),now(),now(),$4,$5,gen_random_uuid())`,
      [offerId, sellerId, locationId, title, offerTitleSearchText(title)],
    );
  });
  const search = async (query: string) => {
    const input = page.getByRole('search').locator('input[type="search"]').first();
    await input.fill(query);
    await input.press('Enter');
  };
  const shot = async (name: string) => {
    const path = info.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: false });
    await info.attach(name, { path, contentType: 'image/png' });
  };
  try {
    // ---- result card, RU, default text size ----
    await page.goto('/');
    await search(suffix);
    const card = resultCard(page, title);
    await expect(card).toHaveCount(1);
    const point = card.getByTestId('card-point');
    const place = card.getByTestId('card-place');
    await expect(point).toHaveText(LONG_POINT);
    await expect(place).toHaveText(LONG_ADDRESS);
    await expectReadable(point);
    await expectReadable(place);
    // hierarchy and neighbours unchanged: name 16 px, opening-hours line 13 px semibold, results caption still the mockup's `.c`
    expect((await textStyle(card.getByRole('heading', { level: 3 }))).size).toBe('16px');
    expect(await card.getByTestId('opening-hours').evaluate((element) => [getComputedStyle(element).fontSize, getComputedStyle(element).fontWeight])).toEqual(['13px', '600']);
    const caption = page.locator('main p.c').filter({ hasText: /Найдено/ }).first();
    expect(await textStyle(caption)).toEqual({ size: '13px', line: '18px', color: INK3 });
    // the long lines wrap by words (more than one line), nothing is cut
    expect(await place.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(20);
    await shot('card-360-ru');
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await expectUsable(page)).toBeGreaterThan(0);
    }

    // ---- 200 % root text: the lines grow, the card may grow, nothing is clipped, actions stay usable ----
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await expectReadable(point, '28px', '40px');
    await expectReadable(place, '28px', '40px');
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await expectUsable(page)).toBeGreaterThan(0);
    }
    await shot('card-320-ru-200');

    // ---- offer page ----
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/offers/${offerId}`);
    const address = page.getByTestId('offer-address');
    const seller = page.getByTestId('offer-seller');
    await expect(address).toHaveText(LONG_ADDRESS);
    await expect(seller).toHaveText(LONG_SELLER);
    await expectReadable(address);
    await expectReadable(seller);
    expect(await page.getByTestId('opening-hours').evaluate((element) => getComputedStyle(element).fontSize)).toBe('13px');
    await expectUsable(page);
    await address.scrollIntoViewIfNeeded();
    await shot('offer-360-ru');
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await expectReadable(address, '28px', '40px');
    await expectReadable(seller, '28px', '40px');
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await expectUsable(page);
    }

    // ---- Kazakh: same data, same treatment, no overflow ----
    await setLocaleCookie(page.context(), 'kk');
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');
    await search(suffix);
    await expectReadable(resultCard(page, title).getByTestId('card-place'));
    await expect(resultCard(page, title).getByTestId('card-point')).toHaveText(LONG_POINT);
    await expectUsable(page);
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await expectUsable(page);
    await page.goto(`/offers/${offerId}`);
    await expectReadable(page.getByTestId('offer-seller'));
    await expectUsable(page);
    await setLocaleCookie(page.context(), 'ru');

    // ---- Favourites, unavailable card (presentation only; the data path is covered by offer-favourites) ----
    await page.setViewportSize({ width: 360, height: 800 });
    await page.route('**/api/favourites?locale=*', (route) => route.fulfill({ json: {
      userId: randomUUID(), count: 1,
      favourites: [{ id: randomUUID(), offerId, locationId, savedAt: new Date().toISOString(), state: 'unavailable', title, sellerName: LONG_SELLER, pointName: LONG_POINT }],
    } }));
    await page.goto('/favourites');
    const unavailable = page.getByTestId('unavailable-line');
    await expect(unavailable).toHaveCount(3);
    for (let index = 0; index < 3; index++) await expectReadable(unavailable.nth(index));
    await expectUsable(page);
    await shot('favourites-unavailable-360-ru');
    await page.unroute('**/api/favourites?locale=*');

    // ---- seller screens keep the mockup's `.c` (13/18 px, --ink3) ----
    await page.context().request.post('/api/auth/otp/request', { data: { phone: sellerPhone } }).then(async (response) => {
      const requested = await response.json();
      expect((await page.context().request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
    });
    await page.goto('/seller');
    await expect(page.getByRole('heading', { level: 1, name: 'Моя витрина' })).toBeVisible();
    // the cabinet start has no `.c` text, so a probe in the seller frame shows what every seller `.c` renders as
    const probe = await page.locator('.kaida main').first().evaluate((main) => {
      const element = document.createElement('p');
      element.className = 'c';
      element.textContent = 'probe';
      main.append(element);
      const style = getComputedStyle(element);
      const result = { size: style.fontSize, line: style.lineHeight, color: style.color };
      element.remove();
      return result;
    });
    expect(probe).toEqual({ size: '13px', line: '18px', color: INK3 });
    await shot('seller-start-360-ru');
  } finally {
    await withPool(async (pool) => {
      await pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
      await pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
      await pool.query('DELETE FROM seller_verified_phones WHERE seller_id = $1', [sellerId]);
      await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
      const users = await pool.query('SELECT id FROM users WHERE phone_e164 = $1', [sellerPhone]);
      for (const row of users.rows) {
        await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id = $1)', [row.id]);
        await pool.query('DELETE FROM sellers WHERE owner_user_id = $1', [row.id]);
        await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [row.id]);
      }
      await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164 = $1', [sellerPhone]);
      await pool.query('DELETE FROM users WHERE phone_e164 = $1', [sellerPhone]);
    });
  }
});
