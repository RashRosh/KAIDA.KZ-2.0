import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000002971' : '+77000002972';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

test('UX2 onboarding visual evidence', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);

  try {
    await page.goto('/login');
    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));

    const otpResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await otpResponse).json();
    const testCode = requested.delivery.code as string;

    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(testCode);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Настройка торговой точки', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue(phone);
    await expect(page.getByLabel('WhatsApp', { exact: true })).toHaveValue(phone);

    await testInfo.attach(`ux2-onboarding-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await cleanup(phone);
  }
});