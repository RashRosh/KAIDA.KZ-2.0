import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// Motion page of the accepted mockup, app side: a screen enters once (no replay after its loading placeholder), a
// closed sheet leaves with an exit animation, a field error shakes again on every submit attempt.

function phoneFor(projectName: string) {
  return `+7700004${projectName === 'mobile' ? '1' : '2'}001`;
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
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function prepareSeller(page: Page, phone: string, label: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, `Motion ${label}`]);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95)", [seller.rows[0].id, `Motion ${label}`]);
  });
}

// Every animation start from page load on, as «animation-name on element classes».
async function recordAnimations(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __motion: string[] }).__motion = log;
    document.addEventListener('animationstart', (event) => {
      const element = event.target as HTMLElement;
      log.push(`${event.animationName} ${element.tagName.toLowerCase()}.${String(element.className).trim().split(/\s+/).join('.')}`);
    }, true);
  });
}

async function takeAnimations(page: Page) {
  return page.evaluate(() => (window as unknown as { __motion: string[] }).__motion.splice(0));
}

test('a seller screen enters once, a sheet leaves animated, an error shakes on every attempt', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  try {
    await prepareSeller(page, phone, testInfo.project.name);
    await recordAnimations(page);

    // Points: the loading placeholder is replaced by the real screen — one entrance, not two.
    await page.goto('/seller/points');
    await expect(page.getByRole('heading', { name: 'Мои точки', level: 1 })).toBeVisible();
    await page.waitForTimeout(400);
    expect((await takeAnimations(page)).filter((line) => line.startsWith('m-enter main.body'))).toHaveLength(1);

    // A new card opened by address: the showcase placeholder does not enter before the editor.
    await page.goto('/seller?new=1');
    await expect(page.getByRole('heading', { name: 'Новая карточка' })).toBeVisible();
    await page.waitForTimeout(400);
    expect((await takeAnimations(page)).filter((line) => line.startsWith('m-enter main.body'))).toHaveLength(1);

    // Submitting with empty fields twice: the messages shake both times.
    const publish = page.getByRole('button', { name: 'Проверить и опубликовать' });
    await publish.click();
    await expect(page.getByText('Напишите, что это за товар')).toBeVisible();
    await page.waitForTimeout(400);
    const first = (await takeAnimations(page)).filter((line) => line.startsWith('m-shake'));
    expect(first.length).toBeGreaterThan(0);
    await publish.click();
    await page.waitForTimeout(400);
    expect((await takeAnimations(page)).filter((line) => line.startsWith('m-shake'))).toHaveLength(first.length);

    // A closed sheet leaves: an inert copy slides out, then disappears.
    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Как сформировать карточки?' });
    await expect(sheet).toBeVisible();
    await takeAnimations(page);
    await sheet.getByRole('button', { name: 'Закрыть' }).click();
    await expect(sheet).toHaveCount(0);
    await page.waitForTimeout(100);
    const leaving = await takeAnimations(page);
    expect(leaving).toContain('m-sheet-out div.sheet.leaving');
    expect(leaving).toContain('m-fade-out div.scrim.leaving');
    await expect(page.locator('.leaving')).toHaveCount(0);
  } finally {
    await cleanup(phone);
  }
});
