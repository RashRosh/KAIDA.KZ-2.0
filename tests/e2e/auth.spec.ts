import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

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

test('anonymous search, login, persistence, search after login and logout', async ({ page, browser }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, '1');
  await cleanup(phone);
  try {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Войти' }).click();
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Получить код' }).click();
    const otpResponse = await requestResponse;
    expect(otpResponse.status()).toBe(201);
    const requested = await otpResponse.json();
    const testCode = requested.delivery.code as string;
    await expect(page.getByText(phone, { exact: true })).toBeVisible();
    await expect(page.getByText(`Тестовый код: ${testCode}`)).toBeVisible();

    await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(testCode === '999999' ? '000000' : '999999');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Неверный код.');

    await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(testCode);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText(phone, { exact: true })).toBeVisible();

    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(phone, { exact: true })).toBeVisible();
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name === 'kaida_session');
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie!.httpOnly).toBe(true);
    expect(sessionCookie!.sameSite).toBe('Lax');
    expect(sessionCookie!.expires).toBeGreaterThan(Date.now() / 1000);

    const storageState = await page.context().storageState();
    const reopened = await browser.newContext({ storageState });
    const reopenedPage = await reopened.newPage();
    await reopenedPage.goto('/');
    await expect(reopenedPage.getByText(phone, { exact: true })).toBeVisible();
    await reopened.close();

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toEqual({ user: null });
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});

test('expired challenge is rejected through real UI without debug endpoint', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, '2');
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await pool.query(
      'UPDATE auth_otp_challenges SET created_at=$1, expires_at=$2 WHERE id=$3',
      [new Date(Date.now() - 10 * 60_000), new Date(Date.now() - 5 * 60_000), requested.challenge.id],
    );
    await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Срок действия кода истёк. Запросите новый.');
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
