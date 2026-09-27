import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor } from './offer-editor-helpers';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000367' : '+77000000368';
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

async function authenticate(page: Page, phone: string) {
  const requested = await page.request.post('/api/auth/otp/request', { data: { phone } });
  expect(requested.status()).toBe(201);
  const body = await requested.json() as { challenge: { id: string }; delivery: { code: string } };
  const verified = await page.request.post('/api/auth/otp/verify', {
    data: { challengeId: body.challenge.id, code: body.delivery.code },
  });
  expect(verified.status()).toBe(200);
}

test('#36 manages multiple trading-point cards and requires explicit single/batch Offer assignment', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  const firstName = `Point A ${testInfo.project.name}`;
  const secondName = `Point B ${testInfo.project.name}`;
  const editedName = `Point B edited ${testInfo.project.name}`;
  await cleanup(phone);
  try {
    await authenticate(page, phone);
    await page.goto('/seller/points');
    await expect(page.getByRole('heading', { name: 'Торговые точки', level: 2 })).toBeVisible();
    await page.getByLabel('Имя', { exact: true }).fill(`Seller 36 ${testInfo.project.name}`);
    await page.getByRole('textbox', { name: 'Название торговой точки', exact: true }).fill(firstName);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByRole('textbox', { name: 'Адрес', exact: true }).fill('Алматы, адрес A');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();

    await expect(page.locator('[data-testid^="trading-point-"]').getByText(firstName, { exact: true })).toBeVisible();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();

    const add = page.getByRole('button', { name: 'Добавить торговую точку' });
    await expect(add).toBeVisible();
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await add.click();
    await page.getByRole('textbox', { name: 'Название торговой точки', exact: true }).fill(secondName);
    await page.getByLabel('Тип торговой точки').selectOption('pavilion');
    await page.getByRole('textbox', { name: 'Адрес', exact: true }).fill('Алматы, адрес B');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();

    await expect(page.locator('[data-testid^="trading-point-"]')).toHaveCount(2);
    const secondCard = page.getByRole('button', { name: `Изменить торговую точку ${secondName}` });
    await secondCard.focus();
    await expect(secondCard).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Изменить торговую точку' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Название торговой точки', exact: true }).fill(editedName);
    await page.getByLabel('Тип торговой точки').selectOption('market');
    await page.getByRole('textbox', { name: 'Адрес', exact: true }).fill('Алматы, изменённый адрес B');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Торговая точка сохранена.', { exact: true })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toContain('43.');
    expect(await page.locator('body').innerText()).not.toContain('76.');

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await page.reload();
    await expect(page.getByText(editedName, { exact: true })).toBeVisible();
    // seller-offer-editor: with two points the point step pre-selects nothing and waits for an explicit choice.
    await page.goto('/seller/offers?new=1');
    const editor = offerEditor(page);
    await fillOfferFields(page, { product: 'Баранина', price: '4360' });
    await editor.getByRole('button', { name: 'Далее' }).click();
    await expect(editor.getByText('Выберите точку для этого предложения')).toBeVisible();
    await expect(editor.getByRole('radio')).toHaveCount(2);
    await expect(editor.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(editor.getByText('Сначала выберите точку')).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
    await editor.getByRole('radio', { name: new RegExp(editedName) }).check();
    await editor.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
    await expect(page.getByText(editedName).first()).toBeVisible();
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller\/offers(\?.*)?$/);

    const search = await page.request.get('/api/search?q=%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
    expect(search.status()).toBe(200);
    const searchBody = await search.json() as { offers: Array<{ seller: { displayName: string } }> };
    expect(searchBody.offers.map((offer) => offer.seller.displayName)).not.toContain(`Seller 36 ${testInfo.project.name}`);

    await page.goto('/seller/batch');
    const firstItem = page.getByTestId('batch-item-0');
    const secondItem = page.getByTestId('batch-item-1');
    await expect(firstItem.getByLabel('Точка')).toHaveValue('');
    await expect(secondItem.getByLabel('Точка')).toHaveValue('');
    await firstItem.getByLabel('Существующий товар каталога').fill('Баранина');
    await firstItem.getByLabel('Цена, ₸').fill('4400');
    await firstItem.getByLabel('Точка').selectOption({ label: firstName });
    await secondItem.getByLabel('Существующий товар каталога').fill('Говядина');
    await secondItem.getByLabel('Цена, ₸').fill('4500');
    await page.getByRole('button', { name: 'Проверить весь пакет' }).click();
    await expect(page.getByText('Выберите торговую точку для каждого нового предложения.', { exact: true })).toBeVisible();
    await secondItem.getByLabel('Точка').selectOption({ label: editedName });
    await page.getByRole('button', { name: 'Проверить весь пакет' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
  } finally {
    await cleanup(phone);
  }
});
