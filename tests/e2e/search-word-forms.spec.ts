import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { testDatabaseUrl } from '../integration/database';
import { resultCard, search } from './buyer-helpers';

// search-word-forms: a free-title card is found by another grammatical form of a word, in the same order in the RU and the
// KK interface; a different word is not merged. The spec owns its Seller, Location, Product and Offers (letters-only suffix
// per execution, only these rows are removed), so no other spec can change the fixture.

test('a free-title card is found by another form of a word; the same Offers in the same order for ru and kk', async ({ page, request }) => {
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const sellerId = randomUUID();
  const locationId = randomUUID();
  const productId = randomUUID();
  const titles = [`Копченые груши ${suffix}`, `Грушевый сок ${suffix}`, `Зеленый чай ${suffix}`, `Зелень свежая ${suffix}`];
  const connection = createDatabase(testDatabaseUrl());
  try {
    await connection.pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, `Wfform seller ${suffix}`]);
    await connection.pool.query("INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,'shop')", [locationId, sellerId, `Wfform point ${suffix}`, 'Wfform address']);
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [productId, `Груша ${suffix}`]);
    for (const title of titles) {
      await connection.pool.query(
        `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
         VALUES (gen_random_uuid(),NULL,$1,$2,'1000','KZT','kg','active',now(),now(),now(),$3,$4,gen_random_uuid())`,
        [sellerId, locationId, title, offerTitleSearchText(title)],
      );
    }

    // API: the observed case, identical Offers and order for ru, kk and no locale
    for (const query of [`груша ${suffix}`, `зелень ${suffix}`, `груши на ${suffix}`]) {
      const q = encodeURIComponent(query);
      const base = await (await request.get(`/api/search?q=${q}`)).json();
      const ru = await (await request.get(`/api/search?q=${q}&locale=ru`)).json();
      const kk = await (await request.get(`/api/search?q=${q}&locale=kk`)).json();
      const ids = (body: { offers: { id: string }[] }) => body.offers.map((offer) => offer.id);
      expect(ids(ru)).toEqual(ids(base));
      expect(ids(kk)).toEqual(ids(base));
    }
    const pears = await (await request.get(`/api/search?q=${encodeURIComponent(`груша ${suffix}`)}`)).json();
    expect(pears.offers.map((offer: { product: { name: string } }) => offer.product.name)).toEqual([titles[0]]);
    const greens = await (await request.get(`/api/search?q=${encodeURIComponent(`зелень ${suffix}`)}`)).json();
    expect(greens.offers.map((offer: { product: { name: string } }) => offer.product.name)).toEqual([titles[3]]);
    expect((await (await request.get(`/api/search?q=${encodeURIComponent(`груши на ${suffix}`)}`)).json()).offers).toEqual([]);

    // Buyer screen: the card is shown for «груша», the other words' cards are not
    await page.goto('/');
    await search(page, `груша ${suffix}`);
    await expect(resultCard(page, titles[0]!)).toHaveCount(1);
    await expect(resultCard(page, titles[1]!)).toHaveCount(0);
    await expect(resultCard(page, titles[2]!)).toHaveCount(0);
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await connection.pool.end();
  }
});
