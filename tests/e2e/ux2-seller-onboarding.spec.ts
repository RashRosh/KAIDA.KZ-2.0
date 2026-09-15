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

test('UX2 is one resumable Bolt-like onboarding flow and completion unlocks Seller Input', async ({ page }, testInfo) => {
  const auth = await authenticate(page, testInfo.project.name);
  const sellerName = `UX2 ${testInfo.project.name} seller`;
  try {
    await page.goto('/seller');

    const onboarding = page.locator('section[aria-labelledby="seller-onboarding-heading"]');
    await expect(onboarding.getByRole('heading', { name: 'Подготовим точку к публикации' })).toBeVisible();
    await expect(onboarding.getByLabel('Название продавца')).toBeVisible();
    await expect(onboarding.getByLabel('Название точки')).toBeVisible();
    await expect(onboarding.getByLabel('Тип точки')).toBeVisible();
    await expect(onboarding.getByLabel('Адрес')).toBeVisible();
    await expect(onboarding.getByLabel('Телефон', { exact: true })).toBeVisible();
    await expect(onboarding.getByLabel('WhatsApp', { exact: true })).toBeVisible();
    await expect(onboarding.getByLabel('Telegram', { exact: true })).toBeVisible();
    await expect(onboarding.getByLabel('Instagram', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toHaveCount(0);

    const guideBox = await onboarding.locator('aside').boundingBox();
    const panelBox = await onboarding.locator(':scope > div').boundingBox();
    expect(guideBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    if (testInfo.project.name === 'mobile') {
      expect(panelBox!.y).toBeGreaterThan(guideBox!.y + guideBox!.height - 2);
    } else {
      expect(panelBox!.x).toBeGreaterThan(guideBox!.x + guideBox!.width - 2);
      expect(Math.abs(panelBox!.y - guideBox!.y)).toBeLessThanOrEqual(2);
    }

    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await onboarding.getByLabel('Название продавца').fill(sellerName);
    await onboarding.getByLabel('Название точки').fill(`UX2 ${testInfo.project.name} point`);
    await onboarding.getByLabel('Тип точки').selectOption('shop');
    await onboarding.getByLabel('Адрес').fill(`Алматы, UX2 ${testInfo.project.name} address`);
    await onboarding.getByLabel('Телефон', { exact: true }).fill(auth.publicPhone);
    await onboarding.getByLabel('WhatsApp', { exact: true }).fill('+447911123456');
    await onboarding.getByLabel('Telegram', { exact: true }).fill(`ux2_${testInfo.project.name}`);
    await onboarding.getByLabel('Instagram', { exact: true }).fill(`ux2.${testInfo.project.name}`);

    let failContactsOnce = true;
    await page.route('**/api/seller/contacts', async (route) => {
      if (route.request().method() === 'PUT' && failContactsOnce) {
        failContactsOnce = false;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'TEMPORARY', message: 'Временная ошибка контактов.' } }),
        });
        return;
      }
      await route.continue();
    });

    await onboarding.getByRole('button', { name: 'Сохранить и продолжить' }).click();
    await expect(page.getByText('Точка сохранена, но контакты не сохранились.', { exact: false })).toBeVisible();
    await expect(page.getByText(sellerName, { exact: true })).toBeVisible();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toHaveCount(0);

    const meAfterPartial = await page.context().request.get('/api/seller/me');
    expect(meAfterPartial.status()).toBe(200);
    expect((await meAfterPartial.json()).seller.displayName).toBe(sellerName);

    await page.unroute('**/api/seller/contacts');
    await page.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(page.getByText('Контакты сохранены.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Подготовим точку к публикации' })).toBeVisible();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue(auth.publicPhone);
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();

    await page.context().grantPermissions(['geolocation'], { origin: baseURL });
    await page.context().setGeolocation(GEO);
    const geoMutation = page.waitForResponse((response) => /\/api\/seller\/locations\/[0-9a-f-]+\/geo$/.test(response.url()) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    expect((await geoMutation).status()).toBe(200);

    await expect(page.getByText('Настройка завершена', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();
    const createButton = page.getByRole('button', { name: 'Создать изменение' });
    await expect(createButton).toBeVisible();
    const createBox = await createButton.boundingBox();
    expect(createBox).not.toBeNull();
    expect(createBox!.height).toBeGreaterThanOrEqual(44);

    await page.reload();
    await expect(page.getByText('Настройка завершена', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(auth.pool, auth.userId, auth.phone);
    await auth.pool.end();
  }
});
