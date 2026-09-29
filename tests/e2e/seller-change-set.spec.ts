import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { seedIds } from '../../src/db/seed';
import { testDatabaseUrl } from '../integration/database';
import { SEED_POINT, signOutInMore } from './buyer-helpers';
import { fillOfferFields, openNewCard } from './offer-editor-helpers';

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

test('Seller must price a proposal, confirms it once and buyer sees the KZT amount with its unit', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  const seedBefore = (await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0];
  try {
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByRole('article').filter({ hasText: SEED_POINT })).toHaveCount(1);

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

    // Seller cabinet: point, contacts and «Добавить товар» are separate destinations (seller-cabinet-overview).
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill(`S4 E2E продавец ${testInfo.project.name}`);
    await page.getByLabel('Название для покупателей').fill(`S4 E2E точка ${testInfo.project.name}`);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S4 E2E адрес');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await completeOnboardingGeo(pool, phone);
    // seller-showcase-editor: «Сформировать карточки товаров» → «Заполнить вручную» opens the editor in place.
    const editor = await openNewCard(page);
    await fillOfferFields(page, { product: 'Баранина', unit: 'kg' });
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(editor.getByText('Укажите цену больше 0 ₸', { exact: true })).toBeVisible();
    await expect(editor.getByRole('alert').filter({ hasText: 'Заполните 1 поле' })).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toBeFocused();

    const sellerRow = (await pool.query('SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);
    expect(Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);

    await fillOfferFields(page, { price: '4321.50', comment: 'S4 E2E свежий привоз' });
    // One point: chosen automatically and shown as such.
    await expect(editor.getByText('Выбрана автоматически', { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Проверьте карточку', level: 1 })).toBeVisible();

    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByText('Будет опубликована 1 карточка', { exact: true })).toBeVisible();
    await expect(page.getByText('Баранина', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    // The confirmation page replaces itself with «Моя витрина».
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);
    await expect(page.getByRole('status').filter({ hasText: 'Опубликовано. Карточка уже видна покупателям' })).toBeVisible();
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(1);
    const resultId = (await pool.query('SELECT result_offer_id FROM seller_change_items WHERE change_set_id=$1', [new URL(url).pathname.split('/').pop()])).rows[0].result_offer_id;
    expect((await pool.query('SELECT price_amount,price_currency,price_unit_code,price_unit_value FROM offers WHERE id=$1', [resultId])).rows[0])
      .toEqual({ price_amount: '4321.50', price_currency: 'KZT', price_unit_code: 'kg', price_unit_value: null });

    // A confirmed deep link is read-only and shows no technical identifiers.
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Изменения подтверждены', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Подтвердить/ })).toHaveCount(0);
    await expect(page.getByText(resultId)).toHaveCount(0);

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    const createdCard = page.getByRole('article').filter({ hasText: `S4 E2E точка ${testInfo.project.name}` });
    await expect(createdCard).toHaveCount(1);
    // seller-showcase-editor: «Цена за» is required now, so the buyer sees the unit.
    await expect(createdCard).toContainText(/4\s321,5\s₸\s*\/\s*кг/);
    expect((await pool.query('SELECT * FROM offers WHERE id=$1', [seedIds.lambOffer])).rows[0]).toEqual(seedBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await signOutInMore(page);
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(createdCard).toHaveCount(1);
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
