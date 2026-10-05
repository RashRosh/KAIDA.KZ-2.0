import { expect, test } from '@playwright/test';
import { search } from './buyer-helpers';

// S15B-2: a known catalog Product without Offers says so; an unknown query keeps the ordinary zero-result text.
// «Тунец» is a Production KB v1 Product (installed by the E2E global setup) that no E2E flow publishes Offers for.

test('a known Product without Offers shows «Сейчас предложений нет.»; an unknown query keeps the old text', async ({ page }) => {
  await page.goto('/');
  await search(page, 'Тунец');
  await expect(page.getByRole('status')).toHaveText('Сейчас предложений нет.');
  await expect(page.getByRole('article')).toHaveCount(0);

  await search(page, 'единорог');
  await expect(page.getByRole('status')).toHaveText('По вашему запросу ничего не найдено.');
});

test('a known Product with Offers shows the results as before', async ({ page }) => {
  await page.goto('/');
  await search(page, 'Баранина');
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page.getByText('Сейчас предложений нет.')).toHaveCount(0);
});
