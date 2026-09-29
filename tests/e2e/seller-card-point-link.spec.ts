import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor } from './offer-editor-helpers';

// seller-card-point-link: the Seller's point opens for editing from the card (a pencil label), and the card comes back
// with everything typed still in place; nothing is sent for the card.

function phoneFor(projectName: string) {
  return `+7700003${projectName === 'mobile' ? '98' : '99'}10`;
}

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function cleanup(phone: string) {
  await withPool(async (pool) => {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function prepareSeller(page: Page, phone: string) {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  return withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name, contact_phone_e164) VALUES ($1,$2,$3) RETURNING id', [user.rows[0].id, 'Точка-ссылка', phone]);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude,phone_e164) VALUES ($1,'Ссылка точка','Алматы, ссылка','shop',43.25,76.95,$2)", [seller.rows[0].id, phone]);
    return seller.rows[0].id as string;
  });
}

const pointName = (sellerId: string) => withPool(async (pool) => (await pool.query('SELECT name FROM locations WHERE seller_id=$1', [sellerId])).rows[0].name as string);
const changeSetCount = (sellerId: string) => withPool(async (pool) => Number((await pool.query('SELECT COUNT(*) FROM seller_change_sets WHERE seller_id=$1', [sellerId])).rows[0].count));

test('a point opens from the card, saves for all its cards and the card keeps what was typed; going back asks only for the point', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The contract covers the phone flow; desktop is deferred.');
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  try {
    const sellerId = await prepareSeller(page, phone);
    await page.goto('/seller?new=1');
    const editor = offerEditor(page);
    await expect(editor).toBeVisible();
    await fillOfferFields(page, { product: 'Баранина', price: '5100', unit: 'kg', comment: 'Свежая, утренняя' });
    const editPoint = editor.getByRole('button', { name: 'Изменить торговую точку Ссылка точка' });

    // Details must load before Save is enabled: fallback empties must never overwrite real contacts or hours.
    await page.route('**/api/seller/points/details', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await editPoint.click();
    await expect(page.getByText('Не удалось загрузить данные продавца.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить точку' })).toBeDisabled();
    await page.getByRole('button', { name: 'Назад к карточке' }).click();
    await expect(editPoint).toBeFocused();
    await page.unroute('**/api/seller/points/details');

    // The pencil label next to the point opens the point editor over the card.
    await editPoint.click();
    await expect(page.getByText('Изменения точки действуют для всех её карточек.')).toBeVisible();
    const name = page.locator('#trading-location-name');
    await expect(name).toHaveValue('Ссылка точка');

    // Going back with a changed point asks; keeping the edit stays on the point, closing returns to the card.
    await name.fill('Точка не сохранена');
    await page.keyboard.press('Escape');
    const sheet = page.getByRole('alertdialog', { name: 'Закрыть без сохранения?' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Продолжить правку' }).click();
    await expect(name).toHaveValue('Точка не сохранена');
    await page.getByRole('button', { name: 'Назад к карточке' }).click();
    await page.getByRole('alertdialog', { name: 'Закрыть без сохранения?' }).getByRole('button', { name: 'Закрыть' }).click();
    await expect(editor.getByRole('combobox', { name: 'Название товара' })).toHaveValue('Баранина');
    await expect(editPoint).toBeFocused();
    expect(await pointName(sellerId)).toBe('Ссылка точка');

    // Save: back on the same card, everything typed is in place, the point has its new name, nothing was sent.
    await editor.getByRole('button', { name: 'Изменить торговую точку Ссылка точка' }).click();
    await page.locator('#trading-location-name').fill('Точка сохранена');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Точка сохранена. Всё введённое на месте')).toBeVisible();
    await expect(editor.getByRole('combobox', { name: 'Название товара' })).toHaveValue('Баранина');
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue('5100');
    await expect(editor.getByRole('textbox', { name: /^Комментарий/ })).toHaveValue('Свежая, утренняя');
    await expect(editor.getByText('Точка сохранена', { exact: true }).first()).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Изменить торговую точку Точка сохранена' })).toBeFocused();
    expect(await pointName(sellerId)).toBe('Точка сохранена');
    expect(await changeSetCount(sellerId)).toBe(0);
    await expect(page).toHaveURL(/\/seller\?new=1$/);
  } finally {
    await cleanup(phone);
  }
});
