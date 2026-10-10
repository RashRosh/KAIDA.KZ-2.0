import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally { await pool.end(); }
}

// These tests prove UI handling with explicit response fixtures, not proxy/source admission.
// Real admission is proven by PostgreSQL integration and the isolated reference-stack acceptance evidence.
for (const kind of ['source-limit', 'unavailable'] as const) {
  test(`current login preserves real existing-code verification on ${kind}`, async ({ page }, info) => {
    const phone = `+77000019${info.project.name === 'mobile' ? '7' : '8'}${kind === 'source-limit' ? '01' : '02'}`;
    await cleanup(phone);
    try {
      await page.clock.install(); await page.goto('/login');
      const dialog = page.getByRole('dialog');
      await dialog.locator('#auth-phone').fill(phone);
      const issuedResponse = page.waitForResponse(r => r.url().endsWith('/api/auth/otp/request'));
      await dialog.getByRole('button', { name: 'Получить код', exact: true }).click();
      const issued = await (await issuedResponse).json();
      await dialog.locator('#auth-otp').fill(issued.delivery.code);
      await page.clock.fastForward(61000);
      let requests = 0;
      await page.route('**/api/auth/otp/request', async route => {
        requests++;
        await route.fulfill({ status: kind === 'source-limit' ? 429 : 503, contentType: 'application/json',
          body: JSON.stringify({ error: kind === 'source-limit'
            ? { code: 'OTP_SOURCE_THROTTLED', retryAfterSeconds: 157, preservesCurrentCode: true }
            : { code: 'AUTH_UNAVAILABLE', preservesCurrentCode: true } }) });
      });
      const resend = dialog.getByRole('button', { name: 'Запросить новый код', exact: true });
      await resend.click();
      await expect(dialog.getByText('Если код уже получен, его можно использовать.', { exact: true })).toBeVisible();
      await expect(dialog.locator('#auth-otp')).toHaveValue(issued.delivery.code);
      await expect(dialog.locator('button[type=submit]')).toBeEnabled();
      if (kind === 'source-limit') {
        await expect(dialog.getByText('С этой сети запрошено слишком много кодов.', { exact: true })).toBeVisible();
        await expect(dialog.getByText('Повторить можно через 02:37', { exact: true })).toBeVisible();
        await expect(resend).toBeDisabled(); await expect(resend).toHaveAttribute('aria-disabled', 'true');
        expect(await resend.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
        await resend.evaluate((e: HTMLButtonElement) => e.click()); expect(requests).toBe(1);
        await page.clock.fastForward(158000);
        await expect(resend).toBeEnabled();
        await expect(dialog.locator('.vh[role=status]')).toHaveText('Запросить новый код');
      } else {
        await expect(dialog.getByText('Новый код сейчас недоступен. Попробуйте позже.', { exact: true })).toBeVisible();
        await expect(dialog.getByText(/^Повторить можно через/)).toHaveCount(0);
      }
      await dialog.locator('button[type=submit]').click(); await expect(dialog).toBeHidden();
      expect((await (await page.request.get('/api/auth/me')).json()).user.phone).toBe(phone);
    } finally { await cleanup(phone); }
  });
}

test('source countdown survives changing phone; primary disabled style and current navigation preserved', async ({ page }, info) => {
  await page.goto('/login'); const dialog = page.getByRole('dialog');
  let requests = 0;
  await page.route('**/api/auth/otp/request', async route => { requests++; await route.fulfill({ status: 429, contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'OTP_SOURCE_THROTTLED', retryAfterSeconds: 157, preservesCurrentCode: true } }) }); });
  await dialog.locator('#auth-phone').fill(info.project.name === 'mobile' ? '+77000019703' : '+77000019803');
  const getCode = dialog.getByRole('button', { name: 'Получить код', exact: true }); await getCode.click();
  await expect(dialog.getByText(/^Повторить можно через/)).toBeVisible();
  await dialog.locator('#auth-phone').fill('+77000019999'); await expect(getCode).toBeDisabled();
  await getCode.evaluate((e: HTMLButtonElement) => e.click()); expect(requests).toBe(1);
  expect(await getCode.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await dialog.getByRole('button', { name: 'Закрыть' }).click(); await expect(dialog).toBeHidden();
});
