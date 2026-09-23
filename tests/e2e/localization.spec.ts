import { expect, test } from '@playwright/test';

test('switches locale in one action and preserves query input across reload', async ({ page }) => {
  await page.goto('/?q=');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill('черновик');

  await page.getByRole('button', { name: 'Қазақша' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('heading', { name: /Тауардың қайда барын тап/ })).toBeVisible();
  await expect(page.getByLabel('Қандай тауар іздейсіз?')).toHaveValue('черновик');
  await expect(page).toHaveURL(/\?q=$/);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('button', { name: 'Қазақша' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByLabel('Какой товар ищете?')).toBeVisible();
});

test('uses browser Kazakh on a first visit and an explicit cookie wins', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: 'kk-KZ' });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');

  await context.addCookies([{ name: 'kaida_locale', value: 'ru', url: baseURL! }]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await context.close();
});

test('API ignores Accept-Language and keeps legacy Russian errors', async ({ request }) => {
  const baseline = await request.get('/api/search?q=', { headers: { 'Accept-Language': 'ru' } });
  const kazakhHeader = await request.get('/api/search?q=', { headers: { 'Accept-Language': 'kk-KZ' } });
  const explicitLocale = await request.get('/api/search?q=&locale=kk');

  expect(await kazakhHeader.json()).toEqual(await baseline.json());
  expect(await explicitLocale.json()).toEqual(await baseline.json());
  expect((await request.get('/api/interests?locale=kk')).status()).not.toBe(400);
});
