import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// seller-ai-text-real-parser §17: the seller-to-buyer Telegram path — enter, normalize, reject, save, reopen, reuse,
// remove, and the KAIDA-built t.me link on the buyer card.
const phoneFor = (project: string) => `+7700008${project === 'mobile' ? '3' : '4'}017`;

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
    const bySeller = 'SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1';
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
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

const stored = (phone: string) => withPool(async (pool) => (await pool.query(
  'SELECT l.telegram_username FROM locations l JOIN sellers s ON s.id=l.seller_id JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1 ORDER BY l.created_at',
  [phone],
)).rows.map((row) => row.telegram_username));

test('Telegram: invite link refused, link normalized and saved, reopened, offered for reuse, removed; buyers get a t.me link', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!testInfo.project.use.baseURL?.includes('3100'), 'default server');
  const phone = phoneFor(testInfo.project.name);
  const pointName = `Телеграм точка ${testInfo.project.name}`;
  await cleanup(phone);
  try {
    await login(page, phone);
    const setup = await page.request.post('/api/seller/setup', { data: { seller: { displayName: 'TG' }, location: { name: pointName, type: 'shop', addressText: 'Алматы' } } });
    expect(setup.ok()).toBe(true);
    await page.goto('/seller/points');
    await page.getByRole('button', { name: `Изменить торговую точку ${pointName}` }).click();
    const field = page.getByLabel('Telegram', { exact: true });

    await field.fill('https://t.me/+AbCdEf123');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Ссылки-приглашения не подходят. Укажите имя пользователя, например @kaida_shop.')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(await stored(phone)).toEqual([null]);

    await field.fill('t.me/Kaida_Shop_1');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Торговая точка сохранена.', { exact: true })).toBeVisible();
    expect(await stored(phone)).toEqual(['kaida_shop_1']);
    await page.getByRole('button', { name: `Изменить торговую точку ${pointName}` }).click();
    await expect(field).toHaveValue('@kaida_shop_1');
    await page.getByRole('button', { name: 'Отмена' }).click();

    // Buyers: a KAIDA-built link from the stored username.
    await withPool(async (pool) => {
      const product = (await pool.query("SELECT id FROM products WHERE name='Баранина'")).rows[0].id;
      const point = (await pool.query('SELECT l.id, l.seller_id FROM locations l JOIN sellers s ON s.id=l.seller_id JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
      await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [point.id]);
      await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,title,title_search,card_id)
        VALUES ($1,$2,$3,'100','KZT','active',now(),(SELECT name FROM products WHERE id=$1::uuid),lower((SELECT name FROM products WHERE id=$1::uuid)),$4)`, [product, point.seller_id, point.id, randomUUID()]);
    });
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    const offer = page.locator('article').filter({ hasText: pointName }).first();
    await expect(offer.getByRole('link', { name: 'Написать в Telegram', exact: true })).toHaveAttribute('href', 'https://t.me/kaida_shop_1');

    // A new point offers the saved username; nothing is filled until the tap.
    await page.goto('/seller/points');
    await page.getByRole('button', { name: 'Добавить торговую точку' }).click();
    await expect(field).toHaveValue('');
    await page.getByTestId('chip-telegram').click();
    await expect(field).toHaveValue('@kaida_shop_1');
    await page.getByRole('button', { name: 'Отмена' }).click();

    // Removal persists and the buyer link disappears.
    await page.getByRole('button', { name: `Изменить торговую точку ${pointName}` }).click();
    await field.fill('');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Торговая точка сохранена.', { exact: true })).toBeVisible();
    expect(await stored(phone)).toEqual([null]);
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    await expect(page.locator('article').filter({ hasText: pointName }).first().getByRole('link', { name: 'Написать в Telegram' })).toHaveCount(0);
  } finally {
    await cleanup(phone);
  }
});
