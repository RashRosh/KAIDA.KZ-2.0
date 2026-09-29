import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

// buyer-screens-mockup (revises UX1A / UX1A1): the site header and its menu leave buyer routes; every buyer screen is
// the phone column of the accepted mockup with the bottom navigation «Поиск / Рядом / Ещё».

const NAV_NAME = 'Основная навигация';

async function expectBuyerShell(page: Page) {
  const nav = page.getByRole('navigation', { name: NAV_NAME });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveText(['Поиск', 'Рядом', 'Ещё']);
  await expect(page.getByRole('banner').filter({ has: page.getByRole('link', { name: 'KAIDA.KZ, главная' }) })).toHaveCount(0);
  await expect(page.getByRole('search', { name: 'Поиск из шапки' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The phone column: at most 480 px, centred, the navigation at its bottom edge.
  const column = await page.locator('.kaida-app > .ph').boundingBox();
  const viewport = page.viewportSize()!;
  expect(column).not.toBeNull();
  expect(column!.width).toBeLessThanOrEqual(480);
  expect(Math.abs(column!.x + column!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  const navBox = (await nav.boundingBox())!;
  expect(Math.abs(navBox.y + navBox.height - viewport.height)).toBeLessThanOrEqual(1);
}

test('buyer routes share the mockup phone column and bottom navigation without horizontal overflow', async ({ page }) => {
  for (const path of ['/', '/nearby', '/more', '/login']) {
    await page.goto(path);
    await expectBuyerShell(page);
    if (path === '/login') await expect(page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' })).toBeVisible();
  }

  await page.goto('/');
  // The mockup's fonts and field shape, not the Pass 3 tokens.
  expect(await page.locator('.kaida').first().evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Roboto');
  await expect(page.getByLabel('Какой товар ищете?')).toBeVisible();
});

test('active navigation state follows the current buyer section', async ({ page }) => {
  for (const [path, activeLabel] of [
    ['/', 'Поиск'],
    ['/nearby', 'Рядом'],
    ['/more', 'Ещё'],
  ] as const) {
    await page.goto(path);
    const nav = page.getByRole('navigation', { name: NAV_NAME });
    await expect(nav.getByRole('link', { name: activeLabel, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }

  await page.getByRole('navigation', { name: NAV_NAME }).getByRole('link', { name: 'Поиск', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Какой товар ищете?')).toBeVisible();
});

// The seller area is the accepted seller mockup (PROJECT_RULES §18.1): its own header and bottom navigation, no site shell.
test('seller area uses the seller app shell without horizontal overflow', async ({ page }) => {
  await page.goto('/seller');
  await expect(page.getByRole('heading', { name: 'Моя витрина', level: 1 })).toBeVisible();
  await expect(page.getByRole('search', { name: 'Поиск из шапки' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('anonymous seller entry opens auth over the current page', async ({ page }) => {
  await page.goto('/more');
  await page.getByRole('link', { name: 'Я продавец — моя витрина', exact: true }).click();
  await expect(page).toHaveURL('/more');
  await expect(page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' })).toBeVisible();
});
