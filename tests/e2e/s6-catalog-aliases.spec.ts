import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { seedIds } from '../../src/db/seed';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000971' : '+77000000972';
}

function publicPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000973' : '+77000000974';
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

test('S6 buyer resolves мясо барана to canonical Баранина Offer', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('мясо барана');
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/search?'));
  await page.getByLabel('Какой товар ищете?').press('Enter');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.query).toBe('мясо барана');
  const seedOffer = body.offers.find((offer: { id: string }) => offer.id === seedIds.lambOffer);
  expect(seedOffer?.product).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
  const seedCard = page.getByRole('article').filter({ hasText: 'Асыл Ет, тестовый продавец' });
  await expect(seedCard).toHaveCount(1);
  await expect(seedCard.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
});

test('S6 seller proposes alias as canonical Product and confirms the Offer', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
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
    await page.getByLabel('Имя', { exact: true }).fill('S6 E2E продавец');
    await page.getByLabel('Название торговой точки').fill('S6 E2E точка');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S6 E2E адрес');
    await page.getByLabel('Телефон', { exact: true }).fill(publicPhoneFor(testInfo.project.name));
    await page.getByRole('button', { name: 'Сохранить и продолжить' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await completeOnboardingGeo(pool, phone);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('мясо барана');
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(page.getByText('Предложение ещё не применено. Offer пока не создан.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();

    const sellerRow = (await pool.query('SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);
    const changeSetId = page.url().split('/').pop();
    const itemBefore = (await pool.query('SELECT product_id,result_offer_id FROM seller_change_items WHERE change_set_id=$1', [changeSetId])).rows[0];
    expect(itemBefore).toEqual({ product_id: seedIds.lambProduct, result_offer_id: null });

    await page.getByRole('button', { name: 'Подтвердить и создать Offer' }).click();
    await expect(page.getByText('Предложение подтверждено. Offer создан.')).toBeVisible();
    const itemAfter = (await pool.query('SELECT product_id,result_offer_id FROM seller_change_items WHERE change_set_id=$1', [changeSetId])).rows[0];
    expect(itemAfter.product_id).toBe(seedIds.lambProduct);
    expect(itemAfter.result_offer_id).not.toBeNull();
    const offer = (await pool.query('SELECT product_id FROM offers WHERE id=$1', [itemAfter.result_offer_id])).rows[0];
    expect(offer.product_id).toBe(seedIds.lambProduct);
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});