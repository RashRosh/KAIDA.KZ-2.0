import { expect, test, type Locator, type Page } from '@playwright/test';

async function searchLamb(page: Page) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  await expect(page.getByRole('heading', { name: 'Результаты поиска', exact: true })).toBeVisible();
  return page.getByRole('list', { name: 'Предложения', exact: true });
}

async function gridColumnCount(list: Locator) {
  return list.evaluate((element) => {
    const value = getComputedStyle(element).gridTemplateColumns.trim();
    return value ? value.split(/\s+/).length : 0;
  });
}

test('real Search results use dense marketplace cards without invented media', async ({ page }, testInfo) => {
  const list = await searchLamb(page);
  const card = list.getByRole('article')
    .filter({ hasText: 'Асыл Ет, тестовый продавец' })
    .filter({ hasText: 'Тестовая мясная точка' });

  await expect(card.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  await expect(card.getByText(/4 200 ₸ \/ кг/)).toBeVisible();
  await expect(card.getByText('Тестовая мясная точка', { exact: true })).toBeVisible();
  await expect(card.getByText('Алматы, Зелёный базар, тестовый павильон 12', { exact: true })).toBeVisible();
  await expect(card.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
  await expect(card.getByText('Свежий привоз.', { exact: true })).toBeVisible();
  await expect(card.locator('img, video')).toHaveCount(0);

  expect(await gridColumnCount(list)).toBe(testInfo.project.name === 'mobile' ? 1 : 3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('desktop marketplace grid follows one/two/three-column responsive composition', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Responsive grid proof runs in desktop Chromium');

  const list = await searchLamb(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await gridColumnCount(list)).toBe(3);

  await page.setViewportSize({ width: 800, height: 900 });
  expect(await gridColumnCount(list)).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 767, height: 900 });
  expect(await gridColumnCount(list)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
