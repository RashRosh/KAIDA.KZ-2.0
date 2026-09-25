import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor } from './offer-editor-helpers';

// seller-offer-editor §7: field errors, dirty close, double-submit guard and the Kazakh phone-width form.

function phoneFor(projectName: string, slot: number) {
  return `+7700001${projectName === 'mobile' ? '98' : '99'}${slot}0`;
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
      await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

// A logged-in Seller with exactly one trading point is a prerequisite, not the behavior under test.
async function prepareSeller(page: Page, phone: string, sellerName: string): Promise<string> {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  return withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, sellerName]);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type) VALUES ($1,$2,'Алматы, редактор','shop')", [seller.rows[0].id, `${sellerName} точка`]);
    return seller.rows[0].id as string;
  });
}

async function changeSetCount(sellerId: string) {
  return withPool(async (pool) => Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerId])).rows[0].count));
}

test('field errors: an invalid price is caught in the form and an unknown product comes back to its field', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 1);
  await cleanup(phone);
  try {
    const sellerId = await prepareSeller(page, phone, `Редактор ${testInfo.project.name}`);
    await page.goto('/seller/offers?new=1');
    const editor = offerEditor(page);

    // Price with three decimals is refused before anything is sent; the error sits under the field.
    await fillOfferFields(page, { product: 'Баранина', price: '12,345', unit: 'kg' });
    await editor.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(editor.getByRole('alert').filter({ hasText: 'Исправьте одно поле, чтобы продолжить' })).toBeVisible();
    const price = editor.getByRole('textbox', { name: 'Цена', exact: true });
    await expect(price).toHaveAttribute('aria-invalid', 'true');
    await expect(price).toBeFocused();
    await expect(editor.getByText('Цена — число, до двух знаков после запятой', { exact: false })).toBeVisible();

    // An unknown product passes the form but the catalog returns it to the product field with the draft kept.
    await fillOfferFields(page, { product: 'Товар которого нет в каталоге', price: '1200' });
    await editor.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(editor.getByRole('heading', { name: 'Где продаёте?' })).toBeVisible();
    await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const product = editor.getByRole('textbox', { name: 'Товар', exact: true });
    await expect(editor.getByText('Такого товара нет в каталоге — проверьте название.')).toBeVisible();
    await expect(product).toHaveAttribute('aria-invalid', 'true');
    await expect(product).toHaveValue('Товар которого нет в каталоге');
    await expect(price).toHaveValue('1200');
    expect(await changeSetCount(sellerId)).toBe(0);
  } finally {
    await cleanup(phone);
  }
});

test('closing a form with typed values asks first; keeping returns to the values, discarding closes the form', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 2);
  await cleanup(phone);
  try {
    await prepareSeller(page, phone, `Закрытие ${testInfo.project.name}`);
    await page.goto('/seller/offers?new=1');
    const editor = offerEditor(page);
    await fillOfferFields(page, { product: 'Баранина', price: '4200' });

    await page.keyboard.press('Escape');
    const confirm = page.getByRole('alertdialog', { name: 'Закрыть без сохранения?' });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Вернуться к форме' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Вернуться к форме' }).click();
    await expect(confirm).toBeHidden();
    await expect(editor.getByRole('textbox', { name: 'Товар', exact: true })).toHaveValue('Баранина');
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue('4200');

    await page.keyboard.press('Escape');
    await confirm.getByRole('button', { name: 'Не сохранять' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/seller\/offers$/);

    // An untouched form closes without asking.
    await page.goto('/seller/offers?new=1');
    await expect(offerEditor(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await cleanup(phone);
  }
});

test('a double tap on Продолжить creates one change set', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 3);
  await cleanup(phone);
  try {
    const sellerId = await prepareSeller(page, phone, `Двойное ${testInfo.project.name}`);
    await page.goto('/seller/offers?new=1');
    const editor = offerEditor(page);
    await fillOfferFields(page, { product: 'Баранина', price: '4300', unit: 'kg' });
    await editor.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(editor.getByRole('heading', { name: 'Где продаёте?' })).toBeVisible();

    await editor.getByRole('button', { name: 'Продолжить', exact: true }).dblclick();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
    expect(await changeSetCount(sellerId)).toBe(1);
  } finally {
    await cleanup(phone);
  }
});

test('the form in Kazakh at 320 px fits without horizontal scroll and asks before discarding', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 4);
  await cleanup(phone);
  try {
    await page.setViewportSize({ width: 320, height: 720 });
    await prepareSeller(page, phone, `Қазақша ${testInfo.project.name}`);
    await page.goto('/seller/offers?new=1');
    const editor = offerEditor(page);
    await editor.getByRole('button', { name: 'Қазақша' }).click();
    await expect(editor.getByRole('heading', { name: 'Жаңа ұсыныс' })).toBeVisible();

    await editor.getByRole('button', { name: 'Әрі қарай', exact: true }).click();
    await expect(editor.getByText('Тауарды көрсетіңіз.')).toBeVisible();
    const fits = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
      return document.documentElement.scrollWidth <= window.innerWidth && dialog.scrollWidth <= dialog.clientWidth;
    });
    expect(fits).toBe(true);

    await editor.getByRole('textbox', { name: 'Тауар', exact: true }).fill('Қой еті');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog', { name: 'Сақтамай жабасыз ба?' })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});
