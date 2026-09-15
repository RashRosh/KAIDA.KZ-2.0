import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000931' : '+77000000932';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function ownedSellerOfferCount(pool: Pool, phone: string) {
  return Number((await pool.query(`
    SELECT count(*)
    FROM offers o
    JOIN sellers s ON s.id = o.seller_id
    JOIN users u ON u.id = s.owner_user_id
    WHERE u.phone_e164 = $1
  `, [phone])).rows[0].count);
}

test('authenticated User creates Seller + first Location and persists after reload', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    expect(await ownedSellerOfferCount(pool, phone)).toBe(0);

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();

    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Нужно войти' })).toBeVisible();
    await page.getByRole('link', { name: 'Войти' }).click();

    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Продавец и первая точка' })).toBeVisible();
    await page.getByLabel('Название продавца').fill('S3 тестовый продавец');
    await page.getByLabel('Название точки').fill('S3 тестовая точка');
    await page.getByLabel('Тип точки').selectOption('pavilion');
    await page.getByLabel('Адрес').fill('Алматы, тестовый адрес S3');
    await page.getByRole('button', { name: 'Создать продавца' }).click();

    await expect(page.getByRole('heading', { name: 'S3 тестовый продавец' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'S3 тестовая точка' })).toBeVisible();
    await expect(page.getByText('Павильон', { exact: true })).toBeVisible();
    await expect(page.getByText('Алматы, тестовый адрес S3', { exact: true })).toBeVisible();
    expect(await ownedSellerOfferCount(pool, phone)).toBe(0);

    const me = await page.context().request.get('/api/seller/me');
    expect(me.status()).toBe(200);
    const meBody = await me.json();
    expect(meBody.seller.displayName).toBe('S3 тестовый продавец');
    expect(Array.isArray(meBody.seller.locations)).toBe(true);
    expect(meBody.seller.locations).toHaveLength(1);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'S3 тестовый продавец' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'S3 тестовая точка' })).toBeVisible();
    expect(await ownedSellerOfferCount(pool, phone)).toBe(0);

    const duplicate = await page.context().request.post('/api/seller/setup', {
      data: {
        seller: { displayName: 'Ignored duplicate' },
        location: { name: 'Ignored point', type: 'shop', addressText: 'Ignored address' },
      },
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).error.code).toBe('SELLER_ALREADY_EXISTS');
    expect(await ownedSellerOfferCount(pool, phone)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
