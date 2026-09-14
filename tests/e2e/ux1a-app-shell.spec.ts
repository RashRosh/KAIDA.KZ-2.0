import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

async function expectSharedShell(page: Page) {
  const header = page.getByRole('banner');
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });

  await expect(header).toBeVisible();
  await expect(header.getByRole('link', { name: 'KAIDA.KZ, главная', exact: true })).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Поиск', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Рядом', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Продавцу', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function navCenter(page: Page) {
  const navBox = await page.getByRole('navigation', { name: 'Основная навигация' }).boundingBox();
  expect(navBox).not.toBeNull();
  return navBox!.x + navBox!.width / 2;
}

test('current main areas share the design-system shell without horizontal overflow', async ({ page }, testInfo) => {
  const navGeometry: Array<{ x: number; width: number }> = [];
  const expectedHeaderHeight = testInfo.project.name === 'mobile' ? 84 : 104;

  for (const path of ['/', '/nearby', '/login', '/seller']) {
    await page.goto(path);
    await expectSharedShell(page);

    const headerBox = await page.getByRole('banner').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(Math.abs(headerBox!.height - expectedHeaderHeight)).toBeLessThanOrEqual(1);

    const navBox = await page.getByRole('navigation', { name: 'Основная навигация' }).boundingBox();
    expect(navBox).not.toBeNull();
    navGeometry.push({ x: navBox!.x, width: navBox!.width });
  }

  const first = navGeometry[0];
  for (const current of navGeometry) {
    expect(Math.abs(current.x - first.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(current.width - first.width)).toBeLessThanOrEqual(1);
  }

  await page.goto('/');
  const searchInput = page.getByLabel('Какой товар ищете?');
  await expect(searchInput).toBeVisible();
  expect(await searchInput.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('12px');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter)).toContain('stable');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Roboto');

  const radii = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return [root.getPropertyValue('--radius-sm').trim(), root.getPropertyValue('--radius').trim(), root.getPropertyValue('--radius-lg').trim(), root.getPropertyValue('--radius-xl').trim()];
  });
  expect(radii).toEqual(['0.5rem', '0.75rem', '1rem', '1.25rem']);
});

test('desktop shell navigation remains centered through real route clicks', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop geometry proof');

  await page.goto('/');
  const expectedCenter = await page.evaluate(() => window.innerWidth / 2);

  for (const linkName of ['Рядом', 'Продавцу', 'Поиск']) {
    const before = await navCenter(page);
    expect(Math.abs(before - expectedCenter)).toBeLessThanOrEqual(1);

    await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: linkName, exact: true }).click();
    await expectSharedShell(page);

    const after = await navCenter(page);
    expect(Math.abs(after - expectedCenter)).toBeLessThanOrEqual(1);
  }
});

test('seller entry opens the existing seller flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Продавцу', exact: true }).click();
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
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Рядом', exact: true }).click();
  await expect(page).toHaveURL(/\/nearby$/);
  await expect(page.getByRole('button', { name: 'Показать товары рядом', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __ux1aGeoCalls: number }).__ux1aGeoCalls)).toBe(0);
});
