import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';

// S15B-3 / S15B-4a: buyer suggestions; a selected catalog Product (`product_id`) is a signal that joins the candidate set, not a filter. «Баранина» (seed Offer) and
// «Тунец» (Production KB v1, no Offers in any E2E flow) are the fixtures.

const LAMB = '10000000-0000-4000-8000-000000000001';
const field = (page: Page) => page.getByLabel('Какой товар ищете?');

test('the API takes a Product id as a signal: 400 for a non-uuid, a stale id falls through to the text search', async ({ request }) => {
  // Issue #130: this test compares several separate responses, so it owns its Product and Offer. Other specs publish to the shared
  // «Баранина» entry and delete it again while this one runs; a fixture of its own cannot change under it. Letters only in the
  // name, a fresh one per execution (the mobile and desktop projects and parallel workers never share it); only these rows are removed.
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const productName = `Pbsignal ${suffix}`;
  const productId = randomUUID();
  const sellerId = randomUUID();
  const locationId = randomUUID();
  const connection = createDatabase(testDatabaseUrl());
  try {
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, productName]);
    await connection.pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, `Pbsignal seller ${suffix}`]);
    await connection.pool.query("INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,'shop')", [locationId, sellerId, `Pbsignal point ${suffix}`, 'Pbsignal address']);
    await connection.pool.query(
      `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
       VALUES (gen_random_uuid(),$1,$2,$3,'1000','KZT','kg','active',now(),now(),now(),$4,lower($4),gen_random_uuid())`,
      [productId, sellerId, locationId, productName],
    );

    const q = encodeURIComponent(productName);
    const byProduct = await (await request.get(`/api/search?q=${q}&product_id=${productId}`)).json();
    expect(byProduct.resolvedProduct).toEqual({ id: productId, name: productName });
    expect(byProduct.offers.length).toBeGreaterThan(0);
    const text = await (await request.get(`/api/search?q=${q}`)).json();
    expect(byProduct).toEqual(text);

    expect((await request.get(`/api/search?q=${q}&product_id=not-a-uuid`)).status()).toBe(400);
    const unknown = await request.get(`/api/search?q=${q}&product_id=20000000-0000-4000-8000-0000000000aa`);
    expect(unknown.status()).toBe(200);
    expect(await unknown.json()).toEqual(text);

    const post = await request.post('/api/search', { data: { q: productName, productId, buyerLocation: { latitude: 43.25, longitude: 76.95 } } });
    expect(post.status()).toBe(200);
    expect((await post.json()).resolvedProduct).toEqual({ id: productId, name: productName });
    expect((await request.post('/api/search', { data: { q: productName, productId: 'nope', buyerLocation: { latitude: 43.25, longitude: 76.95 } } })).status()).toBe(400);
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await connection.pool.end();
  }
});

test('suggestions appear from two letters; choosing one searches by that Product; an edit returns to the text search', async ({ page }) => {
  await page.goto('/');
  await field(page).fill('б');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await field(page).fill('баран');
  const options = page.getByRole('option');
  await expect(options.first()).toHaveText('Баранина');
  await expect(options).toHaveCount(5);

  await page.getByRole('option', { name: 'Баранина', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`product=${LAMB}`));
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(field(page)).toHaveValue('Баранина');
  await expect(page.getByRole('listbox')).toHaveCount(0);

  // Back from the Offer page returns to the same Search by Product.
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/offers\//);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`product=${LAMB}`));
  await expect(page.getByRole('article').first()).toBeVisible();

  // An edit drops the selection: the next Enter is the ordinary text search.
  await field(page).fill('Баранин');
  await expect(page.getByRole('option').first()).toBeVisible();
  await field(page).press('Escape');
  await field(page).press('Enter');
  await expect(page).not.toHaveURL(/product=/);
  await expect(page).toHaveURL(/q=%D0%91%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD/);
});

test('a selected Product with an empty candidate set says there are no offers', async ({ page }) => {
  await page.goto('/');
  await field(page).fill('тунец');
  await page.getByRole('option', { name: 'Тунец', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('сейчас нет предложений');
});

test('keyboard: arrows move the active option and Enter chooses it; Escape closes the list', async ({ page }) => {
  await page.goto('/');
  await field(page).fill('баран');
  await expect(page.getByRole('option').first()).toBeVisible();
  await field(page).press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await field(page).fill('барана');
  await expect(page.getByRole('option').first()).toBeVisible();
  await field(page).press('ArrowDown');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await field(page).press('Enter');
  await expect(page).toHaveURL(/product=/);
});

test('popular chips stay text searches', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: 'Популярные запросы' }).getByRole('button', { name: 'Баранина', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page).not.toHaveURL(/product=/);
});

// Search Home only: a touch session scrolls the field block near the top once when the suggestions open; a mouse never does.
async function homeScroll(page: Page) {
  return field(page).evaluate((input) => {
    const block = input.closest('form')!.querySelector('input')!.parentElement!.parentElement as HTMLElement;
    let container: HTMLElement | null = block.parentElement;
    while (container && !(/(auto|scroll)/.test(getComputedStyle(container).overflowY))) container = container.parentElement;
    if (!container) return { scrollTop: 0, offset: 0 };
    return { scrollTop: container.scrollTop, offset: block.getBoundingClientRect().top - container.getBoundingClientRect().top };
  });
}

test('Search Home: a touch session scrolls the field near the top once when suggestions open', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'touch input is emulated by the mobile project');
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto('/');
  await field(page).tap();
  const before = await homeScroll(page);
  await page.keyboard.type('ба');
  await expect(page.getByRole('option').first()).toBeVisible();
  await expect.poll(async () => (await homeScroll(page)).scrollTop).toBeGreaterThan(0);
  const opened = await homeScroll(page);
  // The block moves toward the top as far as the scrollable area allows.
  expect(opened.offset).toBeLessThan(before.offset);
  await page.keyboard.type('р');
  await page.waitForTimeout(400);
  expect((await homeScroll(page)).scrollTop).toBe(opened.scrollTop);
});

test('Search Home: mouse focus never scrolls the block', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto('/');
  await field(page).click();
  await page.keyboard.type('ба');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.waitForTimeout(400);
  const before = await homeScroll(page);
  await page.keyboard.type('р');
  await page.waitForTimeout(400);
  expect(await homeScroll(page)).toEqual(before);
});
