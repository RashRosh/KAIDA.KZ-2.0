import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// text-availability (docs/slices/text-availability/SLICE_CONTRACT.md §10) on the default server (fake parser), mobile RU:
// «нет в наличии» → candidates at the selected point → «Выключить отмеченные» → existing confirm → statuses on return.
function phoneFor(slot: number) {
  // Band 499: free among the E2E phone bands (493–498 are taken by other text-input specs).
  return `+7700004990${slot}`;
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
    await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [phone]);
    await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM seller_text_submissions WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query('DELETE FROM sellers WHERE owner_user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

// Seller with points «А» and «Б»: Сметана 400 г in both, Пельмени 500 г and 1 кг in «А», Сыр switched off in «А».
async function seed(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  const setup = await page.request.post('/api/seller/setup', {
    data: { seller: { displayName: 'Продавец' }, location: { name: 'Точка А', type: 'shop', addressText: 'Алматы' } },
  });
  expect(setup.ok()).toBe(true);
  return withPool(async (pool) => {
    const { seller_id: sellerId, id: pointA } = (await pool.query(
      'SELECT l.id, l.seller_id FROM locations l JOIN sellers s ON s.id = l.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
    )).rows[0] as { id: string; seller_id: string };
    const pointB = (await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, 'Точка Б', 'shop', 'Алматы') RETURNING id", [sellerId])).rows[0].id as string;
    const offer = async (locationId: string, title: string, search: string, pack: [string, string], price: string, status = 'active') => (await pool.query(
      `INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
       VALUES ($1, $2, $3, $4, gen_random_uuid(), $5, 'KZT', 'package', $6, $7, $8, now()) RETURNING id`,
      [sellerId, locationId, title, search, price, pack[0], pack[1], status],
    )).rows[0].id as string;
    return {
      pointA,
      smetanaA: await offer(pointA, 'Сметана', 'сметана', ['400', 'g'], '1200'),
      smetanaB: await offer(pointB, 'Сметана', 'сметана', ['400', 'g'], '1200'),
      pelm05: await offer(pointA, 'Пельмени', 'пельмени', ['500', 'g'], '1400'),
      pelm1: await offer(pointA, 'Пельмени', 'пельмени', ['1', 'kg'], '2600'),
      syr: await offer(pointA, 'Сыр', 'сыр', ['400', 'g'], '2900', 'inactive'),
    };
  });
}

const statusOf = (id: string) => withPool(async (pool) => (await pool.query('SELECT status FROM offers WHERE id=$1', [id])).rows[0].status as string);

async function submitList(page: Page, pointA: string, text: string) {
  await page.goto(`/seller/text-input?point=${pointA}`);
  await page.getByLabel('Список товаров').fill(text);
  await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
  await expect(page).toHaveURL(/text-input\/review\?input=/);
  await expect(page.getByTestId('availability-block')).toBeVisible();
}

test.describe('«нет в наличии» from the text list', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('3100'), 'runs on the default server with SELLER_TEXT_INPUT=fake');
  test.skip(({ isMobile }) => !isMobile, 'new E2E of this slice: mobile RU (PROJECT_RULES §18.5)');

  test('mixed list → choose → confirm → statuses after return and reload; other point and pack unchanged', async ({ page }) => {
    const phone = phoneFor(1);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Картошка 250 за кг. Сметаны нет. Пельменей нет. Сыра нет. Чеснока нет.');

    await expect(page.getByTestId('text-review-summary')).toHaveText('Новых товаров: 1 · ждут решения: 2');
    await expect(page.locator('[data-testid^="text-draft-"]')).toHaveCount(1);
    const smetana = page.getByTestId(`availability-row-${ids.smetanaA}`);
    await expect(smetana.getByRole('checkbox')).toBeChecked();
    await expect(page.getByTestId(`availability-row-${ids.smetanaB}`)).toHaveCount(0);
    await expect(page.getByTestId('availability-1')).toContainText('Отметьте нужные.');
    await expect(page.getByTestId(`availability-row-${ids.pelm05}`).getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId(`availability-row-${ids.pelm1}`).getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId(`availability-row-${ids.syr}`)).toContainText('Выключено раньше');
    await expect(page.getByTestId(`availability-row-${ids.syr}`).getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByTestId('availability-3')).toContainText('Нет такой карточки в этой точке.');

    await page.getByTestId(`availability-row-${ids.pelm05}`).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Выключить отмеченные · 2' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    await expect(page.getByText('Фасовка').first()).toBeVisible();
    await expect(page.getByText('500 г')).toBeVisible();
    expect([await statusOf(ids.smetanaA), await statusOf(ids.pelm05)]).toEqual(['active', 'active']);
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    await expect(page).toHaveURL(/text-input\/review\?input=/);
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`)).toContainText('Выключено по этому списку');
    await expect(page.getByTestId(`availability-row-${ids.pelm05}`)).toContainText('Выключено по этому списку');
    await expect(page.getByTestId(`availability-row-${ids.pelm1}`).getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId('text-review-summary')).toHaveText('Опубликовано: 0 · выключено: 2 · ждут решения: 2');
    expect([await statusOf(ids.smetanaA), await statusOf(ids.pelm05), await statusOf(ids.pelm1), await statusOf(ids.smetanaB)])
      .toEqual(['inactive', 'inactive', 'active', 'active']);

    await page.reload();
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`)).toContainText('Выключено по этому списку');
    await expect(page.getByTestId('text-review-summary')).toHaveText('Опубликовано: 0 · выключено: 2 · ждут решения: 2');

    // Buyers: the switched-off card is gone from search; the same card in the other point stays.
    const search = await page.request.get(`/api/search?q=${encodeURIComponent('сметана')}`);
    expect(search.ok()).toBe(true);
    const found = JSON.stringify(await search.json());
    expect([found.includes(ids.smetanaA), found.includes(ids.smetanaB)]).toEqual([false, true]);
  });

  test('a named pack proposes only that pack; an unbound pack is never pre-ticked', async ({ page }) => {
    const phone = phoneFor(2);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Пельменей по 1 кг нет. Сметаны 0,4 кг и 1 кг нет.');
    await expect(page.getByTestId(`availability-row-${ids.pelm1}`).getByRole('checkbox')).toBeChecked();
    await expect(page.getByTestId(`availability-row-${ids.pelm05}`)).toHaveCount(0);
    await expect(page.getByTestId('availability-0')).toContainText('Пельмени · 500 г — другая фасовка, не изменится');
    await expect(page.getByTestId('availability-1')).toContainText('Фасовку «0,4 кг, 1 кг» не удалось сопоставить — отметьте сами.');
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`).getByRole('checkbox')).not.toBeChecked();
  });

  test('a card changed after it was shown: nothing proposed, fresh list without ticks; an unconfirmed proposal is offered again', async ({ page }) => {
    const phone = phoneFor(3);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Сметаны нет.');
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`).getByRole('checkbox')).toBeChecked();
    await withPool((pool) => pool.query("UPDATE offers SET price_amount='1300', revision=revision+1 WHERE id=$1", [ids.smetanaA]));
    await page.getByRole('button', { name: 'Выключить отмеченные · 1' }).click();
    await expect(page.getByTestId('availability-0')).toContainText('Карточки изменились — отметьте заново.');
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`)).toContainText('1 300 ₸');
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`).getByRole('checkbox')).not.toBeChecked();
    expect(await withPool(async (pool) => Number((await pool.query(
      'SELECT count(*)::int AS n FROM seller_change_sets cs JOIN sellers s ON s.id = cs.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
    )).rows[0].n))).toBe(0);

    await page.getByTestId(`availability-row-${ids.smetanaA}`).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Выключить отмеченные · 1' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    await page.goBack();
    await page.reload();
    await expect(page.getByTestId('availability-pending')).toBeVisible();
    await expect(page.getByTestId(`availability-row-${ids.smetanaA}`)).toContainText('Ждёт подтверждения');
    await page.getByRole('link', { name: 'Открыть подтверждение' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    expect(await statusOf(ids.smetanaA)).toBe('active');
  });
});
