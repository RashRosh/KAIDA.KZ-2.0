import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { NEARBY_RADIUS_METERS_DEFAULT } from '../../src/modules/discovery/config/discovery.config';
import { testDatabaseUrl } from '../integration/database';

test.describe.configure({ mode: 'serial' });

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;
const buyerLocation = { latitude: 1.234567, longitude: 2.345678 };

function pointNorthByMeters(meters: number) {
  return {
    latitude: buyerLocation.latitude + meters / EARTH_MEAN_RADIUS_METERS * 180 / Math.PI,
    longitude: buyerLocation.longitude,
  };
}

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let sellerId: string;
let insideLocationId: string;
let boundaryLocationId: string;
let outsideLocationId: string;
let geolessLocationId: string;
let insideOfferId: string;
let boundaryOfferId: string;
let outsideOfferId: string;
let geolessOfferId: string;
let inactiveOfferId: string;
let expiredOfferId: string;
let insideLocationName: string;
let boundaryLocationName: string;
let outsideLocationName: string;
let geolessLocationName: string;

async function cleanup() {
  if (!connection) return;
  await connection.pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await connection.pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM products WHERE id=$1', [productId]);
}

test.beforeAll(async ({}, workerInfo) => {
  const suffix = `${workerInfo.project.name}-${randomUUID().slice(0, 8)}`;
  productId = randomUUID();
  sellerId = randomUUID();
  insideLocationId = randomUUID();
  boundaryLocationId = randomUUID();
  outsideLocationId = randomUUID();
  geolessLocationId = randomUUID();
  insideOfferId = randomUUID();
  boundaryOfferId = randomUUID();
  outsideOfferId = randomUUID();
  geolessOfferId = randomUUID();
  inactiveOfferId = randomUUID();
  expiredOfferId = randomUUID();
  productName = `S11 E2E Product ${suffix}`;
  insideLocationName = `S11 inside ${suffix}`;
  boundaryLocationName = `S11 boundary ${suffix}`;
  outsideLocationName = `S11 outside ${suffix}`;
  geolessLocationName = `S11 geoless ${suffix}`;

  connection = createDatabase(testDatabaseUrl());
  const inside = pointNorthByMeters(1000.4);
  const boundary = pointNorthByMeters(NEARBY_RADIUS_METERS_DEFAULT + 0.4);
  const outside = pointNorthByMeters(NEARBY_RADIUS_METERS_DEFAULT + 0.6);
  const now = Date.now();

  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query(`INSERT INTO sellers
    (id,display_name,contact_phone_e164,whatsapp_phone_e164,telegram_username,instagram_username)
    VALUES ($1,$2,$3,$4,$5,$6)`, [
    sellerId,
    `S11 E2E seller ${suffix}`,
    '+77015550101',
    '+77015550102',
    's11_e2e',
    's11.e2e',
  ]);

  const locations = [
    [insideLocationId, insideLocationName, 'S11 inside address', inside.latitude, inside.longitude],
    [boundaryLocationId, boundaryLocationName, 'S11 boundary address', boundary.latitude, boundary.longitude],
    [outsideLocationId, outsideLocationName, 'S11 outside address', outside.latitude, outside.longitude],
  ] as const;
  for (const [id, name, address, latitude, longitude] of locations) {
    await connection.pool.query(
      'INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,$3,$4,\'shop\',$5,$6)',
      [id, sellerId, name, address, latitude, longitude],
    );
  }
  await connection.pool.query(
    'INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,$3,$4,\'shop\',NULL,NULL)',
    [geolessLocationId, sellerId, geolessLocationName, 'S11 geoless address'],
  );

  const offerFixtures = [
    [insideOfferId, insideLocationId, 'active', new Date(now - 4 * 60_000)],
    [boundaryOfferId, boundaryLocationId, 'active', new Date(now - 3 * 60_000)],
    [outsideOfferId, outsideLocationId, 'active', new Date(now - 2 * 60_000)],
    [geolessOfferId, geolessLocationId, 'active', new Date(now - 1 * 60_000)],
    [inactiveOfferId, insideLocationId, 'inactive', new Date(now - 30_000)],
    [expiredOfferId, insideLocationId, 'active', new Date(now - 8 * 24 * 60 * 60_000)],
  ] as const;
  for (const [id, locationId, status, confirmedAt] of offerFixtures) {
    await connection.pool.query(`INSERT INTO offers
      (id,product_id,seller_id,location_id,status,last_confirmed_at,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$6)`, [
      id,
      productId,
      sellerId,
      locationId,
      status,
      confirmedAt,
    ]);
  }
});

test.afterAll(async () => {
  await cleanup();
  await connection.pool.end();
});

async function mockGeolocation(page: import('@playwright/test').Page, point: typeof buyerLocation | null) {
  await page.addInitScript(({ mockedPoint }) => {
    Object.defineProperty(window, '__s11GeoCalls', { value: 0, writable: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback, error?: PositionErrorCallback | null) {
          (window as unknown as { __s11GeoCalls: number }).__s11GeoCalls += 1;
          if (mockedPoint === null) {
            error?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
            return;
          }
          success({
            coords: {
              latitude: mockedPoint.latitude,
              longitude: mockedPoint.longitude,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });
  }, { mockedPoint: point });
}

async function openNearbyFromShell(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });
  if (!await nav.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    await expect(nav).toBeVisible();
  }
  await nav.getByRole('link', { name: 'Рядом', exact: true }).click();
}

function assertDiscoveryPrivacy(body: unknown) {
  const serialized = JSON.stringify(body);
  expect(serialized).toContain('"distanceMeters"');
  for (const forbidden of [
    '"geo"',
    '"latitude"',
    '"longitude"',
    '"buyerLocation"',
    '"lastConfirmedAt"',
    '"nearbyRadiusMeters"',
    '"rank"',
    '"score"',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

function assertSearchPrivacy(body: unknown) {
  const serialized = JSON.stringify(body);
  for (const forbidden of ['"geo"', '"latitude"', '"longitude"', '"buyerLocation"', '"distanceMeters"', '"lastConfirmedAt"']) {
    expect(serialized).not.toContain(forbidden);
  }
}

test('Buyer clicks Nearby once, gets only nearby Offers, keeps contacts, and location is not persisted', async ({ page }) => {
  await mockGeolocation(page, buyerLocation);
  let nearbyRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/discovery/nearby') nearbyRequests += 1;
  });

  await page.goto('/');
  await openNearbyFromShell(page);
  await expect(page).toHaveURL(/\/nearby$/);
  await expect(page.getByRole('article')).toHaveCount(2);
  expect(await page.evaluate(() => (window as unknown as { __s11GeoCalls: number }).__s11GeoCalls)).toBe(1);
  expect(nearbyRequests).toBe(1);

  const cards = page.getByRole('article');
  await expect(cards.nth(0)).toContainText(insideLocationName);
  await expect(cards.nth(0)).toContainText('1000 м');
  await expect(cards.nth(1)).toContainText(boundaryLocationName);
  await expect(cards.nth(1)).toContainText(`${NEARBY_RADIUS_METERS_DEFAULT} м`);
  await expect(page.getByText(outsideLocationName)).toHaveCount(0);
  await expect(page.getByText(geolessLocationName)).toHaveCount(0);

  const firstCard = cards.nth(0);
  for (const label of ['Позвонить', 'WhatsApp', 'Telegram', 'Instagram']) {
    await expect(firstCard.getByRole('link', { name: label, exact: true })).toBeVisible();
  }

  const browserPersistence = await page.evaluate(() => ({
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    cookies: document.cookie,
  }));
  const persisted = JSON.stringify(browserPersistence);
  expect(persisted).not.toContain(String(buyerLocation.latitude));
  expect(persisted).not.toContain(String(buyerLocation.longitude));
  expect(browserPersistence.sessionStorage).not.toContainEqual(['kaida:nearby-nav-intent', '1']);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Показать товары рядом', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s11GeoCalls: number }).__s11GeoCalls)).toBe(0);
  expect(nearbyRequests).toBe(1);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('one-click Nearby geolocation denial shows an error and does not fall back to a global feed', async ({ page }) => {
  await mockGeolocation(page, null);
  let nearbyRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/discovery/nearby') nearbyRequests += 1;
  });

  await page.goto('/');
  await openNearbyFromShell(page);
  await expect(page).toHaveURL(/\/nearby$/);
  await expect(page.getByText('Не удалось определить местоположение. Раздел «Рядом» работает только с разрешённой геолокацией.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s11GeoCalls: number }).__s11GeoCalls)).toBe(1);
  expect(nearbyRequests).toBe(0);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('direct Nearby deep link waits for an explicit action and can produce the empty state', async ({ page }) => {
  await mockGeolocation(page, { latitude: -40.123456, longitude: -50.654321 });
  await page.goto('/nearby');
  await expect(page.getByRole('button', { name: 'Показать товары рядом', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s11GeoCalls: number }).__s11GeoCalls)).toBe(0);

  await page.getByRole('button', { name: 'Показать товары рядом', exact: true }).click();
  await expect(page.getByText('Рядом пока нет актуальных предложений.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s11GeoCalls: number }).__s11GeoCalls)).toBe(1);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('public Nearby API is anonymous, strict, radius-filtered and does not expose raw geo', async ({ request }) => {
  const response = await request.post('/api/discovery/nearby', { data: { buyerLocation } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.offers.map((offer: { id: string }) => offer.id)).toEqual([insideOfferId, boundaryOfferId]);
  expect(body.offers.map((offer: { distanceMeters: number }) => offer.distanceMeters)).toEqual([1000, NEARBY_RADIUS_METERS_DEFAULT]);
  expect(body.offers[0].seller.contacts).toEqual({
    phoneE164: '+77015550101',
    whatsappPhoneE164: '+77015550102',
    telegramUsername: 's11_e2e',
    instagramUsername: 's11.e2e',
  });
  assertDiscoveryPrivacy(body);

  const invalidPayloads: unknown[] = [
    {},
    { buyerLocation: { latitude: buyerLocation.latitude } },
    { buyerLocation: { longitude: buyerLocation.longitude } },
    { buyerLocation: { latitude: '1.23', longitude: buyerLocation.longitude } },
    { buyerLocation: { latitude: buyerLocation.latitude, longitude: '2.34' } },
    { buyerLocation: { latitude: 90.000001, longitude: 0 } },
    { buyerLocation: { latitude: 0, longitude: 180.000001 } },
    { buyerLocation: { latitude: buyerLocation.latitude, longitude: buyerLocation.longitude, accuracy: 10 } },
    { buyerLocation, extra: true },
  ];
  for (const payload of invalidPayloads) {
    const invalid = await request.post('/api/discovery/nearby', { data: payload });
    expect(invalid.status()).toBe(400);
    expect(await invalid.json()).toEqual({
      error: { code: 'INVALID_NEARBY_REQUEST', message: 'Проверьте местоположение.' },
    });
  }

  const noBody = await request.post('/api/discovery/nearby');
  expect(noBody.status()).toBe(400);
  expect((await noBody.json()).error.code).toBe('INVALID_NEARBY_REQUEST');

  const malformed = await request.post('/api/discovery/nearby', {
    data: '{',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(malformed.status()).toBe(400);
  expect((await malformed.json()).error.code).toBe('INVALID_NEARBY_REQUEST');
});

test('closed Search API remains unfiltered by the S11 radius and keeps its old DTO', async ({ request }) => {
  const getResponse = await request.get('/api/search', { params: { q: productName } });
  expect(getResponse.status()).toBe(200);
  const getBody = await getResponse.json();
  expect(getBody.offers.map((offer: { id: string }) => offer.id)).toEqual([
    geolessOfferId,
    outsideOfferId,
    boundaryOfferId,
    insideOfferId,
  ]);
  assertSearchPrivacy(getBody);

  const postResponse = await request.post('/api/search', { data: { q: productName, buyerLocation } });
  expect(postResponse.status()).toBe(200);
  const postBody = await postResponse.json();
  expect(postBody.offers.map((offer: { id: string }) => offer.id)).toEqual([
    insideOfferId,
    boundaryOfferId,
    outsideOfferId,
    geolessOfferId,
  ]);
  expect(postBody.offers.map((offer: { id: string }) => offer.id)).toContain(outsideOfferId);
  expect(postBody.offers.map((offer: { id: string }) => offer.id)).toContain(geolessOfferId);
  assertSearchPrivacy(postBody);
});
