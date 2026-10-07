import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { offers } from '../../src/modules/offers/db/offers.table';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { titleWordsMatch } from '../../src/modules/search/infrastructure/search.repository';
import { getWordFormDictionary } from '../../src/modules/search/word-forms/word-forms';
import { connectTestDatabase } from './database';

// search-word-forms §3.6: the SQL guard (substring test of the first three letters of a form before the word-array test) is a
// lossless prefilter. For EVERY group of the dictionary, with every form present as a bare title and inside a longer title,
// the real condition returns exactly what the unguarded array test (plus the prefix rule) returns.

const groups = new Map<string, string[]>();
for (const line of readFileSync('src/modules/search/word-forms/word-forms.v1.csv', 'utf8').split(/\r?\n/u).slice(1).filter(Boolean)) {
  const [group, form] = line.split(',') as [string, string];
  groups.set(group, [...(groups.get(group) ?? []), form]);
}

describe('word-form SQL guard is lossless (search-word-forms 3.6)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const sellerId = randomUUID();
  const locationId = randomUUID();
  const dictionary = getWordFormDictionary();

  async function search(word: string): Promise<string[]> {
    const rows = await connection.db.select({ title: offers.titleSearch }).from(offers)
      .where(and(eq(offers.sellerId, sellerId), titleWordsMatch([word])));
    return rows.map((row) => row.title).sort();
  }

  beforeAll(async () => {
    connection = await connectTestDatabase();
    await connection.pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, 'Prefilter seller']);
    await connection.pool.query("INSERT INTO locations (id,seller_id,name,address_text,type) VALUES ($1,$2,'Prefilter point','Prefilter address','shop')", [locationId, sellerId]);
    const titles = [...groups.values()].flat().flatMap((form) => [form, `абв ${form} эюя`]);
    for (let i = 0; i < titles.length; i += 4000) {
      await connection.pool.query(
        `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
         SELECT gen_random_uuid(), NULL, $1, $2, t, t, gen_random_uuid(), '1.00', 'KZT', 'kg', 'active', now() FROM unnest($3::text[]) t`,
        [sellerId, locationId, titles.slice(i, i + 4000).map((title) => offerTitleSearchText(title))],
      );
    }
  }, 120000);
  afterAll(async () => {
    await connection?.pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
    await connection?.pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
    await connection?.pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
    await connection?.pool.end();
  });

  it('returns for every form of every group exactly the unguarded result (prefix or any form of the group)', { timeout: 600000 }, async () => {
    const all = (await connection.pool.query<{ title_search: string }>('SELECT title_search FROM offers WHERE seller_id = $1', [sellerId])).rows.map((row) => row.title_search);
    let checked = 0;
    for (const forms of groups.values()) {
      // the first form, the last form, and an irregular-looking middle one: all queries of a group share one cluster set
      for (const word of new Set([forms[0]!, forms[forms.length - 1]!, forms[Math.floor(forms.length / 2)]!])) {
        const expected = all.filter((title) => {
          const words = title.split(' ');
          return words.some((titleWord) => titleWord.startsWith(word)) || words.some((titleWord) => forms.includes(titleWord));
        }).sort();
        expect(await search(word), word).toEqual(expected);
        // every form of the group is a hit as a bare title and inside a longer title
        for (const form of forms) expect(expected, `${word} -> ${form}`).toEqual(expect.arrayContaining([form, `абв ${form} эюя`]));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(groups.size);
    expect(dictionary.groupCount).toBe(groups.size);
  });
});
