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

test('Buyer location is explicit, transient and reached only through the «Расстояние» geo intent', async ({ page }) => {
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
  const geoCalls = () => page.evaluate(() => (window as unknown as { __s9GeoCalls: number }).__s9GeoCalls);

  await page.goto('/welcome');
  // First Entry: the start page has neither the removed pin control nor the sort control.
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Порядок результатов', exact: true })).toHaveCount(0);
  expect(await geoCalls()).toBe(0);

  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  const firstRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await input.press('Enter');
  expect((await firstRequest).method()).toBe('GET');
  // Stage 5A / Rev 3: the addressed geo-less Offer (the freshest fixture) is visible in ordinary Search and the default
  // order is the actuality, fresher first; its card has neither distance nor a route action.
  await expectCardOrder(page, [geolessLocationName, farLocationName, nearLocationName]);
  const geolessCard = page.getByRole('article').filter({ hasText: geolessLocationName });
  await expect(geolessCard.getByRole('link', { name: /Маршрут до / })).toHaveCount(0);
  await expect(geolessCard.getByText(/км$| м$/)).toHaveCount(0);
  expect(searchRequests).toBe(1);
  expect(await geoCalls()).toBe(0);

  // Rev 3 + the sorting control refresh: the sort list holds the three criteria (relevance is the unlabelled default); opening it and choosing price asks for no location.
  await page.getByRole('button', { name: 'Порядок результатов', exact: true }).click();
  const popover = page.getByRole('group', { name: 'Порядок результатов' });
  await expect(popover.getByRole('button')).toHaveCount(4);
  await expect(popover.getByRole('button', { name: /^По расстоянию/ })).toBeVisible();
  await expect(popover.getByRole('button', { name: /^По цене/ })).toBeVisible();
  await expect(popover.getByRole('button', { name: /^По актуальности/ })).toHaveAttribute('aria-pressed', 'false');
  await popover.getByRole('button', { name: /^По цене/ }).click();
  await expect(popover.getByRole('button', { name: 'По цене, дешевле первыми', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await geoCalls()).toBe(0);

  // Choosing «Расстояние» is itself the explicit geo intent: the prompt fires without any other button, the request is a POST.
  const distanceRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search'
    && (request.postData()?.includes('"sort":"distance"') ?? false));
  await popover.getByRole('button', { name: /^По расстоянию/ }).click();
  expect((await distanceRequest).method()).toBe('POST');
  expect(await geoCalls()).toBe(1);
  await expectCardOrder(page, [nearLocationName, farLocationName, geolessLocationName]);

  // Tapping the active criterion reverses it: geo-known Offers farther first, the geo-less one still last.
  await popover.getByRole('button', { name: /^По расстоянию/ }).click();
  await expectCardOrder(page, [farLocationName, nearLocationName, geolessLocationName]);
  expect(await geoCalls()).toBe(1);

  // Back to the actuality: the natural direction, fresher first; the location is kept only on this screen.
  await popover.getByRole('button', { name: /^По актуальности/ }).click();
  await expectCardOrder(page, [geolessLocationName, farLocationName, nearLocationName]);
  expect(await geoCalls()).toBe(1);

  // Reload: the transient location is gone, geolocation is not re-requested, the default Search is GET.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Учитывать моё местоположение', exact: true })).toHaveCount(0);
  expect(await geoCalls()).toBe(0);
  await page.getByLabel('Какой товар ищете?').fill(productName);
  const reloadRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/search');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  expect((await reloadRequest).method()).toBe('GET');
  await expectCardOrder(page, [geolessLocationName, farLocationName, nearLocationName]);
});

test('GET stays backward compatible and GET/POST share S6 semantics, privacy and deterministic ordering among buyer-eligible Offers', async ({ request }) => {
  for (const url of ['/api/search', '/api/search?q=', '/api/search?q=%20%20']) {
    const response = await request.get(url);
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_QUERY');
  }

  // Rev 3: sort and direction are strict — garbage and the never-released `cheaper` are rejected, and client-side numeric
  // weights are rejected by the strict request schema.
  const badParameters: Record<string, string>[] = [{ sort: 'cheapest' }, { sort: 'cheaper' }, { direction: 'up' }, { sort: 'price', direction: 'sideways' }];
  for (const params of badParameters) {
    const bad = await request.get('/api/search', { params: { q: productName, ...params } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
  }
  const weightsPost = await request.post('/api/search', { data: { q: productName, buyerLocation, freshnessWeight: 0.9, distanceWeight: 0.1 } });
  expect(weightsPost.status()).toBe(400);
  expect((await weightsPost.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
  // `distance` needs the buyer coordinates, which a GET cannot carry: it is rejected, never ordered otherwise.
  const distanceSortGet = await request.get('/api/search', { params: { q: productName, sort: 'distance' } });
  expect(distanceSortGet.status()).toBe(400);
  expect((await distanceSortGet.json()).error.code).toBe('INVALID_SEARCH_REQUEST');
  const distanceWithoutLocation = await request.post('/api/search', { data: { q: productName, buyerLocation: null, sort: 'distance' } });
  expect(distanceWithoutLocation.status()).toBe(400);
  // Price and actuality sort through GET with their directions.
  const priceGet = await request.get('/api/search', { params: { q: productName, sort: 'price', direction: 'desc' } });
  expect(priceGet.status()).toBe(200);
  const actualityAsc = await (await request.get('/api/search', { params: { q: productName, sort: 'actuality', direction: 'asc' } })).json();
  expect(actualityAsc.offers.map((offer: { id: string }) => offer.id)).toEqual([nearOfferId, farOfferId, geolessOfferId]);

  const getCanonical = await request.get('/api/search', { params: { q: productName } });
  const getAlias = await request.get('/api/search', { params: { q: aliasName } });
  expect(getCanonical.status()).toBe(200);
  expect(getAlias.status()).toBe(200);
  const getCanonicalBody = await getCanonical.json();
  const getAliasBody = await getAlias.json();
  // stage 5A: the geo-less Offer (the freshest) participates in ordinary Search; its route capability is false.
  expect(getCanonicalBody.offers.map((offer: { id: string }) => offer.id)).toEqual([geolessOfferId, farOfferId, nearOfferId]);
  expect(getCanonicalBody.offers.map((offer: { routeAvailable: boolean }) => offer.routeAvailable)).toEqual([false, true, true]);
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
  // Rev 3: the default order is the actuality, fresher first, with or without the location; the location only adds the
  // derived whole-meter distance of geo-known Offers.
  expect(postCanonicalBody.offers.map((offer: { id: string }) => offer.id)).toEqual([geolessOfferId, farOfferId, nearOfferId]);
  expect(postCanonicalBody.offers.map((offer: { routeAvailable: boolean }) => offer.routeAvailable)).toEqual([false, true, true]);
  expect(postCanonicalBody.offers[0]).not.toHaveProperty('distanceMeters');
  expect(postCanonicalBody.offers[1].distanceMeters).toBeGreaterThan(10000);
  expect(postCanonicalBody.offers[2].distanceMeters).toBe(0);
  // Explicit «Расстояние»: nearer first by default, farther first with desc, the geo-less Offer last for both.
  const distanceAsc = await (await request.post('/api/search', { data: { q: productName, buyerLocation, sort: 'distance' } })).json();
  expect(distanceAsc.offers.map((offer: { id: string }) => offer.id)).toEqual([nearOfferId, farOfferId, geolessOfferId]);
  const distanceDesc = await (await request.post('/api/search', { data: { q: productName, buyerLocation, sort: 'distance', direction: 'desc' } })).json();
  expect(distanceDesc.offers.map((offer: { id: string }) => offer.id)).toEqual([farOfferId, nearOfferId, geolessOfferId]);
  assertPublicPrivacy(distanceAsc);
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
    expect(repeatedPost.offers.map((offer: { id: string }) => offer.id)).toEqual([geolessOfferId, farOfferId, nearOfferId]);
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
    { q: productName, buyerLocation, sort: 'cheaper' },
    { q: productName, buyerLocation, direction: 'up' },
    { q: productName, buyerLocation, sort: 'price', direction: 'both' },
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
