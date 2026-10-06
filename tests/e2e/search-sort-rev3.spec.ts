import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// Stage 6 Rev 3 (docs/slices/search-sort-rev3): the explicit sort popover — Расстояние / Цена / Актуальность, each with a
// direction, applied at once; the selected criterion is the real primary ordering. Mobile + Russian is the current gate
// (PROJECT_RULES.md §18.5).
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };
const STORAGE_KEY = 'kaida:last-search';

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let sellerId: string;
// Four points: near the buyer, 5.5 km and 11 km away, and one without coordinates.
const points = { near: '', far1: '', far2: '', geoless: '' };
const locationIds = { near: '', far1: '', far2: '', geoless: '' };

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
  productName = `Rev3 E2E Product ${suffix}`;
  for (const key of ['near', 'far1', 'far2', 'geoless'] as const) {
    locationIds[key] = randomUUID();
    points[key] = `Rev3 ${key} ${suffix}`;
  }
  connection = createDatabase(testDatabaseUrl());
  const now = Date.now();
  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, `Rev3 seller ${suffix}`, '+77015550971']);
  await connection.pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$5,$6,'Rev3 near address','shop',$10,$11),
    ($2,$5,$7,'Rev3 far1 address','shop',$12,$11),
    ($3,$5,$8,'Rev3 far2 address','shop',$13,$11),
    ($4,$5,$9,'Rev3 geoless address','shop',NULL,NULL)`,
  [locationIds.near, locationIds.far1, locationIds.far2, locationIds.geoless, sellerId, points.near, points.far1, points.far2, points.geoless,
    buyerLocation.latitude, buyerLocation.longitude, buyerLocation.latitude + 0.05, buyerLocation.latitude + 0.1]);

  // Deliberately uncorrelated: the cheapest is the oldest (ageing), the freshest is geo-less, units differ.
  const rows: Array<[string, number, string, number]> = [
    [locationIds.far1, 800, 'package', 3 * 24 * 60], // ageing, cheapest
    [locationIds.near, 1000, 'kg', 60],
    [locationIds.geoless, 1000, 'liter', 5], // freshest, same nominal price as `near`
    [locationIds.far2, 2500, 'piece', 40],
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

async function expectOrder(page: Page, names: string[]) {
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(names.length);
  for (let index = 0; index < names.length; index++) await expect(cards.nth(index)).toContainText(names[index]!);
}

async function searchProduct(page: Page) {
  await page.goto('/');
  const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
  await field.fill(productName);
  await field.press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
}

const trigger = (page: Page) => page.getByRole('button', { name: 'Порядок результатов', exact: true });
const popover = (page: Page) => page.getByRole('group', { name: 'Порядок результатов' });

test('the sort list holds «По умолчанию» and three criteria; none of the old filter controls exist', async ({ page }) => {
  await page.goto('/');
  // No sort control on the Search Home.
  await expect(trigger(page)).toHaveCount(0);

  await searchProduct(page);
  await trigger(page).click();
  await expect(popover(page).getByRole('button')).toHaveCount(4);
  await expect(popover(page).getByRole('button', { name: /^По расстоянию/ })).toBeVisible();
  await expect(popover(page).getByRole('button', { name: /^По цене/ })).toBeVisible();
  // The default value (relevance) is the active item; there is no «По соответствию» anywhere.
  await expect(popover(page).getByRole('button', { name: 'По умолчанию', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(popover(page).getByRole('button', { name: /^По актуальности/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(popover(page).getByRole('button', { name: /соответств/ })).toHaveCount(0);

  // Nothing of the removed Stage 5 filters or the rejected Rev 2 price range.
  for (const gone of [/^Показать \d+ предложени/, 'Сбросить', 'Фильтры', 'Применить']) {
    await expect(page.getByRole('button', { name: gone })).toHaveCount(0);
  }
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/до \d км/)).toHaveCount(0);
  await expect(page.getByLabel('Цена от')).toHaveCount(0);
});

test('price sorts by the nominal amount across units; a second tap reverses; actuality sorts directly by age', async ({ page }) => {
  await searchProduct(page);
  // Default: the actuality, fresher first.
  await expectOrder(page, [points.geoless, points.far2, points.near, points.far1]);

  await trigger(page).click();
  await popover(page).getByRole('button', { name: /^По цене/ }).click();
  // 800 ₸ / упак. precedes the 1000 ₸ Offers (per кг and per л — equal prices keep «fresher first»), then 2500 ₸.
  await expectOrder(page, [points.far1, points.geoless, points.near, points.far2]);
  await expect(popover(page).getByRole('button', { name: 'По цене, дешевле первыми', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await popover(page).getByRole('button', { name: /^По цене/ }).click();
  await expectOrder(page, [points.far2, points.geoless, points.near, points.far1]);
  await expect(popover(page).getByRole('button', { name: 'По цене, дороже первыми', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Switching the criterion starts with its natural direction; the ageing Offer is no longer forced last.
  await popover(page).getByRole('button', { name: /^По актуальности/ }).click();
  await expectOrder(page, [points.geoless, points.far2, points.near, points.far1]);
  await popover(page).getByRole('button', { name: /^По актуальности/ }).click();
  await expectOrder(page, [points.far1, points.near, points.far2, points.geoless]);

  // The popover stayed open after every choice; Escape closes it and returns the focus to the button.
  await expect(popover(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
});

test('«Расстояние» is the explicit geo intent: nearer first, farther first, geo-less last for both directions', async ({ page }) => {
  await mockGeolocation(page, 'grant');
  await searchProduct(page);
  expect(await geoCalls(page)).toBe(0);

  await trigger(page).click();
  await popover(page).getByRole('button', { name: /^По цене/ }).click();
  expect(await geoCalls(page)).toBe(0);

  await popover(page).getByRole('button', { name: /^По расстоянию/ }).click();
  await expectOrder(page, [points.near, points.far1, points.far2, points.geoless]);
  expect(await geoCalls(page)).toBe(1);
  await expect(popover(page).getByRole('button', { name: 'По расстоянию, ближе первыми', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await popover(page).getByRole('button', { name: /^По расстоянию/ }).click();
  await expectOrder(page, [points.far2, points.far1, points.near, points.geoless]);
  // The coordinates are already known on this screen: no second prompt.
  expect(await geoCalls(page)).toBe(1);

  // The state of the tab never holds the coordinates.
  const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY);
  expect(JSON.parse(stored ?? 'null')).toEqual({ v: 2, query: productName, sort: 'distance', direction: 'desc' });
  expect(stored).not.toContain('latitude');
});

test('a denied geolocation falls back to the default relevance with a short notice and never sends «distance» without coordinates', async ({ page }) => {
  await mockGeolocation(page, 'deny');
  const sorts: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname !== '/api/search') return;
    sorts.push(url.searchParams.get('sort') ?? (JSON.parse(request.postData() ?? '{}') as { sort?: string }).sort ?? 'none');
  });
  await searchProduct(page);
  await trigger(page).click();
  await popover(page).getByRole('button', { name: /^По цене/ }).click();
  await expectOrder(page, [points.far1, points.geoless, points.near, points.far2]);

  await popover(page).getByRole('button', { name: /^По расстоянию/ }).click();
  await expect(page.getByText('Для сортировки по расстоянию нужен доступ к местоположению.')).toBeVisible();
  // Back to the default relevance — in the visible state (no criterion, no ×), the order and the tab state alike.
  await expect(page.getByRole('button', { name: 'Сбросить сортировку', exact: true })).toHaveCount(0);
  await expect(popover(page).getByRole('button', { name: 'По умолчанию', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectOrder(page, [points.geoless, points.far2, points.near, points.far1]);
  expect(await geoCalls(page)).toBe(1);
  expect(sorts).not.toContain('distance');
  const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY);
  expect(JSON.parse(stored ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });

  // Choosing another criterion clears the notice; no further prompt without another «Расстояние» tap.
  await popover(page).getByRole('button', { name: /^По цене/ }).click();
  await expect(page.getByText('Для сортировки по расстоянию нужен доступ к местоположению.')).toHaveCount(0);
  expect(await geoCalls(page)).toBe(1);
});

test('a tap outside closes the popover', async ({ page }) => {
  await searchProduct(page);
  await trigger(page).click();
  await expect(popover(page)).toBeVisible();
  await page.mouse.click(10, 600);
  await expect(popover(page)).toHaveCount(0);
});
