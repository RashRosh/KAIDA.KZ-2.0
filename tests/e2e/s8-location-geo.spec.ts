import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

const GEO = { latitude: 43.238949, longitude: 76.889709 };

function phoneFor(projectName: string, scenario: 'success' | 'failure') {
  if (scenario === 'success') return projectName === 'mobile' ? '+77000000991' : '+77000000992';
  return projectName === 'mobile' ? '+77000000993' : '+77000000994';
}

function publicPhoneFor(projectName: string, scenario: 'success' | 'failure') {
  if (scenario === 'success') return projectName === 'mobile' ? '+77000000981' : '+77000000982';
  return projectName === 'mobile' ? '+77000000983' : '+77000000984';
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

async function login(page: Page, phone: string) {
  await page.goto('/seller');
  await page.getByRole('link', { name: 'Войти' }).click();
  await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Получить код' }).click();
  const requested = await (await requestResponse).json();
  await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL('/');
}

async function createSeller(page: Page, projectName: string, scenario: 'success' | 'failure') {
  await page.goto('/seller/points');
  await page.getByLabel('Название торговой точки').fill(`S8 E2E seller ${projectName}-${scenario}`);
  await page.getByLabel('Тип торговой точки').selectOption('shop');
  await page.getByLabel('Адрес').fill(`Алматы, S8 E2E address ${projectName}-${scenario}`);
  await page.getByRole('button', { name: 'Сохранить точку' }).click();
  await expect(page.getByText('Местоположение не задано', { exact: true }).first()).toBeVisible();
  await page.goto('/seller/contacts');
  await page.getByLabel('Телефон', { exact: true }).fill(publicPhoneFor(projectName, scenario));
  await page.getByRole('button', { name: 'Сохранить контакты' }).click();
  await expect(page.getByText('Контакты сохранены.', { exact: true })).toBeVisible();
  await page.goto('/seller/points');
}

async function createLambOffer(page: Page, comment: string) {
  await page.goto('/seller/offers/new');
  await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
  await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('4100.00');
  await page.getByLabel('Единица', { exact: true }).selectOption('kg');
  await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Создать изменение' }).click();
  await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
  await expect(page).toHaveURL('/seller');
}

test('S8 Seller explicitly saves browser geolocation and public Search hides raw coordinates', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'success');
  const sellerName = `S8 E2E seller ${testInfo.project.name}-success`;
  const comment = `S8 privacy ${testInfo.project.name}`;
  await cleanup(phone);
  try {
    await page.context().grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:3100' });
    await page.context().setGeolocation(GEO);
    await login(page, phone);
    await createSeller(page, testInfo.project.name, 'success');

    const before = await page.context().request.get('/api/seller/me');
    expect(before.status()).toBe(200);
    expect((await before.json()).seller.locations[0].geo).toBeNull();

    const saveResponse = page.waitForResponse((response) => (
      /\/api\/seller\/locations\/[0-9a-f-]+\/geo$/.test(response.url())
      && response.request().method() === 'PUT'
    ));
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    const saved = await saveResponse;
    expect(saved.status()).toBe(200);
    expect((await saved.json()).location.geo).toEqual(GEO);
    await expect(page.getByRole('region', { name: 'Торговые точки' }).getByRole('status'))
      .toHaveText('Местоположение сохранено.');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Обновить местоположение' })).toBeVisible();
    await createLambOffer(page, comment);

    const search = await page.context().request.get('/api/search?q=%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
    expect(search.status()).toBe(200);
    const body = await search.json();
    const offer = body.offers.find((candidate: { seller: { displayName: string } }) => candidate.seller.displayName === sellerName);
    expect(offer).toBeTruthy();
    expect(offer.location).not.toHaveProperty('geo');
    expect(offer.location).not.toHaveProperty('latitude');
    expect(offer.location).not.toHaveProperty('longitude');
    expect(JSON.stringify(offer)).not.toContain('43.238949');
    expect(JSON.stringify(offer)).not.toContain('76.889709');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});

test('S8 browser geolocation denial stays client-side and keeps onboarding resumable', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'failure');
  await cleanup(phone);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({
            code: 1,
            message: 'Permission denied by deterministic S8 test',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
      },
    });
  });

  let mutationRequests = 0;
  page.on('request', (request) => {
    if (/\/api\/seller\/locations\/[0-9a-f-]+\/geo$/.test(request.url()) && request.method() === 'PUT') mutationRequests += 1;
  });

  try {
    await login(page, phone);
    await createSeller(page, testInfo.project.name, 'failure');
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    await expect(page.getByText('Доступ к геопозиции запрещён.', { exact: false })).toBeVisible();
    expect(mutationRequests).toBe(0);

    const me = await page.context().request.get('/api/seller/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).seller.locations[0].geo).toBeNull();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Точки', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Торговые точки', level: 2 })).toBeVisible();
    await expect(page.getByText(`S8 E2E seller ${testInfo.project.name}-failure`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
    expect(mutationRequests).toBe(0);
  } finally {
    await cleanup(phone);
  }
});
