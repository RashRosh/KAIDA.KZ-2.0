import { expect, test } from '@playwright/test';
import { seedIds } from '../../src/db/seed';
import { nearbyResponseSchema } from '../../src/modules/discovery/contracts/discovery.contract';

test('Nearby shows and hands off road distance, then labels straight distance after a new position', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  const start = { latitude: 43.2504, longitude: 76.9487 };
  const moved = { latitude: 43.255, longitude: 76.9487 };
  await context.setGeolocation(start);
  await page.setViewportSize({ width: 320, height: 780 });

  const origins: Array<{ latitude: number; longitude: number }> = [];
  await page.route('**/api/discovery/nearby?*', async (route) => {
    const { buyerLocation } = route.request().postDataJSON();
    origins.push(buyerLocation);
    const response = await route.fetch();
    const result = nearbyResponseSchema.parse(await response.json());
    const offers = result.offers.filter(({ id }) => id === seedIds.lambOffer || id === seedIds.beefOffer);
    await route.fulfill({ response, json: buyerLocation.latitude === start.latitude
      ? { distanceBasis: 'road', offers: offers.map((offer) => ({ ...offer, roadDistanceMeters: 4200 })) }
      : { offers: offers.map((offer) => ({ ...offer, distanceMeters: 1800 })) } });
  });

  const note = page.getByText('Расстояния указаны по прямой', { exact: true });
  const lamb = page.getByTestId('nearby-tile').filter({ hasText: 'Баранина' });
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(lamb.getByText('4,2 км', { exact: true })).toBeVisible();
  await expect(page.getByTestId('nearby-tile').getByText('4,2 км', { exact: true })).toHaveCount(2);
  await expect(note).toHaveCount(0);
  await lamb.getByRole('link', { name: 'Баранина' }).click();
  await expect(page.getByTestId('offer-distance')).toHaveText('4,2 км');
  await expect(page.locator(`a[href="/api/offers/${seedIds.lambOffer}/route"]`)).toBeVisible();

  await context.setGeolocation(moved);
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(note).toBeVisible();
  await expect(lamb.getByText('1,8 км', { exact: true })).toBeVisible();
  await lamb.getByRole('link', { name: 'Баранина' }).click();
  await expect(page.getByTestId('offer-distance')).toHaveText('1,8 км · по прямой');
  expect(origins).toEqual([start, moved]);

  await page.reload();
  await expect(page.getByTestId('offer-address')).toBeVisible();
  await expect(page.getByTestId('offer-distance')).toHaveCount(0);
});
