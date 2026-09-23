import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

interface SearchOfferBody {
  id: string;
  product: { id: string; name: string };
  seller: { id: string; displayName: string };
  location: { id: string; name: string; addressText: string | null };
  sellerComment: string | null;
}

interface SearchBody {
  query: string;
  offers: SearchOfferBody[];
}

interface ConfirmBody {
  changeSet: {
    items: Array<{
      resultOffer: { id: string; status: string } | null;
    }>;
  };
}

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000781' : '+77000000782';
}

function publicPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000783' : '+77000000784';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

function contextOptions(projectName: string) {
  return projectName === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } };
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function sellerIdentity(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const result = await pool.query(
      `SELECT s.id AS seller_id, l.id AS location_id
       FROM users u
       JOIN sellers s ON s.owner_user_id=u.id
       JOIN locations l ON l.seller_id=s.id
       WHERE u.phone_e164=$1`,
      [phone],
    );
    expect(result.rows).toHaveLength(1);
    return { sellerId: result.rows[0].seller_id as string, locationId: result.rows[0].location_id as string };
  } finally {
    await pool.end();
  }
}

async function makeBuyerEligible(ids: { sellerId: string; locationId: string }, projectName: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [ids.sellerId, publicPhoneFor(projectName)]);
    await pool.query('UPDATE locations SET latitude=$2,longitude=$3 WHERE id=$1', [ids.locationId, 43.238949, 76.889709]);
  } finally {
    await pool.end();
  }
}

async function login(page: Page, phone: string) {
  await page.goto('/seller');
  await page.getByRole('link', { name: 'Войти' }).click();
  await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
  const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Получить код' }).click();
  const requested = await (await requestResponse).json();
  await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL('/');
}

async function buyerSearch(page: Page, query: string): Promise<SearchBody> {
  await page.goto('/');
  const input = page.getByLabel('Какой товар ищете?');
  await input.fill(query);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/search?') && response.request().method() === 'GET');
  await input.press('Enter');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return response.json() as Promise<SearchBody>;
}

function containsIdentity(
  body: SearchBody,
  identity: { sellerId: string; locationId: string; sellerComment: string },
) {
  return body.offers.some((offer) => (
    offer.seller.id === identity.sellerId
    && offer.location.id === identity.locationId
    && offer.sellerComment === identity.sellerComment
  ));
}

test('S7 buyer finds the exact buyer-eligible Seller-created Offer through canonical and alias Search only after confirmation', async ({ browser }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  const suffix = testInfo.project.name;
  const sellerName = `S7 E2E Seller ${suffix}`;
  const locationName = `S7 E2E Point ${suffix}`;
  const sellerComment = `S7 exact seller comment ${suffix}`;

  await cleanup(phone);
  const sellerContext = await browser.newContext(contextOptions(testInfo.project.name));
  const buyerContext = await browser.newContext(contextOptions(testInfo.project.name));
  const sellerPage = await sellerContext.newPage();
  const buyerPage = await buyerContext.newPage();

  try {
    await login(sellerPage, phone);

    await sellerPage.goto('/seller/points');
    await sellerPage.getByLabel('Имя', { exact: true }).fill(sellerName);
    await sellerPage.getByLabel('Название торговой точки').fill(locationName);
    await sellerPage.getByLabel('Тип торговой точки').selectOption('shop');
    await sellerPage.getByLabel('Адрес').fill(`Алматы, S7 E2E адрес ${suffix}`);
    await sellerPage.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(sellerPage.getByText('Местоположение не задано', { exact: true }).first()).toBeVisible();
    await sellerPage.goto('/seller/contacts');
    await sellerPage.getByLabel('Телефон', { exact: true }).fill(publicPhoneFor(testInfo.project.name));
    await sellerPage.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(sellerPage.getByText('Контакты сохранены.', { exact: true })).toBeVisible();

    const ids = await sellerIdentity(phone);
    await makeBuyerEligible(ids, testInfo.project.name);
    await sellerPage.goto('/seller/offers/new');
    await expect(sellerPage.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();
    const identity = { ...ids, sellerComment };

    await sellerPage.getByRole('textbox', { name: 'Товар', exact: true }).fill('мясо барана');
    await sellerPage.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('4777.00');
    await sellerPage.getByRole('textbox', { name: 'Единица', exact: true }).fill('кг');
    await sellerPage.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill(sellerComment);
    await sellerPage.getByRole('button', { name: 'Создать изменение' }).click();
    await expect(sellerPage).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await expect(sellerPage.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();
    await expect(sellerPage.getByText('Баранина', { exact: true })).toBeVisible();

    const beforeConfirmation = await buyerSearch(buyerPage, 'Баранина');
    expect(containsIdentity(beforeConfirmation, identity)).toBe(false);
    await expect(buyerPage.getByText(sellerName, { exact: true })).toHaveCount(0);

    const createConfirmResponse = sellerPage.waitForResponse((response) => (
      response.url().includes('/api/seller/change-sets/')
      && response.url().endsWith('/confirm')
      && response.request().method() === 'POST'
    ));
    await sellerPage.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    const createConfirm = await createConfirmResponse;
    expect(createConfirm.status()).toBe(200);
    const createBody = await createConfirm.json() as ConfirmBody;
    const offerId = createBody.changeSet.items[0]?.resultOffer?.id;
    expect(offerId).toBeTruthy();
    await expect(sellerPage).toHaveURL('/seller');

    const canonical = await buyerSearch(buyerPage, 'Баранина');
    const canonicalOffer = canonical.offers.find((offer) => offer.id === offerId);
    expect(canonicalOffer).toMatchObject({
      id: offerId,
      product: { name: 'Баранина' },
      seller: { id: ids.sellerId, displayName: sellerName },
      location: { id: ids.locationId, name: locationName },
      sellerComment,
    });

    const alias = await buyerSearch(buyerPage, 'мясо барана');
    const aliasOffer = alias.offers.find((offer) => offer.id === offerId);
    expect(aliasOffer).toEqual(canonicalOffer);
    const sellerOfferCard = buyerPage.getByRole('article').filter({ has: buyerPage.getByText(sellerName, { exact: true }) });
    await expect(sellerOfferCard).toHaveCount(1);
    await expect(sellerOfferCard.getByRole('heading', { name: 'Баранина', exact: true })).toBeVisible();
    await expect(sellerOfferCard.getByText(sellerComment, { exact: true })).toBeVisible();

    // Seller cabinet: switching off lives in the offer card's «Другие действия» menu (seller-cabinet-overview).
    await sellerPage.goto('/seller/offers');
    await sellerPage.getByRole('button', { name: /Другие действия: Баранина/ }).click();
    await sellerPage.getByRole('menuitem', { name: 'Выключить' }).click();
    await expect(sellerPage.getByText('Выключение предложения', { exact: true })).toBeVisible();

    const canonicalWhileProposed = await buyerSearch(buyerPage, 'Баранина');
    const aliasWhileProposed = await buyerSearch(buyerPage, 'мясо барана');
    expect(canonicalWhileProposed.offers.some((offer) => offer.id === offerId)).toBe(true);
    expect(aliasWhileProposed.offers.some((offer) => offer.id === offerId)).toBe(true);

    const deactivateConfirmResponse = sellerPage.waitForResponse((response) => (
      response.url().includes('/api/seller/change-sets/')
      && response.url().endsWith('/confirm')
      && response.request().method() === 'POST'
    ));
    await sellerPage.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    const deactivateConfirm = await deactivateConfirmResponse;
    expect(deactivateConfirm.status()).toBe(200);
    const deactivateBody = await deactivateConfirm.json() as ConfirmBody;
    expect(deactivateBody.changeSet.items[0]?.resultOffer).toMatchObject({ id: offerId, status: 'inactive' });
    await expect(sellerPage.getByRole('status').filter({ hasText: 'Предложение выключено' })).toBeVisible();
    await expect(sellerPage.getByText('Выключено', { exact: true })).toBeVisible();

    const canonicalAfterDeactivation = await buyerSearch(buyerPage, 'Баранина');
    const aliasAfterDeactivation = await buyerSearch(buyerPage, 'мясо барана');
    expect(canonicalAfterDeactivation.offers.some((offer) => offer.id === offerId)).toBe(false);
    expect(aliasAfterDeactivation.offers.some((offer) => offer.id === offerId)).toBe(false);
    await expect(buyerPage.getByText(sellerName, { exact: true })).toHaveCount(0);
  } finally {
    await sellerContext.close();
    await buyerContext.close();
    await cleanup(phone);
  }
});
