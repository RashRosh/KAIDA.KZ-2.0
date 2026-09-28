import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor, openNewCard, publishButton, showcaseCard } from './offer-editor-helpers';

// offer-actuality §7: cards of different ages → buyer badges and order, the task block, «Нужно подтвердить», the
// archive, «Всё актуально», and a restore from the archive through the card screen.

function phoneFor(projectName: string) {
  return `+7700004${projectName === 'mobile' ? '4' : '5'}001`;
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
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [row.id]);
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

async function publish(page: Page, product: string) {
  await openNewCard(page);
  await fillOfferFields(page, { product, price: '900', unit: 'kg' });
  await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
  await page.getByRole('button', { name: publishButton }).click();
  await expect(showcaseCard(page, new RegExp(product))).toBeVisible();
}

// Moves a card's confirmation back by `hours` (the passage of time, not the behavior under test).
async function age(phone: string, product: string, hours: number) {
  await withPool((pool) => pool.query(
    "UPDATE offers SET last_confirmed_at = now() - make_interval(hours => $3) WHERE title=$2 AND seller_id IN (SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1)",
    [phone, product, hours],
  ));
}

test('buyers see how fresh offers are; the Seller confirms due cards and restores an archived one', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const tag = testInfo.project.name === 'mobile' ? 'моб' : 'деск';
  const phone = phoneFor(testInfo.project.name);
  const names = { fresh: `Щавель ${tag}`, ageing: `Щавель старый ${tag}`, hidden: `Щавель скрытый ${tag}`, archived: `Щавель архивный ${tag}` };
  try {
    await cleanup(phone);
    await login(page.request, phone);
    await withPool(async (pool) => {
      const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
      const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, `Актуальность ${tag}`]);
      await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95)", [seller.rows[0].id, `Точка ${tag}`]);
    });
    for (const product of Object.values(names)) await publish(page, product);
    await age(phone, names.ageing, 60);
    await age(phone, names.hidden, 200);
    await age(phone, names.archived, 340);

    // Buyer: badges, fresh first, the hidden and archived offers are not shown.
    await page.goto('/?q=' + encodeURIComponent('Щавель'));
    const results = page.getByRole('article').filter({ hasText: tag });
    await expect(results).toHaveCount(2);
    await expect(results.nth(0)).toContainText(names.fresh);
    await expect(results.nth(0)).toContainText('Сегодня');
    await expect(results.nth(1)).toContainText(names.ageing);
    await expect(results.nth(1)).toContainText('2 дня');

    // Seller: the task, «Нужно подтвердить», the archive chip; the archived card is not in the main list.
    await page.goto('/seller');
    const task = page.getByTestId('actuality-task');
    await expect(task).toContainText('Пора подтвердить актуальность');
    await expect(task).toContainText('2 карточки · 1 уже скрыта с витрины');
    await expect(showcaseCard(page, new RegExp(names.hidden))).toContainText('Скрыто с витрины до подтверждения · 8 дней');
    await expect(showcaseCard(page, new RegExp(names.ageing))).toContainText('Подтвердите актуальность');
    await expect(showcaseCard(page, new RegExp(names.archived))).toHaveCount(0);

    // «Проверить» → «Всё актуально».
    await task.getByRole('button', { name: 'Проверить' }).click();
    await expect(page.getByRole('heading', { name: 'Актуальность · 2', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Всё актуально' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Актуальность подтверждена' })).toBeVisible();
    await expect(page.getByTestId('actuality-task')).toHaveCount(0);

    // Archive → card screen → «Подтвердить актуальность» brings it back.
    await page.getByRole('link', { name: 'Архив · 1' }).click();
    await expect(page.getByRole('heading', { name: 'Архив · 1', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(names.archived) }).click();
    await expect(page.getByText('В архиве', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Подтвердить актуальность/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Актуальность подтверждена' })).toBeVisible();
    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(showcaseCard(page, new RegExp(names.archived))).toBeVisible();

    await page.goto('/?q=' + encodeURIComponent('Щавель'));
    await expect(page.getByRole('article').filter({ hasText: tag })).toHaveCount(4);
  } finally {
    await cleanup(phone);
  }
});
