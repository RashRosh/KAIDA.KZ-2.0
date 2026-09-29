import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { openOffer, SEED_POINT, signOutInMore } from './buyer-helpers';
import { proposeNewOffer, proposeOfferEdit } from './offer-editor-helpers';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000861' : '+77000000862';
}

function publicPhoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000000863' : '+77000000864';
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
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

async function makeBuyerEligible(phone: string, projectName: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const contactPhone = publicPhoneFor(projectName);
    const seller = await pool.query(`
      UPDATE sellers s
      SET contact_phone_e164=$2
      FROM users u
      WHERE s.owner_user_id=u.id AND u.phone_e164=$1
      RETURNING s.id
    `, [phone, contactPhone]);
    expect(seller.rows).toHaveLength(1);
    const location = await pool.query(`
      UPDATE locations l
      SET latitude=$2, longitude=$3
      FROM sellers s
      JOIN users u ON u.id=s.owner_user_id
      WHERE l.seller_id=s.id AND u.phone_e164=$1
      RETURNING l.id
    `, [phone, 43.238949, 76.889709]);
    expect(location.rows).toHaveLength(1);
  } finally {
    await pool.end();
  }
}

async function login(page: import('@playwright/test').Page, phone: string) {
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

async function search(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Какой товар ищете?').fill('баранина');
  await page.getByLabel('Какой товар ищете?').press('Enter');
}

// B01 has no seller comment: the buyer reads it on the offer page.
async function expectBuyerComment(page: import('@playwright/test').Page, card: import('@playwright/test').Locator, comment: string, absent?: string) {
  await openOffer(card, 'Баранина');
  await expect(page.getByTestId('offer-comment')).toHaveText(comment);
  if (absent) await expect(page.getByText(absent, { exact: true })).toHaveCount(0);
}

test('Seller manages an existing Offer only after explicit confirmation and buyer Search follows committed state', async ({ page }, testInfo) => {
  // A long end-to-end flow (create, edit, off, on, search after each step): ~25 s alone, so the default 30 s is too tight.
  test.setTimeout(60_000);
  const phone = phoneFor(testInfo.project.name);
  const sellerName = `S5 E2E ${testInfo.project.name}`;
  const pointName = `S5 E2E точка ${testInfo.project.name}`;
  const sellerOfferCard = page.getByRole('article').filter({ hasText: pointName });
  await cleanup(phone);
  try {
    await login(page, phone);

    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill(sellerName);
    await page.getByLabel('Название для покупателей').fill(pointName);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы, S5 E2E адрес');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Местоположение не задано', { exact: true }).first()).toBeVisible();
    await makeBuyerEligible(phone, testInfo.project.name);
    await proposeNewOffer(page, { product: 'Баранина', price: '4200.00', unit: 'kg', comment: 'S5 старая партия' });
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);

    await search(page);
    await expect(sellerOfferCard).toHaveCount(1);
    await expect(sellerOfferCard.getByText(/4 200 ₸/)).toBeVisible();
    await expectBuyerComment(page, sellerOfferCard, 'S5 старая партия');

    // seller-showcase-editor: cards live on «Моя витрина»; the card screen holds «Изменить», «Выключить», «Включить».
    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Моя витрина', level: 1 })).toBeVisible();
    await proposeOfferEdit(page, page.getByRole('article').first(), { price: '4500.00', unit: 'kg', comment: 'S5 новая партия' });
    await expect(page.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();
    await expect(page.getByText(/4\s500 ₸ \/ кг/)).toBeVisible();
    await expect(page.getByText('S5 новая партия', { exact: true })).toBeVisible();

    const updateReviewUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(updateReviewUrl);
    await expect(page.getByText('S5 новая партия', { exact: true })).toBeVisible();

    await search(page);
    await expect(sellerOfferCard).toHaveCount(1);
    await expect(sellerOfferCard.getByText(/4 200 ₸/)).toBeVisible();
    await expectBuyerComment(page, sellerOfferCard, 'S5 старая партия', 'S5 новая партия');

    await page.goto(updateReviewUrl);
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);
    await expect(page.getByRole('status').filter({ hasText: 'Изменения опубликованы' })).toBeVisible();

    await search(page);
    await expect(sellerOfferCard).toHaveCount(1);
    await expect(sellerOfferCard.getByText(/4 500 ₸/)).toBeVisible();
    await expectBuyerComment(page, sellerOfferCard, 'S5 новая партия', 'S5 старая партия');

    await page.goto('/seller');
    await page.getByRole('article').first().getByRole('button').first().click();
    await page.getByRole('button', { name: 'Выключить' }).click();
    await expect(page.getByText('Выключение предложения', { exact: true })).toBeVisible();
    const deactivateReviewUrl = page.url();

    await search(page);
    await expect(sellerOfferCard).toHaveCount(1);
    await page.goto(deactivateReviewUrl);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Предложение выключено' })).toBeVisible();

    await search(page);
    await expect(page.getByRole('article').filter({ hasText: SEED_POINT })).toHaveCount(1);
    await expect(sellerOfferCard).toHaveCount(0);

    await page.goto('/seller');
    await page.getByRole('article').first().getByRole('button').first().click();
    await page.getByRole('button', { name: 'Включить' }).click();
    await expect(page.getByText('Включение предложения', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Предложение включено' })).toBeVisible();

    await search(page);
    await expect(sellerOfferCard).toHaveCount(1);
    await expectBuyerComment(page, sellerOfferCard, 'S5 новая партия');

    await page.goto('/seller');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Моя витрина', level: 1 })).toBeVisible();
    await expect(page.getByText('На витрине', { exact: true }).first()).toBeVisible();

    await proposeNewOffer(page, { product: 'Баранина', price: '4700.00', comment: 'S5 второй Offer' });
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);

    await signOutInMore(page);
    await search(page);
    await expect(page.getByRole('article').filter({ hasText: SEED_POINT })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});
