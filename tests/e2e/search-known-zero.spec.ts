import { expect, test, type Page } from '@playwright/test';
import { setLocaleCookie } from './buyer-helpers';

// found by role, so the same steps work in the Russian and the Kazakh interface
async function search(page: Page, query: string) {
  const input = page.getByRole('search').locator('input[type="search"]').first();
  await input.fill(query);
  await input.press('Enter');
}

// S15B-2 + search-empty-states (docs/slices/search-empty-states): a known catalog Product without Offers and an unknown
// query each get their own title, hint and two actions. «Тунец» is a Production KB v1 Product (installed by the E2E
// global setup) that no E2E flow publishes Offers for.

test('a known Product without Offers and an unknown query show their own state, ru', async ({ page }) => {
  await page.goto('/');
  await search(page, 'Тунец');
  const status = page.getByRole('status');
  await expect(status).toContainText('По запросу «Тунец» сейчас нет предложений');
  await expect(status).toContainText('Этот товар есть в каталоге KAIDA, но активных предложений сейчас нет.');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Изменить запрос' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Посмотреть рядом' })).toHaveAttribute('href', '/nearby');

  await search(page, 'единорог');
  await expect(status).toContainText('Ничего не найдено по запросу «единорог»');
  await expect(status).toContainText('Проверьте написание');
  await expect(status).not.toContainText('каталоге KAIDA');
  // nothing about notifications, favourites or typo suggestions
  await expect(page.getByText(/Сообщить|уведом|Возможно, вы ищете|Избранное/i)).toHaveCount(0);
});

test('the same states in Kazakh', async ({ page }) => {
  await setLocaleCookie(page.context(), 'kk');
  await page.goto('/');
  await search(page, 'Тунец');
  const status = page.getByRole('status');
  await expect(status).toContainText('«Тунец» сұрауы бойынша қазір ұсыныстар жоқ');
  await expect(status).toContainText('белсенді ұсыныстар жоқ');
  await expect(page.getByRole('button', { name: 'Сұрауды өзгерту' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Жақын жердегіні көру' })).toBeVisible();
  await search(page, 'единорог');
  await expect(status).toContainText('«единорог» сұрауы бойынша ештеңе табылмады');
});

test('«Изменить запрос» focuses and selects the field and sends no search; «Посмотреть рядом» opens Nearby', async ({ page }) => {
  await page.goto('/');
  await search(page, 'единорог');
  await expect(page.getByRole('status')).toContainText('Ничего не найдено по запросу');
  const requests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/search')) requests.push(request.url()); });
  await page.getByRole('button', { name: 'Изменить запрос' }).click();
  const field = page.getByRole('searchbox');
  await expect(field).toBeFocused();
  expect(await field.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd, element.value.length])).toEqual([0, 7, 7]);
  expect(requests).toEqual([]);

  await page.getByRole('link', { name: 'Посмотреть рядом' }).click();
  await expect(page).toHaveURL(/\/nearby/);
});

test('a long query and a word without spaces fit at 320 px and enlarged text, ru and kk', async ({ page }) => {
  const fits = () => page.evaluate(() => ({
    page: document.documentElement.scrollWidth <= window.innerWidth,
    main: [...document.querySelectorAll<HTMLElement>('main *')].filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX !== 'visible').length,
  }));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await search(page, 'ЖасылБазардағыЖаңаӘкелінгенКөкөністерЖәнеЖемістерЖәнеТағыбасқалар');
  await expect(page.getByRole('status')).toContainText('Ничего не найдено по запросу');
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  expect(await fits()).toEqual({ page: true, main: 0 });
  await expect(page.getByRole('button', { name: 'Изменить запрос' })).toBeVisible();

  await setLocaleCookie(page.context(), 'kk');
  await page.goto('/');
  await search(page, 'Тунец');
  await expect(page.getByRole('status')).toContainText('қазір ұсыныстар жоқ');
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  expect(await fits()).toEqual({ page: true, main: 0 });
});

test('a known Product with Offers shows the results as before, without the empty block', async ({ page }) => {
  await page.goto('/');
  await search(page, 'Баранина');
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page.getByText('сейчас нет предложений')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Изменить запрос' })).toHaveCount(0);
});
