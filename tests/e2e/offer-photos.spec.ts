import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import sharp from 'sharp';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor } from './offer-editor-helpers';

// offer-photos §7: create with photos, cover by buttons, publish without photos through the reminder, a failed
// upload that blocks sending, edit removing photos, buyer cover → Offer page → gallery → back to the same list.

function phoneFor(projectName: string, slot: number) {
  return `+7700002${projectName === 'mobile' ? '98' : '99'}${slot}0`;
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
      await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
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

// A logged-in, buyer-visible Seller (public phone, point with geo) with exactly one point.
async function prepareSeller(page: Page, phone: string, label: string) {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  return withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name, contact_phone_e164) VALUES ($1,$2,$3) RETURNING id', [user.rows[0].id, `Фото ${label}`, phone]);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы, фото','shop',43.25,76.95)", [seller.rows[0].id, `Фото точка ${label}`]);
    return seller.rows[0].id as string;
  });
}

async function png(color: { r: number; g: number; b: number }, size = 640) {
  return sharp({ create: { width: size, height: Math.round(size * 0.75), channels: 3, background: color } }).png().toBuffer();
}

async function offerPhotoIds(sellerId: string) {
  return withPool(async (pool) => (await pool.query(
    'SELECT op.photo_id FROM offer_photos op JOIN offers o ON o.id=op.offer_id WHERE o.seller_id=$1 ORDER BY op.position',
    [sellerId],
  )).rows.map((row) => row.photo_id as string));
}

async function openCreate(page: Page) {
  await page.goto('/seller/offers?new=1');
  const editor = offerEditor(page);
  await expect(editor).toBeVisible();
  return editor;
}

async function toConfirm(page: Page) {
  const editor = offerEditor(page);
  await editor.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(editor.getByRole('heading', { name: 'Где продаёте?' })).toBeVisible();
  await editor.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
}

test('Seller adds photos, makes the second the cover and publishes; Buyer opens the card page and returns to the list', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 1);
  await cleanup(phone);
  try {
    const sellerId = await prepareSeller(page, phone, `A ${testInfo.project.name}`);
    const editor = await openCreate(page);
    await expect(editor.getByText('Карточки с фото выбирают чаще')).toBeVisible();

    await editor.locator('input[type="file"]').setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: await png({ r: 200, g: 40, b: 40 }) },
      { name: 'two.png', mimeType: 'image/png', buffer: await png({ r: 40, g: 160, b: 60 }) },
      { name: 'three.png', mimeType: 'image/png', buffer: await png({ r: 40, g: 60, b: 200 }) },
    ]);
    await expect(editor.getByText('3 из 5')).toBeVisible();
    await expect(editor.getByRole('progressbar')).toHaveCount(0);

    // Cover by buttons alone: select photo 2, make it the cover.
    await editor.getByRole('button', { name: 'Фото 2', exact: true }).click();
    await editor.getByRole('button', { name: 'Сделать обложкой' }).click();
    await expect(editor.getByRole('button', { name: 'Фото 1, обложка' })).toBeVisible();

    await fillOfferFields(page, { product: 'Баранина', price: '5100', unit: 'kg' });
    await toConfirm(page);
    await expect(page.getByText('3 шт.')).toBeVisible();
    await expect(page.getByText('Карточки с фото выбирают чаще')).toHaveCount(0);
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    await expect(page).toHaveURL(/notice=created/);

    const photoIds = await offerPhotoIds(sellerId);
    expect(photoIds).toHaveLength(3);

    // Buyer: the result card shows the cover; tapping the name opens the Offer page with the gallery.
    await page.goto('/');
    await page.getByRole('searchbox').or(page.getByRole('textbox', { name: /Поиск/ })).first().fill('Баранина');
    await page.keyboard.press('Enter');
    const card = page.getByRole('article').filter({ hasText: `Фото точка A ${testInfo.project.name}` });
    await expect(card.locator(`img[src="/media/photos/${photoIds[0]}/thumb"]`)).toBeVisible();
    await expect(page).toHaveURL(/\?q=/);
    await card.getByRole('link', { name: 'Баранина' }).click();

    await expect(page).toHaveURL(/\/offers\/[0-9a-f-]+$/);
    const gallery = page.getByRole('region', { name: 'Фото товара' });
    await expect(gallery.getByText('1 из 3')).toBeVisible();
    await expect(gallery.getByRole('img', { name: 'Баранина, фото 1 из 3' })).toBeVisible();
    await gallery.getByRole('button', { name: 'Следующее фото' }).click();
    await expect(gallery.getByText('2 из 3')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Позвонить' }).or(page.getByRole('link', { name: /Позвонить/ })).first()).toBeVisible();

    await page.getByRole('link', { name: 'Назад' }).click();
    await expect(page).toHaveURL(/\/\?q=/);
    await expect(page.getByRole('article').filter({ hasText: `Фото точка A ${testInfo.project.name}` })).toBeVisible();

    // The photo is public now; a direct open of an unknown Offer page is neutral.
    expect((await page.request.get(`/media/photos/${photoIds[0]}/display`)).status()).toBe(200);
    await page.goto('/offers/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: 'Предложение больше недоступно' })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});

test('a card without photos is published after the reminder; in Kazakh the reminder is translated', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 2);
  await cleanup(phone);
  try {
    const sellerId = await prepareSeller(page, phone, `B ${testInfo.project.name}`);
    await openCreate(page);
    await fillOfferFields(page, { product: 'Баранина', price: '4900', unit: 'kg' });
    await toConfirm(page);

    await expect(page.getByText('Карточки с фото выбирают чаще')).toBeVisible();
    await expect(page.getByText('Без фото', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Добавить фото' })).toBeVisible();

    await page.context().addCookies([{ name: 'kaida_locale', value: 'kk', url: page.url() }]);
    await page.reload();
    await expect(page.getByText('Фотосы бар карточкаларды жиі таңдайды')).toBeVisible();
    await page.getByRole('button', { name: 'Фотосыз жариялау' }).click();
    await expect(page).toHaveURL(/notice=created/);
    expect(await offerPhotoIds(sellerId)).toEqual([]);
  } finally {
    await cleanup(phone);
  }
});

test('a rejected file stays at its tile and blocks sending until it is removed; editing can remove every photo', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 3);
  await cleanup(phone);
  try {
    const sellerId = await prepareSeller(page, phone, `C ${testInfo.project.name}`);
    const editor = await openCreate(page);
    await editor.locator('input[type="file"]').setInputFiles([
      { name: 'good.png', mimeType: 'image/png', buffer: await png({ r: 120, g: 120, b: 40 }) },
      { name: 'tiny.png', mimeType: 'image/png', buffer: await png({ r: 10, g: 10, b: 10 }, 120) },
    ]);
    await expect(editor.getByText('Фото слишком маленькое')).toBeVisible();

    await fillOfferFields(page, { product: 'Баранина', price: '4800', unit: 'kg' });
    await editor.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(editor.getByText('Одно из фото не загрузилось — повторите или удалите его')).toBeVisible();
    await expect(editor.getByRole('heading', { name: 'Где продаёте?' })).toHaveCount(0);

    await editor.getByText('Фото слишком маленькое').locator('..').getByRole('button', { name: 'Удалить' }).click();
    await expect(editor.getByText('1 из 5')).toBeVisible();
    await toConfirm(page);
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    await expect(page).toHaveURL(/notice=created/);
    expect(await offerPhotoIds(sellerId)).toHaveLength(1);

    // Edit: remove the only photo; the review shows «Без фото» and the reminder.
    await page.getByRole('article').getByRole('link', { name: 'Изменить', exact: true }).first().click();
    const edit = offerEditor(page);
    await edit.getByRole('button', { name: 'Фото 1, обложка' }).click();
    await edit.getByRole('button', { name: 'Удалить' }).click();
    await expect(edit.getByText('0 из 5')).toBeVisible();
    await edit.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await expect(page.getByText('Карточки с фото выбирают чаще')).toBeVisible();
    await page.getByRole('button', { name: 'Опубликовать без фото' }).click();
    await expect(page).toHaveURL(/notice=updated/);
    expect(await offerPhotoIds(sellerId)).toEqual([]);
  } finally {
    await cleanup(phone);
  }
});
