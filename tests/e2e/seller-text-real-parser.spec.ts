import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { offerEditor, publishButton } from './offer-editor-helpers';
import { REAL_PARSER_BASE_URL, realParserPhone } from './real-parser-e2e';

// seller-ai-text-real-parser §9.1 E2E, REPLAY mode: the production build runs `real` mode against the loopback replay
// stub (saved or hand-written answers, never a model). Proves the integration path, not extraction quality.
test.use({ baseURL: REAL_PARSER_BASE_URL });

const SCENARIO = 'Сегодня есть куриное филе по 2400 за килограмм, бёдра по 1800, пельмени наши, пачка пол кило — 1400 тенге. Хотя нет, филе уже 2500, сметана закончилась.';

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
    await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query('DELETE FROM sellers WHERE owner_user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function counts(phone: string) {
  return withPool(async (pool) => {
    const q = async (table: string) => Number((await pool.query(
      `SELECT count(*)::int AS n FROM ${table} t JOIN sellers s ON s.id = t.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1`,
      [phone],
    )).rows[0].n);
    return { drafts: await q('offer_drafts'), offers: await q('offers') };
  });
}

async function sellerWithPoint(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  await page.goto('/seller/points');
  await page.getByLabel('Имя', { exact: true }).fill('Продавец списка');
  await page.getByLabel('Название для покупателей').fill('Точка списка');
  await page.getByLabel('Тип торговой точки').selectOption('shop');
  await page.getByLabel('Адрес').fill('Алматы');
  await page.getByRole('button', { name: 'Сохранить точку' }).click();
  await expect(page.getByTestId('point-created-panel')).toBeVisible();
}

test.describe('seller text input with the real parser (replay stub)', () => {
  test('failure → retry without duplicates → review with notices and reminder → publish one card → replay', async ({ page }, testInfo) => {
    const phone = realParserPhone(testInfo.project.name, 1);
    await sellerWithPoint(page, phone);
    const text = `${SCENARIO} [stub:fail-once] [e2e:${testInfo.project.name}]`;

    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await page.getByTestId('source-text-input').click();
    await page.getByLabel('Список товаров').fill(text);
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page.getByTestId('text-input-error')).toContainText('Не удалось разобрать текст');
    await expect(page.getByTestId('text-input-error').getByRole('link', { name: 'Заполнить вручную' })).toBeVisible();
    expect(await counts(phone)).toEqual({ drafts: 0, offers: 0 });

    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page).toHaveURL(/text-input\/review\?input=/);
    const inputId = new URL(page.url()).searchParams.get('input')!;
    await expect(page.getByTestId('text-input-reminder')).toHaveText('Список составлен автоматически. Сверьте с исходным текстом выше.');
    await expect(page.locator('[data-testid^="text-draft-"]')).toHaveCount(3);
    await expect(page.getByTestId('text-skipped-block')).toContainText('сметана');
    await expect(page.getByTestId('text-skipped-block')).toContainText('нет в наличии');
    await expect(page.getByTestId('text-uncertain-notice').first()).toContainText('Единица не указана');
    expect(await counts(phone)).toEqual({ drafts: 3, offers: 0 });

    await page.getByRole('button', { name: /пельмени наши/ }).click();
    const editor = offerEditor(page);
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);
    expect(await counts(phone)).toEqual({ drafts: 2, offers: 1 });

    // A late retry of the same submission (same requestId and point) after publishing: replay, nothing recreated.
    const locationId = await withPool(async (pool) => (await pool.query(
      'SELECT l.id FROM locations l JOIN sellers s ON s.id = l.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
    )).rows[0].id as string);
    const replay = await page.request.post('/api/seller/text-input', { data: { text, requestId: inputId, locationId } });
    expect(replay.status()).toBe(200);
    const body = await replay.json();
    expect([body.unavailableDrafts, body.drafts.length]).toEqual([1, 2]);
    expect(await counts(phone)).toEqual({ drafts: 2, offers: 1 });
    await page.goto(`/seller/text-input/review?input=${inputId}`);
    await expect(page.getByTestId('text-review-published')).toHaveText('Опубликовано из этого списка: 1');
  });

  test('pack written in grams stays in grams; omission hint for a line the parser did not cover', async ({ page }, testInfo) => {
    const phone = realParserPhone(testInfo.project.name, 2);
    await sellerWithPoint(page, phone);
    await page.goto('/seller/text-input');
    await page.getByLabel('Список товаров').fill(`Баранина 4500 за кг\nКурага пачка 500 г 1200 [e2e:${testInfo.project.name}]`);
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page).toHaveURL(/text-input\/review/);
    await expect(page.locator('[data-testid^="text-draft-"]')).toHaveCount(2);
    await page.getByRole('button', { name: /Курага/ }).click();
    const editor = offerEditor(page);
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Вес или объём', { exact: true })).toHaveValue('500');
    await expect(editor.getByLabel('Единица веса или объёма')).toHaveValue('g');
  });

  test('answer-level failures create nothing and offer manual entry', async ({ page }, testInfo) => {
    const phone = realParserPhone(testInfo.project.name, 3);
    await sellerWithPoint(page, phone);
    await page.goto('/seller/text-input');
    await page.getByLabel('Список товаров').fill(`${SCENARIO} [stub:no-array] [e2e:${testInfo.project.name}]`);
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page.getByTestId('text-input-error')).toBeVisible();
    await page.getByTestId('text-input-error').getByRole('link', { name: 'Заполнить вручную' }).click();
    await expect(offerEditor(page)).toBeVisible();
    expect(await counts(phone)).toEqual({ drafts: 0, offers: 0 });
  });

  test('a seller who is not allowlisted does not see the real channel', async ({ page }, testInfo) => {
    const phone = realParserPhone(testInfo.project.name, 9);
    await sellerWithPoint(page, phone);
    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await expect(page.getByTestId('source-text-input')).toHaveCount(0);
    expect((await page.goto('/seller/text-input'))?.status()).toBe(404);
    const api = await page.request.post('/api/seller/text-input', { data: { text: SCENARIO } });
    expect([api.status(), (await api.json()).error.code]).toEqual([503, 'TEXT_INPUT_UNAVAILABLE']);
  });
});
