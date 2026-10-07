import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';
import { firstVisitState } from './browser-state';

// S15C / D0 (docs/slices/s15c-d0-search-demand-events): intentional searches are recorded as internal events; nothing else is.
// The events are read straight from the test database (the app has no read path). Every test uses its own query text, so the
// parallel specs of other files never mix into the counts. Mobile + Russian is the current gate (PROJECT_RULES.md §18.5).
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

let connection: ReturnType<typeof createDatabase>;
// Letters only: a digit run in the query text would trip D0's phone-number filter and the event would (correctly) not be recorded (Issue #125).
const marker = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
const cleanupTexts: string[] = [];
// One Product with an Offer (the results to sort, open and come back to) and one Product without Offers (known-zero).
let productId = '';
let zeroProductId = '';
let sellerId = '';
const productName = `Evtprod ${marker}`;
const zeroProductName = `Evtzero ${marker}`;

test.beforeAll(async () => {
  connection = createDatabase(testDatabaseUrl());
  productId = randomUUID();
  zeroProductId = randomUUID();
  sellerId = randomUUID();
  const locationId = randomUUID();
  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2),($3,$4)', [productId, productName, zeroProductId, zeroProductName]);
  await connection.pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, `Evt seller ${marker}`, '+77015550974']);
  await connection.pool.query("INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,'shop')", [locationId, sellerId, `Evt point ${marker}`, 'Evt address']);
  await connection.pool.query(
    `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
     VALUES (gen_random_uuid(),$1,$2,$3,'1000','KZT','kg','active',now(),now(),now(),$4,lower($4),gen_random_uuid())`,
    [productId, sellerId, locationId, productName],
  );
});

test.afterAll(async () => {
  await connection.pool.query('DELETE FROM search_events WHERE query_normalized = ANY($1) OR query_normalized LIKE $2', [cleanupTexts, `evt${marker}%`]);
  await connection.pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
  await connection.pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
  await connection.pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
  await connection.pool.query('DELETE FROM products WHERE id = ANY($1)', [[productId, zeroProductId]]);
  await connection.pool.end();
});

const field = (page: Page) => page.getByRole('searchbox', { name: 'Какой товар ищете?' });
const events = async (text: string) => (await connection.pool.query('SELECT * FROM search_events WHERE query_normalized = $1 ORDER BY occurred_at', [text])).rows;
const count = async (text: string) => (await events(text)).length;
const textOf = (suffix: string) => { const text = `evt${marker} ${suffix}`; cleanupTexts.push(text); return text; };
// the server writes the event before it answers (or, past the 250 ms wait budget, just after): positive checks poll, and a «nothing
// more was recorded» check pauses first
const settle = (page: Page) => page.waitForTimeout(600);

async function search(page: Page, text: string) {
  await field(page).fill(text);
  await field(page).press('Enter');
  await expect(page.getByText(/ничего не найдено|Сейчас предложений нет|Найдено|предложен/i).first()).toBeVisible();
}

test('a submitted search is recorded once, with only the minimal fields', async ({ page }) => {
  const text = textOf('submit');
  await page.goto('/');
  await search(page, text);
  await settle(page);
  const [event] = await events(text);
  await expect.poll(() => count(text)).toBe(1);
  expect(event).toMatchObject({ entry: 'submit', resolution: 'unresolved', resolved_product_id: null, result_count: 0, origin: 'test' });
  expect(new Date(event.occurred_at).getTime() % 3_600_000).toBe(0);
  expect(Object.keys(event).sort()).toEqual(['entry', 'id', 'occurred_at', 'origin', 'query_normalized', 'resolution', 'resolved_product_id', 'result_count']);
});

test('choosing a Product from the suggestions is recorded as `suggestion` with the Product', async ({ page }) => {
  const normalized = zeroProductName.toLowerCase();
  cleanupTexts.push(normalized);
  await page.goto('/');
  await field(page).fill(`evtzero ${marker}`.slice(0, 12));
  await page.getByRole('option', { name: zeroProductName, exact: true }).click();
  await expect(page.getByText(/Сейчас предложений нет/)).toBeVisible();
  await settle(page);
  const [event] = await events(normalized);
  await expect.poll(() => count(normalized)).toBe(1);
  expect(event).toMatchObject({ entry: 'suggestion', resolution: 'selected', resolved_product_id: zeroProductId, result_count: 0, origin: 'test' });
});

test('a chip click is recorded as `chip`', async ({ page }) => {
  await page.goto('/');
  const before = (await connection.pool.query("SELECT count(*)::int AS n FROM search_events WHERE entry = 'chip' AND query_normalized = 'кумыс'")).rows[0].n;
  await page.getByRole('button', { name: 'Кумыс', exact: true }).click();
  await expect(page.getByText(/ничего не найдено|Сейчас предложений нет|предложен/i).first()).toBeVisible();
  await settle(page);
  const after = (await connection.pool.query("SELECT count(*)::int AS n FROM search_events WHERE entry = 'chip' AND query_normalized = 'кумыс'")).rows[0].n;
  expect(after - before).toBe(1);
  cleanupTexts.push('кумыс');
});

test('a repeat inside the 60 s window, sorting, «По умолчанию», Back, «Поиск» and reload record nothing more', async ({ page }) => {
  const text = textOf('excluded');
  const product = productName.toLowerCase();
  cleanupTexts.push(product);
  await page.goto('/');
  await field(page).fill(productName);
  await field(page).press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
  // the first search of the Product: one event (resolved, one Offer), then every service action stays silent
  await settle(page);
  const [first] = await events(product);
  await expect.poll(() => count(product)).toBe(1);
  expect(first).toMatchObject({ entry: 'submit', resolution: 'resolved', resolved_product_id: productId, result_count: 1 });
  const lamb = () => count(product);
  const baseline = 1;

  // the same query again inside the 60 s window (same tab memory) is a repeat: no second event
  await field(page).fill(productName);
  await field(page).press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
  await field(page).press('Enter');
  await settle(page);
  expect(await lamb()).toBe(baseline);

  await page.getByRole('button', { name: /^Порядок результатов: / }).click();
  await page.getByRole('group', { name: 'Порядок результатов' }).getByRole('button', { name: /^По цене/ }).click();
  await page.getByRole('button', { name: /^Порядок результатов: / }).click();
  await page.getByRole('group', { name: 'Порядок результатов' }).getByRole('button', { name: 'По умолчанию', exact: true }).click();
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Ещё', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Поиск', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article').first()).toBeVisible();
  await settle(page);
  expect(await lamb()).toBe(baseline);

  // a different query is a new event (the window is per key)
  await search(page, text);
  await settle(page);
  await expect.poll(() => count(text)).toBe(1);
});

test('two quick Enters give one event', async ({ page }) => {
  const text = textOf('double');
  await page.goto('/');
  await field(page).fill(text);
  await field(page).press('Enter');
  await field(page).press('Enter');
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await expect.poll(() => count(text)).toBe(1);
  await settle(page);
  await expect.poll(() => count(text)).toBe(1);
});

test('First Entry: the first search is recorded once; reload, Back and restoration replay nothing; the URL and the results are unchanged', async ({ browser }) => {
  const context = await browser.newContext({ storageState: firstVisitState });
  const page = await context.newPage();
  const text = textOf('first entry');
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('searchbox').first().fill(text);
  await page.getByRole('searchbox').first().press('Enter');
  await expect(page).toHaveURL(/\/\?q=/);
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await settle(page);
  await expect.poll(() => count(text)).toBe(1);
  expect(new URL(page.url()).search).toBe(`?q=${encodeURIComponent(text).replace(/%20/g, '+')}`);

  await page.reload();
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Ещё', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Поиск', exact: true }).click();
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await settle(page);
  await expect.poll(() => count(text)).toBe(1);
  await context.close();
});

test('a failed search records nothing; the retry records the deliberate search once on success', async ({ page }) => {
  const text = textOf('retry');
  await page.goto('/');
  let failures = 1;
  await page.route('**/api/search?**', async (route) => {
    if (failures > 0) { failures -= 1; await route.abort(); return; }
    await route.continue();
  });
  await field(page).fill(text);
  await field(page).press('Enter');
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await settle(page);
  expect(await count(text)).toBe(0);
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await settle(page);
  await expect.poll(() => count(text)).toBe(1);
});

test('a lost response followed by a retry can duplicate the event — the documented best-effort semantics', async ({ page }) => {
  const text = textOf('lost response');
  await page.goto('/');
  let lose = true;
  await page.route('**/api/search?**', async (route) => {
    if (lose) {
      lose = false;
      await route.fetch(); // the server answers and records the event ...
      await route.abort(); // ... but the browser never sees the response
      return;
    }
    await route.continue();
  });
  await field(page).fill(text);
  await field(page).press('Enter');
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText(/ничего не найдено/).first()).toBeVisible();
  await settle(page);
  await expect.poll(() => count(text)).toBe(2);
});

test('the API: no intent records nothing; an invalid intent is a 400; refused queries are searched but not recorded', async ({ request }) => {
  const text = textOf('api');
  const get = (query: string, extra = '') => request.get(`/api/search?q=${encodeURIComponent(query)}${extra}`);
  expect((await get(text)).status()).toBe(200);
  expect((await get(text, '&intent=nonsense')).status()).toBe(400);
  expect((await request.post('/api/search', { data: { q: text, intent: 'nonsense', buyerLocation: { latitude: 43.25, longitude: 76.95 } } })).status()).toBe(400);
  expect(await count(text)).toBe(0);

  const withIntent = await get(text, '&intent=submit');
  expect(withIntent.status()).toBe(200);
  expect(await withIntent.json()).toEqual(await (await get(text)).json());
  await expect.poll(() => count(text)).toBe(1);

  // refused by the filter: the Search itself works, no event
  const phone = `evt${marker} 8 701 555 09 71`;
  expect((await get(phone, '&intent=submit')).status()).toBe(200);
  const long = `evt${marker} ${'я'.repeat(120)}`;
  expect((await get(long, '&intent=submit')).status()).toBe(200);
  const refused = (await connection.pool.query("SELECT count(*)::int AS n FROM search_events WHERE query_normalized LIKE $1 AND (query_normalized ~ '701' OR length(query_normalized) > 90)", [`evt${marker}%`])).rows[0].n;
  expect(refused).toBe(0);
});
