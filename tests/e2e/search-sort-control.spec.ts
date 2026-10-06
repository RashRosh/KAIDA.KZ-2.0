import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// Search sorting control UX refresh (docs/slices/search-sort-control-refresh): one compact inline row below the chips — default:
// sliders / «По умолчанию» / list trigger; explicit: sliders / criterion + arrow / list trigger / ×. Mobile + Russian.
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
const sortButton = (page: Page) => page.getByRole('button', { name: 'Порядок результатов', exact: true });
const reset = (page: Page) => page.getByRole('button', { name: 'Сбросить сортировку', exact: true });
const list = (page: Page) => page.getByRole('group', { name: 'Порядок результатов' });
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

const defaultValue = (page: Page) => page.getByText('По умолчанию', { exact: true }).first();

test('the default row is sliders / «По умолчанию» / a list trigger, below the chips and above the results: no pill, no caption, no ×', async ({ page }) => {
  await searchProduct(page);
  await expect(sortButton(page)).toHaveCount(1);
  await expect(defaultValue(page)).toBeVisible();
  // The default value and the icon are not interactive; no old labels and no caption.
  await expect(page.getByRole('button', { name: 'По умолчанию' })).toHaveCount(0);
  await expect(reset(page)).toHaveCount(0);
  await expect(page.getByText(/^Порядок:/)).toHaveCount(0);
  await expect(page.getByText(/Сортировк|Сортировать|соответств/)).toHaveCount(0);
  const chips = (await page.locator('.chips-row').boundingBox())!;
  const trigger = (await sortButton(page).boundingBox())!;
  const firstCard = (await page.getByRole('article').first().boundingBox())!;
  expect(trigger.y).toBeGreaterThanOrEqual(chips.y + chips.height - 8);
  expect(trigger.y + trigger.height).toBeLessThanOrEqual(firstCard.y + 8);
  expect(trigger.width).toBeGreaterThanOrEqual(44);
  expect(trigger.height).toBeGreaterThanOrEqual(44);
  await expectOneLine(page);
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  // A tap on the inert default value opens nothing.
  await defaultValue(page).click();
  await expect(list(page)).toHaveCount(0);
});

test('the list has four items; the active default does nothing; the list stays open after a choice', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await searchProduct(page);
  await sortButton(page).click();
  await expect(list(page).getByRole('button')).toHaveCount(4);
  await expect(list(page).getByRole('button', { name: 'По умолчанию', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const before = requests.length;
  await list(page).getByRole('button', { name: 'По умолчанию', exact: true }).click();
  await expect(list(page)).toBeVisible();
  expect(requests.length).toBe(before);
  await list(page).getByRole('button', { name: /^По цене/ }).click();
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  await expect(list(page)).toBeVisible();
});

test('an explicit sort: sliders / criterion + arrow / trigger / ×; the value and the active item reverse the direction; × and «По умолчанию» reset', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await searchProduct(page);
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По цене/ }).click();
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  // the active item shows the arrow; choosing it again reverses
  await expect(list(page).getByRole('button', { name: 'По цене, дешевле первыми', exact: true })).toContainText('↑');
  await list(page).getByRole('button', { name: /^По цене/ }).click();
  await expectOrder(page, ['linked', 'prefix', 'whole']);
  await expect(list(page).getByRole('button', { name: 'По цене, дороже первыми', exact: true })).toContainText('↓');
  await page.keyboard.press('Escape');
  await expect(list(page)).toHaveCount(0);

  const value = page.getByRole('button', { name: 'По цене, дороже первыми', exact: true });
  await expect(value).toContainText('↓');
  await expect(reset(page)).toBeVisible();
  const resetBox = (await reset(page).boundingBox())!;
  expect(resetBox.width).toBeGreaterThanOrEqual(44);
  expect(resetBox.height).toBeGreaterThanOrEqual(44);
  await expectOneLine(page);
  // The row value reverses the direction (the arrow is an indicator, not a separate action).
  await value.click();
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'price', direction: 'asc' });

  // × returns to relevance with no direction.
  await reset(page).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(reset(page)).toHaveCount(0);
  await expect(defaultValue(page)).toBeVisible();
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });
  expect(requests.at(-1)).toContain('sort=relevance');
  expect(requests.at(-1)).not.toContain('direction');

  // «По умолчанию» chosen from the list does the same.
  await sortButton(page).click();
  await list(page).getByRole('button', { name: /^По актуальности/ }).click();
  await expectOrder(page, ['prefix', 'whole', 'linked']);
  await list(page).getByRole('button', { name: 'По умолчанию', exact: true }).click();
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(reset(page)).toHaveCount(0);
  expect(requests.at(-1)).toContain('sort=relevance');
  expect(requests.at(-1)).not.toContain('direction');
});

test('returning to the default changes only the sort: the query and the selected Product stay', async ({ page }) => {
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
  await expect(defaultValue(page)).toBeVisible();
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
  await expect(defaultValue(page)).toBeVisible();
  expect(await geoCalls(page)).toBe(1);
});

for (const width of [320, 360]) {
  test(`the row stays on one line at ${width} px in every state`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await mockGeolocation(page, 'grant');
    await searchProduct(page);
    await expectOneLine(page);
    await sortButton(page).click();
    await list(page).getByRole('button', { name: /^По расстоянию/ }).click();
    await expect.poll(() => geoCalls(page)).toBe(1);
    // the open list is as wide as its content and stays inside the screen
    const box = (await list(page).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'По расстоянию, ближе первыми', exact: true })).toBeVisible();
    await expectOneLine(page);
  });
}

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
