import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// Search sorting control UX refresh (docs/slices/search-sort-control-refresh): one compact inline row below the chips — default:
// sliders / «По умолчанию» / indicator; explicit: sliders / criterion + current arrow / indicator — the whole row is one dropdown
// trigger; the list closes after a choice; «По умолчанию» is the only way back. Mobile + Russian.
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
  // the whole row is one button: it stays on a single line, inside the screen, and does not make the page scroll sideways
  const box = (await trigger(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.height).toBeLessThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const trigger = (page: Page) => page.getByRole('button', { name: /^Порядок результатов: / });
const item = (page: Page, name: RegExp | string) => list(page).getByRole('button', { name });
// The list closes after every choice: a choice opens it first (when it is not open yet).
async function choose(page: Page, name: RegExp | string) {
  if (!(await list(page).isVisible())) await trigger(page).click();
  await item(page, name).click();
  await expect(list(page)).toHaveCount(0);
}

test('the default row is sliders / «По умолчанию» / an indicator, one trigger below the chips and above the results: no pill, no caption, no ×', async ({ page }) => {
  await searchProduct(page);
  await expect(trigger(page)).toHaveCount(1);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По умолчанию');
  await expect(trigger(page)).toContainText('По умолчанию');
  // The whole row is the one button: icon, text and indicator are inside it; nothing else is interactive in the row.
  const row = trigger(page).locator('xpath=ancestor::div[1]');
  await expect(row.getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Сбросить/ })).toHaveCount(0);
  await expect(page.getByText(/^Порядок:/)).toHaveCount(0);
  await expect(page.getByText(/Сортировк|Сортировать|соответств/)).toHaveCount(0);
  const chips = (await page.locator('.chips-row').boundingBox())!;
  const box = (await trigger(page).boundingBox())!;
  const firstCard = (await page.getByRole('article').first().boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(chips.y + chips.height - 8);
  expect(box.y + box.height).toBeLessThanOrEqual(firstCard.y + 8);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expectOneLine(page);
  await expectOrder(page, ['linked', 'whole', 'prefix']);
});

test('a tap on the text, the icon or the indicator opens the same list', async ({ page }) => {
  await searchProduct(page);
  const box = (await trigger(page).boundingBox())!;
  await trigger(page).getByText('По умолчанию').click();
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list(page)).toHaveCount(0);
  await page.mouse.click(box.x + 14, box.y + box.height / 2); // the icon
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2); // the indicator
  await expect(list(page)).toBeVisible();
});

test('the list: four items, arrows show what a click applies, and it closes after any choice — also the active default', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await searchProduct(page);
  await trigger(page).click();
  await expect(list(page).getByRole('button')).toHaveCount(4);
  await expect(list(page).getByRole('button', { name: 'По умолчанию', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(list(page).getByRole('button', { name: 'По умолчанию', exact: true })).not.toContainText(/[↑↓]/);
  // inactive explicit items show their natural direction (the result of selecting them)
  await expect(item(page, /^По цене/)).toContainText('↑');
  await expect(item(page, /^По расстоянию/)).toContainText('↑');
  await expect(item(page, /^По актуальности/)).toContainText('↓');

  // the active default: closes the list and does nothing else
  const before = requests.length;
  await item(page, 'По умолчанию').click();
  await expect(list(page)).toHaveCount(0);
  expect(requests.length).toBe(before);
  await expect(trigger(page)).toBeFocused();
});

test('a different criterion applies its natural direction; the active one reverses; the row shows the current direction, the active item the opposite', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await searchProduct(page);
  await choose(page, /^По цене/);
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  // the row: the CURRENT direction; the accessible name is the state, not an action
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По цене, дешевле первыми');
  await expect(trigger(page)).toContainText('По цене');
  await expect(trigger(page)).toContainText('↑');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'price', direction: 'asc' });

  // the list: the active item shows the OPPOSITE direction and names the action
  await trigger(page).click();
  await expect(item(page, 'По цене, применить: дороже первыми')).toContainText('↓');
  await expect(item(page, 'По цене, применить: дороже первыми')).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, 'По расстоянию, применить: ближе первыми')).toContainText('↑');
  await expect(item(page, 'По актуальности, применить: сначала актуальные')).toContainText('↓');
  await item(page, /^По цене/).click();
  await expect(list(page)).toHaveCount(0);
  await expectOrder(page, ['linked', 'prefix', 'whole']);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По цене, дороже первыми');
  await expect(trigger(page)).toContainText('↓');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'price', direction: 'desc' });

  // the row never reverses the direction: a tap opens the list
  const requestsBefore = requests.length;
  await trigger(page).click();
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(requests.length).toBe(requestsBefore);
  await expectOrder(page, ['linked', 'prefix', 'whole']);

  // a different criterion starts in its natural direction
  await choose(page, /^По актуальности/);
  await expectOrder(page, ['prefix', 'whole', 'linked']);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По актуальности, сначала актуальные');
});

test('«По умолчанию» is the only way back: relevance without a direction, query and Product kept', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') requests.push(url.search);
  });
  await page.goto(`/?q=${encodeURIComponent(productName)}&product=${productId}`);
  await expect(page.getByRole('article').first()).toBeVisible();
  await choose(page, /^По актуальности/);
  await expectOrder(page, ['prefix', 'whole', 'linked']);
  await choose(page, 'По умолчанию');
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По умолчанию');
  await expect(field(page)).toHaveValue(productName);
  await expect(page).toHaveURL(new RegExp(`product=${productId}`));
  expect(requests.at(-1)).toContain(`product_id=${productId}`);
  expect(requests.at(-1)).toContain('sort=relevance');
  expect(requests.at(-1)).not.toContain('direction');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 3, query: productName, sort: 'relevance', productId });
});

test('the row is hidden with no Offers and comes back with the chosen sort', async ({ page }) => {
  await searchProduct(page);
  await choose(page, /^По цене/);

  await field(page).fill('zzzzxq');
  await field(page).press('Enter');
  await expect(page.getByText(/Ничего не найдено по запросу/)).toBeVisible();
  await expect(trigger(page)).toHaveCount(0);

  await field(page).fill(productName);
  await field(page).press('Enter');
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По цене, дешевле первыми');
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
  await choose(page, /^По расстоянию/);
  await expect(page.getByText('Для сортировки по расстоянию нужен доступ к местоположению.')).toBeVisible();
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По умолчанию');
  expect(await geoCalls(page)).toBe(1);
  expect(sorts).not.toContain('distance');
  expect(JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: productName, sort: 'relevance' });
});

test('«По расстоянию» with geolocation: one explicit prompt; the row shows it; «По умолчанию» resets without another prompt', async ({ page }) => {
  await mockGeolocation(page, 'grant');
  await searchProduct(page);
  await choose(page, /^По расстоянию/);
  await expect.poll(() => geoCalls(page)).toBe(1);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По расстоянию, ближе первыми');
  await expectOneLine(page);
  await choose(page, 'По умолчанию');
  await expectOrder(page, ['linked', 'whole', 'prefix']);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По умолчанию');
  expect(await geoCalls(page)).toBe(1);
});

for (const width of [320, 360]) {
  test(`the row stays on one line at ${width} px and the open list stays inside the screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await mockGeolocation(page, 'grant');
    await searchProduct(page);
    await expectOneLine(page);
    await trigger(page).click();
    const box = (await list(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await item(page, /^По расстоянию/).click();
    await expect.poll(() => geoCalls(page)).toBe(1);
    await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По расстоянию, ближе первыми');
    await expectOneLine(page);
  });
}

test('Back from an Offer and «Поиск» keep the explicit sort and its direction', async ({ page }) => {
  await searchProduct(page);
  await choose(page, /^По цене/);
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expectOrder(page, ['whole', 'prefix', 'linked']);
  await expect(trigger(page)).toHaveAttribute('aria-label', 'Порядок результатов: По цене, дешевле первыми');
});

test('keyboard: the trigger announces its state, Escape closes the list, and the focus returns to the trigger', async ({ page }) => {
  await searchProduct(page);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  await trigger(page).click();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
});
