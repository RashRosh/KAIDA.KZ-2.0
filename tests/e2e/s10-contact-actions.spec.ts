import { expect, test } from '@playwright/test';
import { PLAIN_SEARCH_URL } from './browser-state';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { proposeNewOffer } from './offer-editor-helpers';

function phoneFor(projectName: string) {
  return projectName === 'mobile' ? '+77000001991' : '+77000001992';
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
      await pool.query('DELETE FROM seller_verified_phones WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM contact_verification_challenges WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function setSellerLocationGeo(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const result = await pool.query(`
      UPDATE locations l
      SET latitude=$2, longitude=$3
      FROM sellers s
      JOIN users u ON u.id=s.owner_user_id
      WHERE l.seller_id=s.id AND u.phone_e164=$1
      RETURNING l.id
    `, [phone, 43.238949, 76.889709]);
    expect(result.rows).toHaveLength(1);
  } finally {
    await pool.end();
  }
}

// S10 as revised by point-contacts-hours: contacts and hours live on the point; a number reaches buyers only after
// its code; the buyer card shows the hours line with the state icon.
test('point contacts are verified by code and reach the buyer card with the hours line', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const phone = phoneFor(project);
  const pointPhone = project === 'mobile' ? '+77000001993' : '+77000001994';
  const sellerName = `S10 ${project} seller`;
  const pointName = `S10 ${project} point`;
  await cleanup(phone);
  try {
    await page.goto('/seller');
    await page.getByRole('link', { name: 'Войти' }).click();
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill(formattedPhone(phone));
    const requestResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/otp/request') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Получить код' }).click();
    const requested = await (await requestResponse).json();
    await page.getByRole('textbox', { name: 'Код из 6 цифр', exact: true }).fill(requested.delivery.code);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(PLAIN_SEARCH_URL);

    // First point: a new number for calls, the login number for WhatsApp, Sunday around the clock.
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill(sellerName);
    await page.getByLabel('Название для покупателей').fill(pointName);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill(`Алматы, S10 ${project} address`);
    await page.getByLabel('Телефон', { exact: true }).fill(pointPhone);
    await page.getByLabel('WhatsApp', { exact: true }).fill(phone);
    await page.getByLabel('ВС: режим').selectOption('24h');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();

    const card = page.locator('[data-testid^="trading-point-"]').filter({ hasText: pointName });
    await expect(card.getByText('Телефон, WhatsApp', { exact: true })).toBeVisible();
    await expect(card.getByText('ждёт подтверждения')).toBeVisible();
    // AI-S12A: the login number is confirmed at once; the new call number waits for its code (AI-S13).
    await card.click();
    const callNumber = page.locator('div.card').filter({ hasText: `Телефон: ${pointPhone}` });
    await expect(callNumber.getByText('Не подтверждён — покупатели его не видят')).toBeVisible();
    await expect(page.getByText('Подтверждён', { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Отмена' }).click();

    await setSellerLocationGeo(phone);
    await proposeNewOffer(page, { product: 'Баранина', price: '5432.10', unit: 'kg', comment: `S10 ${project} contacts offer` });
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);

    // Monday 17:30 in Almaty: open, closing within the hour.
    await page.clock.setFixedTime(new Date('2026-09-21T12:30:00Z'));
    const search = async () => {
      await page.goto('/');
      await page.getByLabel('Какой товар ищете?').fill('баранина');
      await page.getByLabel('Какой товар ищете?').press('Enter');
      const offer = page.locator('article').filter({ hasText: pointName }).first();
      await expect(offer).toBeVisible();
      return offer;
    };
    let offer = await search();
    await expect(offer.getByRole('link', { name: 'Позвонить продавцу', exact: true })).toHaveCount(0);
    await expect(offer.getByRole('link', { name: 'Написать в WhatsApp', exact: true })).toHaveAttribute('href', `https://wa.me/${phone.slice(1)}`);
    await expect(offer.getByRole('link', { name: `Маршрут до ${pointName}`, exact: true })).toHaveAttribute('href', /\/api\/offers\/[0-9a-f-]+\/route$/);
    // card-opening-hours: the card shows only the status in words (no schedule, no button) ...
    const hours = offer.getByTestId('opening-hours');
    await expect(hours).toHaveText('Закрывается в 18:00');
    await expect(hours).toHaveAttribute('data-state', 'closing');
    await expect(offer.getByTestId('opening-schedule')).toHaveCount(0);
    await expect(offer.getByRole('button', { name: 'Расписание' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // ... and the Offer page shows the whole week, consecutive identical days grouped, today (Monday) in bold.
    await offer.getByRole('link', { name: 'Баранина', exact: true }).click();
    await expect(page).toHaveURL(/\/offers\//);
    const schedule = page.getByTestId('opening-schedule');
    await expect(schedule.getByRole('listitem')).toHaveCount(3);
    await expect(schedule.getByRole('listitem').nth(0)).toContainText('ПН–ПТ');
    await expect(schedule.getByRole('listitem').nth(0)).toContainText('9:00–18:00');
    await expect(schedule.getByRole('listitem').nth(0)).toHaveAttribute('aria-current', 'date');
    await expect(schedule.getByRole('listitem').nth(1)).toContainText('СБ');
    await expect(schedule.getByRole('listitem').nth(1)).toContainText('выходной');
    await expect(schedule.getByRole('listitem').nth(2)).toContainText('ВС');
    await expect(schedule.getByRole('listitem').nth(2)).toContainText('Круглосуточно');
    await expect(page.getByTestId('opening-hours')).toHaveText('Закрывается в 18:00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goBack();

    // Confirm the call number with the code shown on screen (test delivery).
    await page.goto('/seller/points');
    await card.click();
    await callNumber.getByRole('button', { name: 'Подтвердить' }).click();
    const testCode = (await callNumber.getByText(/Тестовый код: \d{6}/).textContent())!.match(/\d{6}/)![0];
    await callNumber.getByLabel('Код из 6 цифр').fill(testCode);
    await callNumber.getByRole('button', { name: 'Подтвердить номер' }).click();
    await expect(page.getByText('Номер подтверждён. Покупатели его видят.')).toBeVisible();
    await expect(page.getByText('Подтверждён', { exact: true })).toHaveCount(2);

    offer = await search();
    await expect(offer.getByRole('link', { name: 'Позвонить продавцу', exact: true })).toHaveAttribute('href', `tel:${pointPhone}`);

    // A second point starts with the first point's contacts and hours.
    await page.goto('/seller/points');
    await page.getByRole('button', { name: 'Добавить торговую точку' }).click();
    await expect(page.getByText(`Контакты и режим работы как у точки «${pointName}» — можно изменить до сохранения.`)).toBeVisible();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue(pointPhone);
    await expect(page.getByLabel('ВС: режим')).toHaveValue('24h');
  } finally {
    await cleanup(phone);
  }
});
