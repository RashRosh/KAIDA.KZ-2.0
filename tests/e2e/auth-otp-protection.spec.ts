import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { openOffer, SEED_POINT, setLocaleCookie } from './buyer-helpers';

const entries = ['more', 'login', 'seller', 'interest'] as const;
function fixture(project: string, scenario: number) { return `+77000016${project === 'mobile' ? '7' : '8'}${String(scenario).padStart(2, '0')}`; }
async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM buyer_interests WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally { await pool.end(); }
}
async function openEntry(page: Page, entry: typeof entries[number]) {
  if (entry === 'login') { await page.goto('/login'); return; }
  if (entry === 'interest') {
    await page.goto('/'); await page.getByLabel('Какой товар ищете?').fill('баранина'); await page.getByLabel('Какой товар ищете?').press('Enter');
    await openOffer(page.getByRole('article').filter({ hasText: SEED_POINT }), 'Баранина');
    await page.getByRole('button', { name: 'Добавить в избранное' }).click(); return;
  }
  await page.goto('/more');
  if (entry === 'seller') await page.getByRole('link', { name: 'Я продавец — моя витрина', exact: true }).click();
  else await page.getByRole('button', { name: /^Войти/ }).click();
}
for (const [index, entry] of entries.entries()) {
  test(`shared phone budget protects ${entry} entry and preserves the old code on HTTP 429`, async ({ page }, info) => {
    const phone = fixture(info.project.name, index + 1); await cleanup(phone);
    try {
      const first = await page.request.post('/api/auth/otp/request', { data: { phone } }); expect(first.status()).toBe(201);
      const issued = await first.json();
      await openEntry(page, entry); const location = page.url(); const dialog = page.getByRole('dialog');
      await dialog.locator('#auth-phone').fill(`8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`);
      const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request') && r.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Получить код' }).click(); const denied = await response;
      expect(denied.status()).toBe(429); const payload = await denied.json();
      expect(denied.headers()['retry-after']).toBe(String(payload.error.retryAfterSeconds));
      expect(denied.headers()['cache-control']).toBe('no-store');
      await expect(dialog.getByText('Подождите перед запросом нового кода.', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Получить код' })).toBeDisabled();
      expect(page.url()).toBe(location);
      expect((await (await page.request.get('/api/auth/me')).json()).user).toBeNull();
      const login = await page.request.post('/api/auth/otp/verify', { data: { challengeId: issued.challenge.id, code: issued.delivery.code } });
      expect(login.status()).toBe(200);
    } finally { await cleanup(phone); }
  });
}

for (const locale of ['ru', 'kk'] as const) {
  test(`exhaustion, countdown and real-API replacement recovery in ${locale}`, async ({ page }, info) => {
    const phone = fixture(info.project.name, locale === 'ru' ? 5 : 6); await cleanup(phone);
    const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
    try {
      await setLocaleCookie(page.context(), locale); await page.clock.install(); await page.goto('/login');
      const dialog = page.getByRole('dialog'); await dialog.locator('#auth-phone').fill(phone);
      const request = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
      await dialog.locator('button[type=submit]').click(); const first = await (await request).json();
      const resend = dialog.getByRole('button', { name: locale === 'ru' ? 'Запросить новый код' : 'Жаңа код сұрау', exact: true });
      await expect(resend).toBeDisabled(); await expect(dialog.getByRole('status').last()).toContainText(locale === 'ru' ? 'сек.' : 'секундтан');
      const wrong = String((Number(first.delivery.code) + 1) % 1000000).padStart(6, '0');
      for (let n = 0; n < 5; n++) {
        await dialog.locator('#auth-otp').fill(wrong);
        const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/verify'));
        await dialog.locator('button[type=submit]').click(); expect((await response).status()).toBe(n === 4 ? 409 : 401);
      }
      await expect(dialog.locator('button[type=submit]')).toBeDisabled();
      await expect(dialog.getByRole('alert')).toContainText(locale === 'ru' ? 'Попытки исчерпаны' : 'Әрекеттер саны таусылды');
      // Make only this isolated fixture eligible. Browser time advances display; it never changes server policy.
      await pool.query("UPDATE auth_otp_challenges SET created_at=created_at-interval '61 seconds' WHERE id=$1", [first.challenge.id]);
      await page.clock.fastForward(61000); await expect(resend).toBeEnabled();
      const secondResponse = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
      await resend.click(); const second = await (await secondResponse).json(); expect(second.challenge.id).not.toBe(first.challenge.id);
      const old = await page.request.post('/api/auth/otp/verify', { data: { challengeId: first.challenge.id, code: first.delivery.code } });
      expect((await old.json()).error.code).toBe('OTP_NOT_ACTIVE');
      await dialog.locator('#auth-otp').fill(second.delivery.code); await dialog.locator('button[type=submit]').click();
      await expect(page.getByRole('dialog')).toBeHidden();
      expect((await (await page.request.get('/api/auth/me')).json()).user.phone).toBe(phone);
    } finally { await pool.end(); await cleanup(phone); }
  });
}

test('a late issued-code response cannot reopen a closed auth modal', async ({ page }, info) => {
  const phone = fixture(info.project.name, 7); await cleanup(phone);
  let release!: () => void; let reached!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const received = new Promise<void>((resolve) => { reached = resolve; });
  try {
    await page.route('**/api/auth/otp/request', async (route) => { const response = await route.fetch(); reached(); await held; await route.fulfill({ response }); });
    await openEntry(page, 'more'); const dialog = page.getByRole('dialog'); await dialog.locator('#auth-phone').fill(phone);
    await dialog.locator('button[type=submit]').click(); await received;
    const delivered = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click(); release(); await delivered;
    await expect(dialog).toBeHidden(); expect((await (await page.request.get('/api/auth/me')).json()).user).toBeNull();
    await page.getByRole('button', { name: /^Войти/ }).click();
    await expect(dialog.locator('#auth-phone')).toBeVisible(); await expect(dialog.locator('#auth-otp')).toBeHidden();
  } finally { release(); await cleanup(phone); }
});

test('browser time cannot bypass the server wait; an expired code offers fresh-code recovery', async ({ page }, info) => {
  const phone = fixture(info.project.name, 8); await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await page.clock.install(); await page.goto('/login'); const dialog = page.getByRole('dialog');
    await dialog.locator('#auth-phone').fill(phone);
    const initial = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await dialog.locator('button[type=submit]').click(); const first = await (await initial).json();
    const resend = dialog.getByRole('button', { name: 'Запросить новый код', exact: true });
    await page.clock.fastForward(61000); await expect(resend).toBeEnabled();
    const denied = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await resend.click(); expect((await denied).status()).toBe(429); await expect(resend).toBeDisabled();
    await expect(dialog.getByText(`Тестовый код: ${first.delivery.code}`, { exact: true })).toBeVisible();
    await pool.query("UPDATE auth_otp_challenges SET expires_at=now()-interval '1 second',created_at=created_at-interval '61 seconds' WHERE id=$1", [first.challenge.id]);
    await dialog.locator('#auth-otp').fill(first.delivery.code); const expired = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/verify'));
    await dialog.locator('button[type=submit]').click(); expect((await expired).status()).toBe(410);
    await expect(dialog.locator('#auth-otp')).toBeDisabled(); await expect(dialog.getByRole('alert')).toContainText('Срок действия кода');
    await page.clock.fastForward(61000); const replacement = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await resend.click(); expect((await replacement).status()).toBe(201); await expect(dialog.locator('#auth-otp')).toBeEnabled();
  } finally { await pool.end(); await cleanup(phone); }
});

test('a lost committed resend response hides the old code and recovers through the same request limit', async ({ page }, info) => {
  const phone = fixture(info.project.name, 9); await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await page.clock.install(); await page.goto('/login'); const dialog = page.getByRole('dialog');
    await dialog.locator('#auth-phone').fill(phone); const initial = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await dialog.locator('button[type=submit]').click(); const first = await (await initial).json();
    await pool.query("UPDATE auth_otp_challenges SET created_at=created_at-interval '61 seconds' WHERE id=$1", [first.challenge.id]);
    await page.clock.fastForward(61000); const resend = dialog.getByRole('button', { name: 'Запросить новый код', exact: true });
    await page.route('**/api/auth/otp/request', async (route) => {
      const committed = await route.fetch(); expect(committed.status()).toBe(201);
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AUTH_UNAVAILABLE' } }) });
    });
    await resend.click(); await expect(dialog.locator('#auth-otp')).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText('Не удалось подтвердить запрос');
    await expect(dialog.getByText(`Тестовый код: ${first.delivery.code}`, { exact: true })).toBeHidden();
    await page.unroute('**/api/auth/otp/request'); const denied = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await resend.click(); expect((await denied).status()).toBe(429); await expect(resend).toBeDisabled();
    expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: first.challenge.id, code: first.delivery.code } })).status()).toBe(409);
    await pool.query("UPDATE auth_otp_challenges SET created_at=created_at-interval '61 seconds' WHERE phone_e164=$1", [phone]);
    await page.clock.fastForward(61000); const replacement = page.waitForResponse((r) => r.url().endsWith('/api/auth/otp/request'));
    await resend.click(); const fresh = await (await replacement).json(); await dialog.locator('#auth-otp').fill(fresh.delivery.code);
    await dialog.locator('button[type=submit]').click(); await expect(dialog).toBeHidden();
    expect((await (await page.request.get('/api/auth/me')).json()).user.phone).toBe(phone);
  } finally { await pool.end(); await cleanup(phone); }
});
