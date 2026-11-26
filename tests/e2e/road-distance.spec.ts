import { expect, test } from '@playwright/test';
import { seedIds } from '../../src/db/seed';
import { nearbyResponseSchema } from '../../src/modules/discovery/contracts/discovery.contract';

test('Nearby distance opens the map and the offer keeps the distance from its tile', async ({ page, context }) => {
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
  const routePath = `/api/offers/${seedIds.lambOffer}/route`;
  let mapDestination: string | undefined;
  await context.route(`**${routePath}`, async route => {
    const redirect = await route.fetch({ maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    mapDestination = redirect.headers().location;
    await route.fulfill({ body: '2GIS destination' });
  });
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(lamb.getByText('4,2 км', { exact: true })).toBeVisible();
  await expect(page.getByTestId('nearby-tile').getByText('4,2 км', { exact: true })).toHaveCount(2);
  await expect(note).toHaveCount(0);
  const [map] = await Promise.all([
    page.waitForEvent('popup'),
    lamb.getByRole('link', { name: /4,2 км/ }).click(),
  ]);
  await expect(map.getByText('2GIS destination')).toBeVisible();
  expect(mapDestination).toMatch(/^https:\/\/2gis\.kz\/almaty\/directions\/points\//);
  await map.close();
  await expect(page).toHaveURL(/\/nearby$/);
  await lamb.getByRole('link', { name: 'Баранина' }).click();
  await expect(page.getByTestId('offer-distance')).toHaveText('4,2 км');
  await expect(page.locator(`a[href="/api/offers/${seedIds.lambOffer}/route"]`)).toBeVisible();

  await context.setGeolocation(moved);
  await page.goto('/nearby');
  await page.getByRole('button', { name: 'Определить местоположение', exact: true }).click();
  await expect(note).toBeVisible();
  await expect(lamb.getByText('1,8 км', { exact: true })).toBeVisible();
  await expect(lamb.getByRole('link', { name: /1,8 км/ })).toHaveAttribute('href', routePath);
  await lamb.getByRole('link', { name: 'Баранина' }).click();
  await expect(page.getByTestId('offer-distance')).toHaveText('1,8 км · по прямой');
  expect(origins).toEqual([start, moved]);

  await page.reload();
  await expect(page.getByTestId('offer-address')).toBeVisible();
  await expect(page.getByTestId('offer-distance')).toHaveCount(0);
});
