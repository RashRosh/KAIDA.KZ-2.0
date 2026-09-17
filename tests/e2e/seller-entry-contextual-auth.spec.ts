import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

const baseURL = 'http://127.0.0.1:3100';
const GEO = { latitude: 43.238949, longitude: 76.889709 };

function phoneFor(projectName: string, scenario: 'cancel' | 'seller' | 'product') {
  const suffix = projectName === 'mobile' ? '1' : '2';
  const stem = scenario === 'cancel' ? '215' : scenario === 'seller' ? '216' : '217';
  return `+7700000${stem}${suffix}`;
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function openPrimaryNav(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });
  if (await nav.isVisible().catch(() => false)) return nav;
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(nav).toBeVisible();
  return nav;
}

async function authenticateInOpenModal(page: Page, phone: string) {
  const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
  await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requestedResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Получить код' }).click();
  const requested = await (await requestedResponse).json() as { delivery: { code: string } };
  await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function authenticateThroughApi(page: Page, phone: string) {
  const requested = await page.request.post('/api/auth/otp/request', { data: { phone } });
  expect(requested.status()).toBe(201);
  const payload = await requested.json() as { challenge: { id: string }; delivery: { code: string } };
  const verified = await page.request.post('/api/auth/otp/verify', {
    data: { challengeId: payload.challenge.id, code: payload.delivery.code },
  });
  expect(verified.status()).toBe(200);
}

test('seller-intent cancel keeps buyer context and cannot leak into ordinary login', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'cancel');
  await cleanup(phone);
  try {
    await page.goto('/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
    const buyerUrl = page.url();

    for (const closeWith of ['button', 'escape', 'backdrop'] as const) {
      const nav = await openPrimaryNav(page);
      const sellerTrigger = nav.getByRole('link', { name: 'Продавцу', exact: true });
      await sellerTrigger.click();
      const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(buyerUrl);

      if (closeWith === 'button') await dialog.getByRole('button', { name: 'Закрыть' }).click();
      if (closeWith === 'escape') await page.keyboard.press('Escape');
      if (closeWith === 'backdrop') await page.getByTestId('auth-backdrop').click({ position: { x: 4, y: 4 } });

      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(buyerUrl);
      await expect(sellerTrigger).toBeFocused();
    }

    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await authenticateInOpenModal(page, phone);
    await expect(page).toHaveURL(buyerUrl);
    await expect(page.getByText(phone, { exact: true })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});

test('seller-intent OTP success routes to the first-run workspace', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'seller');
  await cleanup(phone);
  try {
    await page.goto('/nearby');
    const nav = await openPrimaryNav(page);
    await nav.getByRole('link', { name: 'Продавцу', exact: true }).click();
    await expect(page).toHaveURL('/nearby');
    await authenticateInOpenModal(page, phone);

    await expect(page).toHaveURL('/seller');
    await expect(page.getByRole('heading', { name: 'Кабинет продавца', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Торговая точка', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить товар', exact: true })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});

test('authenticated product-first flow preserves input through required setup before ChangeSet creation', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'product');
  const price = testInfo.project.name === 'mobile' ? '5181.25' : '5182.25';
  const comment = `Issue 35 product-first ${testInfo.project.name}`;
  await cleanup(phone);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await authenticateThroughApi(page, phone);
    await page.goto('/');
    await expect(page.getByText(phone, { exact: true })).toBeVisible();

    const nav = await openPrimaryNav(page);
    await nav.getByRole('link', { name: 'Продавцу', exact: true }).click();
    await expect(page).toHaveURL('/seller');
    await expect(page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' })).toHaveCount(0);

    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    const actionBox = await page.getByRole('button', { name: 'Добавить товар', exact: true }).boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.height).toBeGreaterThanOrEqual(44);

    await page.getByRole('button', { name: 'Добавить товар', exact: true }).click();
    await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
    await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill(price);
    await page.getByRole('textbox', { name: 'Единица', exact: true }).fill('кг');
    await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill(comment);

    let changeSetMutations = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/seller/change-sets')) changeSetMutations += 1;
    });

    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Настройка торговой точки', level: 1 })).toBeVisible();
    await expect(page.getByText('Данные товара сохранены в этом окне.', { exact: false })).toBeVisible();
    expect(changeSetMutations).toBe(0);
    expect(Number((await pool.query('SELECT count(*) FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0].count)).toBe(0);

    await page.getByLabel('Имя', { exact: true }).fill(`Issue 35 ${testInfo.project.name}`);
    await page.getByLabel('Название торговой точки').fill(`Issue 35 point ${testInfo.project.name}`);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill(`Алматы, Issue 35 ${testInfo.project.name}`);
    await page.getByRole('button', { name: 'Сохранить и продолжить' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    expect(changeSetMutations).toBe(0);

    await page.context().grantPermissions(['geolocation'], { origin: baseURL });
    await page.context().setGeolocation(GEO);
    const geoSaved = page.waitForResponse((response) => /\/api\/seller\/locations\/[0-9a-f-]+\/geo$/.test(response.url()) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    expect((await geoSaved).status()).toBe(200);

    await expect(page.getByText('Торговая точка готова. Введённые данные товара сохранены', { exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Товар', exact: true })).toHaveValue('Баранина');
    await expect(page.getByRole('textbox', { name: 'Цена, ₸', exact: true })).toHaveValue(price);
    await expect(page.getByRole('textbox', { name: 'Единица', exact: true })).toHaveValue('кг');
    await expect(page.getByRole('textbox', { name: 'Комментарий продавца', exact: true })).toHaveValue(comment);
    expect(changeSetMutations).toBe(0);

    const proposalCreated = page.waitForResponse((response) => response.url().endsWith('/api/seller/change-sets') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Создать изменение', exact: true }).click();
    expect((await proposalCreated).status()).toBe(201);
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(page.getByText('Предложение ещё не применено. Offer пока не создан.')).toBeVisible();

    const sellerRow = (await pool.query('SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
    expect(Number((await pool.query('SELECT count(*) FROM seller_change_sets WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(1);
    expect(Number((await pool.query('SELECT count(*) FROM offers WHERE seller_id=$1', [sellerRow.id])).rows[0].count)).toBe(0);
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});
