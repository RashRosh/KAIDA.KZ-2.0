import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000881' : '+77000000891';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM buyer_interests WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function login(page: Page, phone: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Получить код' }).click();
  const requested = await (await requestResponse).json();
  await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(phone, { exact: true })).toBeVisible();
}

async function searchSeedProduct(page: Page) {
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  const card = page.getByRole('article')
    .filter({ hasText: 'Асыл Ет, тестовый продавец' })
    .filter({ hasText: 'Тестовая мясная точка' });
  await expect(card.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  return card;
}

test('buyer interest survives reload and a later login, then can be removed', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  try {
    await login(page, phone);

    let card = await searchSeedProduct(page);
    await card.getByRole('button', { name: 'Добавить в интересы' }).click();
    await expect(card.getByRole('button', { name: 'В интересах' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    card = await searchSeedProduct(page);
    await expect(card.getByRole('button', { name: 'В интересах' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await login(page, phone);

    card = await searchSeedProduct(page);
    await expect(card.getByRole('button', { name: 'В интересах' })).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: 'В интересах' }).click();
    await expect(card.getByRole('button', { name: 'Добавить в интересы' })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await cleanup(phone);
  }
});
