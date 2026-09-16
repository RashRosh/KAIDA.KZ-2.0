import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { digestSessionToken } from '../../src/modules/identity/crypto/session-token';
import { testDatabaseUrl } from '../integration/database';

const baseURL = 'http://127.0.0.1:3100';

function ids(projectName: string) {
  const suffix = projectName === 'mobile' ? '61' : '62';
  return {
    userId: `50000000-0000-4000-8000-0000000012${suffix}`,
    phone: `+770000012${suffix}`,
    sessionId: `51000000-0000-4000-8000-0000000012${suffix}`,
    token: `s12-browser-session-${projectName}`,
  };
}

async function cleanup(pool: Pool, userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function authenticate(page: import('@playwright/test').Page, projectName: string) {
  const identity = ids(projectName);
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  await cleanup(pool, identity.userId, identity.phone);
  const createdAt = new Date('2026-09-14T08:00:00.000Z');
  const expiresAt = new Date('2030-09-14T08:00:00.000Z');
  await pool.query('INSERT INTO users (id,phone_e164,created_at) VALUES ($1,$2,$3)', [identity.userId, identity.phone, createdAt]);
  await pool.query('INSERT INTO auth_sessions (id,user_id,token_digest,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)', [identity.sessionId, identity.userId, digestSessionToken(identity.token), createdAt, expiresAt]);
  await page.context().addCookies([{ name: 'kaida_session', value: identity.token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  return { ...identity, pool };
}

async function makeBuyerEligible(pool: Pool, userId: string, projectName: string) {
  const contactPhone = projectName === 'mobile' ? '+77000001263' : '+77000001264';
  const seller = await pool.query(
    'UPDATE sellers SET contact_phone_e164=$2 WHERE owner_user_id=$1 RETURNING id',
    [userId, contactPhone],
  );
  expect(seller.rows).toHaveLength(1);
  const location = await pool.query(
    'UPDATE locations SET latitude=$2,longitude=$3 WHERE seller_id=$1 RETURNING id',
    [seller.rows[0].id, 43.238949, 76.889709],
  );
  expect(location.rows).toHaveLength(1);
}

async function createOffer(page: import('@playwright/test').Page, product: string, amount: string, comment: string) {
  await page.goto('/seller');
  const create = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Добавить товар' }) });
  await create.getByRole('textbox', { name: 'Товар', exact: true }).fill(product);
  await create.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill(amount);
  await create.getByRole('textbox', { name: 'Единица', exact: true }).fill('кг');
  await create.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill(comment);
  await create.getByRole('button', { name: 'Создать изменение' }).click();
  await page.getByRole('button', { name: 'Подтвердить и создать Offer' }).click();
  await expect(page.getByText('Offer создан', { exact: true })).toBeVisible();
}

async function search(page: import('@playwright/test').Page, query: string) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill(query);
  await page.getByLabel('Какой товар ищете?').press('Enter');
}

function sellerOfferCard(page: import('@playwright/test').Page, sellerName: string) {
  return page.locator('article').filter({ hasText: sellerName });
}

test('Seller reviews and confirms several Offer changes as one persisted batch', async ({ page }, testInfo) => {
  const auth = await authenticate(page, testInfo.project.name);
  const sellerName = `S12 E2E ${testInfo.project.name}`;
  try {
    await page.goto('/seller');
    await page.getByLabel('Имя', { exact: true }).fill(sellerName);
    await page.getByLabel('Название торговой точки').fill('S12 E2E точка');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S12 E2E адрес');
    await page.getByLabel('Телефон', { exact: true }).fill(testInfo.project.name === 'mobile' ? '+77000001263' : '+77000001264');
    await page.getByRole('button', { name: 'Сохранить и продолжить' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true })).toBeVisible();

    await makeBuyerEligible(auth.pool, auth.userId, testInfo.project.name);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();

    await createOffer(page, 'Баранина', '4200.00', 'S12 старая баранина');
    await createOffer(page, 'Говядина', '3500.00', 'S12 старая говядина');

    await page.goto('/seller/batch');
    const first = page.getByTestId('batch-item-0');
    await first.getByLabel('Действие').selectOption('update_offer');
    await first.getByLabel('Offer').selectOption({ label: 'Баранина · активно' });
    await first.getByLabel('Цена, ₸').fill('4600.00');
    await first.getByLabel('Комментарий продавца').fill('S12 новая баранина');

    const second = page.getByTestId('batch-item-1');
    await second.getByLabel('Действие').selectOption('deactivate_offer');
    await second.getByLabel('Offer').selectOption({ label: 'Говядина · активно' });
    await page.getByRole('button', { name: 'Проверить весь пакет' }).click();

    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(page.getByText(/Пакет содержит 2 изменений/)).toBeVisible();
    const reviewUrl = page.url();
    await page.reload();
    await expect(page.getByText('S12 новая баранина', { exact: true })).toBeVisible();

    await search(page, 'баранина');
    const oldLambCard = sellerOfferCard(page, sellerName);
    await expect(oldLambCard).toHaveCount(1);
    await expect(oldLambCard.getByText('S12 старая баранина', { exact: true })).toBeVisible();
    await expect(oldLambCard.getByText('S12 новая баранина', { exact: true })).toHaveCount(0);

    await search(page, 'говядина');
    const oldBeefCard = sellerOfferCard(page, sellerName);
    await expect(oldBeefCard).toHaveCount(1);
    await expect(oldBeefCard.getByText('S12 старая говядина', { exact: true })).toBeVisible();

    await page.goto(reviewUrl);
    await page.getByRole('button', { name: 'Подтвердить весь пакет' }).click();
    await expect(page.getByText(/Пакет из 2 изменений применён целиком/)).toBeVisible();

    await search(page, 'баранина');
    const newLambCard = sellerOfferCard(page, sellerName);
    await expect(newLambCard).toHaveCount(1);
    await expect(newLambCard.getByText('S12 новая баранина', { exact: true })).toBeVisible();
    await expect(newLambCard.getByText('S12 старая баранина', { exact: true })).toHaveCount(0);

    await search(page, 'говядина');
    await expect(sellerOfferCard(page, sellerName)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(auth.pool, auth.userId, auth.phone);
    await auth.pool.end();
  }
});