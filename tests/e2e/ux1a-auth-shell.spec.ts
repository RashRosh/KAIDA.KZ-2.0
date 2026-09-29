import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

type Page = import('@playwright/test').Page;

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000941' : '+77000000942';
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
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

async function authenticateThroughApi(page: Page, phone: string) {
  const requested = await page.request.post('/api/auth/otp/request', { data: { phone } });
  expect(requested.status()).toBe(201);
  const payload = await requested.json() as {
    challenge: { id: string };
    delivery: { code: string };
  };

  const verified = await page.request.post('/api/auth/otp/verify', {
    data: { challengeId: payload.challenge.id, code: payload.delivery.code },
  });
  expect(verified.status()).toBe(200);
}

test('authenticated seller shell exposes logout and logout clears private seller state', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  const displayName = `UX1A logout seller ${testInfo.project.name}`;
  const locationName = `UX1A private point ${testInfo.project.name}`;

  await cleanup(phone);
  try {
    await authenticateThroughApi(page, phone);
    const setup = await page.request.post('/api/seller/setup', {
      data: {
        seller: { displayName },
        location: {
          name: locationName,
          type: 'shop',
          addressText: 'Алматы, UX1A logout test',
        },
      },
    });
    expect(setup.status()).toBe(201);

    // AI-S19: «Выйти» sits on the «Ещё» screen of the seller navigation.
    const logout = async () => {
      await page.getByRole('navigation', { name: 'Разделы кабинета' }).getByRole('link', { name: 'Ещё' }).click();
      await expect(page).toHaveURL('/seller/more');
      return page.getByRole('button', { name: 'Выйти' });
    };

    await page.goto('/seller/points');
    const tradingPointCard = page.locator('[data-testid^="trading-point-"]');
    await expect(tradingPointCard.getByText(locationName, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(await logout()).toBeVisible();
    await expect(page.getByText('Вход по этому номеру')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Я покупатель — поиск товаров' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByLabel('Какой товар ищете?')).toBeVisible();

    await page.goto('/seller/points');
    await expect(tradingPointCard.getByText(locationName, { exact: true })).toBeVisible();
    await (await logout()).click();

    // One account for both roles: sign-out lands on the buyer «Ещё», where «Войти» is back.
    await expect(page).toHaveURL('/more');
    await expect(page.getByRole('button', { name: /^Войти/ })).toBeVisible();
    await expect(page.getByText(displayName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(locationName, { exact: true })).toHaveCount(0);

    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toEqual({ user: null });

    const sellerMe = await page.request.get('/api/seller/me');
    expect(sellerMe.status()).toBe(401);

    // buyer-screens-mockup: buyer «Ещё» offers sign-in again.
    await page.goto('/more');
    await expect(page.getByRole('button', { name: /^Войти/ })).toBeVisible();

    await page.goto('/seller/batch');
    await expect(page.getByRole('heading', { name: 'Нужно войти' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toHaveCount(0);
    await expect(page.getByText(displayName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(locationName, { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});
