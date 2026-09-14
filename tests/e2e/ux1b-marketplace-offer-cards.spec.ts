import { expect, test, type Page } from '@playwright/test';

const offer = {
  id: '11111111-1111-4111-8111-111111111111',
  product: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Баранина',
  },
  seller: {
    id: '33333333-3333-4333-8333-333333333333',
    displayName: 'Тестовый продавец',
    contacts: {
      phoneE164: '+77001234567',
      telegramUsername: 'kaida_ux1b',
    },
  },
  location: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Тестовая точка',
    addressText: 'Алматы, тестовый адрес 12',
  },
  price: {
    amount: '4200.00',
    currency: 'KZT',
    unit: 'кг',
  },
  sellerComment: 'Свежий привоз сегодня.',
};

async function mockBuyerData(page: Page) {
  await page.route('**/api/interests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ interests: [] }),
    });
  });
  await page.route('**/api/search?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ query: 'баранина', offers: [offer] }),
    });
  });
  await page.route('**/api/discovery/nearby', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ offers: [{ ...offer, distanceMeters: 350 }] }),
    });
  });
}

async function searchOffer(page: Page) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  const card = page.getByRole('article').filter({ hasText: 'Тестовый продавец' });
  await expect(card).toBeVisible();
  return card;
}

test('UX1B Search is a dense marketplace surface with the approved Offer hierarchy', async ({ page }, testInfo) => {
  await mockBuyerData(page);
  const card = await searchOffer(page);

  await expect(card.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  await expect(card).toContainText(/4\s200\s₸\s\/\sкг/);
  await expect(card.getByText('Где купить', { exact: true })).toBeVisible();
  await expect(card.getByText('Тестовая точка', { exact: true })).toBeVisible();
  await expect(card.getByText('Алматы, тестовый адрес 12', { exact: true })).toBeVisible();
  await expect(card.getByText('Продавец', { exact: true })).toBeVisible();
  await expect(card.getByText('Тестовый продавец', { exact: true })).toBeVisible();
  await expect(card.getByText('Свежий привоз сегодня.', { exact: true })).toBeVisible();

  const interest = card.getByRole('button', { name: 'Добавить в интересы', exact: true });
  const phone = card.getByRole('link', { name: 'Позвонить', exact: true });
  const telegram = card.getByRole('link', { name: 'Telegram', exact: true });
  await expect(interest).toHaveAttribute('aria-pressed', 'false');
  await expect(phone).toHaveAttribute('href', 'tel:+77001234567');
  await expect(telegram).toHaveAttribute('href', 'https://t.me/kaida_ux1b');

  for (const control of [interest, phone, telegram]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  expect(await card.locator('img, picture, video').count()).toBe(0);
  expect(await card.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('16px');
  expect(await card.evaluate((element) => getComputedStyle(element).minHeight)).toBe('0px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  if (testInfo.project.name === 'desktop') {
    const mainBox = await page.getByRole('main').boundingBox();
    const searchBox = await page.getByRole('region', { name: 'Поиск предложений' }).boundingBox();
    expect(mainBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(searchBox!.width).toBeGreaterThanOrEqual(mainBox!.width * 0.9);
  }

  await testInfo.attach(`ux1b-search-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('UX1B Search and Nearby use the same OfferCard without automatic geolocation', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__ux1bGeoCalls', { value: 0, writable: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          (window as unknown as { __ux1bGeoCalls: number }).__ux1bGeoCalls += 1;
          success({
            coords: {
              latitude: 43.238949,
              longitude: 76.889709,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });
  });
  await mockBuyerData(page);

  const searchCard = await searchOffer(page);
  const searchClass = await searchCard.getAttribute('class');

  await page.goto('/nearby');
  expect(await page.evaluate(() => (window as unknown as { __ux1bGeoCalls: number }).__ux1bGeoCalls)).toBe(0);
  await page.getByRole('button', { name: 'Показать товары рядом', exact: true }).click();

  const nearbyCard = page.getByRole('article').filter({ hasText: 'Тестовый продавец' });
  await expect(nearbyCard).toBeVisible();
  await expect(nearbyCard.getByText('350 м', { exact: true })).toBeVisible();
  expect(await nearbyCard.getAttribute('class')).toBe(searchClass);
  expect(await nearbyCard.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('16px');
  expect(await nearbyCard.locator('img, picture, video').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await testInfo.attach(`ux1b-nearby-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('UX1B buyer surface has no horizontal overflow from 320 through 1440 px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One deterministic responsive sweep is sufficient');
  await mockBuyerData(page);
  const card = await searchOffer(page);

  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  }
});
