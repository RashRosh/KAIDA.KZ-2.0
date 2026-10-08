import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { testDatabaseUrl } from '../integration/database';
import { openOffer, resultCard } from './buyer-helpers';

// card-price-packaging (docs/slices/card-price-packaging, rev 3): the price line says what quantity the price buys —
// «/ 800 г», «/ л» (exactly one unit), «/ упак.», «/ пучок», price only. The spec owns its Seller, point and Offers
// (letters-only suffix per execution, only these rows are removed).

type Case = { key: string; price: string; unit: string | null; value?: string; pack?: [string, string]; ru: string; kk: string };
const CASES: Case[] = [
  { key: 'kg', price: '4200', unit: 'kg', ru: '4 200 ₸ / кг', kk: '4 200 ₸ / кг' },
  { key: 'liter', price: '4500', unit: 'liter', ru: '4 500 ₸ / л', kk: '4 500 ₸ / л' },
  { key: 'curd', price: '4000', unit: 'package', pack: ['800', 'g'], ru: '4 000 ₸ / 800 г', kk: '4 000 ₸ / 800 г' },
  { key: 'juice', price: '1500', unit: 'package', pack: ['250', 'ml'], ru: '1 500 ₸ / 250 мл', kk: '1 500 ₸ / 250 мл' },
  { key: 'honey', price: '4500', unit: 'package', pack: ['1', 'l'], ru: '4 500 ₸ / л', kk: '4 500 ₸ / л' },
  { key: 'nuts', price: '4500', unit: 'package', pack: ['1', 'kg'], ru: '4 500 ₸ / кг', kk: '4 500 ₸ / кг' },
  { key: 'flour', price: '900', unit: 'package', pack: ['1000', 'g'], ru: '900 ₸ / 1000 г', kk: '900 ₸ / 1000 г' },
  { key: 'apricot', price: '250', unit: 'piece', pack: ['200', 'g'], ru: '250 ₸ / 200 г', kk: '250 ₸ / 200 г' },
  { key: 'nopack', price: '800', unit: 'package', ru: '800 ₸ / упак.', kk: '800 ₸ / қапт.' },
  { key: 'dill', price: '150', unit: 'other', value: 'пучок', ru: '150 ₸ / пучок', kk: '150 ₸ / пучок' },
  { key: 'greens', price: '1150', unit: 'other', value: 'связка из трёх больших пучков зелени', ru: '1 150 ₸ / связка из трёх больших пучков зелени', kk: '1 150 ₸ / связка из трёх больших пучков зелени' },
  { key: 'eggs', price: '1200', unit: null, ru: '1 200 ₸', kk: '1 200 ₸' },
];

test('the price line reads «/ quantity» or «/ unit» on the card and the Offer page; ru and kk, narrow and large text', async ({ page }) => {
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const sellerId = randomUUID();
  const locationId = randomUUID();
  const connection = createDatabase(testDatabaseUrl());
  const titles = new Map<string, string>();
  const offerIds = new Map<string, string>();
  try {
    await connection.pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, `Price seller ${suffix}`]);
    await connection.pool.query(
      "INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,$3,$4,'shop')",
      [locationId, sellerId, `Price point ${suffix}`, 'Price address'],
    );
    for (const item of CASES) {
      const offerId = randomUUID();
      const title = `Цена ${item.key} ${suffix}`;
      titles.set(item.key, title);
      offerIds.set(item.key, offerId);
      await connection.pool.query(
        `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,price_unit_value,pack_amount,pack_unit,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
         VALUES ($1,NULL,$2,$3,$4,'KZT',$5,$6,$7,$8,'active',now(),now(),now(),$9,$10,gen_random_uuid())`,
        [offerId, sellerId, locationId, item.price, item.unit, item.value ?? null, item.pack?.[0] ?? null, item.pack?.[1] ?? null, title, offerTitleSearchText(title)],
      );
    }
    const priceOf = (key: string) => resultCard(page, titles.get(key)!).locator('.pr').locator('xpath=..');
    const search = async () => { const input = page.getByRole('search').locator('input[type="search"]').first(); await input.fill(suffix); await input.press('Enter'); };
    const noOverflow = () => page.evaluate(() => ({
      page: document.documentElement.scrollWidth <= window.innerWidth,
      cards: [...document.querySelectorAll<HTMLElement>('article')].filter((element) => element.scrollWidth > element.clientWidth + 1).length,
    }));

    await page.goto('/');
    await search();
    await expect(resultCard(page, titles.get('kg')!)).toHaveCount(1);
    for (const item of CASES) await expect(priceOf(item.key), item.key).toHaveText(item.ru);

    // one line: no separate pack line, the quantity appears once, no «за»
    for (const key of ['curd', 'juice', 'flour', 'apricot']) {
      const text = (await resultCard(page, titles.get(key)!).innerText()).replace(/\s+/gu, ' ');
      expect(text.match(/(?:800|250|1000|200) (?:г|мл)/gu) ?? [], key).toHaveLength(1);
      expect(text, key).not.toMatch(/ за /u);
    }
    // the amount never breaks and the slash stays with its unit (a non-breaking space)
    const raw = await priceOf('curd').textContent();
    expect(raw).toContain('/ 800 г');

    // the Offer page: the same line, large amount, no pack line or size note
    await openOffer(resultCard(page, titles.get('curd')!), titles.get('curd')!);
    const offerPrice = page.locator('.pr-lg').locator('xpath=..');
    await expect(offerPrice).toHaveText('4 000 ₸ / 800 г');
    await expect(page.getByText('Размер упаковки не указан')).toHaveCount(0);
    await page.goBack();
    await openOffer(resultCard(page, titles.get('nopack')!), titles.get('nopack')!);
    await expect(page.locator('.pr-lg').locator('xpath=..')).toHaveText('800 ₸ / упак.');
    await expect(page.getByText('Размер упаковки не указан')).toHaveCount(0);
    await page.goBack();

    // narrow screen and enlarged text: nothing clipped, no sideways scroll
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    expect(await noOverflow()).toEqual({ page: true, cards: 0 });
    await page.setViewportSize({ width: 390, height: 844 });

    // Kazakh
    await page.context().addCookies([{ name: 'kaida_locale', value: 'kk', url: page.url() }]);
    await page.goto('/');
    await search();
    await expect(resultCard(page, titles.get('kg')!)).toHaveCount(1);
    for (const item of CASES) await expect(priceOf(item.key), `kk ${item.key}`).toHaveText(item.kk);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    expect(await noOverflow()).toEqual({ page: true, cards: 0 });
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
    await connection.pool.end();
  }
});
