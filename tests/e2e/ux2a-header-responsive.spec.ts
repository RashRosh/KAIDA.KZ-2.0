import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

type Box = { x: number; y: number; width: number; height: number };

const PHONE = '+77000000929';

async function cleanup() {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [PHONE]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [PHONE]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [PHONE]);
  } finally {
    await pool.end();
  }
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

async function expectSearchGeometry(page: import('@playwright/test').Page) {
  const search = page.getByRole('search', { name: 'Поиск из шапки' });
  const input = search.getByRole('searchbox', { name: 'Поиск товара', exact: true });
  const submit = search.getByRole('button', { name: 'Искать', exact: true });

  await expect(search).toBeVisible();
  await expect(input).toBeVisible();
  await expect(submit).toBeVisible();

  const inputBox = await input.boundingBox();
  const submitBox = await submit.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(Math.abs(submitBox!.width - submitBox!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(submitBox!.height - inputBox!.height)).toBeLessThanOrEqual(1);
  expect(submitBox!.width).toBeGreaterThanOrEqual(44);
  expect(submitBox!.height).toBeGreaterThanOrEqual(44);

  return { search, submit };
}

async function authenticateThroughApi(page: import('@playwright/test').Page) {
  const requested = await page.request.post('/api/auth/otp/request', { data: { phone: PHONE } });
  expect(requested.status()).toBe(201);
  const payload = await requested.json() as {
    challenge: { id: string };
    delivery: { code: string };
  };

  const verified = await page.request.post('/api/auth/otp/verify', {
    data: { challengeId: payload.challenge.id, code: payload.delivery.code },
  });
  expect(verified.status()).toBe(200);
}

test('UX2A keeps authenticated tablet and narrow header usable with one square Search submit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Single targeted UX2A proof');

  await cleanup();
  try {
    await authenticateThroughApi(page);

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/');
    const logoutButton = page.getByRole('button', { name: new RegExp(`^Выйти \\(${PHONE.replace('+', '\\+')}\\)$`) });
    await expect(logoutButton).toBeVisible();

    const tablet = await expectSearchGeometry(page);
    const searchBox = await tablet.search.boundingBox();
    const logoutBox = await logoutButton.boundingBox();
    expect(searchBox).not.toBeNull();
    expect(logoutBox).not.toBeNull();
    expect(overlaps(searchBox!, logoutBox!)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await expectSearchGeometry(page);
    const mobileSearchBox = await mobile.search.boundingBox();
    const mobileLogoutBox = await logoutButton.boundingBox();
    const menuBox = await page.getByRole('button', { name: 'Открыть меню', exact: true }).boundingBox();
    expect(mobileSearchBox).not.toBeNull();
    expect(mobileLogoutBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(overlaps(mobileSearchBox!, mobileLogoutBox!)).toBe(false);
    expect(overlaps(mobileSearchBox!, menuBox!)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await mobile.search.getByRole('searchbox', { name: 'Поиск товара', exact: true }).fill('баранина');
    await mobile.submit.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('баранина');
    await expect(page.getByLabel('Какой товар ищете?')).toHaveValue('баранина');
  } finally {
    await cleanup();
  }
});
