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

test('Russian and Kazakh catalog terms find the same Offer and locale controls its Product name', async ({ page, request }) => {
  const ru = await request.get('/api/search?q=%D2%9B%D0%BE%D0%B9%20%D0%B5%D1%82%D1%96');
  const kk = await request.get('/api/search?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0&locale=kk');
  expect(ru.status()).toBe(200);
  expect(kk.status()).toBe(200);
  const ruBody = await ru.json();
  const kkBody = await kk.json();
  expect(ruBody.offers.map((offer: { id: string }) => offer.id)).toEqual(kkBody.offers.map((offer: { id: string }) => offer.id));
  expect(ruBody.offers[0].product).toEqual({ id: ruBody.offers[0].product.id, name: 'Баранина' });
  expect(kkBody.offers[0].product).toEqual({ id: ruBody.offers[0].product.id, name: 'Қой еті, жауырын', nameLocale: 'kk' });

  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('қой еті');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  await expect(page.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Қазақша' }).click();
  await expect(page.getByLabel('Қандай тауар іздейсіз?')).toHaveValue('қой еті');
  await expect(page.getByRole('heading', { name: 'Қой еті, жауырын', exact: true })).toHaveAttribute('lang', 'kk');
});
