import { randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { openOffer, resultCard } from './buyer-helpers';
import { chooseUnit, fillOfferFields, openNewCard, publishButton } from './offer-editor-helpers';

// wholesale-price §9 (E2E mobile RU): the Seller adds a wholesale line in its sheet, a unit change blocks saving until
// it is reviewed, the review page shows it, and the buyer sees «650 ₸ / кг ОПТ · от 1 ящика (≈ 10 кг)» in results and
// on the Offer page.

const PHONE = '+77000471010';

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
      await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function login(request: APIRequestContext, phone: string) {
  const requested = await (await request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

// A logged-in Seller with one geo-confirmed point (prerequisite, not the behavior under test).
async function prepareSeller(page: Page) {
  await cleanup(PHONE);
  await login(page.request, PHONE);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [PHONE]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, 'Опт E2E']);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,'Опт точка','Алматы','shop',43.25,76.95)", [seller.rows[0].id]);
  });
}

const flat = (text: string | null) => (text ?? '').replace(/\s+/gu, ' ').trim();

test('the Seller adds a wholesale price; a unit change blocks saving; the buyer sees the wholesale line', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile RU is the gate of this slice');
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const title = `Перец ${suffix}`;
  try {
    await prepareSeller(page);
    const editor = await openNewCard(page);
    await fillOfferFields(page, { product: title, price: '900', unit: 'kg' });

    // The sheet: each field reports its own error, nothing is saved until all are valid.
    await editor.getByRole('button', { name: 'Оптовая цена', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Оптовая цена' });
    await expect(sheet.getByRole('textbox', { name: 'Цена', exact: true })).toBeFocused();
    await expect(sheet.getByText('₸ / кг')).toBeVisible();
    await sheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(sheet.getByText('Укажите цену больше 0 ₸')).toBeVisible();
    await expect(sheet.getByText('Укажите, сколько единиц в одной таре')).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Цена', exact: true }).fill('650');
    await expect(sheet.getByText('Укажите цену больше 0 ₸')).toHaveCount(0);
    await expect(sheet.getByRole('combobox', { name: 'Тара' })).toHaveValue('box');
    await sheet.getByRole('textbox', { name: 'Сколько кг в одном ящике' }).fill('10');
    await expect(sheet.getByText('Покупатель увидит: от 1 ящика (≈ 10 кг)')).toBeVisible();
    await sheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(sheet).toHaveCount(0);

    const row = editor.getByTestId('wholesale-row');
    await expect(row.getByTestId('wholesale-line')).toHaveText(/650\s₸\s\/\sкг\sОПТ\s*от\s1\sящика\s\(≈\s10\sкг\)/u);
    await expect(row.getByRole('button', { name: 'Изменить' })).toBeFocused();

    // A unit change sends the wholesale line back for review and blocks publishing.
    await chooseUnit(page, 'piece');
    await expect(row.getByText('Изменилась единица цены. Укажите, сколько шт в одном ящике, или уберите оптовую цену.')).toBeVisible();
    await expect(row.getByTestId('wholesale-line')).toContainText('(≈ ? шт)');
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).not.toHaveURL(/\/seller\/change-sets\//);
    await expect(editor.getByText('Заполните 1 поле')).toBeVisible();

    await chooseUnit(page, 'kg');
    await row.getByRole('button', { name: 'Проверить' }).click();
    await expect(sheet.getByRole('textbox', { name: 'Сколько кг в одном ящике' })).toHaveValue('');
    await sheet.getByRole('textbox', { name: 'Сколько кг в одном ящике' }).fill('10');
    await sheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(row.getByText(/Изменилась единица цены/)).toHaveCount(0);

    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await expect(page.locator('.kv').filter({ hasText: 'Оптовая цена' })).toContainText(/650\s₸\s\/\sкг\s·\sот\s1\sящика\s\(≈\s10\sкг\)/u);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?|$)/);

    // The buyer: the second line under the retail price in results and on the Offer page.
    await page.goto('/');
    const input = page.getByRole('search').locator('input[type="search"]').first();
    await input.fill(suffix);
    await input.press('Enter');
    const card = resultCard(page, title);
    await expect(card).toHaveCount(1);
    const line = card.getByTestId('wholesale-line');
    expect(flat(await line.textContent())).toBe('650 ₸ / кг ОПТ от 1 ящика (≈ 10 кг)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await openOffer(card, title);
    expect(flat(await page.getByTestId('wholesale-line').textContent())).toBe('650 ₸ / кг ОПТ от 1 ящика (≈ 10 кг)');
  } finally {
    await cleanup(PHONE);
  }
});
