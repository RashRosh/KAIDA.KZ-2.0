import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { setLocaleCookie } from './buyer-helpers';

// post-publication-buyer-preview (docs/slices/post-publication-buyer-preview, contract rev 3): the Seller opens the REAL buyer
// Offer page of an own published card with `preview=1&return=/seller…`; the cabinet offers the action only while buyers can see
// the Offer; the page is the buyer's own (a note and a way back are added, the interest action is gone).

function phoneFor(projectName: string) {
  return `+7700003${projectName === 'mobile' ? '8' : '9'}0000`;
}
async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try { return await run(pool); } finally { await pool.end(); }
}
async function cleanup(phone: string) {
  await withPool(async (pool) => {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}
async function login(request: APIRequestContext, phone: string) {
  const requested = await (await request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

test('the buyer page in preview mode: a note and a way back, no interest action; a bad return or none leaves the page as it is', async ({ page, request }) => {
  // a seed Offer linked to a catalog Product (it has the interest action for buyers)
  const search = await (await request.get('/api/search?q=' + encodeURIComponent('Баранина'))).json();
  const offer = search.offers.find((item: { product: { id: string | null } }) => item.product.id !== null);
  expect(offer).toBeTruthy();
  const url = `/offers/${offer.id}`;
  const interestRequests: string[] = [];
  page.on('request', (item) => { if (item.url().includes('/api/interests')) interestRequests.push(item.url()); });

  // without parameters: the ordinary buyer page, the interest action is there
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /избранное|Таңдаулыларға/ })).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);

  // preview mode: the note, the way back, no interest action and no interest request
  interestRequests.length = 0;
  await page.goto(`${url}?preview=1&return=${encodeURIComponent('/seller?card=abc')}`);
  const note = page.getByRole('note');
  await expect(note).toContainText('Так карточку видят покупатели');
  await expect(note.getByRole('link', { name: 'Вернуться к карточке' })).toHaveAttribute('href', '/seller?card=abc');
  await expect(page.getByRole('button', { name: /избранное|Таңдаулыларға/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(interestRequests).toEqual([]);

  // an unsafe or missing return ignores the preview mode as a whole
  for (const query of ['?preview=1', `?preview=1&return=${encodeURIComponent('https://evil.example/seller')}`, `?preview=1&return=${encodeURIComponent('//evil.example')}`, `?preview=1&return=${encodeURIComponent('/offers/x')}`, `?return=${encodeURIComponent('/seller')}`]) {
    await page.goto(url + query);
    await expect(page.getByRole('button', { name: /избранное|Таңдаулыларға/ }), query).toBeVisible();
    await expect(page.getByRole('note'), query).toHaveCount(0);
  }

  // an Offer that is not available: the buyer's own answer; with a safe return the way back is the card, not the search
  const missing = randomUUID();
  await page.goto(`/offers/${missing}`);
  await expect(page.getByRole('heading', { name: 'Предложение больше недоступно' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'К поиску' })).toBeVisible();
  await page.goto(`/offers/${missing}?preview=1&return=${encodeURIComponent('/seller?card=abc')}`);
  await expect(page.getByRole('heading', { name: 'Предложение больше недоступно' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Вернуться к карточке' })).toHaveAttribute('href', '/seller?card=abc');
  await expect(page.getByRole('link', { name: 'К поиску' })).toHaveCount(0);

  // Kazakh
  await setLocaleCookie(page.context(), 'kk');
  await page.goto(`${url}?preview=1&return=${encodeURIComponent('/seller')}`);
  await expect(page.getByRole('note')).toContainText('Карточканы сатып алушылар осылай көреді');
  await expect(page.getByRole('note').getByRole('link', { name: 'Карточкаға оралу' })).toBeVisible();
});

test('the Seller cabinet: the action only for what buyers can see, in the agreed order; the real page opens and returns to the card', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  const tag = testInfo.project.name;
  const names = { one: `Превью один ${tag}`, many: `Превью много ${tag}`, stale: `Превью давно ${tag}` };
  const points = [`Точка А ${tag}`, `Точка Б ${tag}`, `Точка В ${tag}`];
  const ids: { oneCard: string; oneOffer: string; manyCard: string; many: string[]; staleCard: string; staleOffer: string } = { oneCard: randomUUID(), oneOffer: randomUUID(), manyCard: randomUUID(), many: [randomUUID(), randomUUID(), randomUUID()], staleCard: randomUUID(), staleOffer: randomUUID() };
  try {
    await cleanup(phone);
    await login(page.request, phone);
    await withPool(async (pool) => {
      const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
      const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, `Витрина превью ${tag}`]);
      const locations: string[] = [];
      for (const point of points) {
        const location = await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95) RETURNING id", [seller.rows[0].id, point]);
        locations.push(location.rows[0].id);
      }
      const insert = (id: string, cardId: string, locationId: string, title: string, price: string, status: 'active' | 'inactive', ageDays = 0, priceOwn = false) => pool.query(
        `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at, price_own)
         VALUES ($1, NULL, $2, $3, $4, lower($4), $5, $6, 'KZT', 'kg', $7, now() - ($8 || ' days')::interval, $9)`,
        [id, seller.rows[0].id, locationId, title, cardId, price, status, String(ageDays), priceOwn],
      );
      await insert(ids.oneOffer, ids.oneCard, locations[0]!, names.one, '4500', 'active');
      await insert(ids.many[0]!, ids.manyCard, locations[0]!, names.many, '4500', 'active');
      await insert(ids.many[1]!, ids.manyCard, locations[1]!, names.many, '4700', 'active', 0, true);
      await insert(ids.many[2]!, ids.manyCard, locations[2]!, names.many, '4500', 'inactive');
      await insert(ids.staleOffer, ids.staleCard, locations[1]!, names.stale, '3000', 'active', 8);
    });
    const href = (offerId: string, card: string) => `/offers/${offerId}?preview=1&return=${encodeURIComponent(`/seller?card=${card}`)}`;

    // one point, on the showcase: «Редактировать» is followed by the new action, then «Выключить»
    await page.goto(`/seller?card=${ids.oneCard}`);
    const list = page.locator('.card').filter({ has: page.getByTestId('preview-action') });
    await expect(list.locator('.li .ts, .li').filter({ hasText: /Подтвердить актуальность|Редактировать|Как видят покупатели|Выключить/ }).first()).toBeVisible();
    const order = await list.locator('.ts').allTextContents();
    expect(order.filter((text) => /Подтвердить актуальность|Редактировать|Как видят покупатели|Выключить/.test(text))).toEqual(['Подтвердить актуальность', 'Редактировать', 'Как видят покупатели', 'Выключить']);
    const action = page.getByTestId('preview-action');
    await expect(action).toHaveAttribute('href', href(ids.oneOffer, ids.oneCard));
    await action.click();
    await expect(page).toHaveURL(new RegExp(`/offers/${ids.oneOffer}\\?preview=1`));
    await expect(page.getByRole('note')).toContainText('Так карточку видят покупатели');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(names.one);
    await page.getByRole('note').getByRole('link', { name: 'Вернуться к карточке' }).click();
    await expect(page).toHaveURL(new RegExp(`/seller\\?card=${ids.oneCard}`));
    await expect(page.getByTestId('preview-action')).toBeVisible();

    // several points: the stack of quiet actions per point; the switched-off point has no preview and says why
    await page.goto(`/seller?card=${ids.manyCard}`);
    const pointCards = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Изменить только в этой точке' }) });
    await expect(pointCards).toHaveCount(3);
    const actionsOf = (index: number) => pointCards.nth(index).locator('.act').allTextContents();
    expect(await actionsOf(0)).toEqual(['Изменить только в этой точке', 'Как видят покупатели', 'Выключить']);
    expect(await actionsOf(1)).toEqual(['Изменить только в этой точке', 'Как видят покупатели', 'Выключить']);
    expect(await actionsOf(2)).toEqual(['Изменить только в этой точке', 'Включить']);
    await expect(pointCards.nth(2).getByTestId('preview-unavailable')).toHaveText('Покупатели сейчас не видят эту точку');
    await expect(pointCards.nth(2).getByTestId('preview-action')).toHaveCount(0);
    await expect(pointCards.nth(1).getByTestId('preview-action')).toHaveAttribute('href', href(ids.many[1]!, ids.manyCard));
    // each target is at least 44 px tall and the stacked targets do not overlap
    const boxes = await pointCards.nth(0).locator('.act').evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return [r.top, r.bottom, r.height]; }));
    for (const [, , height] of boxes) expect(height).toBeGreaterThanOrEqual(43.5);
    for (let index = 1; index < boxes.length; index += 1) expect(boxes[index]![0]).toBeGreaterThanOrEqual(boxes[index - 1]![1]! - 0.5);
    // the own price of the second point is what its page shows
    await pointCards.nth(1).getByTestId('preview-action').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(names.many);
    await expect(page.getByText(/4\s?700\s?₸/).first()).toBeVisible();
    await page.getByRole('note').getByRole('link', { name: 'Вернуться к карточке' }).click();
    await expect(page).toHaveURL(new RegExp(`/seller\\?card=${ids.manyCard}`));

    // a card buyers do not see: no action; the direct address is the buyer's own «unavailable»
    await page.goto(`/seller?card=${ids.staleCard}`);
    await expect(page.getByTestId('preview-action')).toHaveCount(0);
    await page.goto(href(ids.staleOffer, ids.staleCard));
    await expect(page.getByRole('heading', { name: 'Предложение больше недоступно' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Вернуться к карточке' })).toBeVisible();

    // right after publishing: the highlighted row gets the action — the buyer page for one point, the card screen for several
    await page.goto(`/seller?notice=created&offer=${ids.oneOffer}`);
    const row = page.getByTestId(`seller-card-${ids.oneCard}`);
    await expect(row.getByTestId('preview-action')).toHaveAttribute('href', `/offers/${ids.oneOffer}?preview=1&return=%2Fseller`);
    await page.goto(`/seller?notice=updated&offer=${ids.many[0]}`);
    const manyRow = page.getByTestId(`seller-card-${ids.manyCard}`);
    await manyRow.getByTestId('preview-action').click();
    await expect(page).toHaveURL(new RegExp(`/seller\\?card=${ids.manyCard}`));
    await expect(pointCards.first()).toBeVisible();
    // a card nobody can see gets no action even when highlighted
    await page.goto(`/seller?notice=updated&offer=${ids.staleOffer}`);
    await expect(page.getByTestId(`seller-card-${ids.staleCard}`).getByTestId('preview-action')).toHaveCount(0);

    // Kazakh, a narrow screen and large text: the point card wraps, nothing is clipped, no sideways scroll
    await setLocaleCookie(page.context(), 'kk');
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/seller?card=${ids.manyCard}`);
    await expect(page.getByTestId('preview-action').first()).toHaveText('Сатып алушылар қалай көреді');
    await page.addStyleTag({ content: 'html{font-size:200% !important} .kaida .act{font-size:28px;line-height:36px}' });
    const fits = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth <= window.innerWidth,
      main: (() => { const main = document.querySelector<HTMLElement>('.kaida main.body'); return main ? main.scrollWidth <= main.clientWidth + 1 : false; })(),
    }));
    expect(fits).toEqual({ page: true, main: true });
  } finally {
    await cleanup(phone);
  }
});
