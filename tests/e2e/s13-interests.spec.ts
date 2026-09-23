import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000881' : '+77000000891';
}

function anonymousFlowPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000885' : '+77000000895';
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
  await expect(page.getByRole('button', { name: new RegExp(`Выйти \\(${phone.replace('+', '\\+')}\\)`) })).toBeVisible();
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
    await card.getByRole('button', { name: 'Добавить в избранное' }).click();
    await expect(card.getByRole('button', { name: 'В избранном' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    card = await searchSeedProduct(page);
    await expect(card.getByRole('button', { name: 'В избранном' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await login(page, phone);

    card = await searchSeedProduct(page);
    await expect(card.getByRole('button', { name: 'В избранном' })).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: 'В избранном' }).click();
    await expect(card.getByRole('button', { name: 'Добавить в избранное' })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await cleanup(phone);
  }
});

test('anonymous buyer sees the interest control, cancelling auth makes no API call, and completing auth auto-applies the original click', async ({ page }, testInfo) => {
  const phone = anonymousFlowPhoneFor(testInfo.project.name);
  await cleanup(phone);
  try {
    await page.goto('/');
    const card = await searchSeedProduct(page);
    const heart = card.getByRole('button', { name: /Добавить в избранное|В избранном|Сохраняем/ });
    await expect(heart).toBeVisible();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');

    const interestRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/interests')) interestRequests.push(request.url());
    });

    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });

    await heart.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Чтобы добавить товар в избранное, войдите по номеру телефона.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(dialog).toBeHidden();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(interestRequests).toHaveLength(0);

    await heart.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(card.getByRole('button', { name: 'В избранном' })).toHaveAttribute('aria-pressed', 'true');
    expect(interestRequests.some((url) => /\/api\/interests\/[^/]+$/.test(url))).toBe(true);
  } finally {
    await cleanup(phone);
  }
});
