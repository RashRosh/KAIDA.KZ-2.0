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
    `UX1D eligible point ${suffix}`,
    noPhoneLocationId,
    noPhoneSellerId,
    noGeoLocationId,
    destination.latitude,
    destination.longitude,
    noGeoSellerId,
  ]);
  const now = new Date();
  await connection.pool.query(`INSERT INTO offers
    (id,product_id,seller_id,location_id,status,last_confirmed_at,created_at,updated_at) VALUES
    ($1,$4,$5,$6,'active',$10,$10,$10),
    ($2,$4,$7,$8,'active',$10,$10,$10),
    ($3,$4,$9,$11,'active',$10,$10,$10)`, [
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
  const card = page.getByRole('article').filter({ hasText: sellerName });
  await expect(card).toHaveCount(1);
  return card;
}

async function assertEqualSocialRow(card: Locator, names: string[]) {
  const row = card.locator('[aria-label="Дополнительные контакты"]');
  await expect(row).toBeVisible();
  const rowBox = await row.boundingBox();
  expect(rowBox).not.toBeNull();
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const name of names) {
    const link = card.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    boxes.push(box!);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    const icon = link.locator('img');
    await expect(icon).toHaveCount(1);
    const iconBox = await icon.boundingBox();
    expect(iconBox).not.toBeNull();
    expect(iconBox!.width).toBe(18);
    expect(iconBox!.height).toBe(18);
  }
  expect(boxes.every((box) => Math.abs(box.y - boxes[0]!.y) < 1)).toBe(true);
  expect(Math.max(...boxes.map(({ width }) => width)) - Math.min(...boxes.map(({ width }) => width))).toBeLessThan(2);
  if (names.length === 1) expect(Math.abs(boxes[0]!.width - rowBox!.width)).toBeLessThan(2);
}

test('UX1D OfferCard exposes Call+Route and keeps optional social actions in equal 3/2/1 rows without overflow', async ({ page, request }, testInfo) => {
  let card = await runSearch(page);
  await expect(page.getByText(/UX1D no phone seller/)).toHaveCount(0);
  await expect(page.getByText(/UX1D no geo seller/)).toHaveCount(0);

  const primary = card.locator('[aria-label="Основные действия"]');
  await expect(primary.getByRole('link')).toHaveCount(2);
  const call = card.getByRole('link', { name: 'Позвонить', exact: true });
  const route = card.getByRole('link', { name: 'Маршрут', exact: true });
  await expect(call).toHaveAttribute('href', 'tel:+77015551901');
  await expect(route).toHaveAttribute('href', `/api/offers/${offerId}/route`);
  expect((await call.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await route.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.content()).not.toContain(String(destination.latitude));
  expect(await page.content()).not.toContain(String(destination.longitude));

  const redirect = await request.get(`/api/offers/${offerId}/route`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe('dgis://2gis.ru/routeSearch/rsType/car/to/76.889709,43.238949');

  await assertEqualSocialRow(card, ['WhatsApp', 'Telegram', 'Instagram']);
  await connection.pool.query('UPDATE sellers SET instagram_username=NULL WHERE id=$1', [sellerId]);
  card = await runSearch(page);
  await expect(card.getByRole('link', { name: 'Instagram', exact: true })).toHaveCount(0);
  await assertEqualSocialRow(card, ['WhatsApp', 'Telegram']);

  await connection.pool.query('UPDATE sellers SET telegram_username=NULL WHERE id=$1', [sellerId]);
  card = await runSearch(page);
  await expect(card.getByRole('link', { name: 'Telegram', exact: true })).toHaveCount(0);
  await assertEqualSocialRow(card, ['WhatsApp']);

  if (testInfo.project.name === 'desktop') {
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(card.getByRole('link', { name: 'Позвонить', exact: true })).toBeVisible();
      await expect(card.getByRole('link', { name: 'Маршрут', exact: true })).toBeVisible();
    }
  } else {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('UX1D route action returns the same non-disclosing 404 for phone-less, geo-less and unknown Offers', async ({ request }) => {
  for (const id of [noPhoneOfferId, noGeoOfferId, randomUUID()]) {
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
