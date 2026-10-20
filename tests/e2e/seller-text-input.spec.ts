import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { offerEditor, publishButton } from './offer-editor-helpers';

function phoneFor(projectName: string, slot: number) {
  const band = projectName === 'mobile' ? '493' : '494';
  return `+770000${band}0${slot}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(
        `DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${bySeller}))`,
        [row.id],
      );
      await pool.query(
        `DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`,
        [row.id],
      );
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(
        `DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`,
        [row.id],
      );
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function loginAsSeller(page: Page, phone: string) {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect(
    (await page.request.post('/api/auth/otp/verify', {
      data: { challengeId: requested.challenge.id, code: requested.delivery.code },
    })).ok(),
  ).toBe(true);
}

async function offerCount(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    return Number((await pool.query(`
      SELECT count(*) FROM offers o
      JOIN sellers s ON s.id = o.seller_id
      JOIN users u ON u.id = s.owner_user_id
      WHERE u.phone_e164 = $1
    `, [phone])).rows[0].count);
  } finally {
    await pool.end();
  }
}

test.describe('seller text input', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('3100'), 'text input E2E runs on the default server with SELLER_TEXT_INPUT=fake');

  test('text to drafts, edit, no auto publish', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 1);
    await cleanup(phone);
    await loginAsSeller(page, phone);
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill('Продавец текста');
    await page.getByLabel('Название для покупателей').fill('Точка текста');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();

    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await page.getByTestId('source-text-input').click();
    await page.getByLabel('Список товаров').fill('[fixture:e2e-catalog]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page).toHaveURL(/text-input\/review/);
    await expect(page.getByTestId('text-input-review')).toBeVisible();
    expect(await offerCount(phone)).toBe(0);

    await page.getByRole('button', { name: /Баранина/ }).click();
    await page.getByLabel('Название товара').fill('Баранина, лопатка');
    await page.getByRole('button', { name: 'Сохранить черновик' }).click();
    expect(await offerCount(phone)).toBe(0);
  });

  test('shows skipped and uncertain notices', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 2);
    await cleanup(phone);
    await loginAsSeller(page, phone);
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill('Продавец');
    await page.getByLabel('Название для покупателей').fill('Точка');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();

    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await page.getByTestId('source-text-input').click();
    await page.getByLabel('Список товаров').fill('[fixture:e2e-skipped]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page.getByTestId('text-skipped-block')).toContainText('Виноград');

    await page.goto('/seller/text-input');
    await page.getByLabel('Список товаров').fill('[fixture:e2e-uncertain]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page.getByTestId('text-uncertain-notice')).toBeVisible();
  });

  test('publish after confirm creates exactly one offer', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 3);
    await cleanup(phone);
    await loginAsSeller(page, phone);
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill('Продавец публикации');
    await page.getByLabel('Название для покупателей').fill('Точка публикации');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();

    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await page.getByTestId('source-text-input').click();
    await page.getByLabel('Список товаров').fill('[fixture:e2e-catalog]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await page.getByRole('button', { name: /Баранина/ }).click();

    const editor = offerEditor(page);
    await expect(editor).toBeVisible();
    expect(await offerCount(phone)).toBe(0);
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);
    expect(await offerCount(phone)).toBe(1);
  });

  test('network error can retry', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 4);
    await cleanup(phone);
    await loginAsSeller(page, phone);
    await page.goto('/seller/text-input');
    await page.route('**/api/seller/text-input', (route) => route.abort());
    await page.getByLabel('Список товаров').fill('[fixture:e2e-catalog]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.unroute('**/api/seller/text-input');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page).toHaveURL(/text-input\/review/);
  });
});
