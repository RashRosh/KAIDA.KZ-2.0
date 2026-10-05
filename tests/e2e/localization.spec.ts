import { expect, test } from '@playwright/test';
import { chooseLanguageInMore, setLocaleCookie } from './buyer-helpers';
import { emptyBrowserState } from './browser-state';

// buyer-screens-mockup §8 e (PROJECT_RULES.md §18.4 «Язык»): no language screen exists; the language is the saved choice,
// else the browser's, else Russian, and changes on First Entry and on «Ещё» → «Язык»; saving to the cookie and keeping
// the route are unchanged.

test('«Ещё» changes the language in one sheet, keeps the route and the choice survives reload', async ({ page }) => {
  await page.goto('/more');
  await chooseLanguageInMore(page, 'Қазақша');
  await expect(page).toHaveURL(/\/more$/);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Тағы', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('group', { name: 'Тіл' }).getByRole('button', { name: 'Қазақша' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Керек тауарды');

  await chooseLanguageInMore(page, 'Русский');
  await page.goto('/');
  await expect(page.getByLabel('Какой товар ищете?')).toBeVisible();
});

test.describe('first visit', () => {
  test.use({ storageState: emptyBrowserState, locale: 'kk-KZ' });

  test('the browser Kazakh decides the first render without a language screen, and a saved cookie wins afterwards', async ({ page, context }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Керек тауарды');
    await expect(page.getByText('Тілді таңдаңыз')).toHaveCount(0);

    await setLocaleCookie(context, 'ru');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByLabel('Какой товар ищете?')).toBeVisible();
  });
});

test('API ignores Accept-Language and keeps legacy Russian errors', async ({ request }) => {
  const baseline = await request.get('/api/search?q=', { headers: { 'Accept-Language': 'ru' } });
  const kazakhHeader = await request.get('/api/search?q=', { headers: { 'Accept-Language': 'kk-KZ' } });
  const explicitLocale = await request.get('/api/search?q=&locale=kk');

  expect(await kazakhHeader.json()).toEqual(await baseline.json());
  expect(await explicitLocale.json()).toEqual(await baseline.json());
  expect((await request.get('/api/interests?locale=kk')).status()).not.toBe(400);
});

test('Russian and Kazakh catalog terms find the same Offer; the card title stays the Seller text', async ({ page, request }) => {
  const ru = await request.get('/api/search?q=%D2%9B%D0%BE%D0%B9%20%D0%B5%D1%82%D1%96');
  const kk = await request.get('/api/search?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0&locale=kk');
  expect(ru.status()).toBe(200);
  expect(kk.status()).toBe(200);
  const ruBody = await ru.json();
  const kkBody = await kk.json();
  expect(ruBody.offers.map((offer: { id: string }) => offer.id)).toEqual(kkBody.offers.map((offer: { id: string }) => offer.id));
  expect(ruBody.offers[0].product).toEqual({ id: ruBody.offers[0].product.id, name: 'Баранина' });
  // seller-showcase-editor: the card title is the Seller's text in every language; the catalog finds the same Offer.
  expect(kkBody.offers[0].product).toEqual({ id: ruBody.offers[0].product.id, name: 'Баранина' });

  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('қой еті');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  await expect(page.getByRole('heading', { name: 'Баранина', exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/\?q=/);
  const results = page.url();
  await chooseLanguageInMore(page, 'Қазақша');
  await page.goto(results);
  await expect(page.getByLabel('Қандай тауар іздейсіз?')).toHaveValue('қой еті');
  // The title stays as the Seller wrote it after the language switch.
  await expect(page.getByRole('heading', { name: 'Баранина', exact: true }).first()).toBeVisible();
});
