import { expect, test, type Page } from '@playwright/test';
import { PLAIN_SEARCH_URL } from './browser-state';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { testDatabaseUrl } from '../integration/database';
import { seedIds } from '../../src/db/seed';
import { expectSignedIn, openOffer, SEED_POINT, signOutInMore } from './buyer-helpers';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000881' : '+77000000891';
}

function anonymousFlowPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000885' : '+77000000895';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM buyer_offer_favourites WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM buyer_interests WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function login(page: Page, phone: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Получить код' }).click();
  const requested = await (await requestResponse).json();
  await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(PLAIN_SEARCH_URL);
  await expectSignedIn(page, phone);
}

// buyer-screens-mockup: «В избранное» is on the offer page (B02), opened from the result card.
async function openSeedOffer(page: Page) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
  const card = page.getByRole('article').filter({ hasText: SEED_POINT });
  await expect(card.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
  await openOffer(card, 'Баранина');
  await expect(page.getByText('Асыл Ет, тестовый продавец', { exact: true })).toBeVisible();
}

test('a guest can track a product after signing in from Favourites and opening an existing favourite', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'mobile' ? '+77000000901' : '+77000000902';
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  const userId = randomUUID();
  await cleanup(phone);
  try {
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1, $2, now())', [userId, phone]);
    await pool.query(
      'INSERT INTO buyer_offer_favourites (user_id, offer_id, location_id) VALUES ($1, $2, $3)',
      [userId, seedIds.lambOffer, seedIds.location],
    );

    await page.goto('/favourites');
    await expect(page.getByText('Войдите, чтобы открыть избранное')).toBeVisible();
    let otpRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/otp/request') && request.method() === 'POST') otpRequests++;
    });

    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Получить код', exact: true }).click();
    const requested = await (await requestResponse).json();
    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();

    await expect(dialog).toBeHidden();
    const entry = page.getByTestId('favourite-entry');
    await expect(entry).toHaveCount(1);
    await entry.getByRole('link', { name: 'Баранина', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/offers/${seedIds.lambOffer}[?]return=%2Ffavourites$`));

    const tracking = page.getByRole('button', { name: 'Отслеживать товар', exact: true });
    await tracking.click();
    await expect(dialog).toHaveCount(0);
    await expect(tracking).toHaveAttribute('aria-pressed', 'true');
    expect(otpRequests).toBe(1);
    const session = await (await page.request.get('/api/auth/me')).json();
    expect(session.user.phone).toBe(phone);
  } finally {
    await pool.end();
    await cleanup(phone);
  }
});

test('signing in through an Offer favourite also authorizes tracking without another OTP prompt', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'mobile' ? '+77000000897' : '+77000000898';
  await cleanup(phone);
  try {
    await openSeedOffer(page);
    let otpRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/otp/request') && request.method() === 'POST') otpRequests++;
    });

    const favourite = page.getByTestId('favourite-heart');
    await favourite.click();
    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(favourite).toHaveAttribute('aria-pressed', 'true');
    expect(otpRequests).toBe(1);

    const tracking = page.getByRole('button', { name: 'Отслеживать товар', exact: true });
    await tracking.click();
    await expect(dialog).toHaveCount(0);
    await expect(tracking).toHaveAttribute('aria-pressed', 'true');
    expect(otpRequests).toBe(1);
  } finally {
    await cleanup(phone);
  }
});

test('interest-first login stays shared with favourites and logout clears an open Offer despite a stale read', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'mobile' ? '+77000000899' : '+77000000900';
  await cleanup(phone);
  let notifyStaleReadStarted: (() => void) | undefined;
  let finishStaleRead: (() => void) | undefined;
  const logoutPage = await page.context().newPage();
  try {
    await openSeedOffer(page);
    let otpRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/otp/request') && request.method() === 'POST') otpRequests++;
    });

    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });
    const tracking = page.getByRole('button', { name: 'Отслеживать товар', exact: true });
    await tracking.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(tracking).toHaveAttribute('aria-pressed', 'true');
    expect(otpRequests).toBe(1);

    const favourite = page.getByTestId('favourite-heart');
    await favourite.click();
    await expect(favourite).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog).toHaveCount(0);
    expect(otpRequests).toBe(1);

    await logoutPage.goto('/more');
    const logout = logoutPage.getByRole('button', { name: 'Выйти', exact: true });
    await expect(logout).toBeVisible();

    const staleReadStarted = new Promise<void>((resolve) => {
      notifyStaleReadStarted = resolve;
    });
    const holdStaleRead = new Promise<void>((resolve) => {
      finishStaleRead = resolve;
    });
    let delayNextRead = true;
    await page.route('**/api/interests*', async (route) => {
      if (!delayNextRead || route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      delayNextRead = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      notifyStaleReadStarted?.();
      await holdStaleRead;
      await route.fulfill({ response });
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await staleReadStarted;

    const loggedOutRead = page.waitForResponse((response) =>
      response.url().includes('/api/interests?') && response.request().method() === 'GET' && response.status() === 401,
    );
    const logoutResponse = logoutPage.waitForResponse((response) =>
      response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST',
    );
    await logout.click();
    await logoutResponse;
    await loggedOutRead;
    await expect(tracking).toHaveAttribute('aria-pressed', 'false');
    await expect(favourite).toHaveAttribute('aria-pressed', 'false');

    const staleResponse = page.waitForResponse((response) =>
      response.url().includes('/api/interests?') && response.request().method() === 'GET' && response.status() === 200,
    );
    finishStaleRead?.();
    await staleResponse;
    await expect(tracking).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog).toHaveCount(0);
    expect(otpRequests).toBe(1);
  } finally {
    finishStaleRead?.();
    await page.unroute('**/api/interests*');
    await logoutPage.close();
    await cleanup(phone);
  }
});

test('buyer interest survives reload and a later login, then can be removed', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  await cleanup(phone);
  try {
    await login(page, phone);

    await openSeedOffer(page);
    await page.getByRole('button', { name: 'Отслеживать товар', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Отслеживать товар', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Отслеживать товар', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await signOutInMore(page);
    // The original regression relogged immediately. Make its isolated challenge history eligible under the approved cooldown.
    const admissionPool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
    try { await admissionPool.query("UPDATE auth_otp_challenges SET created_at=created_at-interval '61 seconds' WHERE phone_e164=$1", [phone]); }
    finally { await admissionPool.end(); }
    await login(page, phone);

    await openSeedOffer(page);
    await expect(page.getByRole('button', { name: 'Отслеживать товар', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Отслеживать товар', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Отслеживать товар', exact: true })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await cleanup(phone);
  }
});

test('anonymous buyer sees the interest control, cancelling auth makes no API call, and completing auth auto-applies the original click', async ({ page }, testInfo) => {
  const phone = anonymousFlowPhoneFor(testInfo.project.name);
  await cleanup(phone);
  try {
    await openSeedOffer(page);
    const productSelection = page.getByRole('button', { name: 'Отслеживать товар', exact: true });
    await expect(productSelection).toBeVisible();
    await expect(productSelection).toHaveAttribute('aria-pressed', 'false');

    const interestRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/interests')) interestRequests.push(request.url());
    });

    const dialog = page.getByRole('dialog', { name: 'Вход в KAIDA.KZ' });

    await productSelection.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Чтобы отслеживать товар, войдите по номеру телефона.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(dialog).toBeHidden();
    await expect(productSelection).toHaveAttribute('aria-pressed', 'false');
    expect(interestRequests).toHaveLength(0);

    await productSelection.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await dialog.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await dialog.getByRole('button', { name: 'Войти', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Отслеживать товар', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(interestRequests.some((url) => /\/api\/interests\/[^/]+$/.test(url))).toBe(true);
  } finally {
    await cleanup(phone);
  }
});
