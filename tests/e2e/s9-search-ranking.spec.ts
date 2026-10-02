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
  await connection.pool.query('INSERT INTO sellers (id,display_name,contact_phone_e164) VALUES ($1,$2,$3)', [sellerId, `S9 E2E seller ${suffix}`, '+77015550901']);
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
    (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,created_at,updated_at, title, title_search, card_id)
    VALUES
    ($1,$4,$5,$6,1000,'KZT','active',$9,$9,$9,(SELECT name FROM products WHERE id=$4::uuid),lower((SELECT name FROM products WHERE id=$4::uuid)),gen_random_uuid()),
    ($2,$4,$5,$7,1000,'KZT','active',$10,$10,$10,(SELECT name FROM products WHERE id=$4::uuid),lower((SELECT name FROM products WHERE id=$4::uuid)),gen_random_uuid()),
    ($3,$4,$5,$8,1000,'KZT','active',$11,$11,$11,(SELECT name FROM products WHERE id=$4::uuid),lower((SELECT name FROM products WHERE id=$4::uuid)),gen_random_uuid())`, [
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
  // stage #5: the derived whole-meter distanceMeters of a location-aware request is a legitimate public field;
  // raw Buyer/Seller coordinates and private ranking inputs stay forbidden (slice contract §3).
  for (const forbidden of [
    '"geo"',
    '"latitude"',
    '"longitude"',
    '"buyerLocation"',
    '"lastConfirmedAt"',
    '"rank"',
    '"score"',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

test('Buyer location is explicit, transient and reached only through the «Фильтры» geo intent', async ({ page }) => {
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
  // First Entry: the start page has neither the removed pin control nor the filters button.
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Фильтры', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls)).toBe(0);

  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  const firstRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await input.press('Enter');
  expect((await firstRequest).method()).toBe('GET');
  await expectCardOrder(page, [farLocationName, nearLocationName]);
  await expect(page.getByText(geolessLocationName)).toHaveCount(0);
  expect(searchRequests).toBe(1);

  // stage #5: the results header carries «Фильтры» (B07) with the sort radiogroup and the distance chips —
  // no price block (stage #6).
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Сортировка' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Сначала ближе' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Сначала актуальнее' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Расстояние' })).toBeVisible();
  for (const chip of ['до 1 км', 'до 3 км', 'до 5 км', 'Любое']) {
    await expect(page.getByRole('radio', { name: chip, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Цена', { exact: false })).toHaveCount(0);

  // Selecting «Сначала ближе» is itself the explicit geo intent: the prompt fires without any other button.
  await page.getByRole('radio', { name: 'Сначала ближе' }).click();
  expect(await page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls)).toBe(1);
  expect(searchRequests).toBe(1);

  const postRequest = page.waitForRequest((request) => {
    if (new URL(request.url()).pathname !== '/api/search') return false;
    return request.postData()?.includes('"sort":"distance"') ?? false;
  });
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  await expect(page.getByRole('button', { name: 'Фильтры, активно 1' })).toBeVisible();
  expect((await postRequest).method()).toBe('POST');
  await expectCardOrder(page, [nearLocationName, farLocationName]);
  await expect(page.getByRole('button', { name: 'Убрать фильтр Сначала ближе' })).toBeVisible();
  expect(searchRequests).toBe(2);

  // The applied sort chip removes itself and returns to «Сначала актуальнее».
  await page.getByRole('button', { name: 'Убрать фильтр Сначала ближе' }).click();
  await expect(page.getByRole('button', { name: 'Фильтры, активно 1' })).toHaveCount(0);
  expect(searchRequests).toBe(3);
  await expectCardOrder(page, [nearLocationName, farLocationName]);

  // Reload: the transient location is gone, geolocation is not re-requested, the default Search is GET.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls)).toBe(0);
  await page.getByLabel('Какой товар ищете?').fill(productName);
  const reloadRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  expect((await reloadRequest).method()).toBe('GET');
  await expectCardOrder(page, [farLocationName, nearLocationName]);
});

test('the distance radius filters the visible results instantly and the empty-filtered state follows B07', async ({ page }) => {
  // The mocked buyer sits far away from both fixtures, so «до 1 км» filters everything out and the
  // B07 «С такими фильтрами ничего нет» state appears.
  await page.addInitScript((point) => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
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
  }, { latitude: 0, longitude: 0 });

  await page.goto('/');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  await input.press('Enter');
  await expectCardOrder(page, [farLocationName, nearLocationName]);

  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await page.getByRole('radio', { name: 'Сначала ближе' }).click();
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  // Both fixtures are thousands of kilometres away, so freshness keeps «far» above «near» even in this mode;
  // the point of the test is the radius filtering below.
  await expectCardOrder(page, [farLocationName, nearLocationName]);
  // The applied summary line follows B07: count · distance · sort.
  await expect(page.getByText('2 предложения · сначала ближе').first()).toBeVisible();

  // A finite radius applies instantly from the sheet and can empty the visible set.
  await page.getByRole('button', { name: /^Фильтры(, активно \d+)?$/ }).click();
  await page.getByRole('radio', { name: 'до 1 км', exact: true }).click();
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  await expect(page.getByRole('button', { name: 'Фильтры, активно 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Убрать фильтр до 1 км' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'С такими фильтрами ничего нет' })).toBeVisible();
  await expect(page.getByText('Без фильтров по запросу')).toBeVisible();

  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expectCardOrder(page, [farLocationName, nearLocationName]);
  await expect(page.getByRole('button', { name: 'Фильтры, активно 2' })).toHaveCount(0);
});

test('the filters sheet is fully translated in Kazakh', async ({ page }) => {
  await page.context().addCookies([{ name: 'kaida_locale', value: 'kk', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/');
  const input = page.getByLabel('Қандай тауар іздейсіз?');
  await input.fill(productName);
  await input.press('Enter');
  await page.getByRole('button', { name: 'Фильтрлер', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Сұрыптау' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Алдымен жақын' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Кез келген', exact: true })).toBeVisible();
});

test('geolocation denial keeps «Актуальнее» honest, resets the radius and offers the B07 retry', async ({ page }) => {
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

  let searchRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/search') searchRequests += 1;
  });

  await page.goto('/');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  await input.press('Enter');
  await expectCardOrder(page, [farLocationName, nearLocationName]);
  expect(searchRequests).toBe(1);

  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await page.getByRole('radio', { name: 'Сначала ближе' }).click();
  await expect(page.getByText('Не удалось определить местоположение')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разрешить геолокацию' })).toBeVisible();

  // The denial reverted the geo-dependent draft: the ordinary Search keeps working as «Актуальнее».
  await page.getByRole('button', { name: /^Показать \d+ предложени/ }).click();
  await expect(page.getByRole('button', { name: 'Фильтры, активно 1' })).toHaveCount(0);
  expect(searchRequests).toBe(1);
  await expectCardOrder(page, [farLocationName, nearLocationName]);

  // The banner retry button re-requests the permission (still denied here) and stays concise.
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await page.getByRole('radio', { name: 'Сначала ближе' }).click();
  await page.getByRole('button', { name: 'Разрешить геолокацию' }).click();
  await expect(page.getByText('Не удалось определить местоположение')).toBeVisible();
  expect(searchRequests).toBe(1);
  await expectCardOrder(page, [farLocationName, nearLocationName]);
});

test('GET stays backward compatible and GET/POST share S6 semantics, privacy and deterministic ordering among buyer-eligible Offers', async ({ request }) => {
  for (const url of ['/api/search', '/api/search?q=', '/api/search?q=%20%20']) {
    const response = await request.get(url);
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_QUERY');
  }

  // stage #5: the additive sort mode is strict — garbage is rejected, and client-side numeric weights are
  // rejected by the strict request schema (weights belong to the server-side SearchRankingPolicy only).
  const badSort = await request.get('/api/search', { params: { q: productName, sort: 'cheapest' } });
  expect(badSort.status()).toBe(400);
  expect((await badSort.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
  const weightsPost = await request.post('/api/search', { data: { q: productName, buyerLocation, freshnessWeight: 0.9, distanceWeight: 0.1 } });
  expect(weightsPost.status()).toBe(400);
  expect((await weightsPost.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
  const distanceSortGet = await request.get('/api/search', { params: { q: productName, sort: 'distance' } });
  expect(distanceSortGet.status()).toBe(200);

  const getCanonical = await request.get('/api/search', { params: { q: productName } });
  const getAlias = await request.get('/api/search', { params: { q: aliasName } });
  expect(getCanonical.status()).toBe(200);
  expect(getAlias.status()).toBe(200);
  const getCanonicalBody = await getCanonical.json();
  const getAliasBody = await getAlias.json();
  expect(getCanonicalBody.offers.map((offer: { id: string }) => offer.id)).toEqual([farOfferId, nearOfferId]);
  expect(getCanonicalBody.offers.map((offer: { id: string }) => offer.id)).not.toContain(geolessOfferId);
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
  expect(postCanonicalBody.offers.map((offer: { id: string }) => offer.id)).toEqual([nearOfferId, farOfferId]);
  // stage #5: the derived whole-meter distance is public for geo-known Offers of a location-aware request.
  expect(postCanonicalBody.offers[0].distanceMeters).toBe(0);
  expect(postCanonicalBody.offers[1].distanceMeters).toBeGreaterThan(10000);
  expect(postAliasBody.offers.map((offer: { id: string }) => offer.id)).toEqual(
    postCanonicalBody.offers.map((offer: { id: string }) => offer.id),
  );
  expect(new Set(postAliasBody.offers.map((offer: { product: { id: string } }) => offer.product.id))).toEqual(new Set([productId]));
  assertPublicPrivacy(postCanonicalBody);
  assertPublicPrivacy(postAliasBody);

  for (let attempt = 0; attempt < 3; attempt++) {
    const repeatedGet = await (await request.get('/api/search', { params: { q: productName } })).json();
    expect(repeatedGet.offers.map((offer: { id: string }) => offer.id)).toEqual([farOfferId, nearOfferId]);
    const repeatedPost = await (await request.post('/api/search', { data: postBody })).json();
    expect(repeatedPost.offers.map((offer: { id: string }) => offer.id)).toEqual([nearOfferId, farOfferId]);
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
