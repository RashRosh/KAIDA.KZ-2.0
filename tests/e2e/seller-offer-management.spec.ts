import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000861' : '+77000000862';
}

function publicPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000863' : '+77000000864';
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

async function makeBuyerEligible(phone: string, projectName: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const contactPhone = publicPhoneFor(projectName);
    const seller = await pool.query(`
      UPDATE sellers s
      SET contact_phone_e164=$2
      FROM users u
      WHERE s.owner_user_id=u.id AND u.phone_e164=$1
      RETURNING s.id
    `, [phone, contactPhone]);
    expect(seller.rows).toHaveLength(1);
    const location = await pool.query(`
      UPDATE locations l
      SET latitude=$2, longitude=$3
      FROM sellers s
      JOIN users u ON u.id=s.owner_user_id
      WHERE l.seller_id=s.id AND u.phone_e164=$1
      RETURNING l.id
    `, [phone, 43.238949, 76.889709]);
    expect(location.rows).toHaveLength(1);
  } finally {
    await pool.end();
  }
}

async function login(page: import('@playwright/test').Page, phone: string) {
  await page.goto('/seller');
  await page.getByRole('link', { name: 'Войти' }).click();
  await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Получить код' }).click();
  const requested = await (await requestResponse).json();
  await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL('/');
}

async function search(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
}

test('Seller manages an existing Offer only after explicit confirmation and buyer Search follows committed state', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  const sellerName = `S5 E2E ${testInfo.project.name}`;
  const sellerOfferCard = page.getByRole('article').filter({ has: page.getByText(sellerName, { exact: true }) });
  await cleanup(phone);
  try {
    await login(page, phone);

    await page.goto('/seller');
    await page.getByLabel('Имя', { exact: true }).fill(sellerName);
    await page.getByLabel('Название торговой точки').fill('S5 E2E точка');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S5 E2E адрес');
    await page.getByLabel('Телефон', { exact: true }).fill(publicPhoneFor(testInfo.project.name));
    await page.getByRole('button', { name: 'Сохранить и продолжить' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await makeBuyerEligible(phone, testInfo.project.name);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
    await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('4200.00');
    await page.getByRole('textbox', { name: 'Единица', exact: true }).fill('кг');
    await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill('S5 старая партия');
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await page.getByRole('button', { name: 'Подтвердить и создать Offer' }).click();
    await expect(page.getByText('Offer создан', { exact: true })).toBeVisible();

    await search(page);
    await expect(page.getByText(sellerName, { exact: true })).toBeVisible();
    await expect(page.getByText('S5 старая партия', { exact: true })).toBeVisible();
    await expect(sellerOfferCard.getByText(/4 200 ₸/)).toBeVisible();

    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Мои предложения' })).toBeVisible();
    await page.getByRole('button', { name: 'Изменить' }).click();
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Проверить изменение' }) });
    await editForm.getByLabel('Цена, ₸').fill('4500.00');
    await editForm.getByLabel('Единица').fill('кг');
    await editForm.getByLabel('Комментарий продавца').fill('S5 новая партия');
    await editForm.getByRole('button', { name: 'Проверить изменение' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(page.getByText('Новые цена и комментарий ещё не применены. Покупатели пока видят прежние данные.')).toBeVisible();
    await expect(page.getByText('4500.00 KZT / кг', { exact: true })).toBeVisible();
    await expect(page.getByText('S5 новая партия', { exact: true })).toBeVisible();

    const updateReviewUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(updateReviewUrl);
    await expect(page.getByText('S5 новая партия', { exact: true })).toBeVisible();

    await search(page);
    await expect(page.getByText(sellerName, { exact: true })).toBeVisible();
    await expect(page.getByText('S5 старая партия', { exact: true })).toBeVisible();
    await expect(page.getByText('S5 новая партия', { exact: true })).toHaveCount(0);
    await expect(sellerOfferCard.getByText(/4 200 ₸/)).toBeVisible();

    await page.goto(updateReviewUrl);
    await page.getByRole('button', { name: 'Подтвердить изменение' }).click();
    await expect(page.getByText('Новые цена и комментарий применены.')).toBeVisible();

    await search(page);
    await expect(page.getByText(sellerName, { exact: true })).toBeVisible();
    await expect(page.getByText('S5 новая партия', { exact: true })).toBeVisible();
    await expect(sellerOfferCard.getByText(/4 500 ₸/)).toBeVisible();
    await expect(page.getByText('S5 старая партия', { exact: true })).toHaveCount(0);

    await page.goto('/seller');
    await page.getByRole('button', { name: 'Выключить' }).click();
    await expect(page.getByText('Offer ещё не выключен и остаётся доступен покупателям по обычным правилам поиска.')).toBeVisible();
    const deactivateReviewUrl = page.url();

    await search(page);
    await expect(page.getByText(sellerName, { exact: true })).toBeVisible();
    await page.goto(deactivateReviewUrl);
    await page.getByRole('button', { name: 'Подтвердить выключение' }).click();
    await expect(page.getByText('Offer выключен.', { exact: true })).toBeVisible();

    await search(page);
    await expect(page.getByText(sellerName, { exact: true })).toHaveCount(0);

    await page.goto('/seller');
    await page.getByRole('button', { name: 'Включить' }).click();
    await expect(page.getByText('Актуальность Offer ещё не подтверждена повторно.')).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить актуальность' }).click();
    await expect(page.getByText('Актуальность Offer подтверждена.')).toBeVisible();

    await search(page);
    await expect(page.getByText(sellerName, { exact: true })).toBeVisible();
    await expect(page.getByText('S5 новая партия', { exact: true })).toBeVisible();

    await page.goto('/seller');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Мои предложения' })).toBeVisible();
    await expect(page.getByText('Активно', { exact: true }).first()).toBeVisible();

    await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
    await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('4700.00');
    await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill('S5 второй Offer');
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await page.getByRole('button', { name: 'Подтвердить и создать Offer' }).click();
    await expect(page.getByText('Offer создан', { exact: true })).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});