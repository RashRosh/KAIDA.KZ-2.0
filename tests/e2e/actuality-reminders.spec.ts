import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// actuality-reminders §7 (E2E): «Включить уведомления» asks the browser only after the tap and a refusal keeps the
// in-app block; «Ещё» has the same switch; the reminder link survives sign-in. Real delivery is manual acceptance.

function phoneFor(projectName: string) {
  return `+7700004${projectName === 'mobile' ? '6' : '7'}001`;
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
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
      await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1', [row.id]);
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

// A Seller with one card confirmed 30 hours ago (due for the first reminder).
async function sellerWithDueCard(phone: string, tag: string) {
  await withPool(async (pool) => {
    const user = await pool.query("INSERT INTO users (id, phone_e164, created_at) VALUES (gen_random_uuid(), $1, now()) RETURNING id", [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, `Напоминания ${tag}`]);
    const point = await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95) RETURNING id", [seller.rows[0].id, `Точка ${tag}`]);
    await pool.query(
      `INSERT INTO offers (id, title, title_search, card_id, seller_id, location_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
       VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, $4, 900, 'KZT', 'kg', 'active', now() - interval '30 hours')`,
      [`Курт ${tag}`, `курт ${tag}`, seller.rows[0].id, point.rows[0].id],
    );
  });
}

async function signInThroughForm(page: Page, phone: string) {
  await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requested = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Получить код' }).click();
  const code = (await (await requested).json()).delivery.code as string;
  await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

// The browser refuses notifications when asked (a Seller tapping «Блокировать»).
async function refuseNotifications(page: Page) {
  await page.addInitScript(() => {
    let permission: NotificationPermission = 'default';
    Object.defineProperty(Notification, 'permission', { get: () => permission });
    Notification.requestPermission = async () => {
      permission = 'denied';
      return permission;
    };
  });
}

test('a reminder link survives sign-in; the push switch asks only after a tap and a refusal keeps the in-app block', async ({ page }, testInfo) => {
  const tag = testInfo.project.name === 'mobile' ? 'моб' : 'деск';
  const phone = phoneFor(testInfo.project.name);
  try {
    await cleanup(phone);
    await sellerWithDueCard(phone, tag);
    await refuseNotifications(page);

    // Opening the reminder link signed out: sign in, then straight to the list.
    await page.goto('/seller?actuality=1');
    await page.getByRole('link', { name: 'Войти' }).click();
    await signInThroughForm(page, phone);
    await expect(page).toHaveURL(/\/seller\?actuality=1$/);
    await expect(page.getByRole('heading', { name: 'Актуальность · 1', level: 1 })).toBeVisible();

    // The task block offers push; the browser is asked only now, and a refusal explains how to allow it later.
    await page.goto('/seller');
    const task = page.getByTestId('actuality-task');
    await expect(task.getByRole('button', { name: 'Включить уведомления' })).toBeVisible();
    await task.getByRole('button', { name: 'Включить уведомления' }).click();
    await expect(task).toContainText('Уведомления запрещены в браузере');
    await expect(task).toContainText('Пора подтвердить актуальность');

    // «Ещё» has the same switch.
    await page.goto('/seller/more');
    await expect(page.getByRole('button', { name: /Включить уведомления/ })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});
