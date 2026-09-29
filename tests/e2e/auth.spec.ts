import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { morePhone, SEED_POINT } from './buyer-helpers';

function phoneFor(projectName: string, suffix = '1') {
  return projectName === 'mobile' ? `+7700000090${suffix}` : `+7700000091${suffix}`;
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

// buyer-screens-mockup: sign-in lives on buyer «Ещё» (no «Войти» in the top bars).
test('auth modal opens in place and dismisses without changing auth state', async ({ page }) => {
  await page.goto('/more');
  const trigger = page.getByRole('button', { name: /^Войти/ });
  await expect(trigger).toBeVisible();

  await trigger.click();
  await expect(page).toHaveURL('/more');
  let dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).toBeTruthy();
  // The mockup's bottom sheet: inside the phone column and the screen height.
  expect(box!.width).toBeLessThanOrEqual(await page.evaluate(() => Math.min(480, window.innerWidth)));
  expect(box!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
  await page.getByTestId('auth-backdrop').click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();

  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toEqual({ user: null });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('anonymous search, modal login, persistence, search after login and logout', async ({ page, browser }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, '1');
  const seedCard = () => page.getByRole('article').filter({ hasText: SEED_POINT });
  const signedIn = page.getByText(morePhone(phone), { exact: true });
  await cleanup(phone);
  try {
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(seedCard().getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();

    await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Ещё', exact: true }).click();
    await page.getByRole('button', { name: /^Войти/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const otpResponse = await requestResponse;
    expect(otpResponse.status()).toBe(201);
    const requested = await otpResponse.json();
    const testCode = requested.delivery.code as string;
    await expect(dialog.getByText(`Код для ${phone}`, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`Тестовый код: ${testCode}`, { exact: true })).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(testCode === '999999' ? '000000' : '999999');
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(dialog.getByText('Неверный код.', { exact: true })).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(testCode);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL('/more');
    await expect(signedIn).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(`/?${new URLSearchParams({ q: 'баранина' })}`);
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(seedCard().getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();

    await page.goto('/more');
    await expect(signedIn).toBeVisible();
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name === 'kaida_session');
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie!.httpOnly).toBe(true);
    expect(sessionCookie!.sameSite).toBe('Lax');
    expect(sessionCookie!.expires).toBeGreaterThan(Date.now() / 1000);

    const storageState = await page.context().storageState();
    const reopened = await browser.newContext({ storageState });
    const reopenedPage = await reopened.newPage();
    await reopenedPage.goto('/more');
    await expect(reopenedPage.getByText(morePhone(phone), { exact: true })).toBeVisible();
    await reopened.close();

    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Войти/ })).toBeVisible();
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toEqual({ user: null });
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(seedCard().getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});

test('direct /login uses the same modal flow and expired challenge is rejected', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, '2');
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await page.goto('/login');
    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await pool.query(
      'UPDATE auth_otp_challenges SET created_at=$1, expires_at=$2 WHERE id=$3',
      [new Date(Date.now() - 10 * 60_000), new Date(Date.now() - 5 * 60_000), requested.challenge.id],
    );
    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(dialog.getByText('Срок действия кода истёк. Запросите новый.', { exact: true })).toBeVisible();
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
