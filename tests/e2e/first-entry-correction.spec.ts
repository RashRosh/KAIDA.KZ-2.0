import { expect, test } from '@playwright/test';
import { firstVisitState, returningVisitorState } from './browser-state';

// Stage 6B (docs/slices/first-entry-correction): `/welcome` is First Entry, `/` is the ordinary Search, the intro marker
// is persistent and separate from the demo flag, and no language screen exists. Mobile + Russian is the current gate
// (PROJECT_RULES.md §18.5); these specs start from `firstVisitState` (language chosen, no intro marker).
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

test.use({ storageState: firstVisitState });

const introMarker = async (context: import('@playwright/test').BrowserContext) =>
  (await context.cookies()).find((cookie) => cookie.name === 'kaida_intro_seen');

test('the first generic / shows First Entry with the demo and the language switch, no language screen', async ({ page, context }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Найдите, где');
  await expect(page.locator('.fe-live')).not.toHaveCount(0);
  await expect(page.getByText('Выберите язык')).toHaveCount(0);

  const group = page.getByRole('group', { name: 'Язык' });
  await expect(group.getByRole('button', { name: 'Русский' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'Қазақша' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await introMarker(context))?.value).toBe('1');
});

test('after First Entry the generic / is the Search, and «Поиск» never reopens First Entry', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);

  // «Поиск» in the navigation of First Entry itself.
  await page.getByRole('navigation').getByRole('link', { name: 'Поиск', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('searchbox', { name: 'Какой товар ищете?' })).toBeVisible();
  await expect(page.getByText('Пример · так выглядит результат')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Баранина', exact: true })).toBeVisible();

  // And from another buyer screen, and by a direct generic entry.
  await page.getByRole('navigation').getByRole('link', { name: 'Ещё', exact: true }).click();
  await expect(page).toHaveURL(/\/more$/);
  await page.getByRole('navigation').getByRole('link', { name: 'Поиск', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('searchbox', { name: 'Какой товар ищете?' })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Пример · так выглядит результат')).toHaveCount(0);
});

test('deep links are not intercepted and do not set the marker; the first generic / still shows First Entry', async ({ page, context }) => {
  await page.goto('/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
  await expect(page).toHaveURL(/\/\?q=/);
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.goto('/nearby');
  await expect(page).toHaveURL(/\/nearby$/);
  expect(await introMarker(context)).toBeUndefined();

  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
});

test('/welcome is reachable directly at any time and does not redirect away', async ({ browser }) => {
  const context = await browser.newContext({ storageState: returningVisitorState });
  const page = await context.newPage();
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Найдите, где');
  await context.close();
});

test('the language applies at once from First Entry and keeps the typed text and the route', async ({ page }) => {
  await page.goto('/welcome');
  const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
  await field.fill('мёд');

  await page.getByRole('button', { name: 'Қазақша' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Керек тауарды');
  await expect(page.getByRole('searchbox')).toHaveValue('мёд');
  await expect(page).toHaveURL(/\/welcome$/);

  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('searchbox')).toHaveValue('мёд');
});

test('a search from First Entry opens the results and Back returns to First Entry; an empty query is not sent', async ({ page }) => {
  await page.goto('/welcome');
  const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
  await field.fill('  ');
  await field.press('Enter');
  await expect(page.locator('#search-validation')).toContainText('Введите название товара');
  await expect(page).toHaveURL(/\/welcome$/);

  await field.fill('баранина');
  await field.press('Enter');
  await expect(page).toHaveURL(/\/\?q=/);
  await expect(page.getByRole('article').first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Найдите, где');
});

test('the intro marker and the demo flag are independent of each other', async ({ page, context }) => {
  await page.goto('/welcome');
  await expect.poll(async () => (await introMarker(context))?.value).toBe('1');
  expect(await page.evaluate(() => window.localStorage.getItem('kaida_fe_demo_seen'))).toBe('1');

  // Clearing the demo flag does not bring First Entry back to the generic entry.
  await page.evaluate(() => window.localStorage.removeItem('kaida_fe_demo_seen'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('searchbox', { name: 'Какой товар ищете?' })).toBeVisible();

  // Clearing the marker does: the next generic entry shows First Entry again.
  await context.clearCookies({ name: 'kaida_intro_seen' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
});
