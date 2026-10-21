import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { returningVisitorState } from './browser-state';
import { offerEditor, publishButton } from './offer-editor-helpers';

// seller-ai-text-real-parser §16 — the connected seller journey on the default server (fake parser):
// create a point → add products to it → review drafts and skipped items (recoverable) → edit → explicit publish.
const FIELD_HEIGHT = 6 * 22 + 2 * 12 + 2 * 1.5;

function phoneFor(projectName: string, slot: number) {
  return `+770000${projectName === 'mobile' ? '497' : '498'}0${slot}`;
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

async function login(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

async function setupPoint(page: Page, name: string) {
  const response = await page.request.post('/api/seller/setup', {
    data: { seller: { displayName: 'Продавец' }, location: { name, type: 'shop', addressText: 'Алматы' } },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { seller: { locations: { id: string }[] } }).seller.locations[0]!.id;
}

async function fillPointForm(page: Page, name: string) {
  await page.getByLabel('Название для покупателей').fill(name);
  await page.getByLabel('Тип торговой точки').selectOption('shop');
  await page.getByLabel('Адрес').fill('Алматы');
  await page.getByRole('button', { name: 'Сохранить точку' }).click();
}

const submissions = (phone: string) => withPool(async (pool) => Number((await pool.query(
  'SELECT count(*)::int AS n FROM seller_text_submissions t JOIN sellers s ON s.id = t.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1',
  [phone],
)).rows[0].n));

test.describe('connected seller journey', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('3100'), 'runs on the default server with SELLER_TEXT_INPUT=fake');

  test('the list field is about six lines tall, keeps its height and scrolls inside', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 1);
    await login(page, phone);
    await setupPoint(page, 'Точка поля');
    await page.goto('/seller/text-input');
    const field = page.getByLabel('Список товаров');
    await expect(field).toBeVisible();
    const before = (await field.boundingBox())!.height;
    expect(Math.abs(before - FIELD_HEIGHT)).toBeLessThanOrEqual(2);
    const text = Array.from({ length: 20 }, (_, i) => `Товар ${i + 1} — ${100 + i} за кг`).join('\n');
    await field.fill(text);
    await field.press('Control+End');
    const after = (await field.boundingBox())!.height;
    expect(after).toBeCloseTo(before, 0);
    const metrics = await field.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight, top: el.scrollTop, overflow: getComputedStyle(el).overflowY }));
    expect(metrics.scroll).toBeGreaterThan(metrics.client);
    expect(metrics.overflow).toBe('auto');
    // The caret on the last line stays visible: the field scrolled down to it (only the 12 px bottom padding may remain).
    expect(metrics.top).toBeGreaterThan(0);
    expect(metrics.top + metrics.client).toBeGreaterThanOrEqual(metrics.scroll - 12 - 4);
  });

  test('without a point: explanation, create the point, come back with the text and that point, nothing submitted', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 2);
    await login(page, phone);
    await page.goto('/seller/text-input');
    await expect(page.getByTestId('text-input-point-required')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разобрать в черновики' })).toBeDisabled();
    const text = 'Баранина 4500 за кг\nУкроп 200 шт';
    await page.getByLabel('Список товаров').fill(text);

    await page.getByTestId('text-input-create-point').click();
    await expect(page).toHaveURL(/\/seller\/points\?return=text-input/);
    await expect(page.getByLabel('Название для покупателей')).toBeVisible();
    await page.getByRole('button', { name: 'Отмена' }).click();
    await expect(page).toHaveURL(/\/seller\/text-input$/);
    await expect(page.getByLabel('Список товаров')).toHaveValue(text);

    await page.getByTestId('text-input-create-point').click();
    await page.getByLabel('Имя', { exact: true }).fill('Продавец пути');
    await fillPointForm(page, 'Новая точка');
    await expect(page).toHaveURL(/\/seller\/text-input\?point=[0-9a-f-]+/);
    await expect(page.getByLabel('Список товаров')).toHaveValue(text);
    await expect(page.getByTestId('text-input-target-name')).toContainText('Новая точка');
    await expect(page.getByRole('button', { name: 'Разобрать в черновики' })).toBeEnabled();
    expect(await submissions(phone)).toBe(0);
  });

  test('a new or an existing point offers adding products to exactly that point', async ({ page }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 3);
    await login(page, phone);
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill('Продавец точек');
    await fillPointForm(page, 'Точка А');
    const panel = page.getByTestId('point-created-panel');
    await expect(panel).toContainText('Точка «Точка А» создана');
    await panel.getByTestId('point-created-add').click();
    const sheet = page.getByTestId('add-products-sheet');
    await expect(page.getByRole('dialog')).toContainText('Товары для точки «Точка А»');
    await sheet.getByTestId('add-products-text').click();
    await expect(page).toHaveURL(/\/seller\/text-input\?point=[0-9a-f-]+/);
    await expect(page.getByTestId('text-input-target-name')).toContainText('Точка А');

    await page.goto('/seller/points');
    await page.locator('[data-testid^="add-products-"]').first().click();
    await expect(page.getByRole('dialog')).toContainText('Товары для точки «Точка А»');
    await page.getByRole('button', { name: 'Готово, добавлю позже' }).click();
    await expect(sheet).toHaveCount(0);

    await page.locator('[data-testid^="add-products-"]').first().click();
    await page.getByTestId('add-products-manual').click();
    await expect(page).toHaveURL(/\/seller\?new=1&at=[0-9a-f-]+/);
    await expect(offerEditor(page)).toBeVisible();
    await expect(offerEditor(page)).toContainText('Точка А');
  });

  test('review recovers after reload, in a new tab and from the showcase; published and expired states', async ({ page, context, browser }, testInfo) => {
    const phone = phoneFor(testInfo.project.name, 4);
    await login(page, phone);
    await setupPoint(page, 'Точка разбора');
    await page.goto('/seller/text-input');
    await page.getByLabel('Список товаров').fill('[fixture:e2e-skipped]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await expect(page).toHaveURL(/text-input\/review\?input=/);
    const reviewUrl = page.url();
    const inputId = new URL(reviewUrl).searchParams.get('input')!;
    await expect(page.getByTestId('text-skipped-block')).toContainText('Виноград');
    await expect(page.getByTestId('text-review-raw')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('text-skipped-block')).toContainText('Виноград');
    await expect(page.getByTestId('text-review-raw')).toBeVisible();

    const tab = await context.newPage();
    await tab.goto(reviewUrl);
    await expect(tab.getByTestId('text-skipped-block')).toContainText('Виноград');
    await expect(tab.getByTestId('text-review-raw-unavailable')).toBeVisible();
    await expect(tab.getByTestId('text-review-point')).toContainText('Точка разбора');
    await tab.close();

    await page.goto('/seller');
    await page.getByTestId(`text-review-link-${inputId}`).click();
    await expect(page).toHaveURL(new RegExp(`input=${inputId}`));
    await expect(page.getByTestId('text-skipped-block')).toContainText('Виноград');

    await page.getByRole('button', { name: /Баранина/ }).click();
    const editor = offerEditor(page);
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);
    await page.goto(reviewUrl);
    await expect(page.getByTestId('text-review-published')).toHaveText('Опубликовано из этого списка: 1');
    await expect(page.getByTestId('text-skipped-block')).toContainText('Виноград');

    const other = await browser.newContext({ storageState: returningVisitorState, baseURL: testInfo.project.use.baseURL });
    const otherPage = await other.newPage();
    const otherPhone = phoneFor(testInfo.project.name, 5);
    await login(otherPage, otherPhone);
    await setupPoint(otherPage, 'Чужая точка');
    await otherPage.goto(reviewUrl);
    await expect(otherPage.getByTestId('text-review-unavailable')).toBeVisible();
    await other.close();
    await cleanup(otherPhone);

    await withPool((pool) => pool.query("UPDATE seller_text_submissions SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' WHERE request_id = $1", [inputId]));
    await page.reload();
    await expect(page.getByTestId('text-review-unavailable')).toBeVisible();
    await expect(page.getByTestId('text-skipped-block')).toHaveCount(0);
  });
});
