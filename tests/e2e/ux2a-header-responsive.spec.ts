import { expect, test, type Page } from '@playwright/test';

// buyer-screens-mockup (revises UX2A): the site header leaves buyer routes; the results screen keeps its own search
// bar. It stays usable on a tablet and a narrow phone: one square Search submit of at least 44 px, no overlaps, no
// horizontal scroll, and a new search runs from it.

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

async function expectResultsBar(page: Page) {
  const search = page.getByRole('search', { name: 'Поиск предложений' });
  const input = search.getByRole('searchbox', { name: 'Какой товар ищете?' });
  // stage #5: the pin toggle is replaced by the «Фильтры» button (B07) next to the search field.
  const filters = search.getByRole('button', { name: 'Фильтры', exact: true });

  await expect(input).toBeVisible();
  await expect(filters).toBeVisible();
  // B01 has no search button: the query runs from the keyboard (Enter / the phone's search key).
  await expect(search.getByRole('button', { name: 'Искать', exact: true })).toHaveCount(0);
  const filtersBox = (await filters.boundingBox())!;
  expect(filtersBox.height).toBeGreaterThanOrEqual(44);
  expect(overlaps((await input.boundingBox())!, filtersBox)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  return { input };
}

test('UX2A the results search bar stays usable on a tablet and a narrow phone with one square Search submit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Single targeted UX2A proof');

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
  await expect(page.getByRole('article').first()).toBeVisible();
  await expectResultsBar(page);

  await page.setViewportSize({ width: 320, height: 720 });
  const mobile = await expectResultsBar(page);

  await mobile.input.fill('говядина');
  await mobile.input.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('говядина');
  await expect(page.getByRole('article').filter({ hasText: 'Говядина' }).first()).toBeVisible();
});
