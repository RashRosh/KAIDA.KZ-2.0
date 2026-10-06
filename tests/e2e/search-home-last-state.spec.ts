import { expect, test, type Page } from '@playwright/test';
import { firstVisitState } from './browser-state';

// Stage 6C (docs/slices/search-home-last-state): the Search Home (field + ≤5 chips, no feed), the layout after a search and
// the last Search of the tab reopened by «Поиск» with fresh results. Mobile + Russian is the current gate
// (PROJECT_RULES.md §18.5); specs start as a returning visitor (language chosen, First Entry already shown).
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

const STORAGE_KEY = 'kaida:last-search';
const field = (page: Page) => page.getByRole('searchbox', { name: 'Какой товар ищете?' });
const chips = (page: Page) => page.getByRole('group', { name: 'Популярные запросы' }).getByRole('button');
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('link', { name, exact: true });
const storedState = (page: Page) => page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY);

async function mockGeolocation(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__geoCalls', { value: 0, writable: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          (window as unknown as { __geoCalls: number }).__geoCalls += 1;
          success({
            coords: { latitude: 43.238949, longitude: 76.889709, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });
  });
}
const geoCalls = (page: Page) => page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);

test('the Search Home shows the centered field and at most five chips, with no feed and no request', async ({ page }) => {
  let searchRequests = 0;
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/api/search') searchRequests += 1; });
  await page.goto('/');
  await expect(field(page)).toBeVisible();
  await expect(chips(page)).toHaveCount(5);
  await expect(chips(page)).toHaveText(['Баранина', 'Говядина', 'Мёд', 'Картофель', 'Кумыс']);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText(/^Порядок:/)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await expect(page.getByText('Пример · так выглядит результат')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Сортировка', exact: true })).toHaveCount(0);
  const box = await field(page).boundingBox();
  expect(box?.y ?? 0).toBeGreaterThan(250);
  expect(searchRequests).toBe(0);
  expect(await storedState(page)).toBeNull();
});

test('a chip search moves the field and the chips to the top and keeps the chips visible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Баранина', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  const box = await field(page).boundingBox();
  expect(box?.y ?? 999).toBeLessThan(120);
  await expect(chips(page)).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Сортировка', exact: true })).toBeVisible();

  // The chips stay when there is nothing to show as well.
  await field(page).fill('несуществующийтовар');
  await field(page).press('Enter');
  await expect(page.getByText('По вашему запросу ничего не найдено.').or(page.getByText(/ничего не найден/i)).first()).toBeVisible();
  await expect(chips(page)).toHaveCount(5);
});

test('an empty query creates no Search state and the Home layout stays', async ({ page }) => {
  await page.goto('/');
  await field(page).fill('   ');
  await field(page).press('Enter');
  await expect(page.locator('#search-validation')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  expect((await field(page).boundingBox())?.y ?? 0).toBeGreaterThan(250);
  expect(await storedState(page)).toBeNull();
});

test('«Поиск» reopens the last search with fresh results after Рядом, Ещё and an Offer page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Баранина', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();

  for (const other of ['Рядом', 'Ещё']) {
    await nav(page, other).click();
    await expect(page).not.toHaveURL(/\/\?q=/);
    await expect(nav(page, 'Поиск')).toHaveAttribute('href', /\/\?q=/);
    const request = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/search' && r.url().includes('q='));
    await nav(page, 'Поиск').click();
    await request;
    await expect(page).toHaveURL(/\/\?q=/);
    await expect(field(page)).toHaveValue('Баранина');
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  }

  // From an Offer page.
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  const again = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/search');
  await nav(page, 'Поиск').click();
  await again;
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(field(page)).toHaveValue('Баранина');
});

test('the tab state holds only the query and the preferences — no results, no coordinates, no other storage', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Баранина', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  const raw = await storedState(page);
  expect(JSON.parse(raw ?? 'null')).toEqual({ v: 2, query: 'Баранина', sort: 'relevance' });
  for (const forbidden of ['offers', 'latitude', 'longitude', 'price', 'radius']) expect(raw).not.toContain(forbidden);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  expect((await context.cookies()).some((cookie) => cookie.name === STORAGE_KEY || cookie.value.includes('Баранина'))).toBe(false);
  expect(new URL(page.url()).search).toBe('?q=%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
});

test('a restored distance sort falls back to the default relevance without coordinates and without asking for geolocation', async ({ page }) => {
  await mockGeolocation(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Баранина', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.getByRole('button', { name: 'Сортировка', exact: true }).click();
  await page.getByRole('group', { name: 'Сортировка' }).getByRole('button', { name: /^По расстоянию/ }).click();
  await expect(page.getByRole('group', { name: 'Сортировка' }).getByRole('button', { name: 'По расстоянию, ближе первыми', exact: true })).toBeVisible();
  expect(await geoCalls(page)).toBe(1);
  expect(JSON.parse((await storedState(page)) ?? 'null')).toMatchObject({ sort: 'distance', direction: 'asc' });

  await nav(page, 'Ещё').click();
  await nav(page, 'Поиск').click();
  await expect(page.getByRole('article').first()).toBeVisible();
  // The tab state and the screen agree on the normalized values; no prompt was triggered.
  await expect.poll(async () => JSON.parse((await storedState(page)) ?? 'null')).toEqual({ v: 2, query: 'Баранина', sort: 'relevance' });
  await page.getByRole('button', { name: 'Сортировка', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сбросить сортировку', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Сортировка' }).getByRole('button', { name: /^По актуальности/ })).toHaveAttribute('aria-pressed', 'false');
  // Returning did not ask again: the counter is still the one explicit request made before leaving.
  expect(await geoCalls(page)).toBe(1);

  // A later explicit choice of «Расстояние» is a geolocation intent again.
  await page.getByRole('group', { name: 'Сортировка' }).getByRole('button', { name: /^По расстоянию/ }).click();
  await expect.poll(() => geoCalls(page)).toBe(2);
});

test('a price sort and its direction are restored; a Stage 5 state degrades to the default relevance without a radius', async ({ page }) => {
  await page.addInitScript((key) => {
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, JSON.stringify({ v: 2, query: 'Баранина', sort: 'price', direction: 'desc' }));
    }
  }, STORAGE_KEY);
  await page.goto('/');
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.getByRole('button', { name: 'Сортировка', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Сортировка' }).getByRole('button', { name: 'По цене, дороже первыми', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // The Stage 5 / 6C value (query + sort + radius) keeps the query, drops the radius and falls back without coordinates.
  const legacy = await page.context().newPage();
  await legacy.addInitScript((key) => {
    window.sessionStorage.setItem(key, JSON.stringify({ v: 1, query: 'Баранина', sort: 'distance', radiusMeters: 3000 }));
  }, STORAGE_KEY);
  await legacy.goto('/');
  await expect(legacy.getByRole('article').first()).toBeVisible();
  await expect(legacy.getByRole('searchbox', { name: 'Какой товар ищете?' })).toHaveValue('Баранина');
  await expect.poll(async () => JSON.parse((await storedState(legacy)) ?? 'null')).toEqual({ v: 2, query: 'Баранина', sort: 'relevance' });
  await legacy.close();
});

test('a plain / with a last search reopens it; another tab and damaged storage give the Home', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Баранина', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();

  const request = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/search');
  await page.goto('/');
  await request;
  await expect(page.getByRole('article').first()).toBeVisible();

  // A new tab has its own session state.
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('searchbox', { name: 'Какой товар ищете?' })).toBeVisible();
  await expect(other.getByRole('article')).toHaveCount(0);
  await expect(other.getByRole('group', { name: 'Популярные запросы' }).getByRole('button')).toHaveCount(5);
  await other.close();

  // Damaged storage is ignored without an error.
  const damaged = await context.newPage();
  await damaged.addInitScript((key) => window.sessionStorage.setItem(key, '{bad'), STORAGE_KEY);
  await damaged.goto('/');
  await expect(damaged.getByRole('searchbox', { name: 'Какой товар ищете?' })).toBeVisible();
  await expect(damaged.getByRole('article')).toHaveCount(0);
  await damaged.close();
});

test('a deep link searches, updates the last search and Back from an Offer returns to the same results', async ({ page }) => {
  await page.goto('/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
  await expect(page.getByRole('article').first()).toBeVisible();
  expect(JSON.parse((await storedState(page)) ?? 'null').query).toBe('баранина');
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(field(page)).toHaveValue('баранина');
});

test.describe('a first visit through a deep link (no intro marker)', () => {
  test.use({ storageState: firstVisitState });

  test('«Поиск» reopens the last search and never First Entry; the generic / still follows 6B', async ({ page }) => {
    await page.goto('/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
    await expect(page.getByRole('article').first()).toBeVisible();
    await nav(page, 'Рядом').click();
    await expect(page).toHaveURL(/\/nearby$/);
    await nav(page, 'Поиск').click();
    await expect(page).toHaveURL(/\/\?q=/);
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/welcome/);

    // The generic entry without a query keeps the 6B rule: no marker was set by the deep link.
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
  });
});
