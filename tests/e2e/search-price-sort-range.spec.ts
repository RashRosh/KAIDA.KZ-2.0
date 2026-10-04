import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// Stage #6: «Сначала дешевле» + «Цена, ₸» от–до (nominal price, units not normalized, inclusive bounds).
test.describe.configure({ mode: 'serial' });

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let sellerId: string;
const locationNames = { geoless: '', a: '', b: '' };
const locationIds = { geoless: '', a: '', b: '' };

async function cleanup() {
  if (!connection) return;
  await connection.pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await connection.pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM products WHERE id=$1', [productId]);
}

test.beforeAll(async ({}, workerInfo) => {
  const suffix = `${workerInfo.project.name}-${randomUUID().slice(0, 8)}`;
  productId = randomUUID();
  sellerId = randomUUID();
  productName = `S6b E2E Product ${suffix}`;
  for (const key of ['geoless', 'a', 'b'] as const) {
    locationIds[key] = randomUUID();
    locationNames[key] = `S6b ${key} ${suffix}`;
  }
  connection = createDatabase(testDatabaseUrl());
  const now = Date.now();
  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, `S6b seller ${suffix}`, '+77015550960']);
  await connection.pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$4,$5,'S6b geoless address','shop',NULL,NULL),
    ($2,$4,$6,'S6b a address','shop',43.238949,76.889709),
    ($3,$4,$7,'S6b b address','shop',43.248949,76.899709)`,
  [locationIds.geoless, locationIds.a, locationIds.b, sellerId, locationNames.geoless, locationNames.a, locationNames.b]);
  // Freshness: b (2000/шт) newest, a (1000/кг) middle, geoless (500/упак) oldest — actuality order is the reverse of price.
  const rows: Array<[string, number, string, number]> = [
    [locationIds.geoless, 500, 'package', 3],
    [locationIds.a, 1000, 'kg', 2],
    [locationIds.b, 2000, 'piece', 1],
  ];
  for (const [locationId, amount, unit, minutesAgo] of rows) {
    const at = new Date(now - minutesAgo * 60_000);
    await connection.pool.query(
      `INSERT INTO offers
        (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
        VALUES ($1,$2,$3,$4,$5,'KZT',$6,'active',$7,$7,$7,$8,lower($8),gen_random_uuid())`,
      [randomUUID(), productId, sellerId, locationId, amount, unit, at, productName],
    );
  }
});

test.afterAll(async () => {
  await cleanup();
  await connection.pool.end();
});

async function expectCardOrder(page: Page, names: string[]) {
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(names.length);
  for (let index = 0; index < names.length; index++) {
    await expect(cards.nth(index)).toContainText(names[index]!);
  }
}

async function search(page: Page) {
  await page.goto('/');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  await input.press('Enter');
  await expectCardOrder(page, [locationNames.b, locationNames.a, locationNames.geoless]);
}

async function openFilters(page: Page) {
  await page.getByRole('button', { name: /^Фильтры/ }).click();
}

async function fillPrice(page: Page, from: string, to: string) {
  await page.getByLabel('Цена от', { exact: true }).fill(from);
  await page.getByLabel('Цена до', { exact: true }).fill(to);
}

test('«Сначала дешевле» orders by nominal price (geo-less included) and the chip resets it', async ({ page }) => {
  await search(page);
  await openFilters(page);
  await expect(page.getByRole('radio', { name: 'Сначала дешевле' })).toBeVisible();
  await expect(page.getByText('Сравниваем цену, как она указана в карточке', { exact: false })).toBeVisible();

  const request = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/search' && r.url().includes('sort=cheaper'));
  await page.getByRole('radio', { name: 'Сначала дешевле' }).click();
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  await request;
  await expectCardOrder(page, [locationNames.geoless, locationNames.a, locationNames.b]);
  await expect(page.getByRole('button', { name: 'Фильтры, активно 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Убрать фильтр Сначала дешевле' }).click();
  await expectCardOrder(page, [locationNames.b, locationNames.a, locationNames.geoless]);
});

test('price from–to filters instantly, inclusively and across units; chip removes it', async ({ page }) => {
  await search(page);
  let searchRequests = 0;
  page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/search') searchRequests += 1; });

  await openFilters(page);
  await fillPrice(page, '500', '1000');
  await expect(page.getByRole('button', { name: /^Показать 2 предложени/ })).toBeVisible();
  await page.getByRole('button', { name: /^Показать 2 предложени/ }).click();
  // Inclusive bounds: 500 (упак.) and 1000 (кг) stay, 2000 (шт.) goes — no new request, units not normalized.
  await expectCardOrder(page, [locationNames.a, locationNames.geoless]);
  expect(searchRequests).toBe(0);
  await expect(page.getByRole('button', { name: 'Фильтры, активно 1' })).toBeVisible();

  const chip = page.getByRole('button', { name: /^Убрать фильтр от 500 – до 1\s000 ₸$/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await expectCardOrder(page, [locationNames.b, locationNames.a, locationNames.geoless]);
  expect(searchRequests).toBe(0);
});

test('an invalid range shows validation and is not applied; a valid empty range shows the filtered-empty state', async ({ page }) => {
  await search(page);
  await openFilters(page);
  await fillPrice(page, '2000', '500');
  await expect(page.getByRole('alert').filter({ hasText: 'Проверьте границы цены' })).toBeVisible();
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  // The sheet stays open, nothing was applied.
  await expect(page.getByRole('alert').filter({ hasText: 'Проверьте границы цены' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Фильтры, активно/ })).toHaveCount(0);

  await fillPrice(page, '5000', '');
  await expect(page.getByRole('alert').filter({ hasText: 'Проверьте границы цены' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Показать 0 предложени/ }).click();
  await expect(page.getByText('С такими фильтрами ничего нет')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('price state stays out of the URL and storage', async ({ page }) => {
  await search(page);
  await openFilters(page);
  await fillPrice(page, '500', '1000');
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  expect(page.url()).not.toMatch(/price|500|1000/);
  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  expect(stored).not.toMatch(/price|500|1000/);
});
