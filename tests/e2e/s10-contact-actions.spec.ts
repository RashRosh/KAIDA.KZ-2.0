import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

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

test('S10 Seller contacts reach buyer-eligible OfferCard and one cleared channel disappears', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const phone = phoneFor(project);
  const sellerName = `S10 ${project} seller`;
  const telegram = `kaida_s10_${project}`;
  const instagram = `kaida.s10.${project}`;
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
    await expect(page).toHaveURL('/');

    // Seller cabinet: point, contacts and «Добавить товар» are separate destinations (seller-cabinet-overview).
    await page.goto('/seller/points');
    await page.getByLabel('Имя', { exact: true }).fill(sellerName);
    await page.getByLabel('Название торговой точки').fill(`S10 ${project} point`);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill(`Алматы, S10 ${project} address`);
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText(`S10 ${project} point`, { exact: true }).first()).toBeVisible();
    await page.goto('/seller/contacts');
    await page.getByLabel('Телефон', { exact: true }).fill('+12025550123');
    await page.getByLabel('WhatsApp', { exact: true }).fill('+447911123456');
    await page.getByLabel('Telegram', { exact: true }).fill(telegram);
    await page.getByLabel('Instagram', { exact: true }).fill(instagram);
    await page.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(page.getByText('Контакты сохранены.', { exact: true })).toBeVisible();

    await setSellerLocationGeo(phone);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Контакты для покупателей' })).toBeVisible();

    await page.goto('/seller/offers/new');
    await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
    await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('5432.10');
    await page.getByLabel('Единица', { exact: true }).selectOption('kg');
    await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill(`S10 ${project} contacts offer`);
    await page.getByRole('button', { name: 'Создать изменение' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    await expect(page).toHaveURL('/seller');

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    const card = page.locator('article').filter({ hasText: sellerName }).first();
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: 'Позвонить', exact: true })).toHaveAttribute('href', 'tel:+12025550123');
    await expect(card.getByRole('link', { name: 'Маршрут', exact: true })).toHaveAttribute('href', /\/api\/offers\/[0-9a-f-]+\/route$/);
    await expect(card.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', 'https://wa.me/447911123456');
    await expect(card.getByRole('link', { name: 'Telegram', exact: true })).toHaveAttribute('href', `https://t.me/${telegram}`);
    await expect(card.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', `https://www.instagram.com/${instagram}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto('/seller/contacts');
    await expect(page.getByRole('heading', { name: 'Контакты для покупателей' })).toBeVisible();
    await page.getByLabel('Telegram', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Сохранить контакты' }).click();
    await expect(page.getByText('Контакты сохранены.', { exact: true })).toBeVisible();

    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    const updatedCard = page.locator('article').filter({ hasText: sellerName }).first();
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard.getByRole('link', { name: 'Telegram', exact: true })).toHaveCount(0);
    await expect(updatedCard.getByRole('link', { name: 'Позвонить', exact: true })).toHaveAttribute('href', 'tel:+12025550123');
    await expect(updatedCard.getByRole('link', { name: 'Маршрут', exact: true })).toBeVisible();
    await expect(updatedCard.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', 'https://wa.me/447911123456');
    await expect(updatedCard.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', `https://www.instagram.com/${instagram}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});
