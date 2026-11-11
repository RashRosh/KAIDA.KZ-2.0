import { expect, test } from '@playwright/test';

// D6 · B02 source parity: Search Home in a fresh tab — the full KAIDA wordmark in the header, the title «Что ищете?»,
// the field at the top, the «Популярные запросы» chips; catalog suggestions as rows; the empty-query error. 360 px at 2x
// for the PO's acceptance (docs/slices/design-search-home). Behaviour (no feed, no request, 6C) stays in
// search-home-last-state.spec.ts.

test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

test('B02.ST01: the Search Home in B02 presentation — wordmark, title, field at the top, five chips', async ({ page }, info) => {
  await page.goto('/');
  const wordmark = page.getByRole('img', { name: 'KAIDA' });
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveCSS('fill', 'rgb(153, 0, 204)');
  expect(Number(await wordmark.evaluate((el) => el.getBoundingClientRect().height))).toBeCloseTo(28, 0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Что ищете?');
  await expect(page.getByText('Популярные запросы')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Популярные запросы' }).getByRole('button')).toHaveText(['Баранина', 'Говядина', 'Мёд', 'Картофель', 'Кумыс']);
  // The arrow appears only with text.
  await expect(page.getByRole('button', { name: 'Искать', exact: true })).toHaveCount(0);
  const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
  expect(Number(await field.evaluate((el) => el.getBoundingClientRect().top))).toBeLessThan(250);
  const minTouch = await page.locator('.chip').evaluateAll((els) => Math.min(...els.map((el) => el.getBoundingClientRect().height)));
  expect(minTouch).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('B02-ST01-home-360.png'), fullPage: false });
  await info.attach('B02-ST01-home-360', { path: info.outputPath('B02-ST01-home-360.png'), contentType: 'image/png' });
});

test('B02.ST02: typing shows catalog suggestions as rows with the typed part in bold, and the arrow appears', async ({ page }, info) => {
  await page.goto('/');
  const field = page.getByRole('searchbox', { name: 'Какой товар ищете?' });
  await field.fill('бара');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  await expect(list.getByRole('option').first()).toContainText('Баран');
  await expect(list.getByRole('option').first().locator('b')).toHaveText('Бара');
  await expect(page.getByRole('button', { name: 'Искать', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('B02-ST02-suggest-360.png'), fullPage: false });
  await info.attach('B02-ST02-suggest-360', { path: info.outputPath('B02-ST02-suggest-360.png'), contentType: 'image/png' });
});

test('B02.ST05: an empty submit shows the validation in the field error style and starts no Search', async ({ page }, info) => {
  let searchRequests = 0;
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/api/search') searchRequests += 1; });
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Какой товар ищете?' }).press('Enter');
  await expect(page.locator('#search-validation')).toHaveText('Введите название товара.');
  await expect(page.getByRole('searchbox', { name: 'Какой товар ищете?' })).toHaveAttribute('aria-invalid', 'true');
  expect(searchRequests).toBe(0);
  await page.screenshot({ path: info.outputPath('B02-ST05-error-360.png'), fullPage: false });
  await info.attach('B02-ST05-error-360', { path: info.outputPath('B02-ST05-error-360.png'), contentType: 'image/png' });
});
