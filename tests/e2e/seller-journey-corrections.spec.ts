import { expect, test, type Locator, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { offerEditor, publishButton } from './offer-editor-helpers';

// seller-ai-text-real-parser §19–§21 (manual-acceptance findings 4, 5, 7) on the default server (fake parser):
// consistent row navigation and return from the editor, publication-state styling, the products of one point.
const phoneFor = (project: string, slot: number) => `+7700008${project === 'mobile' ? '7' : '8'}02${slot}`;

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
    const bySeller = 'SELECT s.id FROM sellers s JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1';
    await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${bySeller}))`, [phone]);
    await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [phone]);
    await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`, [phone]);
    await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query('DELETE FROM sellers WHERE owner_user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function sellerWithPoint(page: Page, phone: string, name: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  const response = await page.request.post('/api/seller/setup', { data: { seller: { displayName: 'Путь' }, location: { name, type: 'shop', addressText: 'Алматы' } } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { seller: { locations: { id: string }[] } }).seller.locations[0]!.id;
}

const hasArrow = (row: Locator) => row.locator('.rowbtn .i-right');

test.describe('seller journey corrections', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('3100'), 'default server with the fake parser');

  test('draft rows keep their arrow and the editor returns to the review; editing one draft leaves the other as it was', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 1);
    try {
      await sellerWithPoint(page, phone, 'Точка стрелок');
      await page.goto('/seller/text-input');
      await page.getByLabel('Список товаров').fill('[fixture:e2e-multi]');
      await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
      await expect(page).toHaveURL(/text-input\/review\?input=/);
      const reviewUrl = page.url();
      const rows = page.locator('[data-testid^="text-draft-"]');
      await expect(rows).toHaveCount(2);
      for (const index of [0, 1]) await expect(hasArrow(rows.nth(index))).toBeVisible();
      const otherBefore = await rows.nth(1).innerText();

      await rows.first().getByRole('button').first().click();
      const editor = offerEditor(page);
      await expect(editor).toBeVisible();
      await editor.getByRole('combobox', { name: 'Название товара' }).fill('Баранина, лопатка');
      await editor.getByRole('button', { name: 'Сохранить черновик' }).click();
      await expect(page).toHaveURL(reviewUrl);
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText('Баранина, лопатка');
      expect(await rows.nth(1).innerText()).toBe(otherBefore);
      for (const index of [0, 1]) await expect(hasArrow(rows.nth(index))).toBeVisible();

      await page.reload();
      await expect(rows).toHaveCount(2);
      for (const index of [0, 1]) await expect(hasArrow(rows.nth(index))).toBeVisible();

      await page.goto('/seller');
      const draftRows = page.locator('[data-testid^="seller-draft-"]');
      await expect(draftRows).toHaveCount(2);
      for (const index of [0, 1]) await expect(hasArrow(draftRows.nth(index))).toBeVisible();
    } finally {
      await cleanup(phone);
    }
  });

  test('published cards share one style and status; drafts stay neutral; no lasting highlight; keyboard focus stays visible', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 2);
    try {
      await sellerWithPoint(page, phone, 'Точка стиля');
      await page.goto('/seller/text-input');
      await page.getByLabel('Список товаров').fill('[fixture:e2e-multi]');
      await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
      await expect(page).toHaveURL(/text-input\/review/);
      await page.locator('[data-testid^="text-draft-"]').first().getByRole('button').first().click();
      const editor = offerEditor(page);
      await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
      await expect(page).toHaveURL(/\/seller\/change-sets\//);
      await page.getByRole('button', { name: publishButton }).click();
      await expect(page).toHaveURL(/\/seller(\?.*)?$/);

      const published = page.locator('[data-testid^="seller-card-"]');
      await expect(published).toHaveCount(1);
      await expect(published).toHaveClass(/\bpub\b/);
      await expect(published).not.toHaveClass(/\bhl\b/);
      await expect(published.getByTestId('status-published')).toHaveText('Опубликовано · На витрине');
      const draft = page.locator('[data-testid^="seller-draft-"]');
      await expect(draft).toHaveCount(1);
      await expect(draft).not.toHaveClass(/\bpub\b/);
      await expect(draft).toContainText('Черновик');

      // The same style after a reload: it follows the state, not the publication moment.
      await page.reload();
      await expect(published).toHaveClass(/\bpub\b/);

      // Keyboard focus shows its own outline on a published row.
      const target = published.locator('.rowbtn');
      for (let step = 0; step < 40 && !(await target.evaluate((el) => el === document.activeElement)); step += 1) await page.keyboard.press('Tab');
      expect(await target.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await target.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');

      // A switched-off card never claims «На витрине».
      await withPool((pool) => pool.query("UPDATE offers SET status='inactive' WHERE seller_id IN (SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1)", [phone]));
      await page.reload();
      await expect(published).not.toHaveClass(/\bpub\b/);
      await expect(published.getByTestId('status-published')).toHaveCount(0);
      await expect(published).toContainText('Выключено');
    } finally {
      await cleanup(phone);
    }
  });

  test('«Товары точки · N»: one point’s cards and drafts, add products with that point, empty point, back to points', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 3);
    try {
      const pointId = await sellerWithPoint(page, phone, 'Точка товаров');
      const second = await page.request.post('/api/seller/locations', { data: { name: 'Пустая точка', type: 'shop', addressText: 'Алматы' } });
      expect(second.ok()).toBe(true);
      const secondId = ((await second.json()) as { location: { id: string } }).location.id;
      await page.goto(`/seller/text-input?point=${pointId}`);
      await page.getByLabel('Список товаров').fill('[fixture:e2e-multi]');
      await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
      await expect(page).toHaveURL(/text-input\/review/);

      await page.goto('/seller/points');
      await expect(page.getByTestId(`point-products-${pointId}`)).toHaveText(/Товары точки · 2/);
      await expect(page.getByTestId(`point-products-${secondId}`)).toHaveText(/Товары точки · 0/);
      await page.getByTestId(`point-products-${pointId}`).click();
      await expect(page).toHaveURL(new RegExp(`/seller/points/${pointId}/products`));
      await expect(page.getByRole('heading', { level: 1, name: 'Точка товаров' })).toBeVisible();
      await expect(page.getByTestId('point-products')).toContainText('Товары точки · 2');
      await expect(page.locator('[data-testid^="seller-draft-"]')).toHaveCount(2);

      await page.getByTestId('point-products-add').click();
      await page.getByTestId('add-products-manual').click();
      await expect(page).toHaveURL(new RegExp(`/seller\\?new=1&at=${pointId}`));
      await expect(offerEditor(page)).toContainText('Точка товаров');
      await page.goto(`/seller/points/${secondId}/products`);
      await expect(page.getByTestId('point-products-empty')).toHaveText('В этой точке пока нет товаров');
      await page.getByRole('button', { name: 'Назад к точкам' }).click();
      await expect(page).toHaveURL(/\/seller\/points$/);
    } finally {
      await cleanup(phone);
    }
  });
});
