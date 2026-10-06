import { expect, test, type Page } from '@playwright/test';

// buyer-screens-mockup B01 (revises UX1B): the result card shows the photo or the neutral fallback with the plaque,
// name, price, point, address, hours, route and only the existing contacts; the seller name, the comment and the
// interest are on the offer page. The whole card opens the offer page; its buttons stay separate.

async function searchLamb(page: Page) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  await expect(page.getByRole('list', { name: 'Предложения', exact: true })).toBeVisible();
  return page.getByRole('list', { name: 'Предложения', exact: true });
}

test('real Search results use the B01 card without invented media', async ({ page }) => {
  const list = await searchLamb(page);
  const card = list.getByRole('article').filter({ hasText: 'Тестовая мясная точка' });

  await expect(card.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  await expect(card).toContainText(/4\s200\s₸\s*\/\s*кг/);
  await expect(card.getByText('Тестовая мясная точка', { exact: true })).toBeVisible();
  await expect(card.getByText('Алматы, Зелёный базар, тестовый павильон 12', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Маршрут до Тестовая мясная точка', exact: true })).toBeVisible();
  // The seed has no photo: the neutral fallback, never an invented picture.
  await expect(card.locator('.img.fb')).toHaveCount(1);
  await expect(card.locator('video')).toHaveCount(0);
  await expect(card.locator('.img img')).toHaveCount(0);

  await expect(card.getByText('Асыл Ет, тестовый продавец', { exact: true })).toHaveCount(0);
  await expect(card.getByText('Свежий привоз.', { exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: /избранн/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the whole card opens the offer page while route and contacts stay separate focusable actions', async ({ page }) => {
  const list = await searchLamb(page);
  const card = list.getByRole('article').filter({ hasText: 'Тестовая мясная точка' });
  const title = card.getByRole('link', { name: 'Баранина', exact: true });
  const route = card.getByRole('link', { name: 'Маршрут до Тестовая мясная точка', exact: true });

  // Keyboard: the card link, then its own buttons, each a separate stop.
  await title.focus();
  await expect(title).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(route).toBeFocused();
  await expect(card.locator('a a, a button, button a')).toHaveCount(0);

  // A tap anywhere on the card body (here: on the photo area) opens the offer page.
  await card.click({ position: { x: 24, y: 24 } });
  await expect(page).toHaveURL(/\/offers\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Баранина', level: 1 })).toBeVisible();
});
