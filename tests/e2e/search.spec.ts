import { expect, test } from '@playwright/test';

test('lamb: search by button, full offer, responsive layout and refresh', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('По вашему запросу ничего не найдено.')).toHaveCount(0);
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/search?'));
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  const seedOffer = body.offers.find((offer: {
    seller: { displayName: string };
    location: { name: string };
    sellerComment: string | null;
  }) => offer.seller.displayName === 'Асыл Ет, тестовый продавец'
    && offer.location.name === 'Тестовая мясная точка'
    && offer.sellerComment === 'Свежий привоз.');
  expect(seedOffer).toMatchObject({
    product: { name: 'Баранина' },
    price: { amount: '4200.00', currency: 'KZT', unit: 'кг' },
    seller: { displayName: 'Асыл Ет, тестовый продавец' },
    location: {
      name: 'Тестовая мясная точка',
      addressText: 'Алматы, Зелёный базар, тестовый павильон 12',
    },
    sellerComment: 'Свежий привоз.',
  });
  const seedCard = page.getByRole('article')
    .filter({ hasText: 'Асыл Ет, тестовый продавец' })
    .filter({ hasText: 'Тестовая мясная точка' });
  await expect(seedCard).toHaveCount(1);
  await expect(seedCard.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  await expect(seedCard).toContainText(/4\s200\s₸\s\/\sкг/);
  await expect(seedCard).toContainText('Асыл Ет, тестовый продавец');
  await expect(seedCard).toContainText('Тестовая мясная точка');
  await expect(seedCard).toContainText('Алматы, Зелёный базар, тестовый павильон 12');
  await expect(seedCard).toContainText('Свежий привоз.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await testInfo.attach('lamb-offer', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.reload();
  await page.getByLabel('Какой товар ищете?').fill('БАРАНИНА');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  await expect(seedCard.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
});

test('unknown product clears the previous result', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill('баранина');
  await input.press('Enter');
  const seedCard = page.getByRole('article')
    .filter({ hasText: 'Асыл Ет, тестовый продавец' })
    .filter({ hasText: 'Тестовая мясная точка' });
  await expect(seedCard).toHaveCount(1);
  await input.fill('единорог');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('По вашему запросу ничего не найдено.');
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('beef has a missing price, not a zero', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('говядина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  await expect(page.getByRole('article')).toContainText('Говядина');
  await expect(page.getByRole('article')).toContainText('Цена не указана');
  await expect(page.getByRole('article')).toContainText('Есть мякоть и мясо на кости.');
});

test('empty query is validated without sending an API request', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => { if (request.url().includes('/api/search')) requests++; });
  await page.goto('/');
  const searchRegion = page.getByRole('region', { name: 'Поиск предложений' });
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill('   ');
  await input.press('Enter');
  await expect(searchRegion.getByRole('alert')).toHaveText('Введите название товара.');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toBeFocused();
  expect(requests).toBe(0);
});

test('loading blocks a second submit while the real request is pending', async ({ page }) => {
  let releaseRequest!: () => void;
  const gate = new Promise<void>((resolve) => { releaseRequest = resolve; });
  let requests = 0;
  await page.route('**/api/search?*', async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ищем…', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toHaveText('Ищем предложения…');
  await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  releaseRequest();
  const seedCard = page.getByRole('article')
    .filter({ hasText: 'Асыл Ет, тестовый продавец' })
    .filter({ hasText: 'Тестовая мясная точка' });
  await expect(seedCard).toHaveCount(1);
  expect(requests).toBe(1);
});

test('network failure clears old results and permits a real retry', async ({ page }) => {
  await page.goto('/');
  const searchRegion = page.getByRole('region', { name: 'Поиск предложений' });
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill('баранина');
  await input.press('Enter');
  const seedCard = page.getByRole('article')
    .filter({ hasText: 'Асыл Ет, тестовый продавец' })
    .filter({ hasText: 'Тестовая мясная точка' });
  await expect(seedCard).toHaveCount(1);
  await page.route('**/api/search?*', (route) => route.abort('failed'));
  await input.fill('говядина');
  await input.press('Enter');
  await expect(searchRegion.getByRole('alert')).toHaveText('Не удалось выполнить поиск. Попробуйте ещё раз.');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(input).toHaveValue('говядина');
  await page.unroute('**/api/search?*');
  await input.press('Enter');
  await expect(page.getByRole('article')).toContainText('Цена не указана');
});

test('HTTP boundary handles missing/empty query and parameterized exact search', async ({ request }) => {
  for (const url of ['/api/search', '/api/search?q=', '/api/search?q=%20%20']) {
    const response = await request.get(url);
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_QUERY');
  }
  const found = await request.get('/api/search', { params: { q: '  БАРАНИНА  ' } });
  expect(found.status()).toBe(200);
  const body = await found.json();
  expect(body.query).toBe('БАРАНИНА');
  const seedOffer = body.offers.find((offer: {
    seller: { displayName: string };
    location: { name: string };
    sellerComment: string | null;
  }) => offer.seller.displayName === 'Асыл Ет, тестовый продавец'
    && offer.location.name === 'Тестовая мясная точка'
    && offer.sellerComment === 'Свежий привоз.');
  expect(seedOffer?.price).toEqual({ amount: '4200.00', currency: 'KZT', unit: 'кг' });
  const empty = await request.get('/api/search', { params: { q: '%' } });
  expect(empty.status()).toBe(200);
  expect((await empty.json()).offers).toEqual([]);
});
