import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

test.describe.configure({ mode: 'serial' });

let connection: ReturnType<typeof createDatabase>;
let productId: string;
let productName: string;
let sellerId: string;
let sellerName: string;
let pointName: string;
let locationId: string;
let offerId: string;
let noPhoneSellerId: string;
let noPhoneLocationId: string;
let noPhoneOfferId: string;
let noGeoSellerId: string;
let noGeoLocationId: string;
let noGeoOfferId: string;
const destination = { latitude: 43.238949, longitude: 76.889709 };

async function cleanup() {
  if (!connection) return;
  const sellerIds = [sellerId, noPhoneSellerId, noGeoSellerId].filter(Boolean);
  if (productId) await connection.pool.query('DELETE FROM offers WHERE product_id=$1', [productId]);
  if (sellerIds.length > 0) {
    await connection.pool.query('DELETE FROM seller_verified_phones WHERE seller_id = ANY($1::uuid[])', [sellerIds]);
    await connection.pool.query('DELETE FROM locations WHERE seller_id = ANY($1::uuid[])', [sellerIds]);
    await connection.pool.query('DELETE FROM sellers WHERE id = ANY($1::uuid[])', [sellerIds]);
  }
  if (productId) await connection.pool.query('DELETE FROM products WHERE id=$1', [productId]);
}

test.beforeAll(async ({}, workerInfo) => {
  const suffix = `${workerInfo.project.name}-${randomUUID().slice(0, 8)}`;
  connection = createDatabase(testDatabaseUrl());
  productId = randomUUID();
  productName = `UX1D E2E Product ${suffix}`;
  sellerId = randomUUID();
  sellerName = `UX1D eligible seller ${suffix}`;
  pointName = `UX1D eligible point ${suffix}`;
  locationId = randomUUID();
  offerId = randomUUID();
  noPhoneSellerId = randomUUID();
  noPhoneLocationId = randomUUID();
  noPhoneOfferId = randomUUID();
  noGeoSellerId = randomUUID();
  noGeoLocationId = randomUUID();
  noGeoOfferId = randomUUID();

  await cleanup();
  await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
  await connection.pool.query(`INSERT INTO sellers
    (id,display_name,contact_phone_e164,whatsapp_phone_e164,telegram_username,instagram_username) VALUES
    ($1,$2,'+77015551901','+77015551902','ux1d_e2e','ux1d.e2e'),
    ($3,$4,NULL,NULL,NULL,NULL),
    ($5,$6,'+77015551903',NULL,NULL,NULL)`, [
    sellerId,
    sellerName,
    noPhoneSellerId,
    `UX1D no phone seller ${suffix}`,
    noGeoSellerId,
    `UX1D no geo seller ${suffix}`,
  ]);
  await connection.pool.query(`INSERT INTO locations
    (id,seller_id,name,address_text,type,latitude,longitude) VALUES
    ($1,$2,$3,'Almaty UX1D eligible','shop',$7,$8),
    ($4,$5,'UX1D no phone point','Almaty UX1D no phone','shop',$7,$8),
    ($6,$9,'UX1D no geo point','Almaty UX1D no geo','shop',NULL,NULL)`, [
    locationId,
    sellerId,
    pointName,
    noPhoneLocationId,
    noPhoneSellerId,
    noGeoLocationId,
    destination.latitude,
    destination.longitude,
    noGeoSellerId,
  ]);
  // point-contacts-hours: contacts live on the point and are public only when verified.
  await connection.pool.query("UPDATE locations SET phone_e164='+77015551901', whatsapp_phone_e164='+77015551902' WHERE id=$1", [locationId]);
  await connection.pool.query("INSERT INTO seller_verified_phones (seller_id,phone_e164,verified_at) VALUES ($1,'+77015551901',now()),($1,'+77015551902',now())", [sellerId]);
  const now = new Date();
  await connection.pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,created_at,updated_at, title, title_search, card_id) VALUES
    ($1,$4,$5,$6,1000,'KZT','active',$10,$10,$10,(SELECT name FROM products WHERE id=$4::uuid),lower((SELECT name FROM products WHERE id=$4::uuid)),gen_random_uuid()),
    ($2,$4,$7,$8,1000,'KZT','active',$10,$10,$10,(SELECT name FROM products WHERE id=$4::uuid),lower((SELECT name FROM products WHERE id=$4::uuid)),gen_random_uuid()),
    ($3,$4,$9,$11,1000,'KZT','active',$10,$10,$10,(SELECT name FROM products WHERE id=$4::uuid),lower((SELECT name FROM products WHERE id=$4::uuid)),gen_random_uuid())`, [
    offerId,
    noPhoneOfferId,
    noGeoOfferId,
    productId,
    sellerId,
    locationId,
    noPhoneSellerId,
    noPhoneLocationId,
    noGeoSellerId,
    now,
    noGeoLocationId,
  ]);
});

test.afterAll(async () => {
  await cleanup();
  await connection.pool.end();
});

async function runSearch(page: Page) {
  await page.goto('/');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(productName);
  await input.press('Enter');
  const card = page.getByRole('article').filter({ hasText: pointName });
  await expect(card).toHaveCount(1);
  return card;
}

// buyer-screens-mockup B01: only the point's existing contacts, as named icon-only links of at least 44 × 44 on the
// row of «Маршрут».
async function assertContactIcons(card: Locator, names: string[]) {
  // The results body enters with a slide (Motion m-enter): measure only once it has settled.
  await card.page().locator('main.body').evaluate((main) => Promise.all(main.getAnimations().map((animation) => animation.finished)));
  const route = card.getByRole('link', { name: /^Маршрут до / });
  const routeBox = (await route.boundingBox())!;
  for (const name of names) {
    const link = card.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    expect((await link.textContent())?.trim()).toBe('');
    const box = (await link.boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    expect(Math.abs(box.y + box.height / 2 - (routeBox.y + routeBox.height / 2))).toBeLessThan(2);
  }
}

test('UX1D result card exposes Route and the verified contacts as icons, and Route alone for a point without contacts', async ({ page, request }, testInfo) => {
  let card = await runSearch(page);
  // stage 5A: the addressed geo-less point is visible in ordinary Search — contacts work, the route action is
  // honestly absent (its point has neither contacts nor coordinates, so the action row is empty).
  const noGeoCard = page.getByRole('article').filter({ hasText: 'UX1D no geo point' });
  await expect(noGeoCard).toHaveCount(1);
  await expect(noGeoCard.getByRole('link', { name: /Маршрут до UX1D no geo point/ })).toHaveCount(0);
  await expect(noGeoCard.getByRole('link', { name: 'Позвонить продавцу', exact: true })).toHaveCount(0);
  // point-contacts-hours: a point without contacts is visible with Route only, never empty or grey contact icons.
  const noPhoneCard = page.getByRole('article').filter({ hasText: 'UX1D no phone point' });
  await expect(noPhoneCard.getByRole('link', { name: 'Маршрут до UX1D no phone point', exact: true })).toBeVisible();
  await expect(noPhoneCard.getByRole('link', { name: 'Позвонить продавцу', exact: true })).toHaveCount(0);
  await expect(noPhoneCard.getByRole('link', { name: 'Написать в WhatsApp', exact: true })).toHaveCount(0);

  const call = card.getByRole('link', { name: 'Позвонить продавцу', exact: true });
  const whatsApp = card.getByRole('link', { name: 'Написать в WhatsApp', exact: true });
  const route = card.getByRole('link', { name: `Маршрут до ${pointName}`, exact: true });
  await expect(call).toHaveAttribute('href', 'tel:+77015551901');
  await expect(whatsApp).toHaveAttribute('href', 'https://wa.me/77015551902');
  await expect(route).toHaveAttribute('href', `/api/offers/${offerId}/route`);
  expect(Math.round((await route.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await assertContactIcons(card, ['Позвонить продавцу', 'Написать в WhatsApp']);
  expect(await page.content()).not.toContain(String(destination.latitude));
  expect(await page.content()).not.toContain(String(destination.longitude));

  const redirect = await request.get(`/api/offers/${offerId}/route`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe('dgis://2gis.ru/routeSearch/rsType/car/to/76.889709,43.238949');

  await connection.pool.query('UPDATE locations SET whatsapp_phone_e164=NULL WHERE id=$1', [locationId]);
  card = await runSearch(page);
  await expect(card.getByRole('link', { name: 'Написать в WhatsApp', exact: true })).toHaveCount(0);
  await assertContactIcons(card, ['Позвонить продавцу']);

  if (testInfo.project.name === 'desktop') {
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(card.getByRole('link', { name: 'Позвонить продавцу', exact: true })).toBeVisible();
      await expect(card.getByRole('link', { name: `Маршрут до ${pointName}`, exact: true })).toBeVisible();
    }
  } else {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('UX1D route action returns the same non-disclosing 404 for geo-less and unknown Offers', async ({ request }) => {
  expect((await request.get(`/api/offers/${noPhoneOfferId}/route`, { maxRedirects: 0 })).status()).toBe(302);
  for (const id of [noGeoOfferId, randomUUID()]) {
    const response = await request.get(`/api/offers/${id}/route`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: 'OFFER_ROUTE_NOT_FOUND', message: 'Маршрут недоступен.' },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(String(destination.latitude));
    expect(serialized).not.toContain(String(destination.longitude));
  }
});

test('stage 5A: a geo-less Offer opens its buyer Offer page without the route action', async ({ page }) => {
  await page.goto(`/offers/${noGeoOfferId}`);
  // The generic buyer visibility opens the page; the geo-dependent route action is honestly absent.
  await expect(page.getByText('UX1D no geo point')).toBeVisible();
  await expect(page.getByText('UX1D no geo seller')).toBeVisible();
  await expect(page.getByRole('link', { name: /Маршрут до / })).toHaveCount(0);
});
