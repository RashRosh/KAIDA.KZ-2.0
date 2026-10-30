import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// text-duplicates (docs/slices/text-duplicates/SLICE_CONTRACT.md §10) on the default server (fake parser), mobile RU:
// a repeated list holds possible matches, conflicting prices block publication until chosen, and «создать черновик»
// makes one draft even under a double tap.
function phoneFor(slot: number) {
  // Band 4998: free among the E2E phone bands (493–499x are taken by other text-input specs).
  return `+7700004998${slot}`;
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

// Point «А»: Сметана Простоквашино 400 г 1200, Пельмени 500 г 1400, Сыр 400 г switched off.
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
    const offer = async (title: string, search: string, pack: [string, string], price: string, status = 'active') => (await pool.query(
      `INSERT INTO offers (seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, pack_amount, pack_unit, status, last_confirmed_at)
       VALUES ($1, $2, $3, $4, gen_random_uuid(), $5, 'KZT', 'package', $6, $7, $8, now()) RETURNING id`,
      [sellerId, pointA, title, search, price, pack[0], pack[1], status],
    )).rows[0].id as string;
    return {
      pointA,
      smetana: await offer('Сметана Простоквашино', 'сметана простоквашино', ['400', 'g'], '1200'),
      pelm05: await offer('Пельмени', 'пельмени', ['500', 'g'], '1400'),
      syr: await offer('Сыр', 'сыр', ['400', 'g'], '2900', 'inactive'),
    };
  });
}

const counts = (phone: string) => withPool(async (pool) => {
  const by = 'SELECT s.id FROM sellers s JOIN users u ON u.id = s.owner_user_id WHERE u.phone_e164=$1';
  const offers = Number((await pool.query(`SELECT count(*)::int AS n FROM offers WHERE seller_id IN (${by})`, [phone])).rows[0].n);
  const drafts = Number((await pool.query(`SELECT count(*)::int AS n FROM offer_drafts WHERE seller_id IN (${by})`, [phone])).rows[0].n);
  return { offers, drafts };
});

async function submitList(page: Page, pointA: string, text: string) {
  await page.goto(`/seller/text-input?point=${pointA}`);
  await page.getByLabel('Список товаров').fill(text);
  await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
  await expect(page).toHaveURL(/text-input\/review\?input=/);
}

test.describe('a repeated text list', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('3100'), 'runs on the default server with SELLER_TEXT_INPUT=fake');
  test.skip(({ isMobile }) => !isMobile, 'new E2E of this slice: mobile RU (PROJECT_RULES §18.5)');

  test('possible matches are held; other products and packs become drafts; a price conflict blocks until chosen', async ({ page }) => {
    const phone = phoneFor(1);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Сметана Простоквашино 1200 за упаковку 400 г. Сметана домашняя 1500 за упаковку 400 г. '
      + 'Пельмени 1500 за упаковку 500 г. Пельмени 2600 за упаковку 1 кг. Сыр 2900 за упаковку 400 г. Картошка 250 за кг. Картошка 300 за кг.');

    await expect(page.getByTestId('held-block')).toBeVisible();
    await expect(page.getByTestId('held-0').getByTestId('held-headline')).toHaveText('Без изменений');
    // Revised by text-price-update (§3.1, approved 2026-10-27): an eligible price difference is offered as a proposal
    // (the existing editor link stays for rows that are not eligible).
    await expect(page.getByTestId('held-1').getByTestId('held-headline')).toHaveText('Новая цена для карточки');
    await expect(page.getByTestId(`held-candidate-${ids.pelm05}`).getByTestId('price-change')).toHaveText('1 400 ₸ → 1 500 ₸ / упак.');
    await expect(page.getByTestId('held-2').getByTestId('held-headline')).toHaveText('Вернуть на витрину');
    await expect(page.locator('[data-testid^="text-draft-"]')).toHaveCount(3);
    await expect(page.getByTestId('text-other-pack')).toHaveText('В точке уже есть: Пельмени · 500 г — другая фасовка');
    await expect(page.getByTestId('text-price-unready')).toHaveText('Цена не выбрана · не готов к публикации');
    await expect(page.getByTestId('text-review-summary')).toHaveText('Новых товаров: 3 · уже есть в точке: 3');
    expect(await counts(phone)).toEqual({ offers: 3, drafts: 3 });

    await page.getByTestId('text-price-choices').getByRole('button', { name: '300 ₸ / кг' }).click();
    await expect(page.getByTestId('text-price-choices')).toHaveCount(0);
    await expect(page.getByTestId('text-price-unready')).toHaveCount(0);
    expect(await counts(phone)).toEqual({ offers: 3, drafts: 3 });
  });

  test('an existing card repeated with two prices: no automatic draft; a double tap makes one; reload keeps it', async ({ page }) => {
    const phone = phoneFor(2);
    const ids = await seed(page, phone);
    await submitList(page, ids.pointA, 'Пельмени 1400 за упаковку 500 г. Пельмени 1500 за упаковку 500 г.');

    await expect(page.getByTestId('held-0')).toContainText('В тексте разные цены: 1 400 ₸ и 1 500 ₸');
    await expect(page.getByTestId(`held-candidate-${ids.pelm05}`)).toBeVisible();
    await expect(page.locator('[data-testid^="text-draft-"]')).toHaveCount(0);
    expect(await counts(phone)).toEqual({ offers: 3, drafts: 0 });

    const create = page.getByTestId('held-create-draft');
    await create.dblclick();
    await expect(page.getByTestId('held-draft-made')).toBeVisible();
    await expect(page.getByTestId('text-price-unready')).toBeVisible();
    expect(await counts(phone)).toEqual({ offers: 3, drafts: 1 });

    await page.reload();
    await expect(page.getByTestId('held-draft-made')).toBeVisible();
    await expect(page.getByTestId('held-create-draft')).toHaveCount(0);
    expect(await counts(phone)).toEqual({ offers: 3, drafts: 1 });
  });
});
