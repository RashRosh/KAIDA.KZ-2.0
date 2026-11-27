import { randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { openOffer, resultCard } from './buyer-helpers';
import { chooseUnit, fillOfferFields, openNewCard, publishButton } from './offer-editor-helpers';

// wholesale-only §9 (E2E mobile RU): all 5 manual acceptance steps —
// 1) create wholesale-only card without perContainer via «Только оптом» toggle;
// 2) buyer sees prominent wholesale price with ОПТ badge & batch in Search and Offer page;
// 3) sort=price (Дешевле & Дороже) puts retail above wholesale-only;
// 4) seller confirms actuality via singular «Товар есть, цена та же»;
// 5) seller turns off «Только оптом», enters retail price, editor requires perContainer before publishing as mixed.

const PHONE = '+77000471020';

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

async function prepareSeller(page: Page) {
  await cleanup(PHONE);
  await login(page.request, PHONE);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [PHONE]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, 'Опт Только E2E']);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,'Опт база','Алматы, Рынок','shop',43.25,76.95)", [seller.rows[0].id]);
  });
}

const flat = (text: string | null) => (text ?? '').replace(/\s+/gu, ' ').trim();

test('wholesale-only full lifecycle: create, buyer search & price sort, actuality confirm, and switch back to retail', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile RU is the gate of this slice');
  const suffix = Array.from(randomBytes(6), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const wholesaleTitle = `Томаты опт ${suffix}`;
  const retailTitle = `Томаты розница ${suffix}`;
  try {
    await prepareSeller(page);

    // First publish a retail offer of the same token so we can verify price sorting (step 3).
    const retailEditor = await openNewCard(page);
    await fillOfferFields(page, { product: retailTitle, price: '900', unit: 'kg' });
    await retailEditor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?|$)/);

    // Step 1: Create wholesale-only card without perContainer.
    const editor = await openNewCard(page);
    await editor.getByRole('combobox', { name: 'Название товара' }).fill(wholesaleTitle);
    const toggle = editor.getByTestId('wholesale-only-switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    // Retail price field is hidden.
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveCount(0);

    await chooseUnit(page, 'kg');
    await editor.getByRole('button', { name: 'Указать оптовую цену' }).click();
    const sheet = page.getByRole('dialog', { name: 'Оптовая цена' });
    await sheet.getByRole('textbox', { name: 'Цена', exact: true }).fill('450');
    await sheet.getByRole('combobox', { name: 'Тара' }).selectOption('bag');
    // Conversion is optional and remove button is hidden in wholesale-only mode.
    await expect(sheet.getByText(/необязательно/i)).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Убрать оптовую цену' })).toHaveCount(0);
    await expect(sheet.getByTestId('wholesale-buyer-sees')).toHaveText('Покупатель увидит: от 1 мешка');
    await sheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(sheet).toHaveCount(0);

    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await expect(page.locator('.kv').filter({ hasText: 'Оптовая цена' })).toContainText(/450\s₸\s\/\sкг\s·\sот\s1\sмешка/u);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?|$)/);

    // Step 2: Buyer sees prominent wholesale price with ОПТ badge & batch in Search and Offer page.
    await page.goto('/');
    const input = page.getByRole('search').locator('input[type="search"]').first();
    await input.fill(suffix);
    await input.press('Enter');
    const card = resultCard(page, wholesaleTitle);
    await expect(card).toHaveCount(1);
    const line = card.getByTestId('wholesale-line');
    await expect(line).toHaveAttribute('data-wholesale-only', 'true');
    expect(flat(await line.textContent())).toBe('450 ₸ / кг ОПТ от 1 мешка');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Step 3: Sort by price (asc & desc) -> retail offer always appears before wholesale-only!
    const sortTrigger = page.locator('button[aria-haspopup="true"]');
    await sortTrigger.click();
    await page.getByRole('group', { name: 'Порядок результатов' }).getByRole('button', { name: /По цене/i }).click();
    await expect(sortTrigger).toContainText(/По цене/i);
    await expect(page.locator('article h3').first()).toHaveText(retailTitle);
    const titlesAsc = await page.locator('article h3').allTextContents();
    expect(titlesAsc.indexOf(retailTitle)).toBeLessThan(titlesAsc.indexOf(wholesaleTitle));

    await sortTrigger.click();
    await page.getByRole('group', { name: 'Порядок результатов' }).getByRole('button', { name: /дороже/i }).click();
    await expect(sortTrigger).toContainText(/↓/);
    await expect(page.locator('article h3').first()).toHaveText(retailTitle);
    const titlesDesc = await page.locator('article h3').allTextContents();
    expect(titlesDesc.indexOf(retailTitle)).toBeLessThan(titlesDesc.indexOf(wholesaleTitle));

    // Open Offer page and check prominent wholesale-only price.
    await openOffer(resultCard(page, wholesaleTitle), wholesaleTitle);
    const offerPrice = page.getByTestId('offer-price');
    expect(flat(await offerPrice.textContent())).toBe('450 ₸ / кг ОПТ от 1 мешка');

    // Step 4: Seller confirms actuality with singular button «Товар есть, цена та же».
    await page.goto('/seller');
    await page.getByRole('button', { name: wholesaleTitle, exact: true }).click();
    const confirmBtn = page.getByRole('button', { name: 'Товар есть, цена та же', exact: true });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await expect(page.getByText('Актуальность подтверждена')).toBeVisible();

    // Step 5: Seller turns «Только оптом» OFF, enters retail price 600 -> prompted for perContainer -> fills 20 -> publishes mixed.
    await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
    const editForm = page.locator('main');
    await editForm.getByTestId('wholesale-only-switch').click();
    await expect(editForm.getByTestId('wholesale-only-switch')).toHaveAttribute('aria-checked', 'false');
    await editForm.getByRole('textbox', { name: 'Цена', exact: true }).fill('600');
    await expect(editForm.getByText(/Для розницы укажите, сколько кг в одном мешке/u)).toBeVisible();
    await page.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await expect(page).not.toHaveURL(/\/seller\/change-sets\//);

    await editForm.getByTestId('wholesale-row').getByRole('button', { name: 'Проверить' }).click();
    const reviewSheet = page.getByRole('dialog', { name: 'Оптовая цена' });
    await reviewSheet.getByRole('textbox', { name: 'Сколько кг в одном мешке' }).fill('20');
    await expect(reviewSheet.getByTestId('wholesale-buyer-sees')).toHaveText('Покупатель увидит: от 1 мешка (≈ 20 кг)');
    await reviewSheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(reviewSheet).toHaveCount(0);

    await page.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page).toHaveURL(/\/seller(\?|$)/);

    // Verify buyer now sees mixed retail + wholesale!
    await page.goto('/');
    const searchInput2 = page.getByRole('search').locator('input[type="search"]').first();
    await searchInput2.fill(suffix);
    await searchInput2.press('Enter');
    const mixedCard = resultCard(page, wholesaleTitle);
    await expect(mixedCard).toContainText(/600\s₸/u);
    expect(flat(await mixedCard.getByTestId('wholesale-line').textContent())).toBe('450 ₸ / кг ОПТ от 1 мешка (≈ 20 кг)');
  } finally {
    await cleanup(PHONE);
  }
});
