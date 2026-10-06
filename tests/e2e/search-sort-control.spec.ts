import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// Search sorting control UX refresh (docs/slices/search-sort-control-refresh): one compact row under the search field — default
// «Сортировка» + an indicator; explicit sort: criterion + direction arrow, a separate list trigger and × (reset). Mobile + Russian.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

const STORAGE_KEY = 'kaida:last-search';
const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let sellerId: string;
const keys = ['linked', 'whole', 'prefix'] as const;
const points = { linked: '', whole: '', prefix: '' };
const locationIds = { linked: '', whole: '', prefix: '' };

test.beforeAll(async ({}, workerInfo) => {
  const suffix = `${workerInfo.project.name}-${randomUUID().slice(0, 8)}`;
  productId = randomUUID();
  sellerId = randomUUID();
  productName = `Sortrow Product ${suffix.replace('-', ' ')}`;
  for (const key of keys) {
    locationIds[key] = randomUUID();
    points[key] = `Sortrow ${key} ${suffix}`;
  }
  connection = createDatabase(testDatabaseUrl());
  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, `Sortrow seller ${suffix}`, '+77015550973']);
  const now = Date.now();
  const rows: Array<[typeof keys[number], string | null, string, number, string]> = [
    ['linked', productId, productName, 120, '3000'],
    ['whole', null, `${productName} extra`, 30, '1000'],
    ['prefix', null, `${productName}x`, 5, '2000'],
  ];
  for (const [key, linkedProduct, title, minutesAgo, price] of rows) {
    await connection.pool.query("INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,'shop')", [locationIds[key], sellerId, points[key], `Sortrow ${key} address`]);
    const at = new Date(now - minutesAgo * 60_000);
    await connection.pool.query(
      `INSERT INTO offers
        (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
        VALUES (gen_random_uuid(),$1,$2,$3,$4,'KZT','kg','active',$5,$5,$5,$6,lower($6),gen_random_uuid())`,
      [linkedProduct, sellerId, locationIds[key], price, at, title],
    );
  }
});

test.afterAll(async () => {
  await connection.pool.query('DELETE FROM offers WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM products WHERE id=$1', [productId]);
  await connection.pool.end();
});

async function mockGeolocation(page: Page, mode: 'grant' | 'deny') {
  await page.addInitScript(({ point, behaviour }) => {
    Object.defineProperty(window, '__geoCalls', { value: 0, writable: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback, failure?: PositionErrorCallback) {
          (window as unknown as { __geoCalls: number }).__geoCalls += 1;
          if (behaviour === 'deny') {
            failure?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
            return;
          }
          success({
            coords: { latitude: point.latitude, longitude: point.longitude, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });
  }, { point: buyerLocation, behaviour: mode });
}
const geoCalls = (page: Page) => page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);

const field = (page: Page) => page.getByRole('searchbox', { name: 'Какой товар ищете?' });
const sortButton = (page: Page) => page.getByRole('button', { name: 'Сортировка', exact: true });
const reset = (page: Page) => page.getByRole('button', { name: 'Сбросить сортировку', exact: true });
const list = (page: Page) => page.getByRole('group', { name: 'Сортировка' });
const storedState = (page: Page) => page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY);

async function searchProduct(page: Page) {
  await page.goto('/');
  await field(page).fill(productName);
  await field(page).press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
}

async function expectOrder(page: Page, order: Array<typeof keys[number]>) {
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(order.length);
  for (let index = 0; index < order.length; index++) await expect(cards.nth(index)).toContainText(points[order[index]!]);
}

async function expectOneLine(page: Page) {
  const row = sortButton(page).first().locator('xpath=ancestor::div[1]');
  const box = (await row.boundingBox())!;
  const buttons = await row.getByRole('button').all();
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
  const tops = boxes.map((b) => b!.y);
  // every control sits on the same line, inside the screen, none overlaps the next
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(box.height);
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i]!.x + boxes[i]!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (i > 0) expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width - 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('the default row is «Сортировка» + an indicator under the field: no icon, no caption, no ×', async ({ page }) => {
  await searchProduct(page);
  await expect(sortButton(page)).toHaveCount(1);
  await expect(sortButton(page)).toHaveText('Сортировка');
  await expect(reset(page)).toHaveCount(0);
  await expect(page.getByText(/^Порядок:/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /соответств/ })).toHaveCount(0);
  const input = (await field(page).boundingBox())!;
  const row = (await sortButton(page).boundingBox())!;
  expect(row.y).toBeGreaterThanOrEqual(input.y + input.height);
  expect(row.height).toBeGreaterThanOrEqual(44);
  await expectOneLine(page);
  await expectOrder(page, ['linked', 'whole', 'prefix']);
});

test('an explicit sort shows criterion + arrow, the list trigger and ×; the arrow reverses; × returns to relevance', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await searchProduct(page);
  await sortButton(page).click();
  await expect(list(page).getByRole('button')).toHaveCount(3);
  await list(page).getByRole('button', { name: /^По цене/ }).click();
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  await page.keyboard.press('Escape');

  const criterion = page.getByRole('button', { name: 'По цене, дешевле первыми', exact: true });
  await expect(criterion).toBeVisible();
  await expect(criterion).toContainText('↑');
  await expect(sortButton(page)).toHaveCount(1); // the list trigger
  await expect(reset(page)).toBeVisible();
  const resetBox = (await reset(page).boundingBox())!;
  expect(resetBox.width).toBeGreaterThanOrEqual(44);
  expect(resetBox.height).toBeGreaterThanOrEqual(44);
  await expectOneLine(page);

  // A tap on the criterion (or its arrow) changes the direction.
  await criterion.click();
  await expectOrder(page, ['linked', 'prefix', 'whole']);
  await expect(page.getByRole('button', { name: 'По цене, дороже первыми', exact: true })).toContainText('↓');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'price', direction: 'desc' });

  await reset(page).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(reset(page)).toHaveCount(0);
  await expect(sortButton(page)).toHaveText('Сортировка');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });
  expect(requests.at(-1)).toContain('sort=relevance');
  expect(requests.at(-1)).not.toContain('direction');
});

test('the reset changes only the sort: the query and the selected Product stay', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await page.goto(`/?q=${encodeURIComponent(productName)}&product=${productId}`);
  await expect(page.getByRole('article').first()).toBeVisible();
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По актуальности/ }).click();
  await page.keyboard.press('Escape');
  await reset(page).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(field(page)).toHaveValue(productName);
  await expect(page).toHaveURL(new RegExp(`product=${productId}`));
  expect(requests.at(-1)).toContain(`product_id=${productId}`);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 3, query: productName, sort: 'relevance', productId });
});

test('the row is hidden with no Offers and comes back with the chosen sort', async ({ page }) => {
  await searchProduct(page);
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По цене/ }).click();
  await page.keyboard.press('Escape');
  await expect(reset(page)).toBeVisible();

  await field(page).fill('zzzzxq');
  await field(page).press('Enter');
  await expect(page.getByText('По вашему запросу ничего не найдено.')).toBeVisible();
  await expect(sortButton(page)).toHaveCount(0);
  await expect(reset(page)).toHaveCount(0);

  await field(page).fill(productName);
  await field(page).press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'По цене, дешевле первыми', exact: true })).toBeVisible();
  await expect(reset(page)).toBeVisible();
});

test('«По расстоянию» without geolocation: a denied prompt gives the notice and the default row, never «distance» without coordinates', async ({ page }) => {
  await mockGeolocation(page, 'deny');
  const sorts: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname !== '/api/search') return;
    sorts.push(url.searchParams.get('sort') ?? (JSON.parse(request.postData() ?? '{}') as { sort?: string }).sort ?? 'none');
  });
  await searchProduct(page);
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По расстоянию/ }).click();
  await expect(page.getByText('Для сортировки по расстоянию нужен доступ к местоположению.')).toBeVisible();
  await expect(reset(page)).toHaveCount(0);
  await expect(sortButton(page)).toHaveText('Сортировка');
  expect(await geoCalls(page)).toBe(1);
  expect(sorts).not.toContain('distance');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });
});

test('«По расстоянию» with geolocation: one explicit prompt; the row shows it; × resets without another prompt', async ({ page }) => {
  await mockGeolocation(page, 'grant');
  await searchProduct(page);
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По расстоянию/ }).click();
  expect(await geoCalls(page)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'По расстоянию, ближе первыми', exact: true })).toBeVisible();
  await expectOneLine(page);
  await reset(page).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(sortButton(page)).toHaveText('Сортировка');
  expect(await geoCalls(page)).toBe(1);
});

test('the row stays on one line at 320 px in every state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockGeolocation(page, 'grant');
  await searchProduct(page);
  await expectOneLine(page);
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По расстоянию/ }).click();
  await expect.poll(() => geoCalls(page)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'По расстоянию, ближе первыми', exact: true })).toBeVisible();
  await expectOneLine(page);
});

test('Back from an Offer and «Поиск» keep the explicit sort with its × visible', async ({ page }) => {
  await searchProduct(page);
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По цене/ }).click();
  await page.keyboard.press('Escape');
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  await expect(page.getByRole('button', { name: 'По цене, дешевле первыми', exact: true })).toBeVisible();
  await expect(reset(page)).toBeVisible();
});

test('keyboard: the list trigger announces its state, Escape closes it and returns the focus to the trigger', async ({ page }) => {
  await searchProduct(page);
  const trigger = sortButton(page);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
