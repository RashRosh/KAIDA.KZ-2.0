import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

const GEO = { latitude: 43.238949, longitude: 76.889709 };

function phoneFor(projectName: string, scenario: 'success' | 'failure') {
  if (scenario === 'success') return projectName === 'mobile' ? '+77000000991' : '+77000000992';
  return projectName === 'mobile' ? '+77000000993' : '+77000000994';
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

async function cleanupHomeFixture(projectName: string) {
  const suffix = projectName === 'mobile' ? '995' : '996';
  const userId = `50000000-0000-4000-8000-000000000${suffix}`;
  const sellerId = `20000000-0000-4000-8000-000000000${suffix}`;
  const locationId = `30000000-0000-4000-8000-000000000${suffix}`;
  const offerId = `40000000-0000-4000-8000-000000000${suffix}`;
  const phone = projectName === 'mobile' ? '+77000000995' : '+77000000996';
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM offers WHERE id=$1 OR seller_id=$2', [offerId, sellerId]);
    await pool.query('DELETE FROM locations WHERE id=$1 OR seller_id=$2', [locationId, sellerId]);
    await pool.query('DELETE FROM sellers WHERE id=$1 OR owner_user_id=$2', [sellerId, userId]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
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

async function createSeller(page: Page, projectName: string) {
  await page.goto('/seller');
  await page.getByLabel('Название продавца').fill(`S8 E2E seller ${projectName}`);
  await page.getByLabel('Название точки').fill(`S8 E2E point ${projectName}`);
  await page.getByLabel('Тип точки').selectOption('shop');
  await page.getByLabel('Адрес').fill(`Алматы, S8 E2E address ${projectName}`);
  await page.getByRole('button', { name: 'Создать продавца' }).click();
  await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
}

async function sellerIdentity(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const result = await pool.query(`
      SELECT s.id AS seller_id,l.id AS location_id
      FROM users u
      JOIN sellers s ON s.owner_user_id=u.id
      JOIN locations l ON l.seller_id=s.id
      WHERE u.phone_e164=$1
    `, [phone]);
    expect(result.rows).toHaveLength(1);
    return { sellerId: result.rows[0].seller_id as string, locationId: result.rows[0].location_id as string };
  } finally {
    await pool.end();
  }
}

async function installHomeSearchFixture(projectName: string) {
  const suffix = projectName === 'mobile' ? '995' : '996';
  const userId = `50000000-0000-4000-8000-000000000${suffix}`;
  const sellerId = `20000000-0000-4000-8000-000000000${suffix}`;
  const locationId = `30000000-0000-4000-8000-000000000${suffix}`;
  const offerId = `40000000-0000-4000-8000-000000000${suffix}`;
  const phone = projectName === 'mobile' ? '+77000000995' : '+77000000996';
  const contactPhone = projectName === 'mobile' ? '+77000000985' : '+77000000986';
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const now = new Date();
    await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [userId, phone, now]);
    await pool.query('INSERT INTO sellers (id,display_name,owner_user_id,contact_phone_e164) VALUES ($1,$2,$3,$4)', [sellerId, `S8 home privacy seller ${projectName}`, userId, contactPhone]);
    await pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude)
      VALUES ($1,$2,$3,$4,'home',$5,$6)`, [locationId, sellerId, `S8 home privacy point ${projectName}`, `S8 home address ${projectName}`, 43.22, 76.82]);
    await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,seller_comment,status,last_confirmed_at,revision,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,'active',$6,1,$6,$6)`, [
      offerId,
      '10000000-0000-4000-8000-000000000001',
      sellerId,
      locationId,
      `S8 home privacy ${projectName}`,
      now,
    ]);
    return offerId;
  } finally {
    await pool.end();
  }
}

test('S8 Seller explicitly saves browser geolocation and public Search hides shop/home raw coordinates', async ({ page, browser }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'success');
  const shopOfferId = testInfo.project.name === 'mobile'
    ? '40000000-0000-4000-8000-000000000991'
    : '40000000-0000-4000-8000-000000000992';
  await cleanup(phone);
  await cleanupHomeFixture(testInfo.project.name);
  const buyerContext = await browser.newContext();
  try {
    await page.context().grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:3100' });
    await page.context().setGeolocation(GEO);
    await login(page, phone);
    await createSeller(page, testInfo.project.name);

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
    await expect(page.getByText('Местоположение сохранено', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Обновить местоположение' })).toBeVisible();

    const me = await page.context().request.get('/api/seller/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).seller.locations[0].geo).toEqual(GEO);

    await page.reload();
    await expect(page.getByText('Местоположение сохранено', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Обновить местоположение' })).toBeVisible();

    const ids = await sellerIdentity(phone);
    const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
    try {
      const now = new Date();
      const contactPhone = testInfo.project.name === 'mobile' ? '+77000000981' : '+77000000982';
      await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [ids.sellerId, contactPhone]);
      await pool.query(`INSERT INTO offers (id,product_id,seller_id,location_id,seller_comment,status,last_confirmed_at,revision,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,'active',$6,1,$6,$6)`, [
        shopOfferId,
        '10000000-0000-4000-8000-000000000001',
        ids.sellerId,
        ids.locationId,
        `S8 shop privacy ${testInfo.project.name}`,
        now,
      ]);
    } finally {
      await pool.end();
    }
    const homeOfferId = await installHomeSearchFixture(testInfo.project.name);

    const search = await buyerContext.request.get('http://127.0.0.1:3100/api/search?q=%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
    expect(search.status()).toBe(200);
    const body = await search.json();
    for (const offerId of [shopOfferId, homeOfferId]) {
      const offer = body.offers.find((candidate: { id: string }) => candidate.id === offerId);
      expect(offer).toBeTruthy();
      expect(offer.location).not.toHaveProperty('geo');
      expect(offer.location).not.toHaveProperty('latitude');
      expect(offer.location).not.toHaveProperty('longitude');
    }
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('"geo"');
    expect(serialized).not.toContain('"latitude"');
    expect(serialized).not.toContain('"longitude"');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await buyerContext.close();
    await cleanup(phone);
    await cleanupHomeFixture(testInfo.project.name);
  }
});

test('S8 browser geolocation denial stays client-side and does not mutate Location.geo', async ({ page }, testInfo) => {
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
    await createSeller(page, `${testInfo.project.name}-denied`);
    await page.getByRole('button', { name: 'Использовать моё местоположение' }).click();
    await expect(page.getByText('Доступ к геопозиции запрещён.', { exact: false })).toBeVisible();
    expect(mutationRequests).toBe(0);

    const me = await page.context().request.get('/api/seller/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).seller.locations[0].geo).toBeNull();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});
