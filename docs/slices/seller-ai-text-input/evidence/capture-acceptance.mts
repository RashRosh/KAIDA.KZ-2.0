import 'dotenv/config';

/**
 * PO acceptance screenshots (no secrets in output files). From repo root:
 *   pnpm exec tsx docs/slices/seller-ai-text-input/evidence/capture-acceptance.mts
 *
 * Prerequisites (local only, not committed):
 * - Postgres test DB: DATABASE_URL or TEST_DATABASE_URL (same as integration/E2E).
 * - Production build served at http://127.0.0.1:3100 with SELLER_TEXT_INPUT=fake.
 * - No API keys or .env secrets required beyond DB URL already used for tests.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { chromium, type Page } from '@playwright/test';
import { testDatabaseUrl } from '../../../../tests/integration/database';

const BASE = 'http://127.0.0.1:3100';
const OUT = join(import.meta.dirname);
const PHONES = { mobile: '+77000049305', desktop: '+77000049405' } as const;

mkdirSync(OUT, { recursive: true });

async function cleanupTestUser(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(
        `DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${bySeller}))`,
        [row.id],
      );
      await pool.query(
        `DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`,
        [row.id],
      );
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(
        `DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`,
        [row.id],
      );
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function login(page: Page, phone: string) {
  const requested = await (await page.request.post(`${BASE}/api/auth/otp/request`, { data: { phone } })).json();
  if (!requested?.challenge?.id || !requested?.delivery?.code) {
    throw new Error('OTP request failed (check test auth and phone band)');
  }
  expectOk(
    (
      await page.request.post(`${BASE}/api/auth/otp/verify`, {
        data: { challengeId: requested.challenge.id, code: requested.delivery.code },
      })
    ).ok(),
  );
}

function expectOk(ok: boolean) {
  if (!ok) throw new Error('auth failed');
}

async function ensureSeller(page: Page) {
  const setup = await page.request.post(`${BASE}/api/seller/setup`, {
    data: {
      seller: { displayName: 'Приёмка текста' },
      location: { name: 'Точка приёмки', type: 'shop', addressText: 'Алматы' },
    },
  });
  if (setup.status() !== 201 && setup.status() !== 409) {
    throw new Error(`setup failed: ${setup.status()}`);
  }
}

async function capture(name: string, page: Page) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
}

async function runViewport(label: 'mobile' | 'desktop', width: number, height: number) {
  const phone = PHONES[label];
  await cleanupTestUser(phone);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: label === 'mobile',
    hasTouch: label === 'mobile',
  });
  const page = await context.newPage();
  try {
    await login(page, phone);
    await ensureSeller(page);
    await page.goto(`${BASE}/seller`);
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await capture(`${label}-01-source-sheet.png`, page);
    await page.getByTestId('source-text-input').click();
    await capture(`${label}-02-text-compose.png`, page);

    await page.getByLabel('Список товаров').fill('[fixture:e2e-multi]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await page.waitForURL(/text-input\/review/);
    await page.getByTestId('text-input-review').waitFor();
    await page.getByRole('button', { name: /Баранина/ }).waitFor();
    await page.getByRole('button', { name: /Укроп/ }).waitFor();
    await capture(`${label}-03-review-multi.png`, page);

    await page.goto(`${BASE}/seller/text-input`);
    await page.getByLabel('Список товаров').fill('[fixture:e2e-skipped]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await page.getByTestId('text-skipped-block').waitFor();
    await capture(`${label}-04-review-skipped.png`, page);

    await page.goto(`${BASE}/seller/text-input`);
    await page.getByLabel('Список товаров').fill('[fixture:e2e-uncertain]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await page.getByTestId('text-uncertain-notice').waitFor();
    await capture(`${label}-05-review-uncertain.png`, page);

    await page.goto(`${BASE}/seller/text-input`);
    await page.getByLabel('Список товаров').fill('[fixture:e2e-catalog]');
    await page.getByRole('button', { name: 'Разобрать в черновики' }).click();
    await page.getByRole('button', { name: /Баранина/ }).click();
    await page.getByLabel('Название товара').waitFor();
    await capture(`${label}-06-card-editor.png`, page);
  } finally {
    await browser.close();
    await cleanupTestUser(phone);
  }
}

await runViewport('mobile', 390, 844);
await runViewport('desktop', 1440, 900);
console.log('Wrote 12 screenshots under docs/slices/seller-ai-text-input/evidence/');
