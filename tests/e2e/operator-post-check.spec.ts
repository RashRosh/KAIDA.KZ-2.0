import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor, openNewCard, publishButton, showcaseCard } from './offer-editor-helpers';

// operator-post-check §7: the operator removes a card, buyers lose it, the Seller reads the reason, fixes and
// republishes it, the feed marks it; return; a non-operator gets 404. Operator phones are set in playwright.config.ts.

function sellerPhone(projectName: string) {
  return `+7700003${projectName === 'mobile' ? '8' : '9'}002`;
}
function operatorPhone(projectName: string) {
  return `+7700003${projectName === 'mobile' ? '8' : '9'}001`;
}

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function cleanup(phones: string[]) {
  await withPool(async (pool) => {
    for (const phone of phones) {
      const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
      for (const row of users.rows) {
        const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
        await pool.query(`DELETE FROM offer_card_removals WHERE seller_id IN (${bySeller}) OR removed_by_user_id=$1 OR restored_by_user_id=$1`, [row.id]);
        await pool.query('DELETE FROM operator_feed_marks WHERE user_id=$1', [row.id]);
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
    }
  });
}

async function login(request: APIRequestContext, phone: string) {
  // Re-entering roles is a workflow prerequisite. Make only this isolated phone's
  // previous request eligible, without changing the server's approved OTP policy.
  await withPool((pool) => pool.query("UPDATE auth_otp_challenges SET created_at=created_at-interval '61 seconds' WHERE phone_e164=$1", [phone]));
  const requested = await (await request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

async function prepareSeller(page: Page, phone: string, point: string) {
  await login(page.request, phone);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, 'Постпроверка']);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95)", [seller.rows[0].id, point]);
  });
}

async function buyerFinds(request: APIRequestContext, word: string) {
  const result = await (await request.get(`/api/search?q=${encodeURIComponent(word)}`)).json() as { offers: { product: { name: string } }[] };
  return result.offers.filter((offer) => offer.product.name.toLowerCase().includes(word)).length;
}

test('operator removes a card, the Seller fixes and republishes it, the feed marks it; return works', async ({ page }, testInfo) => {
  const tag = testInfo.project.name;
  const seller = sellerPhone(tag);
  const operator = operatorPhone(tag);
  const word = tag === 'mobile' ? 'тархунмоб' : 'тархундеск';
  const point = `Тастак ${tag}`;
  try {
    await cleanup([seller, operator]);
    await prepareSeller(page, seller, point);
    await openNewCard(page);
    await fillOfferFields(page, { product: `Напиток ${word}`, price: '800', unit: 'piece' });
    await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(showcaseCard(page, new RegExp(word))).toBeVisible();
    expect(await buyerFinds(page.request, word)).toBe(1);

    // The Seller is not an operator: the operator screens do not exist for them.
    expect((await page.goto('/operator'))?.status()).toBe(404);
    expect((await page.request.get('/api/operator/feed')).status()).toBe(404);

    // Operator: remove with a reason and a comment.
    await login(page.request, operator);
    await page.goto('/operator');
    await page.getByRole('button', { name: 'Все', exact: true }).click();
    const row = page.getByRole('article').filter({ hasText: `Напиток ${word}` }).first();
    await expect(row).toContainText('новая');
    await expect(row).toContainText('Продавец +7 700 ··· 02');
    await row.getByRole('button', { name: 'Снять с витрины' }).click();
    await expect(page.getByRole('heading', { name: 'Снять с витрины', level: 1 })).toBeVisible();
    await page.getByRole('radio', { name: 'Фото не соответствует товару' }).check();
    await page.getByRole('textbox', { name: /Комментарий продавцу/ }).fill('На фото другой напиток');
    await page.getByRole('button', { name: 'Снять с витрины' }).last().click();
    await expect(page.getByRole('status').filter({ hasText: 'Карточка снята с витрины' })).toBeVisible();
    await expect(row).toContainText('Снята · Фото не соответствует товару');
    await expect(row.getByRole('button', { name: 'Вернуть на витрину' })).toBeVisible();
    expect(await buyerFinds(page.request, word)).toBe(0);

    // Seller: the status and the reason in plain words, no on/off switch; fix and publish again.
    await login(page.request, seller);
    await page.goto('/seller');
    const card = showcaseCard(page, new RegExp(word));
    await expect(card).toContainText('Снято оператором');
    await expect(card).toContainText('Фото не соответствует товару · исправьте карточку');
    await card.getByRole('button').first().click();
    await expect(page.getByText('Фото не соответствует товару. Покупатели карточку не видят.')).toBeVisible();
    await expect(page.getByText('Комментарий оператора: На фото другой напиток')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Включить' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Исправить и опубликовать снова' }).click();
    const editor = offerEditor(page);
    await editor.getByRole('textbox', { name: 'Цена', exact: true }).fill('850');
    await editor.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(showcaseCard(page, new RegExp(word))).toContainText('На витрине');
    expect(await buyerFinds(page.request, word)).toBe(1);

    // Operator: the card is back in the feed as republished; remove and return it.
    await login(page.request, operator);
    await page.goto('/operator');
    await page.getByRole('button', { name: 'Все', exact: true }).click();
    const again = page.getByRole('article').filter({ hasText: `Напиток ${word}` }).first();
    await expect(again).toContainText('снова после снятия');
    await again.getByRole('button', { name: 'Снять с витрины' }).click();
    await page.getByRole('button', { name: 'Снять с витрины' }).last().click();
    await expect(again).toContainText('Снята · Товар нельзя размещать');
    await again.getByRole('button', { name: 'Вернуть на витрину' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Карточка снова на витрине' })).toBeVisible();
    expect(await buyerFinds(page.request, word)).toBe(1);
  } finally {
    await cleanup([seller, operator]);
  }
});
