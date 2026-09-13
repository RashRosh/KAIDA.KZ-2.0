import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

test.describe.configure({ mode: 'serial' });

const buyerLocation = { latitude: 43.238949, longitude: 76.889709 };

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let aliasName: string;
let sellerId: string;
let nearLocationId: string;
let farLocationId: string;
let geolessLocationId: string;
let nearOfferId: string;
let farOfferId: string;
let geolessOfferId: string;
let nearLocationName: string;
let farLocationName: string;
let geolessLocationName: string;

async function cleanup() {
  if (!connection) return;
  await connection.pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  await connection.pool.query('DELETE FROM product_aliases WHERE product_id=$1', [productId]);
  await connection.pool.query('DELETE FROM locations WHERE seller_id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM sellers WHERE id=$1', [sellerId]);
  await connection.pool.query('DELETE FROM products WHERE id=$1', [productId]);
}

test.beforeAll(async ({}, workerInfo) => {
  const suffix = `${workerInfo.project.name}-${randomUUID().slice(0, 8)}`;
  productId = randomUUID();
  sellerId = randomUUID();
  nearLocationId = randomUUID();
  farLocationId = randomUUID();
  geolessLocationId = randomUUID();
  nearOfferId = randomUUID();
  farOfferId = randomUUID();
  geolessOfferId = randomUUID();
  productName = `S9 E2E Product ${suffix}`;
  aliasName = `S9 E2E Alias ${suffix}`;
  nearLocationName = `S9 near ${suffix}`;
  farLocationName = `S9 far ${suffix}`;
  geolessLocationName = `S9 geoless ${suffix}`;

  connection = createDatabase(testDatabaseUrl());
  const now = Date.now();

  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query('INSERT INTO product_aliases (product_id,name) VALUES ($1,$2)', [productId, aliasName]);
  await connection.pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, `S9 E2E seller ${suffix}`]);
  await connection.pool.query(`INSERT INTO locations (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$4,$5,'S9 near address','shop',$8,$9),
    ($2,$4,$6,'S9 far address','shop',$10,$11),
    ($3,$4,$7,'S9 geoless address','shop',NULL,NULL)`, [
    nearLocationId,
    farLocationId,
    geolessLocationId,
    sellerId,
    nearLocationName,
    farLocationName,
    geolessLocationName,
    buyerLocation.latitude,
    buyerLocation.longitude,
    43.338949,
    76.989709,
  ]);
  await connection.pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,status,last_confirmed_at,created_at,updated_at)
    VALUES
    ($1,$4,$5,$6,'active',$9,$9,$9),
    ($2,$4,$5,$7,'active',$10,$10,$10),
    ($3,$4,$5,$8,'active',$11,$11,$11)`, [
    nearOfferId,
    farOfferId,
    geolessOfferId,
    productId,
    sellerId,
    nearLocationId,
    farLocationId,
    geolessLocationId,
    new Date(now - 3 * 60_000),
    new Date(now - 2 * 60_000),
    new Date(now - 1 * 60_000),
  ]);
});

test.afterAll(async () => {
  await cleanup();
  await connection.pool.end();
});

async function expectCardOrder(page: import('@playwright/test').Page, locationNames: string[]) {
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(locationNames.length);
  for (let index = 0; index < locationNames.length; index++) {
    await expect(cards.nth(index)).toContainText(locationNames[index]!);
  }
}

function assertPublicPrivacy(body: unknown) {
  const serialized = JSON.stringify(body);
  for (const forbidden of [
    '"geo"',
    '"latitude"',
    '"longitude"',
    '"buyerLocation"',
    '"distance"',
    '"distanceMeters"',
    '"lastConfirmedAt"',
    '"rank"',
    '"score"',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

test('Buyer location is explicit, transient, disableable and changes only the next explicit Search', async ({ page }) => {
  await page.addInitScript((point) => {
    Object.defineProperty(window, '__s9GeoCalls', { value: 0, writable: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls += 1;
          success({
            coords: {
              latitude: point.latitude,
              longitude: point.longitude,
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
  }, buyerLocation);

  let searchRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/search') searchRequests += 1;
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls)).toBe(0);

  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  const firstRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await input.press('Enter');
  expect((await firstRequest).method()).toBe('GET');
  await expectCardOrder(page, [geolessLocationName, farLocationName, nearLocationName]);
  expect(searchRequests).toBe(1);

  await page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true }).click();
  await expect(page.getByText('Местоположение будет учтено при следующем поиске.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Не учитывать местоположение', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls)).toBe(1);
  expect(searchRequests).toBe(1);

  const postRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await input.press('Enter');
  expect((await postRequest).method()).toBe('POST');
  await expectCardOrder(page, [nearLocationName, farLocationName, geolessLocationName]);
  expect(searchRequests).toBe(2);

  await page.getByRole('button', { name: 'Не учитывать местоположение', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toBeVisible();
  expect(searchRequests).toBe(2);

  const fallbackRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await input.press('Enter');
  expect((await fallbackRequest).method()).toBe('GET');
  await expectCardOrder(page, [geolessLocationName, farLocationName, nearLocationName]);

  await page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Не учитывать местоположение', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls)).toBe(0);

  await page.getByLabel('Какой товар ищете?').fill(productName);
  const reloadRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  expect((await reloadRequest).method()).toBe('GET');
});

test('browser geolocation failure is non-blocking and ordinary Search remains GET', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success: PositionCallback, error?: PositionErrorCallback | null) {
          error?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
        },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true }).click();
  await expect(page.getByText('Не удалось определить местоположение. Поиск работает без учёта расстояния.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Попробовать снова', exact: true })).toBeVisible();

  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  const requestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await input.press('Enter');
  expect((await requestPromise).method()).toBe('GET');
  await expectCardOrder(page, [geolessLocationName, farLocationName, nearLocationName]);
});

test('GET stays backward compatible and GET/POST share S6 semantics, privacy and deterministic ordering', async ({ request }) => {
  for (const url of ['/api/search', '/api/search?q=', '/api/search?q=%20%20']) {
    const response = await request.get(url);
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_QUERY');
  }

  const getCanonical = await request.get('/api/search', { params: { q: productName } });
  const getAlias = await request.get('/api/search', { params: { q: aliasName } });
  expect(getCanonical.status()).toBe(200);
  expect(getAlias.status()).toBe(200);
  const getCanonicalBody = await getCanonical.json();
  const getAliasBody = await getAlias.json();
  expect(getCanonicalBody.offers.map((offer: { id: string }) => offer.id)).toEqual([geolessOfferId, farOfferId, nearOfferId]);
  expect(getAliasBody.offers.map((offer: { id: string }) => offer.id)).toEqual(
    getCanonicalBody.offers.map((offer: { id: string }) => offer.id),
  );
  expect(new Set(getAliasBody.offers.map((offer: { product: { id: string } }) => offer.product.id))).toEqual(new Set([productId]));
  assertPublicPrivacy(getCanonicalBody);
  assertPublicPrivacy(getAliasBody);

  const postBody = { q: productName, buyerLocation };
  const postCanonical = await request.post('/api/search', { data: postBody });
  const postAlias = await request.post('/api/search', { data: { q: aliasName, buyerLocation } });
  expect(postCanonical.status()).toBe(200);
  expect(postAlias.status()).toBe(200);
  const postCanonicalBody = await postCanonical.json();
  const postAliasBody = await postAlias.json();
  expect(postCanonicalBody.offers.map((offer: { id: string }) => offer.id)).toEqual([nearOfferId, farOfferId, geolessOfferId]);
  expect(postAliasBody.offers.map((offer: { id: string }) => offer.id)).toEqual(
    postCanonicalBody.offers.map((offer: { id: string }) => offer.id),
  );
  expect(new Set(postAliasBody.offers.map((offer: { product: { id: string } }) => offer.product.id))).toEqual(new Set([productId]));
  assertPublicPrivacy(postCanonicalBody);
  assertPublicPrivacy(postAliasBody);

  for (let attempt = 0; attempt < 3; attempt++) {
    const repeatedGet = await (await request.get('/api/search', { params: { q: productName } })).json();
    expect(repeatedGet.offers.map((offer: { id: string }) => offer.id)).toEqual([geolessOfferId, farOfferId, nearOfferId]);
    const repeatedPost = await (await request.post('/api/search', { data: postBody })).json();
    expect(repeatedPost.offers.map((offer: { id: string }) => offer.id)).toEqual([nearOfferId, farOfferId, geolessOfferId]);
  }
});

test('POST strictly rejects malformed, partial, non-number, out-of-range and unknown input', async ({ request }) => {
  const invalidPayloads: unknown[] = [
    {},
    { q: productName },
    { buyerLocation },
    { q: '   ', buyerLocation },
    { q: productName, buyerLocation: { latitude: buyerLocation.latitude } },
    { q: productName, buyerLocation: { longitude: buyerLocation.longitude } },
    { q: productName, buyerLocation: { latitude: 'NaN', longitude: buyerLocation.longitude } },
    { q: productName, buyerLocation: { latitude: buyerLocation.latitude, longitude: 'Infinity' } },
    { q: productName, buyerLocation: { latitude: null, longitude: buyerLocation.longitude } },
    { q: productName, buyerLocation: { latitude: 90.000001, longitude: 0 } },
    { q: productName, buyerLocation: { latitude: 0, longitude: 180.000001 } },
    { q: productName, buyerLocation: { latitude: 43.2, longitude: 76.8, accuracy: 1 } },
    { q: productName, buyerLocation, extra: true },
  ];

  for (const payload of invalidPayloads) {
    const response = await request.post('/api/search', { data: payload });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
  }

  const noBody = await request.post('/api/search');
  expect(noBody.status()).toBe(400);
  expect((await noBody.json()).error.code).toBe('INVALID_SEARCH_REQUEST');

  const malformed = await request.post('/api/search', {
    data: '{',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(malformed.status()).toBe(400);
  expect((await malformed.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
});
