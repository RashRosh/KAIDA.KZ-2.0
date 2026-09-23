import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { seedIds } from '../../src/db/seed';
import { testDatabaseUrl } from '../integration/database';

const projectFixtures = {
  mobile: {
    productId: '10000000-0000-4000-8000-000000000301',
    offerId: '40000000-0000-4000-8000-000000000301',
    productName: 'S1 lifecycle mobile',
  },
  desktop: {
    productId: '10000000-0000-4000-8000-000000000302',
    offerId: '40000000-0000-4000-8000-000000000302',
    productName: 'S1 lifecycle desktop',
  },
} as const;

test('fresh active is visible; expired and inactive are hidden without lifecycle API/UI', async ({ page }, testInfo) => {
  const fixture = projectFixtures[testInfo.project.name as keyof typeof projectFixtures];
  if (!fixture) throw new Error(`Unexpected Playwright project: ${testInfo.project.name}`);

  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM offers WHERE id = $1', [fixture.offerId]);
    await pool.query('DELETE FROM products WHERE id = $1', [fixture.productId]);
    await pool.query('INSERT INTO products (id, name) VALUES ($1, $2)', [fixture.productId, fixture.productName]);
    await pool.query(
      `INSERT INTO offers (
        id, product_id, seller_id, location_id, price_amount, price_currency, price_unit_code,
        seller_comment, status, last_confirmed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        fixture.offerId,
        fixture.productId,
        seedIds.seller,
        seedIds.location,
        '777.00',
        'KZT',
        'piece',
        'S1 E2E lifecycle fixture',
        'active',
        new Date(),
      ],
    );

    await page.goto('/');
    const input = page.getByLabel('Какой товар ищете?');
    await input.fill(fixture.productName);
    await input.press('Enter');
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText(fixture.productName);

    await pool.query(
      'UPDATE offers SET last_confirmed_at = $1 WHERE id = $2',
      [new Date(Date.now() - 169 * 60 * 60 * 1000), fixture.offerId],
    );
    await input.press('Enter');
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('По вашему запросу ничего не найдено.');

    await pool.query(
      'UPDATE offers SET status = $1, last_confirmed_at = $2 WHERE id = $3',
      ['inactive', new Date(), fixture.offerId],
    );
    await input.press('Enter');
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('По вашему запросу ничего не найдено.');
  } finally {
    await pool.query('DELETE FROM offers WHERE id = $1', [fixture.offerId]);
    await pool.query('DELETE FROM products WHERE id = $1', [fixture.productId]);
    await pool.end();
  }
});
