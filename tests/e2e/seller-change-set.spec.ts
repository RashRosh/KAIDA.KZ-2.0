import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { seedIds } from '../../src/db/seed';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000941' : '+77000000942';
}

function publicPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000943' : '+77000000944';
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

async function completeOnboardingGeo(pool: Pool, phone: string) {
  const result = await pool.query(`
    UPDATE locations l
    SET latitude=$2, longitude=$3
    FROM sellers s
    JOIN users u ON u.id=s.owner_user_id
    WHERE l.seller_id=s.id AND u.phone_e164=$1
    RETURNING l.id
  `, [phone, 43.238949, 76.889709]);
  expect(result.rows).toHaveLength(1);
}

test('Seller must price a proposal, confirms it once and buyer sees KZT amount without a unit suffix', async ({ page }, testInfo) => {
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
    await page.getByRole('button', { name: 'Торговая точка', exact: true }).click();
    await page.getByLabel('Имя', { exact: true }).fill('S4 E2E продавец');
    await page.getByLabel('Название торговой точки').fill('S4 E2E точка');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S4 E2E адрес');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await page.getByLabel('Телефон', { exact: true }).fill(publicPhoneFor(testInfo.project.name));
    await page.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await completeOnboardingGeo(pool, phone);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await expect(page.getByText('Укажите цену предложения.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL('/seller');

    const sellerRow = (await pool.query('SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);
    expect(Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);

    await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('4321.50');
    await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill('S4 E2E свежий привоз');
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(page.getByText('Предложение ещё не применено. Offer пока не создан.')).toBeVisible();

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
    expect((await pool.query('SELECT price_amount,price_currency,price_unit FROM offers WHERE id=$1', [resultId])).rows[0])
      .toEqual({ price_amount: '4321.50', price_currency: 'KZT', price_unit: null });

    await page.reload();
    await expect(page.getByText('Предложение подтверждено. Offer создан.')).toBeVisible();
    await expect(page.getByText(`ID: ${resultId}`, { exact: true })).toBeVisible();

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    const createdCard = page.getByRole('article').filter({ hasText: 'S4 E2E продавец' });
    await expect(createdCard).toHaveCount(1);
    await expect(createdCard).toContainText(/4\s321,5\s₸/);
    await expect(createdCard).not.toContainText(' / ');
    expect((await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0]).toEqual(seedBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(createdCard).toHaveCount(1);
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
