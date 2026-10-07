import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedIds } from '../../src/db/seed';
import { offerTitleSearchText, queryWords, titleMatchesQuery } from '../../src/modules/offers/title/offer-title';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { getWordFormDictionary } from '../../src/modules/search/word-forms/word-forms';
import { connectTestDatabase } from './database';

// search-word-forms (docs/slices/search-word-forms): reviewed grammatical word forms, locale-independent, every word required.
// Fixtures: the seed Offers «Баранина» / «Говядина» (linked to Products) plus free-title cards and one catalog Product «Груша».

const kbFile = (name: string) => readFileSync(`src/modules/catalog/kb-package/v1/${name}`, 'utf8').split('\n').slice(1).filter(Boolean).map((line) => line.split(','));

describe('Search word forms (search-word-forms)', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  const titles = [
    'Копченые груши', 'Грушевый сок', 'Огурцы свежие', 'Зеленый чай', 'Макаронные изделия', 'Макароны рожки', 'Говяжья вырезка',
    'Зелень свежая', 'Печенье овсяное', 'Мука в/с 2 кг', 'Яйца С1 10 шт', 'Сыр 200г', 'Coca-Cola 0,5л', 'Қымыз кумыс', 'Груши на меду',
    'Куриные яйца', 'Рис длиннозерный', 'Мука рисовая', 'Перцы болгарские', 'Баранина на кости', 'Мясо барана домашнее', 'Колбаса вареная',
    // irregular forms (stem changes, fleeting vowels, collective plurals)
    'Курица копченая', 'Куры гриль', 'Яблоко зеленое', 'Яблок мешок', 'Яйцо куриное', 'Морковь свежая', 'Моркови пучок', 'Ребро говяжье', 'Муки 1 кг', 'Тунец консервированный', 'Перец болгарский',
  ];
  const offerIds = new Map(titles.map((title) => [title, randomUUID()]));
  const pearProduct = randomUUID();
  const idOf = (title: string) => offerIds.get(title)!;
  const ids = (response: { offers: { id: string }[] }) => response.offers.map((offer) => offer.id);
  const search = (query: string, options: Parameters<typeof searchOffers>[2] = {}) => searchOffers(query, connection.db, options);

  beforeAll(async () => {
    connection = await connectTestDatabase();
    await connection.pool.query('INSERT INTO products (id,name) VALUES ($1,$2)', [pearProduct, 'Груша']);
    for (const [title, id] of offerIds) await insertFree(id, title);
  });
  afterAll(async () => {
    await connection?.pool.query('DELETE FROM offers WHERE id = ANY($1)', [[...offerIds.values()]]);
    await connection?.pool.query('DELETE FROM products WHERE id = $1', [pearProduct]);
    await connection?.pool.end();
  });

  async function insertFree(id: string, title: string) {
    await connection.pool.query(
      `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $1, '5000.00', 'KZT', 'kg', 'active', now())`,
      [id, seedIds.seller, seedIds.location, title, offerTitleSearchText(title)],
    );
  }

  it('finds the free-title card by another form of a Product word, and still resolves the Product', async () => {
    const response = await search('груша');
    expect(response.resolvedProduct).toEqual({ id: pearProduct, name: 'Груша' });
    expect(ids(response)).toEqual(expect.arrayContaining([idOf('Копченые груши'), idOf('Груши на меду')]));
    expect(ids(response)).not.toContain(idOf('Грушевый сок'));
  });

  it('finds irregular and plural forms both ways', async () => {
    expect(ids(await search('огурец'))).toContain(idOf('Огурцы свежие'));
    expect(ids(await search('огурцы'))).toContain(idOf('Огурцы свежие'));
    expect(ids(await search('перец'))).toContain(idOf('Перцы болгарские'));
    expect(ids(await search('яйцо'))).toContain(idOf('Яйца С1 10 шт'));
  });

  it('finds irregular forms in both directions', async () => {
    const pairs: [string, string][] = [
      ['огурец', 'Огурцы свежие'], ['огурцов', 'Огурцы свежие'], ['перцы', 'Перец болгарский'], ['перец', 'Перцы болгарские'], ['перца', 'Перец болгарский'],
      ['куры', 'Курица копченая'], ['курица', 'Куры гриль'], ['яблок', 'Яблоко зеленое'], ['яблоко', 'Яблок мешок'], ['яиц', 'Яйцо куриное'], ['яйцо', 'Яйца С1 10 шт'],
      ['моркови', 'Морковь свежая'], ['морковь', 'Моркови пучок'], ['ребра', 'Ребро говяжье'], ['ребро', 'Ребро говяжье'], ['муку', 'Муки 1 кг'], ['мука', 'Муки 1 кг'], ['тунца', 'Тунец консервированный'], ['тунец', 'Тунец консервированный'],
    ];
    for (const [query, title] of pairs) expect(ids(await search(query)), query + ' -> ' + title).toContain(idOf(title));
  });

  it('multiword queries mix prefix, exact and form evidence, and every word stays required', async () => {
    const fresh = idOf('Огурцы свежие');
    // form + prefix, form + exact, exact + prefix, prefix + prefix, form + form
    for (const query of ['огурец свеж', 'огурец свежие', 'огурцы свеж', 'огур свеж', 'огурец свежий']) expect(ids(await search(query)), query).toContain(fresh);
    expect(ids(await search('огурец свежий'))).toEqual([fresh]);
    // a missing or foreign word removes the card, whichever evidence the other words have
    for (const query of ['огурец молоко', 'огурец свеж молоко', 'огурцы сыр', 'огурец свежие зеленый', 'огур свеж 55']) expect(ids(await search(query)), query).not.toContain(fresh);
    // three words: form + prefix + exact
    expect(ids(await search('груша мед на'))).toEqual([idOf('Груши на меду')]);
    expect(ids(await search('груша мед на кости'))).toEqual([]);
    expect(ids(await search('перец болг'))).toEqual(expect.arrayContaining([idOf('Перцы болгарские'), idOf('Перец болгарский')]));
    expect(ids(await search('перцы болгарский'))).toEqual(expect.arrayContaining([idOf('Перец болгарский')]));
  });

  it('does not merge different words (harmful merges stay apart)', async () => {
    expect(ids(await search('зелень'))).toEqual([idOf('Зелень свежая')]);
    // «печень» is a plain prefix of «печенье»: that match exists today and stays; the dictionary adds nothing to it
    expect(ids(await search('печень'))).toEqual([idOf('Печенье овсяное')]);
    expect(ids(await search('печенье'))).toEqual([idOf('Печенье овсяное')]);
    expect(ids(await search('варенье'))).not.toContain(idOf('Колбаса вареная'));
    expect(ids(await search('мясо'))).not.toContain(idOf('Мука в/с 2 кг'));
    // «рис» is a plain prefix of «рисовая» (today's rule); the dictionary adds nothing beyond the prefix matches
    expect((await search('рис')).offers).toHaveLength(2);
    expect(ids(await search('рис'))).toEqual(expect.arrayContaining([idOf('Рис длиннозерный'), idOf('Мука рисовая')]));
    expect(ids(await search('мука'))).not.toContain(idOf('Макароны рожки'));
  });

  it('adds nothing through the excluded related pairs and keeps every result that exists today', async () => {
    // «говядина»: the Product-linked seed Offer stays; the unlinked «Говяжья вырезка» is not added through говядина~говяжий
    const beef = ids(await search('говядина'));
    expect(beef).toContain(seedIds.beefOffer);
    expect(beef).not.toContain(idOf('Говяжья вырезка'));
    // «макароны»: the prefix match stays; the unlinked «Макаронные изделия» is not added through макароны~макаронный
    const pasta = ids(await search('макароны'));
    expect(pasta).toContain(idOf('Макароны рожки'));
    expect(pasta).not.toContain(idOf('Макаронные изделия'));
    expect(ids(await search('макаронные'))).toContain(idOf('Макаронные изделия'));
    // «курица» / «куриные»: no pair, the plain prefix rule only
    expect(ids(await search('курица'))).not.toContain(idOf('Куриные яйца'));
    expect(ids(await search('куриные'))).toContain(idOf('Куриные яйца'));
    // the Product link and the exact resolver keep working
    expect(ids(await search('баранина'))).toEqual(expect.arrayContaining([seedIds.lambOffer, idOf('Баранина на кости')]));
    expect((await search('баранина')).resolvedProduct).toEqual({ id: seedIds.lambProduct, name: 'Баранина' });
  });

  it('requires every query word; a word outside the dictionary matches by prefix only', async () => {
    expect(ids(await search('груши на'))).toEqual([idOf('Груши на меду')]);
    expect(ids(await search('груша копченые'))).toEqual([idOf('Копченые груши')]);
    expect(ids(await search('груша коп'))).toEqual([idOf('Копченые груши')]);
    expect(ids(await search('груша сок'))).toEqual([]);
    expect(ids(await search('на'))).toEqual(expect.arrayContaining([idOf('Баранина на кости'), idOf('Груши на меду')]));
    expect(ids(await search('на'))).not.toContain(idOf('Копченые груши'));
    expect(ids(await search('колбас'))).toEqual([idOf('Колбаса вареная')]);
    expect(ids(await search('колбаса'))).toEqual([idOf('Колбаса вареная')]);
    expect(ids(await search('cheeses'))).toEqual([]);
  });

  it('puts a form match between whole-word and prefix-only matches in the relevance order', async () => {
    const response = await search('груши');
    // «Копченые груши» and «Груши на меду» are whole words (level 2); a form-only card is level 3
    const form = randomUUID();
    await insertFree(form, 'Груша спелая');
    try {
      const withForm = ids(await search('груши'));
      expect(withForm.indexOf(form)).toBeGreaterThan(withForm.indexOf(idOf('Копченые груши')));
      expect(withForm.indexOf(form)).toBeGreaterThan(withForm.indexOf(idOf('Груши на меду')));
      expect(withForm).toContain(form);
    } finally {
      await connection.pool.query('DELETE FROM offers WHERE id = $1', [form]);
    }
    expect(ids(response)).toContain(idOf('Копченые груши'));
  });

  it('is consistent without any backfill: a new card and a changed title are found at once', async () => {
    const fresh = randomUUID();
    await insertFree(fresh, 'Груши сушеные');
    try {
      expect(ids(await search('груша'))).toContain(fresh);
      await connection.pool.query('UPDATE offers SET title = $2, title_search = $3 WHERE id = $1', [fresh, 'Яблоки сушеные', offerTitleSearchText('Яблоки сушеные')]);
      expect(ids(await search('груша'))).not.toContain(fresh);
      expect(ids(await search('яблоко'))).toContain(fresh);
    } finally {
      await connection.pool.query('DELETE FROM offers WHERE id = $1', [fresh]);
    }
  });

  describe('identical results in the RU and KK interfaces', () => {
    const dictionary = getWordFormDictionary();
    const forms = [...new Set(kbFile('aliases.csv').flatMap((row) => row[2]?.split(' ') ?? []))].filter((word) => dictionary.formsOf(word.toLowerCase()) !== null);
    const queries = [
      ...forms.filter((_, index) => index % 3 === 0).slice(0, 110),
      ...kbFile('products.csv').filter((_, index) => index % 12 === 0).map((row) => row[1]!),
      ...kbFile('products.csv').filter((_, index) => index % 14 === 0).map((row) => row[2]!),
      ...titles.map((title) => title.split(' ')[0]!),
      'груша', 'груши на', 'груша копченые', 'огурец свежие', 'на', 'для', 'из', '10', '2', 'cheese', 'cheeses', 'Coca-Cola', 'қымыз', 'сиыр еті', 'алма', 'зелень', 'макароны', 'говядина',
      'мука 2 кг', 'яйцо С1', 'сыр 200', 'Баранина', 'Говядина',
    ].filter((query) => queryWords(query).length > 0);

    it('has at least 200 distinct queries', () => {
      expect(new Set(queries).size).toBeGreaterThanOrEqual(200);
    });

    it('returns the same Offers in the same order for ru, kk and no locale (relevance)', { timeout: 180000 }, async () => {
      for (const query of new Set(queries)) {
        const base = await search(query);
        const ru = await search(query, { locale: 'ru' });
        const kk = await search(query, { locale: 'kk' });
        expect(ids(ru), query).toEqual(ids(base));
        expect(ids(kk), query).toEqual(ids(base));
        expect(kk.resolvedProduct, query).toEqual(base.resolvedProduct);
      }
    });

    it('keeps that identity under the explicit sorts', { timeout: 180000 }, async () => {
      const sample = [...new Set(queries)].filter((_, index) => index % 5 === 0);
      for (const query of sample) {
        for (const order of [{ sort: 'actuality' }, { sort: 'actuality', direction: 'asc' }, { sort: 'price' }, { sort: 'price', direction: 'desc' }] as const) {
          const ru = await search(query, { ...order, locale: 'ru' });
          const kk = await search(query, { ...order, locale: 'kk' });
          expect(ids(kk), `${query} ${JSON.stringify(order)}`).toEqual(ids(ru));
        }
      }
    });

    it('SQL and TypeScript agree: the result set is exactly "every word by prefix or by reviewed form"', { timeout: 180000 }, async () => {
      const rows = await connection.pool.query<{ id: string; title_search: string; product_id: string | null }>('SELECT id, title_search, product_id FROM offers');
      for (const query of new Set(queries)) {
        const words = queryWords(query);
        if (words.length === 0) continue;
        const response = await search(query);
        const resolved = response.resolvedProduct?.id;
        const expected = rows.rows.filter((row) => {
          if (resolved !== undefined && row.product_id === resolved) return true;
          const titleWords = row.title_search.split(' ');
          return words.every((word) => titleMatchesQuery(row.title_search, [word]) || (dictionary.formsOf(word)?.some((form) => titleWords.includes(form)) ?? false));
        });
        // buyer-visible Offers only: every returned id is expected, and every expected Offer of the fixtures is returned
        const returned = new Set(ids(response));
        for (const id of returned) expect(expected.map((row) => row.id), query).toContain(id);
        for (const row of expected) if (([...offerIds.values(), seedIds.lambOffer, seedIds.beefOffer] as string[]).includes(row.id)) expect(returned.has(row.id), `${query} -> ${row.title_search}`).toBe(true);
      }
    });
  });
});
