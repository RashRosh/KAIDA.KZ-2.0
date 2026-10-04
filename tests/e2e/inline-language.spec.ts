import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { morePhone } from './buyer-helpers';

// Stage 6D (docs/slices/inline-language): «Ещё» → «Язык» is two inline options applied at once — no sheet, radio or
// «Готово» — for the buyer and for the Seller. Mobile + Russian is the current gate (PROJECT_RULES.md §18.5).
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The current delivery gate is mobile + Russian.');
});

// Each test signs in, switches the language twice, reloads and narrows the viewport: more than the default 30 s on a slow runner.
test.setTimeout(60_000);

// One account per surface: the two tests run in parallel workers and must not clean up each other's user.
const phones = { '/more': '+77000014081', '/seller/more': '+77000014082' } as const;

async function cleanup() {
  for (const phone of Object.values(phones)) await cleanupPhone(phone);
}

async function cleanupPhone(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

test.afterAll(cleanup);

async function signIn(page: Page, phone: string) {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

const languageGroup = (page: Page, name: 'Язык' | 'Тіл') => page.getByRole('group', { name, exact: true });

async function exerciseInlineLanguage(page: Page, path: keyof typeof phones) {
  const phone = phones[path];
  await cleanupPhone(phone);
  await signIn(page, phone);
  await page.goto(path);
  const group = languageGroup(page, 'Язык');
  const russian = group.getByRole('button', { name: 'Русский', exact: true });
  const kazakh = group.getByRole('button', { name: 'Қазақша', exact: true });

  // Two options in place, the active one marked; nothing of the old sheet exists.
  await expect(russian).toHaveAttribute('aria-pressed', 'true');
  await expect(kazakh).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Готово', exact: true })).toHaveCount(0);
  // The pill is small, as in the mockup; each mark keeps a 44 × 44 px touch area around it. Measured in one step, after the
  // screen's enter animation has settled.
  await page.locator('main.body').evaluate((main) => Promise.all(main.getAnimations().map((animation) => animation.finished)));
  for (const option of [russian, kazakh]) {
    const reach = await option.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = (px: number, py: number) => element.contains(document.elementFromPoint(px, py));
      return { width: box.width, height: box.height, above: hit(box.x + box.width / 2, box.y - 5), below: hit(box.x + box.width / 2, box.y + box.height + 5) };
    });
    expect(Math.round(reach.height)).toBeLessThanOrEqual(36);
    expect(Math.round(reach.width)).toBeGreaterThanOrEqual(44);
    expect(reach.above).toBe(true);
    expect(reach.below).toBe(true);
  }

  // Tapping the active language changes nothing.
  await russian.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(russian).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(new RegExp(`${path}$`));

  // The other language applies at once; the route stays, focus stays on the tapped option, the account is intact.
  await kazakh.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  const kazakhGroup = languageGroup(page, 'Тіл');
  await expect(kazakhGroup.getByRole('button', { name: 'Қазақша', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(kazakhGroup.getByRole('button', { name: 'Русский', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(kazakhGroup.getByRole('button', { name: 'Қазақша', exact: true })).toBeFocused();
  await expect(page.getByText(morePhone(phone), { exact: true })).toBeVisible();

  // The choice survives a reload; the dialog and the radio never appeared.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Back to Russian in one tap; both names fit from 320 px without a horizontal scroll.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Русский', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const name of ['Русский', 'Қазақша']) {
    const box = (await languageGroup(page, 'Язык').getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
}

test('buyer «Ещё»: two inline options applied at once, route and account intact', async ({ page }) => {
  await exerciseInlineLanguage(page, '/more');
});

test('seller «Ещё»: the same inline options applied at once', async ({ page }) => {
  await exerciseInlineLanguage(page, '/seller/more');
});
