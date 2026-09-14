import { expect, test } from '@playwright/test';

async function expectSharedShell(page: import('@playwright/test').Page) {
  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  await expect(header.getByRole('link', { name: 'KAIDA.KZ, главная', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Поиск', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Рядом', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Продавцу', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('current main areas share one compact navigation shell without horizontal overflow', async ({ page }, testInfo) => {
  const desktopNavCenters: number[] = [];

  for (const path of ['/', '/nearby', '/login', '/seller']) {
    await page.goto(path);
    await expectSharedShell(page);

    if (testInfo.project.name === 'desktop') {
      const navBox = await page.getByRole('navigation', { name: 'Основная навигация' }).boundingBox();
      expect(navBox).not.toBeNull();
      desktopNavCenters.push(navBox!.x + navBox!.width / 2);
    }
  }

  if (desktopNavCenters.length > 0) {
    const firstCenter = desktopNavCenters[0];
    for (const center of desktopNavCenters) {
      expect(Math.abs(center - firstCenter)).toBeLessThanOrEqual(1);
    }
  }

  await page.goto('/');
  const searchInput = page.getByLabel('Какой товар ищете?');
  await expect(searchInput).toBeVisible();
  expect(await searchInput.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('3px');
});

test('seller entry opens the existing seller flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'Продавцу', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.getByRole('heading', { name: 'Ваши товары в KAIDA.KZ', exact: true })).toBeVisible();
});

test('shell navigation to Nearby does not request geolocation automatically', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__ux1aGeoCalls', { value: 0, writable: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition() {
          (window as unknown as { __ux1aGeoCalls: number }).__ux1aGeoCalls += 1;
        },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'Рядом', exact: true }).click();
  await expect(page).toHaveURL(/\/nearby$/);
  await expect(page.getByRole('button', { name: 'Показать товары рядом', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __ux1aGeoCalls: number }).__ux1aGeoCalls)).toBe(0);
});
