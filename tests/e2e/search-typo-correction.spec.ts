import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { testDatabaseUrl } from '../integration/database';
import { setLocaleCookie } from './buyer-helpers';

// search-typo-suggestions (docs/slices/search-typo-suggestions, contract rev 3): the original search first; a mistyped query that
// found nothing shows the Offers of its confident correction under two plain text lines; the second one is a real link that
// turns on «search as typed» — kept through reload, Back and the «Поиск» tab. The spec owns its Offers (letters-only marker per
// execution, only these rows are removed). The words «молоко», «малина» come from the Production KB / the Offer titles.

async function search(page: Page, query: string) {
  const input = page.getByRole('search').locator('input[type="search"]').first();
  await input.fill(query);
  await input.press('Enter');
}

test('a mistyped query shows the corrected results with two text lines; «search as typed» survives reload, Back and the tab; D0 counts one event', async ({ page }, testInfo) => {
  // the two projects run in parallel: each one searches its own mistyped spelling, so the D0 rows never mix
  const typo = testInfo.project.name === 'mobile' ? 'малако' : 'малоко';
  const marker = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const connection = createDatabase(testDatabaseUrl());
  const offerIds: string[] = [];
  const insert = async (title: string) => {
    const id = randomUUID();
    offerIds.push(id);
    await connection.pool.query(
      `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $1, '650.00', 'KZT', 'liter', 'active', now())`,
      [id, seedIds.seller, seedIds.location, title, offerTitleSearchText(title)],
    );
    return title;
  };
  const events = async () => (await connection.pool.query("SELECT * FROM search_events WHERE query_normalized = $1 ORDER BY occurred_at", [typo])).rows;
  try {
    const milk = await insert(`Молоко фермерское ${marker}`);
    await insert(`Малина свежая ${marker}`);
    const before = (await events()).length;

    await page.goto('/');
    await search(page, typo);
    // two compact text lines above the results: the corrected query in bold, then the link to the original
    const status = page.getByRole('status').filter({ hasText: 'Показаны результаты по запросу' });
    await expect(status).toBeVisible();
    await expect(status.locator('strong')).toHaveText('молоко');
    const instead = page.getByRole('link', { name: `Искать вместо этого «${typo}»` });
    await expect(instead).toBeVisible();
    await expect(instead).toHaveAttribute('href', `/?${new URLSearchParams({ q: typo, typed: '1' })}`);
    await expect(page.getByRole('article').filter({ hasText: milk })).toHaveCount(1);
    // the original text stays in the field and in the address; the corrected one is never written there
    await expect(page.getByRole('search').locator('input[type="search"]').first()).toHaveValue(typo);
    expect(new URL(page.url()).searchParams.get('q')).toBe(typo);
    expect(new URL(page.url()).searchParams.get('typed')).toBeNull();
    // no panel, no button: the lines are plain text and a link
    await expect(status.getByRole('button')).toHaveCount(0);
    // one event for this deliberate search: the original outcome and the corrected fields
    await expect.poll(async () => (await events()).length).toBe(before + 1);
    const event = (await events()).at(-1)!;
    expect(event).toMatchObject({ entry: 'submit', resolution: 'unresolved', result_count: 0, resolved_product_id: null, corrected_query_normalized: 'молоко' });
    expect(event.corrected_result_count).toBeGreaterThanOrEqual(1);

    // «search as typed»: the ordinary zero state, no correction lines, no new event
    await instead.click();
    await expect(page).toHaveURL(/typed=1/);
    await expect(page.getByRole('status').filter({ hasText: `Ничего не найдено по запросу «${typo}»` })).toBeVisible();
    await expect(page.getByText('Показаны результаты по запросу')).toHaveCount(0);
    await expect(page.getByRole('article')).toHaveCount(0);
    expect((await events()).length).toBe(before + 1);
    // reload keeps the choice
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: `Ничего не найдено по запросу «${typo}»` })).toBeVisible();
    await expect(page.getByText('Показаны результаты по запросу')).toHaveCount(0);
    // the «Поиск» tab after another tab keeps it too (the last Search of this tab, version 4)
    await page.goto('/more');
    await page.getByRole('navigation').getByRole('link', { name: 'Поиск' }).click();
    await expect(page).toHaveURL(/typed=1/);
    await expect(page.getByRole('status').filter({ hasText: `Ничего не найдено по запросу «${typo}»` })).toBeVisible();
    // Back from the typed state returns to the corrected results
    await page.goBack();
    await expect(page).toHaveURL(/\/more/);
    await page.goBack();
    await expect(page).toHaveURL(/typed=1/);
    await page.goBack();
    await expect(page).toHaveURL(/\/\?q=[^&]*$/);
    await expect(page.getByText('Показаны результаты по запросу')).toBeVisible();
    // a new deliberate search with the same text switches the correction on again
    await search(page, typo);
    await expect(page.getByText('Показаны результаты по запросу')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('typed')).toBeNull();
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE id = ANY($1)', [offerIds]);
    await connection.pool.end();
  }
});

test('«машина» is left alone; a query that returns Offers is not corrected; the API flag is optional and validated', async ({ page, request }) => {
  const marker = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const connection = createDatabase(testDatabaseUrl());
  const offerIds: string[] = [];
  try {
    for (const title of [`Малина свежая ${marker}`, `Молоко фермерское ${marker}`]) {
      const id = randomUUID();
      offerIds.push(id);
      await connection.pool.query(
        `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $1, '650.00', 'KZT', 'kg', 'active', now())`,
        [id, seedIds.seller, seedIds.location, title, offerTitleSearchText(title)],
      );
    }
    await page.goto('/');
    await search(page, 'машина');
    await expect(page.getByRole('status').filter({ hasText: 'Ничего не найдено по запросу «машина»' })).toBeVisible();
    await expect(page.getByText('Показаны результаты по запросу')).toHaveCount(0);
    await expect(page.getByRole('article')).toHaveCount(0);

    await search(page, 'молоко');
    await expect(page.getByRole('article').filter({ hasText: marker }).first()).toBeVisible();
    await expect(page.getByText('Показаны результаты по запросу')).toHaveCount(0);

    // API: without the flag the answer is the original one; with it the correction is added; a bad value is refused
    const plain = await (await request.get('/api/search?q=' + encodeURIComponent('малако'))).json();
    expect(plain.offers).toEqual([]);
    expect(plain.correction).toBeUndefined();
    const corrected = await (await request.get('/api/search?q=' + encodeURIComponent('малако') + '&correct=1')).json();
    expect(corrected.query).toBe('малако');
    expect(corrected.correction).toEqual({ from: 'малако', to: 'молоко' });
    expect(corrected.offers.length).toBeGreaterThanOrEqual(1);
    expect((await request.get('/api/search?q=' + encodeURIComponent('малако') + '&correct=2')).status()).toBe(400);
    const machine = await (await request.get('/api/search?q=' + encodeURIComponent('машина') + '&correct=1')).json();
    expect(machine.offers).toEqual([]);
    expect(machine.correction).toBeUndefined();

    // the same query gives the same correction and the same order in both interface languages
    const ru = await (await request.get('/api/search?q=' + encodeURIComponent('малако') + '&correct=1&locale=ru')).json();
    const kk = await (await request.get('/api/search?q=' + encodeURIComponent('малако') + '&correct=1&locale=kk')).json();
    expect(kk.correction).toEqual(ru.correction);
    expect(kk.offers.map((offer: { id: string }) => offer.id)).toEqual(ru.offers.map((offer: { id: string }) => offer.id));
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE id = ANY($1)', [offerIds]);
    await connection.pool.end();
  }
});

test('Kazakh interface and narrow, large text: the same correction, two lines that wrap without clipping', async ({ page }) => {
  const marker = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const connection = createDatabase(testDatabaseUrl());
  const id = randomUUID();
  try {
    const title = `Молоко фермерское ${marker}`;
    await connection.pool.query(
      `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $1, '650.00', 'KZT', 'liter', 'active', now())`,
      [id, seedIds.seller, seedIds.location, title, offerTitleSearchText(title)],
    );
    await setLocaleCookie(page.context(), 'kk');
    await page.goto('/');
    await search(page, 'малако');
    await expect(page.getByText('сұрауы бойынша нәтижелер көрсетілді')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Оның орнына «малако» деп іздеу' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    const fits = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth <= window.innerWidth,
      link: (() => { const link = [...document.querySelectorAll<HTMLAnchorElement>('main a')].find((anchor) => anchor.href.includes('typed=1')); return link ? link.scrollWidth <= link.clientWidth + 1 : false; })(),
    }));
    expect(fits).toEqual({ page: true, link: true });
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE id = $1', [id]);
    await connection.pool.end();
  }
});
