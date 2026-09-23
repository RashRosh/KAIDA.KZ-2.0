import { expect, test } from '@playwright/test';

// seller-cabinet-overview: the Pass 3 palette applies app-wide before buyer screens are rebuilt, so existing buyer
// surfaces are checked at the contract widths for clipping and horizontal overflow in both languages.
const widths = [320, 390, 768, 1024, 1440];

test.describe('Pass 3 tokens — buyer surfaces', () => {
  test.skip(({ isMobile }) => isMobile, 'Widths are driven explicitly; one project is enough.');

  for (const locale of ['ru', 'kk'] as const) {
    test(`buyer Search, Nearby and Auth keep layout at every width (${locale})`, async ({ page, context, baseURL }, testInfo) => {
      await context.addCookies([{ name: 'kaida_locale', value: locale, url: baseURL! }]);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });

        await page.goto('/?q=%D0%B1%D0%B0%D1%80%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0');
        await expect(page.getByRole('article').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await testInfo.attach(`search-${locale}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

        await page.goto('/nearby');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await testInfo.attach(`nearby-${locale}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

        await page.goto('/login');
        await expect(page.getByRole('textbox').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await testInfo.attach(`login-${locale}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      }
    });
  }
});
