import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { emptyBrowserState, PLAIN_SEARCH_URL, returningVisitorState } from '../../tests/e2e/browser-state';
import { openOffer, resultCard, search } from '../../tests/e2e/buyer-helpers';
import { fillOfferFields, offerEditor, openNewCard, publishButton } from '../../tests/e2e/offer-editor-helpers';

// R3: adapted R1 manual path (original R1 smoke unchanged) on a clean bootstrap (migrations + Production KB, no seed), through the public interface:
// catalog → Seller (login, point, manual geo fallback, two cards) → Buyer (search, card, photo, route link) → Operator feed.
// Everything it creates exists only in the isolated bootstrap database and photo directory.

const SELLER = '+77000090001';
const OPERATOR = '+77000090002'; // must equal OPERATOR_PHONES of the server under test
const POINT = 'Точка smoke';
const KB_PRODUCT = 'Мёд горный'; // Production KB product (KAIDA-P0697); the seed is not loaded
const FREE_TITLE = 'Домашний сыр smoke';
const MAP_LINK = 'https://www.google.com/maps/place/Almaty/@43.238949,76.889709,16z';
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true };

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

test('the manual Seller → Buyer path works on a clean bootstrap', async ({ page, browser, request, baseURL }) => {
  test.setTimeout(180000);
  {
    await test.step('a first visitor reaches the app', async () => {
      const first = await browser.newContext({ baseURL, storageState: emptyBrowserState, ...mobile });
      const firstPage = await first.newPage();
      expect((await firstPage.goto('/'))?.ok()).toBe(true);
      await expect(firstPage).toHaveURL(/\/(welcome)?(\?.*)?$/);
      await first.close();
    });

    await test.step('catalog works on the empty database: known product, zero offers', async () => {
      const response = await request.get(`/api/search?q=${encodeURIComponent(KB_PRODUCT.toLowerCase())}`);
      expect(response.status()).toBe(200);
      const body = await response.json() as { resolvedProduct: { name: string } | null; offers: unknown[] };
      expect(body.resolvedProduct?.name).toBe(KB_PRODUCT);
      expect(body.offers).toHaveLength(0);
    });

    await test.step('Seller logs in with the test OTP and saves a point with a manual map link', async () => {
      await page.goto('/seller');
      await page.getByRole('link', { name: 'Войти' }).click();
      await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(SELLER));
      const requested = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Получить код' }).click();
      const challenge = await (await requested).json() as { delivery: { code: string } };
      await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(challenge.delivery.code);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(PLAIN_SEARCH_URL);
      const session = (await page.context().cookies()).find((cookie) => cookie.httpOnly);
      expect(session?.secure).toBe(true);
      expect(session?.httpOnly).toBe(true);

      await page.goto('/seller/points');
      await page.getByLabel('Название для покупателей').fill(POINT);
      await page.getByLabel('Тип торговой точки').selectOption('shop');
      await page.getByLabel('Адрес').fill('Алматы, smoke');
      await page.getByRole('button', { name: 'Сохранить точку' }).click();
      await expect(page.getByText('Местоположение не задано', { exact: true }).first()).toBeVisible();

      await page.goto('/seller/points');
      await page.getByRole('button', { name: /^Изменить торговую точку/ }).click();
      await page.getByRole('button', { name: /^Заполнить вручную/ }).click();
      await page.getByLabel('Заполнить вручную', { exact: true }).fill(MAP_LINK);
      await expect(page.getByTestId('manual-geo-preview')).toContainText('43.238949, 76.889709');
      await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Местоположение сохранено.' })).toBeVisible();
    });

    await test.step('Seller publishes a catalog card with a photo and a free-title card without one', async () => {
      const editor = await openNewCard(page);
      const name = editor.getByRole('combobox', { name: 'Название товара' });
      await name.fill('мёд гор');
      await editor.getByRole('option', { name: KB_PRODUCT }).click();
      await expect(name).toHaveValue(KB_PRODUCT);
      await fillOfferFields(page, { price: '9000', unit: 'kg' });
      await editor.locator('input[type="file"]').setInputFiles({
        name: 'smoke.png',
        mimeType: 'image/png',
        buffer: await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 160, b: 40 } } }).png().toBuffer(),
      });
      await expect(editor.getByText('1 из 5')).toBeVisible();
      await expect(editor.getByRole('progressbar')).toHaveCount(0);
      await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
      await expect(page).toHaveURL(/\/seller\/change-sets\//);
      await page.getByRole('button', { name: publishButton }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Опубликовано. Карточка уже видна покупателям' })).toBeVisible();

      await openNewCard(page);
      await fillOfferFields(page, { product: FREE_TITLE, price: '3000', unit: 'kg' });
      await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
      await expect(page).toHaveURL(/\/seller\/change-sets\//);
      await page.getByRole('button', { name: publishButton }).click();
      await expect(page.getByRole('status').filter({ hasText: /Опубликовано/ })).toBeVisible();
    });

    await test.step('Buyer without login finds both cards, sees the photo and gets a route link', async () => {
      const buyer = await browser.newContext({ baseURL, storageState: returningVisitorState, ...mobile });
      const buyerPage = await buyer.newPage();
      await buyerPage.goto('/');
      await search(buyerPage, KB_PRODUCT);
      const card = resultCard(buyerPage, POINT);
      await expect(card).toContainText(KB_PRODUCT);
      await expect(card).toContainText('9');
      const thumb = card.locator('img[src^="/media/photos/"]').first();
      await expect(thumb).toBeVisible();
      const photoUrl = (await thumb.getAttribute('src'))!.replace(/\/thumb$/, '/display');
      const photo = await buyer.request.get(photoUrl);
      expect(photo.status()).toBe(200);
      expect(photo.headers()['content-type']).toBe('image/webp');

      await openOffer(card, KB_PRODUCT);
      const route = buyerPage.getByRole('link', { name: `Маршрут до ${POINT}`, exact: true });
      await expect(route).toHaveAttribute('href', /\/api\/offers\/[0-9a-f-]+\/route$/);
      // Only the construction of the link is verified: the redirect is not followed and no third-party service is called.
      const redirect = await buyer.request.get((await route.getAttribute('href'))!, { maxRedirects: 0 });
      expect(redirect.status()).toBe(302);
      expect(redirect.headers().location).toBe('dgis://2gis.ru/routeSearch/rsType/car/to/76.889709,43.238949');

      await buyerPage.goto('/');
      await search(buyerPage, 'сыр');
      await expect(resultCard(buyerPage, POINT)).toContainText(FREE_TITLE);
      await buyer.close();
    });

    await test.step('the photo is stored in the isolated photo directory', async () => {
      const files = execFileSync('docker', ['exec', 'kaida-deploy-check-app-1', 'find', '/data/photos', '-name', '*.webp'], { encoding: 'utf8' });
      expect(files.trim()).not.toBe('');
    });

    await test.step('Operator sees both new cards in the post-check feed', async () => {
      const operator = await browser.newContext({ baseURL, storageState: returningVisitorState, ...mobile });
      const challenge = await (await operator.request.post('/api/auth/otp/request', { data: { phone: OPERATOR } })).json() as { challenge: { id: string }; delivery: { code: string } };
      expect((await operator.request.post('/api/auth/otp/verify', { data: { challengeId: challenge.challenge.id, code: challenge.delivery.code } })).ok()).toBe(true);
      const operatorPage = await operator.newPage();
      await operatorPage.goto('/operator');
      await operatorPage.getByRole('button', { name: 'Все', exact: true }).click();
      await expect(operatorPage.getByRole('article').filter({ hasText: KB_PRODUCT })).toBeVisible();
      await expect(operatorPage.getByRole('article').filter({ hasText: FREE_TITLE })).toBeVisible();
      await operator.close();
    });

    await test.step('search events written by the smoke are origin=test only', async () => {
      const origins = execFileSync('docker', ['exec', 'kaida-deploy-check-postgres-1', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT DISTINCT origin FROM search_events"'], { encoding: 'utf8' });
      expect(origins.trim()).toBe('test');
    });
  }
});
