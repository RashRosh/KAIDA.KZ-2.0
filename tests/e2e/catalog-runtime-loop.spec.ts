import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { search } from './buyer-helpers';
import { fillOfferFields, offerEditor, openNewCard, publishButton } from './offer-editor-helpers';

// catalog-runtime-loop: a Product that exists only in Production KB v1 (installed by the E2E global setup through the
// existing importer) goes from a Seller suggestion to a published Offer that a Buyer finds by its RU and KK catalog names.

const KB_PRODUCT = 'Мёд горный'; // KAIDA-P0697, KK «Тау балы»

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
      await pool.query('DELETE FROM photos WHERE owner_user_id=$1', [row.id]);
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

async function prepareSeller(page: Page, phone: string, point: string) {
  await cleanup(phone);
  await login(page.request, phone);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, 'Пасека']);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95)", [seller.rows[0].id, point]);
  });
}

test('a non-seed Production KB Product chosen from suggestions is published and found by its RU and KK catalog names', async ({ page }, testInfo) => {
  const tag = testInfo.project.name;
  const phone = `+7700007${tag === 'mobile' ? '5' : '6'}010`;
  const point = `Пасека точка ${tag}`;
  try {
    await prepareSeller(page, phone, point);
    const editor = await openNewCard(page);
    const name = editor.getByRole('combobox', { name: 'Название товара' });
    await name.fill('мёд гор');
    await editor.getByRole('option', { name: KB_PRODUCT }).click();
    await expect(name).toHaveValue(KB_PRODUCT);
    await fillOfferFields(page, { price: '9000', unit: 'kg' });
    await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Опубликовано. Карточка уже видна покупателям' })).toBeVisible();

    // The Offer is linked to the runtime catalog Product.
    const linked = await withPool((pool) => pool.query(
      `SELECT p.name, o.title FROM offers o JOIN products p ON p.id = o.product_id
       WHERE o.seller_id IN (SELECT id FROM sellers WHERE owner_user_id = (SELECT id FROM users WHERE phone_e164=$1))`, [phone]));
    expect(linked.rows).toEqual([{ name: KB_PRODUCT, title: KB_PRODUCT }]);

    // A Buyer finds that exact Offer by the canonical name and by the alternate (Kazakh) catalog name.
    for (const query of [KB_PRODUCT, 'Тау балы']) {
      await page.goto('/');
      await search(page, query);
      const result = page.getByRole('article').filter({ hasText: point });
      await expect(result).toContainText(KB_PRODUCT);
      await expect(result).toContainText('9');
    }
  } finally {
    await cleanup(phone);
  }
});

// S15B-1: natural typing reaches «Баранина» in the suggestions, first for «баран», and choosing it links the card.
test('typing баран and бар shows Баранина among the catalog suggestions and choosing it works', async ({ page }, testInfo) => {
  const tag = testInfo.project.name;
  const phone = `+7700007${tag === 'mobile' ? '5' : '6'}020`;
  try {
    await prepareSeller(page, phone, `Лавка ${tag}`);
    const editor = await openNewCard(page);
    const name = editor.getByRole('combobox', { name: 'Название товара' });
    await name.fill('баран');
    const options = editor.getByRole('option');
    await expect(options.first()).toHaveText('Баранина');
    await expect(options).toHaveCount(5);
    await name.fill('бар');
    await expect(editor.getByRole('option', { name: 'Баранина', exact: true })).toBeVisible();
    await editor.getByRole('option', { name: 'Баранина', exact: true }).click();
    await expect(name).toHaveValue('Баранина');
    await fillOfferFields(page, { price: '4000', unit: 'kg' });
    await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Опубликовано. Карточка уже видна покупателям' })).toBeVisible();
    const linked = await withPool((pool) => pool.query(
      `SELECT p.name FROM offers o JOIN products p ON p.id = o.product_id
       WHERE o.seller_id IN (SELECT id FROM sellers WHERE owner_user_id = (SELECT id FROM users WHERE phone_e164=$1))`, [phone]));
    expect(linked.rows).toEqual([{ name: 'Баранина' }]);
  } finally {
    await cleanup(phone);
  }
});
