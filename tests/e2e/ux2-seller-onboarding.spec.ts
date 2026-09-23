import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { testDatabaseUrl } from '../integration/database';

const baseURL = 'http://127.0.0.1:3100';
const GEO = { latitude: 43.238949, longitude: 76.889709 };

function fixture(projectName: string) {
  const suffix = projectName === 'mobile' ? '71' : '72';
  return {
    userId: `50000000-0000-4000-8000-0000000020${suffix}`,
    phone: `+770000020${suffix}`,
    sessionId: `51000000-0000-4000-8000-0000000020${suffix}`,
    token: `ux2-browser-session-${projectName}`,
    publicPhone: projectName === 'mobile' ? '+12025550771' : '+12025550772',
  };
}

async function cleanup(pool: Pool, userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function authenticate(page: import('@playwright/test').Page, projectName: string) {
  const identity = fixture(projectName);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  await cleanup(pool, identity.userId, identity.phone);
  const createdAt = new Date('2026-09-15T18:00:00.000Z');
  const expiresAt = new Date('2030-09-15T18:00:00.000Z');
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [identity.userId, identity.phone, createdAt]);
  await pool.query('INSERT INTO auth_sessions (id,user_id,token_digest,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)', [identity.sessionId, identity.userId, digestSessionToken(identity.token), createdAt, expiresAt]);
  await page.context().addCookies([{ name: 'kaida_session', value: identity.token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  return { ...identity, pool };
}

test('UX2 first setup remains resumable inside the permanent Trading Points workspace', async ({ page }, testInfo) => {
  const auth = await authenticate(page, testInfo.project.name);
  const pointName = `UX2 ${testInfo.project.name} point`;
  try {
    await page.goto('/seller');
    await page.getByRole('button', { name: 'Торговая точка', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Торговые точки', level: 2 })).toBeVisible();

    const name = page.getByLabel('Имя', { exact: true });
    const locationName = page.getByLabel('Название торговой точки');
    const locationType = page.getByLabel('Тип торговой точки');
    const address = page.getByLabel('Адрес');
    await expect(name).toBeVisible();
    await expect(locationName).toHaveAttribute('required', '');
    await expect(locationType).toHaveAttribute('required', '');
    await expect(address).toHaveAttribute('required', '');
    await expect(address).toHaveAttribute('autocomplete', 'street-address');

    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await name.fill(`UX2 ${testInfo.project.name} seller`);
    await locationName.fill(pointName);
    await locationType.selectOption('shop');
    await address.fill(`Алматы, UX2 ${testInfo.project.name} address`);
    const save = page.getByRole('button', { name: 'Сохранить точку' });
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await save.click();

    const tradingPointCard = page.locator('[data-testid^="trading-point-"]');
    await expect(page.getByRole('heading', { name: 'Торговые точки', level: 2 })).toBeVisible();
    await expect(tradingPointCard.getByText(pointName, { exact: true })).toBeVisible();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();

    await page.getByLabel('Телефон', { exact: true }).fill(auth.publicPhone);
    await page.getByLabel('WhatsApp', { exact: true }).fill('+447911123456');
    await page.getByLabel('Telegram', { exact: true }).fill(`ux2_${testInfo.project.name}`);
    await page.getByLabel('Instagram', { exact: true }).fill(`ux2.${testInfo.project.name}`);
    await page.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(page.getByText('Контакты сохранены.', { exact: true })).toBeVisible();

    await page.reload();
    await expect(tradingPointCard.getByText(pointName, { exact: true })).toBeVisible();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue(auth.publicPhone);
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();

    await page.context().grantPermissions(['geolocation'], { origin: baseURL });
    await page.context().setGeolocation(GEO);
    const geoMutation = page.waitForResponse((response) => /\/api\/seller\/locations\/[0-9a-f-]+\/geo$/.test(response.url()) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    expect((await geoMutation).status()).toBe(200);
    await expect(page.getByText('Местоположение сохранено.', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('Настройка завершена', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(auth.pool, auth.userId, auth.phone);
    await auth.pool.end();
  }
});
