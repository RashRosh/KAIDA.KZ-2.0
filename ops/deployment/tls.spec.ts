import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('TLS cookies and the photo body limit survive the Caddy proxy', async ({ request }) => {
  test.setTimeout(120000);
  const challenge = await (await request.post('/api/auth/otp/request', { data: { phone: '+77000090003' } })).json();
  const verified = await request.post('/api/auth/otp/verify', { data: { challengeId: challenge.challenge.id, code: challenge.delivery.code } });
  expect(verified.status()).toBe(200);
  expect(verified.headers()['set-cookie']).toMatch(/;\s*Secure/i);
  expect(verified.headers()['set-cookie']).toMatch(/;\s*HttpOnly/i);

  // An actual decodable PNG close to the product limit, not a forged Content-Length.
  const large = await sharp(randomBytes(2200 * 2200 * 3), { raw: { width: 2200, height: 2200, channels: 3 } }).png().toBuffer();
  expect(large.length).toBeGreaterThan(13 * 1024 * 1024);
  expect(large.length).toBeLessThan(15 * 1024 * 1024);
  const accepted = await request.post('/api/seller/photos', { multipart: { file: { name: 'large.png', mimeType: 'image/png', buffer: large } } });
  expect(accepted.status()).toBe(201);
  const rejected = await request.post('/api/seller/photos', { multipart: { file: { name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(15 * 1024 * 1024 + 1) } } });
  expect(rejected.status()).toBe(413);
  expect((await rejected.json()).error.code).toBe('PHOTO_TOO_LARGE');
});

test('a Secure session cannot be established on ordinary HTTP', async ({ browser }) => {
  test.setTimeout(60000);
  // Chromium exempts localhost from some Secure-cookie restrictions. Use a non-trustworthy
  // test hostname resolved directly to loopback; no DNS or LAN/public publication is involved.
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`http://kaida.test:${process.env.KAIDA_HTTP_TEST_PORT ?? '3400'}/`);
    const result = await page.evaluate(async () => {
      const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const challenge = await (await post('/api/auth/otp/request', { phone: '+77000090004' })).json();
      const verified = await post('/api/auth/otp/verify', { challengeId: challenge.challenge.id, code: challenge.delivery.code });
      const me = await (await fetch('/api/auth/me')).json();
      return { status: verified.status, me };
    });
    expect(result.status).toBe(200);
    expect((await context.cookies()).some((cookie) => cookie.name === 'kaida_session')).toBe(false);
    expect(result.me.user).toBeNull();
  } finally {
    await context.close();
  }
});
