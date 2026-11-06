import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { templateOpeningHours } from '../../src/modules/locations/hours/opening-hours';
import type { SearchOffer } from '../../src/modules/search/contracts/search.contract';

// D4 · B09/B10 source parity: guest, loading, list (available + unavailable), empty, list error, removal error; 360 px
// screenshots for the PO's acceptance (docs/slices/design-favourites). The data path stays in offer-favourites.

const id = (n: number) => `a4800000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const offer = (n: number, name: string, amount: string, point: string, seller: string, minutes: number, photo?: number): SearchOffer => ({
  id: id(n), product: { id: null, name }, seller: { id: id(20 + n), displayName: seller },
  location: { id: id(30 + n), name: point, addressText: 'ул. Рыскулова, 58', openingHours: templateOpeningHours(), contacts: { phoneE164: '+77000000001' } },
  price: { amount, currency: 'KZT', unit: 'кг' }, sellerComment: null, routeAvailable: true,
  ...(photo ? { coverPhotoId: id(photo) } : {}),
  actuality: { days: Math.floor(minutes / 1440), ageing: minutes >= 2880 }, lastConfirmedAt: ago(minutes),
});
const list = {
  userId: id(80), count: 3, favourites: [
    { id: id(90), offerId: id(1), locationId: id(31), savedAt: ago(5), state: 'available', offer: offer(1, 'Помидоры розовые тепличные', '1450', 'Павильон 12 · Зелёный базар', 'Айгерим К.', 120, 40) },
    { id: id(91), offerId: id(2), locationId: id(32), savedAt: ago(9), state: 'available', offer: offer(2, 'Помидоры розовые тепличные', '1390', 'Магазин «Свежий ряд»', 'Нурлан Б.', 40, 41) },
    { id: id(92), offerId: id(3), locationId: id(33), savedAt: ago(20), state: 'unavailable', title: 'Мёд горный, 500 г', sellerName: 'Асан К.', pointName: 'Рынок «Жетысу», ряд 7' },
  ],
};

async function photos(page: Page) {
  for (const [n, file] of [[40, 'tomatoes'], [41, 'bullheart']] as const) {
    const svg = await readFile(`tests/fixtures/design-search/${file}.svg`, 'utf8');
    await page.route(`**/media/photos/${id(n)}/thumb`, (route) => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
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

test('B09.ST04/ST07: top bar with count, 4-item nav, available and unavailable cards, removal error', async ({ page }, info) => {
  await photos(page);
  await page.route('**/api/favourites?*', (route) => route.fulfill({ json: list }));
  await page.route('**/api/favourites', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/favourites');
  await expect(page.getByTestId('favourite-entry')).toHaveCount(3);
  await expect(page.getByRole('heading', { level: 1, name: 'Избранное' })).toBeVisible();
  await expect(page.getByText('3 записи')).toBeVisible();
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(nav.getByRole('link', { name: 'Избранное' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Назад' })).toHaveCount(0);
  const first = page.getByTestId('favourite-entry').first();
  await expect(first.getByRole('link', { name: 'Помидоры розовые тепличные' })).toHaveAttribute('href', `/offers/${id(1)}?return=%2Ffavourites`);
  await expect(first.getByRole('img', { name: /Продавец подтвердил: 2 ч/ })).toBeVisible();
  const unavailable = page.getByTestId('favourite-entry').nth(2);
  await expect(unavailable.getByText('Сейчас недоступно')).toBeVisible();
  await expect(unavailable.getByRole('link')).toHaveCount(0);
  await expect(unavailable.getByText(/₸/)).toHaveCount(0);
  const m = await first.evaluate((el) => {
    const card = el.querySelector('article')!;
    const style = (s: string) => getComputedStyle(card.querySelector(s)!);
    const thumb = card.querySelector('img')!.parentElement!.getBoundingClientRect();
    const remove = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Убрать из избранного')!.getBoundingClientRect();
    return { thumb: [thumb.width, thumb.height], title: style('h3').fontSize, price: style('b').fontSize, radius: getComputedStyle(card).borderRadius, remove: remove.height >= 44 };
  });
  expect(m).toEqual({ thumb: [88, 88], title: '17px', price: '18px', radius: '14px', remove: true });
  expect(await first.getByRole('button', { name: 'Убрать из избранного' }).evaluate((b) => getComputedStyle(b).color)).toBe('rgb(153, 0, 204)');
  await shot(page, info, 'B09-ST04-list-360');
  await noOverflow(page);
  await unavailable.getByRole('button', { name: 'Убрать из избранного' }).click();
  await expect(unavailable.getByText('Не удалось убрать из избранного. Запись осталась в списке.')).toBeVisible();
  await expect(unavailable.getByRole('button', { name: 'Убрать ещё раз' })).toBeVisible();
  await shot(page, info, 'B09-ST05-remove-error-360');
});

test('B09.ST01: a guest is asked to sign in, with a way to search', async ({ page }, info) => {
  await page.route('**/api/favourites?*', (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto('/favourites');
  await expect(page.getByRole('heading', { name: 'Войдите, чтобы открыть избранное' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Войти' }).evaluate((b) => getComputedStyle(b).color)).toBe('rgb(255, 255, 255)');
  await expect(page.getByRole('link', { name: 'Найти товар' })).toHaveAttribute('href', '/');
  await shot(page, info, 'B09-ST01-guest-360');
  await noOverflow(page);
});

test('B09.ST03: an empty list explains how to save', async ({ page }, info) => {
  await page.route('**/api/favourites?*', (route) => route.fulfill({ json: { userId: id(80), count: 0, favourites: [] } }));
  await page.goto('/favourites');
  await expect(page.getByRole('heading', { name: 'В избранном пока пусто' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Найти товар' })).toBeVisible();
  await shot(page, info, 'B09-ST03-empty-360');
});

test('B09.ST02/ST05: loading skeletons, then a list error with Retry', async ({ page }, info) => {
  let release: (() => void) | null = null;
  let fail = true;
  await page.route('**/api/favourites?*', (route) => fail
    ? new Promise<void>((resolve) => { release = () => { void route.fulfill({ status: 503, json: {} }).then(resolve); }; })
    : route.fulfill({ json: list }));
  await page.goto('/favourites');
  await expect(page.getByTestId('favourite-skeleton')).toHaveCount(3);
  await shot(page, info, 'B09-ST02-loading-360');
  release!();
  await expect(page.getByRole('alert').filter({ hasText: 'Не удалось загрузить избранное.' })).toBeVisible();
  await shot(page, info, 'B09-ST05-list-error-360');
  fail = false;
  await photos(page);
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByTestId('favourite-entry')).toHaveCount(3);
});
