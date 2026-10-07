import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { returningVisitorState } from '../../tests/e2e/browser-state';
import { resultCard, search } from '../../tests/e2e/buyer-helpers';

// R2 (docs/slices/backup-restore §7.7): READ-ONLY checks of an application started on a RESTORED installation. It creates nothing
// except a login session (a test OTP login of the seller). Inputs from the environment:
//   R2_SELLER_PHONE          the seller whose cards must be there
//   R2_EXPECT_OFFERS         how many Offers that seller had in the source
//   R2_SOURCE_PHOTOS         the photo directory of the SOURCE: restored images must be byte-identical to these files
//   R2_SOURCE_SESSION_COOKIE optional: a session cookie value issued by the SOURCE (checks that old sessions survive a restore
//                            with a different OTP secret — confirmed by reading the code, §2 of the contract)
const SELLER = process.env.R2_SELLER_PHONE ?? '+77000090001';
const EXPECT_OFFERS = Number(process.env.R2_EXPECT_OFFERS ?? '2');
const SOURCE_PHOTOS = process.env.R2_SOURCE_PHOTOS;
const SOURCE_SESSION = process.env.R2_SOURCE_SESSION_COOKIE;
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// the card name a buyer searches for is the Product name of the seller's Offer (for a free-title card, its title)
type SellerOffer = { id: string; product: { name: string }; buyerVisible: boolean; photos?: { id: string }[] };

test('the restored installation: login, seller cards, buyer search and image delivery', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  expect(SOURCE_PHOTOS, 'R2_SOURCE_PHOTOS is required').toBeTruthy();

  const seller = await browser.newContext({ baseURL, storageState: returningVisitorState, ...mobile });
  let offers: SellerOffer[] = [];

  await test.step('the seller logs in with a NEW test code and sees all cards', async () => {
    const challenge = await (await seller.request.post('/api/auth/otp/request', { data: { phone: SELLER } })).json() as { challenge: { id: string }; delivery: { code: string } };
    expect((await seller.request.post('/api/auth/otp/verify', { data: { challengeId: challenge.challenge.id, code: challenge.delivery.code } })).ok()).toBe(true);
    const response = await seller.request.get('/api/seller/offers');
    expect(response.status()).toBe(200);
    offers = (await response.json() as { offers: SellerOffer[] }).offers;
    expect(offers).toHaveLength(EXPECT_OFFERS);
  });

  await test.step('a session issued by the source is still accepted (it is stored as a plain hash, not tied to the OTP secret)', async () => {
    test.skip(!SOURCE_SESSION, 'R2_SOURCE_SESSION_COOKIE not provided');
    const old = await browser.newContext({ baseURL, storageState: returningVisitorState, ...mobile });
    await old.addCookies([{ name: 'kaida_session', value: SOURCE_SESSION!, url: baseURL! }]);
    expect((await old.request.get('/api/seller/offers')).status()).toBe(200);
    await old.close();
  });

  await test.step('every photo is delivered as image/webp, byte-identical to the source file', async () => {
    const photoIds = offers.flatMap((offer) => (offer.photos ?? []).map((photo) => photo.id));
    expect(photoIds.length, 'the source seller has at least one card with a photo').toBeGreaterThan(0);
    for (const id of photoIds) {
      for (const variant of ['display', 'thumb'] as const) {
        const delivered = await seller.request.get(`/media/photos/${id}/${variant}`);
        expect(delivered.status()).toBe(200);
        expect(delivered.headers()['content-type']).toBe('image/webp');
        const original = await readFile(path.join(SOURCE_PHOTOS!, id.slice(0, 2), `${id}.${variant}.webp`));
        expect(Buffer.compare(await delivered.body(), original)).toBe(0);
      }
    }
  });

  await test.step('a buyer without login finds each card; a card with a photo shows its image', async () => {
    const buyer = await browser.newContext({ baseURL, storageState: returningVisitorState, ...mobile });
    const page = await buyer.newPage();
    for (const offer of offers.filter((candidate) => candidate.buyerVisible)) {
      const name = offer.product.name;
      const api = await buyer.request.get(`/api/search?q=${encodeURIComponent(name)}`);
      expect(api.status()).toBe(200);
      expect((await api.json() as { offers: { id: string }[] }).offers.map((found) => found.id)).toContain(offer.id);
      if (!offer.photos?.length) continue;
      await page.goto('/');
      await search(page, name);
      const card = resultCard(page, name).first();
      await expect(card).toBeVisible();
      const thumb = card.locator(`img[src="/media/photos/${offer.photos[0].id}/thumb"]`);
      await expect(thumb).toBeVisible();
      expect(await thumb.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    await buyer.close();
  });

  await seller.close();
});
