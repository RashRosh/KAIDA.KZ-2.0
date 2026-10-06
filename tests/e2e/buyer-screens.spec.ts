import { expect, test } from '@playwright/test';
import { SEED_POINT, setLocaleCookie } from './buyer-helpers';
import { emptyBrowserState } from './browser-state';

// buyer-screens-mockup §6: no language screen intercepts a page; the result card (B01) opens the offer page
// (B02) with the seller, comment and interest; bottom navigation and buyer «Ещё»; no language switch in top bars.
// Uses the seeded «Баранина» offer (Тестовая мясная точка, Асыл Ет).

test.describe('first visit', () => {
  test.use({ storageState: emptyBrowserState });

  test('no language screen intercepts a buyer or seller page', async ({ page }) => {
    await page.goto('/nearby');
    await expect(page.getByText('Выберите язык')).toHaveCount(0);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Рядом' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    await page.goto('/seller');
    await expect(page.getByText('Выберите язык')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });
});

test.describe('the start page', () => {
  test('the demo plays on the first visit only; the field stops it; the arrow needs text', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Найдите, где');
    // First visit: the typed word runs in the placeholder while the field stays empty, and the example is there.
    await expect(page.locator('.fe-live')).not.toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Какой товар ищете?' })).toHaveValue('');
    await expect(page.getByText('Пример · так выглядит результат')).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('kaida_fe_demo_seen'))).toBe('1');

    // Second visit: the final frame, no motion classes; the field stops the example.
    await page.reload();
    await expect(page.getByText('Пример · так выглядит результат')).toBeVisible();
    await expect(page.locator('.fe-live')).toHaveCount(0);
    const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
    await expect(field).toHaveAttribute('placeholder', 'Что ищете?');
    await expect(page.getByRole('button', { name: 'Искать' })).toHaveCount(0);
    await field.focus();
    await expect(page.getByText('Пример · так выглядит результат')).toHaveCount(0);
    await field.fill('мёд');
    await expect(page.getByRole('button', { name: 'Искать' })).toBeVisible();
    await field.fill('  ');
    await expect(page.getByRole('button', { name: 'Искать' })).toHaveCount(0);
  });
});

test('a result card opens the offer page with seller, comment and interest; navigation and «Ещё» work', async ({ page }) => {
  await page.goto('/welcome');
  // No language switch and no sign-in on the top of the buyer screens.
  await expect(page.getByRole('group', { name: 'Язык интерфейса' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Войти' })).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Какой товар ищете?' }).fill('баранина');
  await page.getByRole('button', { name: 'Искать' }).click();
  await expect(page.getByRole('searchbox', { name: 'Какой товар ищете?' })).toHaveValue('баранина');
  await expect(page.getByRole('button', { name: 'Порядок результатов', exact: true })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: SEED_POINT });
  await expect(card).toContainText(/4\s200\s₸/);
  await expect(card.getByRole('link', { name: /^Маршрут до Тестовая мясная точка/ })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Позвонить продавцу' })).toHaveAttribute('href', /^tel:\+7/);
  // B01: seller, comment and interest are not on the result card.
  await expect(card).not.toContainText('Асыл Ет');
  await expect(card.getByRole('button', { name: /избранн/ })).toHaveCount(0);

  await card.getByRole('link', { name: 'Баранина' }).click();
  await expect(page).toHaveURL(/\/offers\//);
  await expect(page.getByRole('heading', { name: 'Баранина', level: 1 })).toBeVisible();
  await expect(page.getByText('Асыл Ет, тестовый продавец')).toBeVisible();
  await expect(page.getByTestId('offer-comment')).toBeVisible();
  // Signed out, «Добавить в избранное» asks to sign in first; closing keeps the page.
  await page.getByRole('button', { name: 'Добавить в избранное' }).click();
  await expect(page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Back returns to the same results.
  await page.getByRole('link', { name: 'Назад' }).click();
  await expect(page).toHaveURL(/\?q=/);

  // Bottom navigation and buyer «Ещё»: sign-in, language, the seller entry asking to sign in.
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });
  await nav.getByRole('link', { name: 'Ещё' }).click();
  await expect(nav.getByRole('link', { name: 'Ещё' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^Войти/ })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Язык' }).getByRole('button', { name: 'Русский' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /Я продавец/ }).click();
  await expect(page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(page).toHaveURL(/\/more$/);
});

test('buyer screens fit every contract width in both languages', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Widths are driven explicitly; one project is enough.');
  for (const locale of ['ru', 'kk'] as const) {
    await setLocaleCookie(context, locale);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0', '/nearby', '/more']) {
        await page.goto(path);
        await expect(page.getByRole('navigation').first()).toBeVisible();
        if (path.startsWith('/?q=')) await expect(page.getByRole('article').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale} ${width} ${path}`).toBe(true);
      }
    }
  }
});

test('the seller top bars carry no language switch', async ({ page }) => {
  await page.goto('/seller');
  await expect(page.getByRole('group', { name: 'Язык интерфейса' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'РУС' })).toHaveCount(0);
});
