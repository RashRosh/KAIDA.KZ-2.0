import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

// buyer-screens-mockup: the result card (B01) carries no seller name or comment — they are on the offer page (B02);
// sign-in and sign-out live on buyer «Ещё».

export const SEED_POINT = 'Тестовая мясная точка';

// «+77000000901» → «+7 700 000 09 01», as buyer «Ещё» shows the signed-in phone.
export function morePhone(phone: string) {
  return `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10, 12)}`;
}

export async function search(page: Page, query: string) {
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(query);
  await input.press('Enter');
}

export function resultCard(page: Page, text: string): Locator {
  return page.getByRole('article').filter({ hasText: text });
}

// Opens the offer page from a result card by the product name link that covers the card.
export async function openOffer(card: Locator, productName: string) {
  await card.getByRole('link', { name: productName, exact: true }).click();
  await expect(card.page()).toHaveURL(/\/offers\//);
}

export async function expectSignedIn(page: Page, phone: string) {
  await page.goto('/more');
  await expect(page.getByText(morePhone(phone), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
}

export async function signOutInMore(page: Page) {
  await page.goto('/more');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Войти/ })).toBeVisible();
}

// The config's storage state holds kaida_locale on path «/»; a cookie added by URL would get the page's own path and
// be sent alongside it, so a test switches the language by replacing that same cookie.
export async function setLocaleCookie(context: BrowserContext, locale: 'ru' | 'kk') {
  await context.addCookies([{ name: 'kaida_locale', value: locale, domain: '127.0.0.1', path: '/' }]);
}

// PROJECT_RULES.md §18.4 «Язык»: after the first-visit choice the language is changed on buyer «Ещё» → «Язык».
export async function chooseLanguageInMore(page: Page, language: 'Русский' | 'Қазақша') {
  await page.goto('/more');
  await page.getByRole('button', { name: /^(Язык|Тіл)/ }).click();
  await page.getByRole('radio', { name: language }).click();
  await page.getByRole('button', { name: /^(Готово|Дайын)$/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', language === 'Қазақша' ? 'kk' : 'ru');
}
