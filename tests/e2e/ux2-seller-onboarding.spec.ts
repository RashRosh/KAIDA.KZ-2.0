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

test('UX2 is one resumable Bolt-like trading point onboarding flow and completion unlocks Seller Input', async ({ page }, testInfo) => {
  const auth = await authenticate(page, testInfo.project.name);
  const pointName = `UX2 ${testInfo.project.name} point`;
  try {
    await page.goto('/seller');

    await expect(page.getByRole('heading', { name: 'Настройка торговой точки', level: 1 })).toBeVisible();
    await expect(page.getByText('Seller Input', { exact: true })).toHaveCount(0);

    const onboarding = page.locator('section[aria-labelledby="seller-onboarding-heading"]');
    await expect(onboarding.getByRole('heading', { name: 'Ваша торговая точка' })).toBeVisible();
    await expect(onboarding.locator('aside')).toHaveCount(0);
    await expect(onboarding.locator('header svg')).toHaveCount(1);
    const optionalName = onboarding.getByLabel('Имя', { exact: true });
    await expect(optionalName).toBeVisible();
    await expect(optionalName).toHaveValue('');
    await expect(onboarding.getByText('Как к вам будут обращаться покупатели. Можно оставить пустым.', { exact: true })).toBeVisible();

    const locationName = onboarding.getByLabel('Название торговой точки');
    const locationType = onboarding.getByLabel('Тип торговой точки');
    const address = onboarding.getByLabel('Адрес');
    const phone = onboarding.getByLabel('Телефон', { exact: true });
    await expect(locationName).toBeVisible();
    await expect(locationType).toBeVisible();
    await expect(address).toBeVisible();
    await expect(phone).toBeVisible();
    await expect(locationName).toHaveAttribute('required', '');
    await expect(locationType).toHaveAttribute('required', '');
    await expect(address).toHaveAttribute('required', '');
    await expect(phone).toHaveAttribute('required', '');
    await expect(address).toHaveAttribute('autocomplete', 'street-address');
    await expect(onboarding.getByText('Например: Алматы, Абая 150, вход со двора', { exact: true })).toBeVisible();
    await expect(phone).toHaveValue(auth.phone);
    await expect(onboarding.getByText('Номер входа подставляется автоматически', { exact: false })).toBeVisible();
    await expect(onboarding.getByLabel('WhatsApp', { exact: true })).toBeVisible();
    await expect(onboarding.getByLabel('Telegram', { exact: true })).toBeVisible();
    await expect(onboarding.getByLabel('Instagram', { exact: true })).toBeVisible();
    await expect(onboarding.getByText('Обязательно для поиска по расстоянию.', { exact: false })).toBeVisible();
    await expect(onboarding.getByText('автоматическое определение адреса потребует отдельного geocoding API.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toHaveCount(0);

    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    const panel = onboarding.locator(':scope > div');
    const panelBox = await panel.boundingBox();
    const onboardingBox = await onboarding.boundingBox();
    const desktopSave = page.getByRole('button', { name: 'Сохранить и продолжить' });
    const desktopSaveBox = await desktopSave.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(onboardingBox).not.toBeNull();
    expect(desktopSaveBox).not.toBeNull();
    expect(Math.abs(panelBox!.x - onboardingBox!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(panelBox!.width - onboardingBox!.width)).toBeLessThanOrEqual(2);
    expect(desktopSaveBox!.x - panelBox!.x).toBeGreaterThanOrEqual(20);
    expect(desktopSaveBox!.x - panelBox!.x).toBeLessThanOrEqual(32);
    expect(desktopSaveBox!.height).toBeGreaterThanOrEqual(44);

    await page.setViewportSize({ width: 390, height: 900 });
    const mobilePanelBox = await panel.boundingBox();
    const mobileSaveBox = await desktopSave.boundingBox();
    expect(mobilePanelBox).not.toBeNull();
    expect(mobileSaveBox).not.toBeNull();
    expect(mobileSaveBox!.width).toBeGreaterThanOrEqual(mobilePanelBox!.width - 44);
    expect(mobileSaveBox!.height).toBeGreaterThanOrEqual(44);

    await locationName.fill(pointName);
    await locationType.selectOption('shop');
    await address.fill(`Алматы, UX2 ${testInfo.project.name} address`);
    await phone.fill(auth.publicPhone);
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
    await expect(page.getByText(pointName, { exact: true })).toBeVisible();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toHaveCount(0);

    const meAfterPartial = await page.context().request.get('/api/seller/me');
    expect(meAfterPartial.status()).toBe(200);
    expect((await meAfterPartial.json()).seller.displayName).toBe(pointName);

    await page.unroute('**/api/seller/contacts');
    await page.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(page.getByText('Контакты сохранены.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ваша торговая точка' })).toBeVisible();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue(auth.publicPhone);
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();

    await page.context().grantPermissions(['geolocation'], { origin: baseURL });
    await page.context().setGeolocation(GEO);
    const geoMutation = page.waitForResponse((response) => /\/api\/seller\/locations\/[0-9a-f-]+\/geo$/.test(response.url()) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    expect((await geoMutation).status()).toBe(200);

    await expect(page.getByText('Настройка завершена', { exact: true })).toBeVisible();
    await expect(page.getByText('Точка готова. Теперь можно добавлять и обновлять товары.', { exact: true })).toBeVisible();
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