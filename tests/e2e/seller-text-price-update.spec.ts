import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// text-price-update (docs/slices/text-price-update/SLICE_CONTRACT.md §9) on the default server (fake parser), mobile RU:
// a clear match is pre-selected → «Обновить цены» → existing confirm with point, pack, unit and old → new price →
// applied only at the selected point; a double tap and a reload reopen the same pending proposal.
function phoneFor(slot: number) {
  // Band 4996: free among the E2E phone bands.
  return `+7700004996${slot}`;
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

// «Точка А» and «Точка Б» share one Пельмени card (500 г, 1 400 ₸); «А» also has two Сметана cards.
async function seed(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  expect((await page.request.post('/api/seller/setup', {
    data: { seller: { displayName: 'Продавец' }, location: { name: 'Точка А', type: 'shop', addressText: 'Алматы' } },
  })).ok()).toBe(true);
  return withPool(async (pool) => {
    const { seller_id: sellerId, id: pointA } = (await pool.query(
      'SELECT l.id, l.seller_id FROM locations l JOIN sellers s ON s.id = l.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
    )).rows[0] as { id: string; seller_id: string };
    const pointB = (await pool.query("INSERT INTO locations (seller_id, name, type, address_text) VALUES ($1, 'Точка Б', 'shop', 'Алматы') RETURNING id", [sellerId])).rows[0].id as string;
    const card = (await pool.query('SELECT gen_random_uuid() AS id')).rows[0].id as string;
    const offer = async (location: string, title: string, search: string, pack: [string, string], price: string, cardId: string | null = null) => (await pool.query(
      `INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
       VALUES ($1, $2, $3, $4, COALESCE($9::uuid, gen_random_uuid()), $5, 'KZT', 'package', $6, $7, $8, now()) RETURNING id`,
      [sellerId, location, title, search, price, pack[0], pack[1], 'active', cardId],
    )).rows[0].id as string;
    return {
      pointA,
      pelmA: await offer(pointA, 'Пельмени', 'пельмени', ['500', 'g'], '1400', card),
      pelmB: await offer(pointB, 'Пельмени', 'пельмени', ['500', 'g'], '1400', card),
      prosto: await offer(pointA, 'Сметана Простоквашино', 'сметана простоквашино', ['400', 'g'], '1200'),
      domash: await offer(pointA, 'Сметана Домашняя', 'сметана домашняя', ['400', 'g'], '1300'),
    };
  });
}

const priceOf = (id: string) => withPool(async (pool) => (await pool.query('SELECT price_amount FROM offers WHERE id=$1', [id])).rows[0].price_amount as string);
const changeSets = (phone: string) => withPool(async (pool) => Number((await pool.query(
  'SELECT count(*)::int AS n FROM seller_change_sets cs JOIN sellers s ON s.id = cs.seller_id JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1', [phone],
)).rows[0].n));

async function submitList(page: Page, pointA: string, text: string) {
  await page.goto(`/seller/text-input?point=${pointA}`);
  await page.getByLabel('Список товаров').fill(text);
  await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
  await expect(page).toHaveURL(/text-input\/review\?input=/);
  await expect(page.getByTestId('held-block')).toBeVisible();
}

test.describe('a new price from the text list', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('3100'), 'runs on the default server with SELLER_TEXT_INPUT=fake');
  test.skip(({ isMobile }) => !isMobile, 'new E2E of this slice: mobile RU (PROJECT_RULES §18.5)');

  test('clear match pre-selected → confirm with point, pack, unit, old → new → only the selected point changes', async ({ page }) => {
    const phone = phoneFor(1);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Пельмени 1500 за упаковку 500 г. Сметана 1400 за упаковку 400 г.');

    const pelm = page.getByTestId(`held-candidate-${ids.pelmA}`);
    await expect(pelm.getByTestId('price-change')).toHaveText('1 400 ₸ → 1 500 ₸ / упак.');
    await expect(pelm.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('held-1').getByTestId('held-headline')).toHaveText('Выберите карточку — изменится только одна');
    await expect(page.getByTestId('held-1').getByRole('radio')).toHaveCount(2);
    for (const radio of await page.getByTestId('held-1').getByRole('radio').all()) await expect(radio).toHaveAttribute('aria-checked', 'false');

    await page.getByTestId('price-submit').click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    await expect(page.getByText('Торговая точка')).toBeVisible();
    await expect(page.getByText('Фасовка')).toBeVisible();
    await expect(page.getByText('Единица')).toBeVisible();
    await expect(page.getByText('1 400 ₸ → 1 500 ₸')).toBeVisible();
    await expect(page.getByTestId('confirm-other-points')).toHaveText('В других точках цена не изменится.');
    expect(await priceOf(ids.pelmA)).toBe('1400');
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    await expect(page).toHaveURL(/text-input\/review\?input=/);
    await expect(page.getByTestId('price-applied')).toHaveText('Цена обновлена: 1 500 ₸');
    expect([await priceOf(ids.pelmA), await priceOf(ids.pelmB)]).toEqual(['1500', '1400']);
  });

  test('a double tap and a reload reopen the same pending proposal; a different choice is its own', async ({ page }) => {
    const phone = phoneFor(2);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Сметана 1400 за упаковку 400 г.');
    await page.getByTestId(`held-candidate-${ids.prosto}`).getByRole('radio').click();
    await page.getByTestId('price-submit').dblclick();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+/);
    const first = page.url();
    expect(await changeSets(phone)).toBe(1);

    await page.goBack();
    await page.reload();
    await expect(page.getByTestId('price-pending')).toBeVisible();
    await page.getByRole('link', { name: 'Открыть подтверждение' }).click();
    await expect(page).toHaveURL(new RegExp(first.split('?')[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect([await changeSets(phone), await priceOf(ids.prosto)]).toEqual([1, '1200']);
  });
});
