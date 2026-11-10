import { expect, test, type Page } from '@playwright/test';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';

// D5 · B07 source parity: initial (ST01), locating skeletons (ST02), grid (ST03), denial (ST04), empty (ST05),
// request error (ST06); 360 px screenshots for the PO's acceptance (docs/slices/design-nearby). The launch flow,
// privacy and the discovery API stay in s11-nearby-discovery and UX1C.

const id = (n: number) => `b4800000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const offer = (n: number, name: string, amount: string, unit: string, minutes: number, meters: number, photo?: number): SearchOffer => ({
  id: id(n), product: { id: null, name }, seller: { id: id(20 + n), displayName: 'Продавец' },
  location: { id: id(30 + n), name: 'Точка', addressText: 'ул. Рыскулова, 58', openingHours: templateOpeningHours(), contacts: { phoneE164: '+77000000001' } },
  price: { amount, currency: 'KZT', unit }, sellerComment: null, routeAvailable: true,
  ...(photo ? { coverPhotoId: id(photo) } : {}),
  actuality: { days: Math.floor(minutes / 1440), ageing: minutes >= 2880 }, lastConfirmedAt: ago(minutes),
  distanceMeters: meters,
});
const gridOffers = [
  offer(1, 'Помидоры розовые', '1450', 'кг', 120, 400, 40),
  offer(2, 'Огурцы грунтовые', '520', 'кг', 40, 900, 41),
  offer(3, 'Картофель молодой, мешок 5 кг', '2300', 'упак.', 300, 1300),
  offer(4, 'Яблоки «Апорт» крупные отборные, сорт Алматинский', '1100', 'кг', 4320, 1700, 42),
  offer(5, 'Мёд горный, 500 г', '3400', 'упак.', 11520, 2200, 43),
  offer(6, 'Зелень, пучок', '150', 'шт.', 15, 2600, 44),
];

async function mockGeolocation(page: Page, denied = false) {
  await page.addInitScript((mockDenied) => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback, error?: PositionErrorCallback | null) {
          // Defer like a real browser so the locating state is observable.
          if (mockDenied) {
            setTimeout(() => error?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 0);
            return;
          }
          setTimeout(() => success({
            coords: { latitude: 1.234567, longitude: 2.345678, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition), 0);
        },
      },
    });
  }, denied);
}

async function photos(page: Page) {
  for (const [n, file] of [[40, 'tomatoes'], [41, 'cucumbers'], [42, 'apples'], [43, 'honey'], [44, 'greens']] as const) {
    const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#eee"/><text x="60" y="66" font-size="14" text-anchor="middle">${file}</text></svg>`;
    await page.route(`**/media/photos/${id(n)}/thumb`, (route) => route.fulfill({ contentType: 'image/svg+xml', body }));
  }
}

async function shot(page: Page, info: { outputPath: (name: string) => string }, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
}

async function noOverflow(page: Page) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `width ${width}`).toBe(false);
  }
  await page.setViewportSize({ width: 360, height: 800 });
}

// Screenshots for a person are taken at 2× so text renders as on a phone screen, not blurred at 1×.
test.use({ deviceScaleFactor: 2 });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Source viewport driven explicitly.');
  await page.setViewportSize({ width: 360, height: 800 });
});

test('B07.ST01: without location the page explains and asks explicitly', async ({ page }, info) => {
  await mockGeolocation(page, true); // launch must stay user-driven, not automatic
  await page.goto('/nearby');
  await expect(page.getByRole('heading', { name: 'Рядом с вами' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Покажем предложения рядом' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Определить местоположение', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Искать по названию' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Рядом' })).toHaveAttribute('aria-current', 'page');
  await shot(page, info, 'B07-ST01-initial-360');
  await noOverflow(page);
});

test('B07.ST02: locating and loading show a notice and the grid-shaped skeletons', async ({ page }, info) => {
  let release: (() => void) | null = null;
  await mockGeolocation(page);
  await page.route('**/api/discovery/nearby*', (route) => new Promise<void>((resolve) => {
    release = () => { void route.fulfill({ json: { offers: gridOffers } }).then(resolve); };
  }));
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(page.getByText('Ищем товары рядом…')).toBeVisible();
  await expect(page.locator('[data-testid="nearby-skeleton"]')).toHaveCount(4);
  await shot(page, info, 'B07-ST02-locating-360');
  release!();
  await expect(page.getByTestId('nearby-tile')).toHaveCount(6);
});

test('B07.ST03: a two-column grid with photo, name, heart, price, freshness and distance', async ({ page }, info) => {
  await mockGeolocation(page);
  await photos(page);
  await page.route('**/api/discovery/nearby*', (route) => route.fulfill({ json: { offers: gridOffers } }));
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(page.getByTestId('nearby-tile')).toHaveCount(6);
  const first = page.getByTestId('nearby-tile').first();
  await expect(first.getByRole('heading', { name: 'Помидоры розовые' })).toBeVisible();
  await expect(first.getByText('1 450')).toBeVisible();
  await expect(first.getByText('/ кг')).toBeVisible();
  await expect(first.getByRole('img', { name: /Продавец подтвердил: 2 ч/ })).toBeVisible();
  await expect(first.getByText('400 м')).toBeVisible();
  await expect(first.getByRole('link', { name: 'Помидоры розовые' })).toHaveAttribute('href', `/offers/${id(1)}`);
  await expect(first.getByRole('button', { name: 'В избранное' })).toBeVisible();
  // the fourth tile has no photo: the KAIDA mark is the fallback
  const fourth = page.getByTestId('nearby-tile').nth(2);
  await expect(fourth.getByText('Картофель молодой, мешок 5 кг')).toBeVisible();
  const sizes = await first.evaluate((el) => {
    const thumb = el.querySelector('div')!.getBoundingClientRect();
    const price = getComputedStyle(el.querySelector('p')!);
    const badge = [...el.querySelectorAll('span')].find((s) => s.getAttribute('role') === 'img')!;
    const cap = [...el.querySelectorAll('span')].find((s) => s.textContent === '400 м')!;
    return {
      thumbRatio: Math.round(thumb.width / thumb.height * 100) / 100,
      priceFont: price.fontSize,
      badgeBg: getComputedStyle(badge).backgroundColor,
      capColor: getComputedStyle(cap).color,
      heart: (el.querySelector('button')!.getBoundingClientRect().height) >= 44,
    };
  });
  expect(sizes).toEqual({ thumbRatio: 1, priceFont: '20px', badgeBg: 'rgb(0, 121, 80)', capColor: 'rgb(91, 64, 106)', heart: true });
  await shot(page, info, 'B07-ST03-grid-360');
  await noOverflow(page);
});

test('B07.ST04: denied geolocation explains and offers retry', async ({ page }, info) => {
  await mockGeolocation(page, true);
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Не удалось определить местоположение' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Попробовать снова' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Искать по названию' })).toBeVisible();
  await shot(page, info, 'B07-ST04-denied-360');
  await noOverflow(page);
});

test('B07.ST05: a successful query without offers explains the radius', async ({ page }, info) => {
  await mockGeolocation(page);
  await page.route('**/api/discovery/nearby*', (route) => route.fulfill({ json: { offers: [] } }));
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Рядом пока нет предложений' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Искать по названию' })).toBeVisible();
  await shot(page, info, 'B07-ST05-empty-360');
  await noOverflow(page);
});

test('B07.ST06: a request error keeps the notice with retry over dimmed skeletons', async ({ page }, info) => {
  await mockGeolocation(page);
  await page.route('**/api/discovery/nearby*', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Не удалось загрузить предложения.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await expect(page.locator('[data-testid="nearby-skeleton"]')).toHaveCount(2);
  await shot(page, info, 'B07-ST06-request-error-360');
  // Retry repeats the query for the known location without a new geolocation call.
  await page.route('**/api/discovery/nearby*', (route) => route.fulfill({ json: { offers: gridOffers } }));
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByTestId('nearby-tile')).toHaveCount(6);
});
