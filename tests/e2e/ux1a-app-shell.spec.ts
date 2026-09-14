import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

const NAV_NAME = 'Основная навигация';

async function openPrimaryNav(page: Page) {
  const nav = page.getByRole('navigation', { name: NAV_NAME });
  if (await nav.isVisible().catch(() => false)) return nav;

  const openButton = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(nav).toBeVisible();
  return nav;
}

async function expectNavEntries(nav: Locator) {
  await expect(nav.getByRole('link', { name: 'Поиск', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Рядом', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Продавцу', exact: true })).toBeVisible();
}

async function expectSharedShell(page: Page, projectName: string) {
  const header = page.getByRole('banner');

  await expect(header).toBeVisible();
  await expect(header.getByRole('link', { name: 'KAIDA.KZ, главная', exact: true })).toBeVisible();

  if (projectName === 'mobile') {
    await expect(header.getByRole('button', { name: 'Открыть меню', exact: true })).toBeVisible();
  } else {
    const nav = page.getByRole('navigation', { name: NAV_NAME });
    await expect(nav).toBeVisible();
    await expectNavEntries(nav);
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function navCenter(page: Page) {
  const navBox = await page.getByRole('navigation', { name: NAV_NAME }).boundingBox();
  expect(navBox).not.toBeNull();
  return navBox!.x + navBox!.width / 2;
}

test('current main areas share the design-system shell without horizontal overflow', async ({ page }, testInfo) => {
  const navGeometry: Array<{ x: number; width: number }> = [];
  const expectedHeaderHeight = testInfo.project.name === 'mobile' ? 84 : 104;

  for (const path of ['/', '/nearby', '/login', '/seller']) {
    await page.goto(path);
    await expectSharedShell(page, testInfo.project.name);

    const headerBox = await page.getByRole('banner').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(Math.abs(headerBox!.height - expectedHeaderHeight)).toBeLessThanOrEqual(1);

    if (testInfo.project.name === 'mobile') {
      const nav = await openPrimaryNav(page);
      await expectNavEntries(nav);
      await page.getByRole('button', { name: 'Закрыть меню', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeVisible();
    } else {
      const navBox = await page.getByRole('navigation', { name: NAV_NAME }).boundingBox();
      expect(navBox).not.toBeNull();
      navGeometry.push({ x: navBox!.x, width: navBox!.width });
    }
  }

  if (navGeometry.length > 0) {
    const first = navGeometry[0];
    for (const current of navGeometry) {
      expect(Math.abs(current.x - first.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(current.width - first.width)).toBeLessThanOrEqual(1);
    }
  }

  await page.goto('/');
  const searchInput = page.getByLabel('Какой товар ищете?');
  await expect(searchInput).toBeVisible();
  expect(await searchInput.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('12px');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter)).toContain('stable');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Roboto');

  const radii = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return [
      '--radius-sm',
      '--radius',
      '--radius-lg',
      '--radius-xl',
    ].map((property) => Number.parseFloat(root.getPropertyValue(property)));
  });
  expect(radii).toEqual([0.5, 0.75, 1, 1.25]);
});

test('active navigation state follows the current product area', async ({ page }) => {
  for (const [path, activeLabel] of [
    ['/', 'Поиск'],
    ['/nearby', 'Рядом'],
    ['/seller', 'Продавцу'],
  ] as const) {
    await page.goto(path);
    const nav = await openPrimaryNav(page);
    const activeLink = nav.getByRole('link', { name: activeLabel, exact: true });
    await expect(activeLink).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }
});

test('desktop shell navigation remains centered through real route clicks', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop geometry proof');

  await page.goto('/');
  const expectedCenter = await page.evaluate(() => window.innerWidth / 2);

  for (const linkName of ['Рядом', 'Продавцу', 'Поиск']) {
    const before = await navCenter(page);
    expect(Math.abs(before - expectedCenter)).toBeLessThanOrEqual(1);

    await page.getByRole('navigation', { name: NAV_NAME }).getByRole('link', { name: linkName, exact: true }).click();
    await expectSharedShell(page, testInfo.project.name);

    const after = await navCenter(page);
    expect(Math.abs(after - expectedCenter)).toBeLessThanOrEqual(1);
  }
});

test('mobile navigation is compact, dismissible and closes after route selection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile interaction proof');

  await page.goto('/');
  const openButton = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await expect(openButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: NAV_NAME })).toHaveCount(0);

  await openButton.click();
  await expect(page.getByRole('button', { name: 'Закрыть меню', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: NAV_NAME })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(openButton).toBeVisible();
  await expect(page.getByRole('navigation', { name: NAV_NAME })).toHaveCount(0);

  await openButton.click();
  await page.getByRole('navigation', { name: NAV_NAME }).getByRole('link', { name: 'Рядом', exact: true }).click();
  await expect(page).toHaveURL(/\/nearby$/);
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: NAV_NAME })).toHaveCount(0);
});

test('seller entry opens the existing seller flow', async ({ page }) => {
  await page.goto('/');
  const nav = await openPrimaryNav(page);
  await nav.getByRole('link', { name: 'Продавцу', exact: true }).click();
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
  const nav = await openPrimaryNav(page);
  await nav.getByRole('link', { name: 'Рядом', exact: true }).click();
  await expect(page).toHaveURL(/\/nearby$/);
  await expect(page.getByRole('button', { name: 'Показать товары рядом', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __ux1aGeoCalls: number }).__ux1aGeoCalls)).toBe(0);
});
