import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { seedIds } from '../../src/db/seed';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000941' : '+77000000942';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
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

test('Seller creates persisted proposal, confirms it once and reloads the result', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  const seedBefore = (await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0];
  try {
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
    await page.getByLabel('Название продавца').fill('S4 E2E продавец');
    await page.getByLabel('Название точки').fill('S4 E2E точка');
    await page.getByLabel('Тип точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S4 E2E адрес');
    await page.getByRole('button', { name: 'Создать продавца' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();

    await page.getByLabel('Товар').fill('Баранина');
    await page.getByLabel('Цена, ₸').fill('4321.50');
    await page.getByLabel('Единица').fill('кг');
    await page.getByLabel('Комментарий продавца').fill('S4 E2E свежий привоз');
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(page.getByText('Предложение ещё не применено. Offer пока не создан.')).toBeVisible();

    const sellerRow = (await pool.query('SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);

    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByText('Предложение ещё не применено. Offer пока не создан.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Баранина' })).toBeVisible();

    await page.getByRole('button', { name: 'Подтвердить и создать Offer' }).click();
    await expect(page.getByText('Предложение подтверждено. Offer создан.')).toBeVisible();
    await expect(page.getByText('Offer создан', { exact: true })).toBeVisible();
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(1);
    const resultId = (await pool.query('SELECT result_offer_id FROM seller_change_items WHERE change_set_id=$1', [url.split('/').pop()])).rows[0].result_offer_id;

    await page.reload();
    await expect(page.getByText('Предложение подтверждено. Offer создан.')).toBeVisible();
    await expect(page.getByText(`ID: ${resultId}`, { exact: true })).toBeVisible();

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
    expect((await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0]).toEqual(seedBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
