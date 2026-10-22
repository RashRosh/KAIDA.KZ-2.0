import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// seller-ai-text-real-parser §18: the compact grouped opening-hours editor.
const phoneFor = (project: string, slot: number) => `+7700008${project === 'mobile' ? '5' : '6'}01${slot}`;

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function cleanup(phone: string) {
  await withPool(async (pool) => {
    const bySeller = 'SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1';
    await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [phone]);
    await pool.query('DELETE FROM sellers WHERE owner_user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=$1)', [phone]);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function login(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

const storedHours = (phone: string) => withPool(async (pool) => (await pool.query(
  'SELECT l.opening_hours AS hours FROM locations l JOIN sellers s ON s.id=l.seller_id JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1',
  [phone],
)).rows[0].hours);

const summary = (page: Page) => page.getByTestId('hours-summary');
const editor = (page: Page) => page.getByTestId('hours-editor');

async function setTimes(page: Page, from: string, to: string) {
  await editor(page).getByLabel('Промежуток 1: с').fill(from);
  await editor(page).getByLabel('Промежуток 1: до').fill(to);
}

test('new point: «Не указано» → weekdays → own Saturday → split Friday → cancel keeps the form → saved as shown', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.baseURL?.includes('3100'), 'default server');
  test.setTimeout(120_000);
  const phone = phoneFor(testInfo.project.name, 1);
  try {
    await login(page, phone);
    await page.goto('/seller/points');
    await expect(summary(page)).toContainText('ПН–ВС');
    await expect(summary(page)).toContainText('Не указано');

    await page.getByTestId('hours-other-days').click();
    await editor(page).getByRole('button', { name: 'По будням' }).click();
    await setTimes(page, '09:00', '18:00');
    await expect(page.getByTestId('hours-edit-summary')).toContainText('ПН–ПТ: 9:00–18:00');
    await editor(page).getByRole('button', { name: 'Применить' }).click();
    await expect(summary(page).getByRole('listitem')).toHaveCount(2);

    await page.getByTestId('hours-other-days').click();
    await editor(page).getByRole('button', { name: 'СБ', exact: true }).click();
    await setTimes(page, '10:00', '15:00');
    await editor(page).getByRole('button', { name: 'Применить' }).click();

    // Split Friday off the weekday group: the others change, Friday keeps its hours.
    await page.getByRole('button', { name: 'Изменить режим: ПН–ПТ' }).click();
    await editor(page).getByRole('button', { name: 'ПТ', exact: true }).click();
    await expect(page.getByTestId('hours-left-out')).toHaveText('Без изменений останутся: ПТ');
    await editor(page).getByLabel('Промежуток 1: до').fill('17:00');
    await editor(page).getByRole('button', { name: 'Применить' }).click();
    await expect(summary(page)).toContainText('ПН–ЧТ');
    await expect(summary(page)).toContainText('9:00–17:00');

    // Taking a day from another group is said before applying; «Отмена» changes nothing.
    await page.getByTestId('hours-other-days').click();
    await editor(page).getByRole('button', { name: 'СБ', exact: true }).click();
    await editor(page).getByLabel('В эти дни').selectOption('closed');
    await expect(page.getByTestId('hours-taken-over')).toHaveText('Заменит часы: СБ (10:00–15:00)');
    await editor(page).getByRole('button', { name: 'Отмена' }).click();
    await expect(summary(page)).toContainText('10:00–15:00');

    await page.getByLabel('Имя', { exact: true }).fill('Часы');
    await page.getByLabel('Название для покупателей').fill('Точка часов');
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByLabel('Адрес').fill('Алматы');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByTestId('point-created-panel')).toBeVisible();
    const day = (from: string, to: string) => ({ kind: 'intervals', intervals: [{ open: from, close: to }] });
    expect((await storedHours(phone)).days).toEqual({
      mon: day('09:00', '17:00'), tue: day('09:00', '17:00'), wed: day('09:00', '17:00'), thu: day('09:00', '17:00'),
      fri: day('09:00', '18:00'), sat: day('10:00', '15:00'), sun: { kind: 'unset' },
    });
  } finally {
    await cleanup(phone);
  }
});

test('an existing schedule with overnight, a break, 24 h, a day off and an unknown day saves unchanged', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.baseURL?.includes('3100'), 'default server');
  test.setTimeout(90_000);
  const phone = phoneFor(testInfo.project.name, 2);
  try {
    await login(page, phone);
    const response = await page.request.post('/api/seller/setup', { data: { seller: { displayName: 'Часы' }, location: { name: 'Сложная', type: 'shop', addressText: 'Алматы' } } });
    expect(response.ok()).toBe(true);
    const complex = {
      timeZone: 'Asia/Almaty',
      days: {
        mon: { kind: 'intervals', intervals: [{ open: '09:00', close: '13:00' }, { open: '14:00', close: '18:00' }] },
        tue: { kind: 'intervals', intervals: [{ open: '09:00', close: '13:00' }, { open: '14:00', close: '18:00' }] },
        wed: { kind: 'intervals', intervals: [{ open: '20:00', close: '03:00' }] },
        thu: { kind: '24h' },
        fri: { kind: 'closed' },
        sat: { kind: 'unset' },
        sun: { kind: 'intervals', intervals: [{ open: '10:00', close: '12:00' }] },
      },
    };
    await withPool((pool) => pool.query(
      "UPDATE locations SET opening_hours=$2, opening_hours_needs_review=false WHERE seller_id IN (SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1)",
      [phone, JSON.stringify(complex)],
    ));
    await page.goto('/seller/points');
    await page.getByRole('button', { name: 'Изменить торговую точку Сложная' }).click();
    await expect(summary(page)).toContainText('9:00–13:00, 14:00–18:00');
    await expect(summary(page)).toContainText('20:00–3:00');
    await expect(summary(page)).toContainText('Круглосуточно');
    await expect(summary(page)).toContainText('Выходной');
    await expect(summary(page)).toContainText('Не указано');
    // Opening a group and cancelling changes nothing either.
    await page.getByRole('button', { name: 'Изменить режим: ПН, ВТ' }).click();
    await editor(page).getByRole('button', { name: 'Отмена' }).click();
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Торговая точка сохранена.', { exact: true })).toBeVisible();
    expect(await storedHours(phone)).toEqual(complex);
  } finally {
    await cleanup(phone);
  }
});
