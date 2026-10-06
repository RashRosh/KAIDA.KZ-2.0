import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// S15B-4b (docs/slices/s15b4b-relevance-sort): relevance is the default order; the explicit sorts keep their order.
// Three Offers of one query, uncorrelated with their freshness: the Product card (level 1) is the oldest, a free title with
// whole words (level 2) is in the middle, a free title that matches only by a word start (level 3) is the freshest.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

const STORAGE_KEY = 'kaida:last-search';

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let sellerId: string;
const points = { linked: '', whole: '', prefix: '' };
const locationIds = { linked: '', whole: '', prefix: '' };
const offerIds = { linked: '', whole: '', prefix: '' };

async function cleanup() {
  if (!connection) return;
  await connection.pool.query('DELETE FROM offers WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM products WHERE id=$1', [productId]);
}

test.beforeAll(async ({}, workerInfo) => {
  const suffix = `${workerInfo.project.name}-${randomUUID().slice(0, 8)}`;
  productId = randomUUID();
  sellerId = randomUUID();
  productName = `Relevance Product ${suffix.replace('-', ' ')}`;
  for (const key of ['linked', 'whole', 'prefix'] as const) {
    locationIds[key] = randomUUID();
    offerIds[key] = randomUUID();
    points[key] = `Relevance ${key} ${suffix}`;
  }
  connection = createDatabase(testDatabaseUrl());
  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, `Relevance seller ${suffix}`, '+77015550972']);
  for (const key of ['linked', 'whole', 'prefix'] as const) {
    await connection.pool.query(
      "INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,'shop')",
      [locationIds[key], sellerId, points[key], `Relevance ${key} address`],
    );
  }
  const now = Date.now();
  const rows: Array<[keyof typeof offerIds, string | null, string, number]> = [
    ['linked', productId, productName, 120],
    ['whole', null, `${productName} extra`, 30],
    ['prefix', null, `${productName}x`, 5],
  ];
  for (const [key, linkedProduct, title, minutesAgo] of rows) {
    const at = new Date(now - minutesAgo * 60_000);
    await connection.pool.query(
      `INSERT INTO offers
        (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
        VALUES ($1,$2,$3,$4,'1000','KZT','kg','active',$5,$5,$5,$6,lower($6),$1)`,
      [offerIds[key], linkedProduct, sellerId, locationIds[key], at, title],
    );
  }
});

test.afterAll(async () => {
  await cleanup();
  await connection.pool.end();
});

async function expectOrder(page: Page, keys: Array<keyof typeof points>) {
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(keys.length);
  for (let index = 0; index < keys.length; index++) await expect(cards.nth(index)).toContainText(points[keys[index]!]);
}

async function searchProduct(page: Page) {
  await page.goto('/');
  const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
  await field.fill(productName);
  await field.press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
}

const trigger = (page: Page) => page.getByRole('button', { name: /^Порядок результатов: / });
const popover = (page: Page) => page.getByRole('group', { name: 'Порядок результатов' });
// The list closes after every choice: a choice opens it first (when it is not open yet).
async function menu(page: Page) {
  const group = popover(page);
  if (!(await group.isVisible())) await trigger(page).click();
  return group;
}
const storedState = (page: Page) => page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY);

test('the default order is relevance: the Product card, whole words, then a word start — not the freshest first', async ({ page }) => {
  await searchProduct(page);
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });
  await trigger(page).click();
  // Relevance is the default value of the list («По умолчанию»), never «По соответствию».
  await expect(popover(page).getByRole('button')).toHaveCount(4);
  await expect(popover(page).getByRole('button', { name: 'По умолчанию', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('explicit sorts keep their order and direction; «По умолчанию» returns to relevance without a direction', async ({ page }) => {
  const searches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') searches.push(url.search);
  });
  await searchProduct(page);
  await trigger(page).click();
  // «По актуальности»: the freshest first — the order that relevance replaced as the default.
  await (await menu(page)).getByRole('button', { name: /^По актуальности/ }).click();
  await expectOrder(page, ['prefix', 'whole', 'linked']);
  await (await menu(page)).getByRole('button', { name: /^По актуальности/ }).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'actuality', direction: 'asc' });

  // «По умолчанию» is back to relevance: no direction on the request, none in the tab state.
  await (await menu(page)).getByRole('button', { name: 'По умолчанию', exact: true }).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });
  expect(searches.at(-1)).toContain('sort=relevance');
  expect(searches.at(-1)).not.toContain('direction');
});

test('Back from an Offer keeps the relevance order; an explicit actuality is restored as actuality', async ({ page }) => {
  await searchProduct(page);
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expectOrder(page, ['linked', 'whole', 'prefix']);

  await trigger(page).click();
  await (await menu(page)).getByRole('button', { name: /^По актуальности/ }).click();
  await expectOrder(page, ['prefix', 'whole', 'linked']);
  await page.keyboard.press('Escape');
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expectOrder(page, ['prefix', 'whole', 'linked']);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'actuality', direction: 'desc' });
});

test('API: no sort is relevance, a direction alone is the legacy actuality, relevance with a direction is a 400', async ({ request }) => {
  const get = async (params: string) => {
    const response = await request.get(`/api/search?q=${encodeURIComponent(productName)}${params}`);
    return { status: response.status(), ids: response.ok() ? (await response.json() as { offers: { id: string }[] }).offers.map((offer) => offer.id) : [] };
  };
  const relevance = [offerIds.linked, offerIds.whole, offerIds.prefix];
  expect(await get('')).toEqual({ status: 200, ids: relevance });
  expect(await get('&sort=relevance')).toEqual({ status: 200, ids: relevance });
  expect(await get('&direction=asc')).toEqual({ status: 200, ids: [offerIds.linked, offerIds.whole, offerIds.prefix] });
  expect(await get('&direction=desc')).toEqual({ status: 200, ids: [offerIds.prefix, offerIds.whole, offerIds.linked] });
  expect(await get('&sort=actuality')).toEqual({ status: 200, ids: [offerIds.prefix, offerIds.whole, offerIds.linked] });
  expect((await get('&sort=relevance&direction=asc')).status).toBe(400);
  const post = await request.post('/api/search', { data: { q: productName, sort: 'relevance', direction: 'desc', buyerLocation: { latitude: 43.25, longitude: 76.95 } } });
  expect(post.status()).toBe(400);
});
