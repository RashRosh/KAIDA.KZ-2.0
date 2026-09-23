import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// The default web server runs with the translator off; `translatorOnBaseURL` is the same build with the fake adapter.
const translatorOnBaseURL = 'http://127.0.0.1:3101';

const kkComment = 'Жаңа, таңертеңгі жеткізілім';
const ruTranslation = 'Свежая, утренний привоз';

function phonesFor(projectName: string, variant: 'on' | 'off') {
  const base = { mobile: { on: 31, off: 33 }, desktop: { on: 35, off: 37 } }[projectName === 'mobile' ? 'mobile' : 'desktop'][variant];
  return { login: `+770000032${base}`, public: `+770000032${base + 1}` };
}

function formattedPhone(phone: string) {
  return `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
}

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
  });
}

// Seller profile, point, public phone and coordinates are prerequisites here, not the behavior under test.
async function prepareSeller(phone: string, publicPhone: string, sellerName: string) {
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query(
      'INSERT INTO sellers (owner_user_id, display_name, contact_phone_e164) VALUES ($1,$2,$3) RETURNING id',
      [user.rows[0].id, sellerName, publicPhone],
    );
    await pool.query(
      "INSERT INTO locations (seller_id, name, address_text, type, latitude, longitude) VALUES ($1,$2,$3,'shop',43.238949,76.889709)",
      [seller.rows[0].id, `${sellerName} нүкте`, 'Алматы, аудару көшесі'],
    );
  });
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

async function publishOffer(page: Page, comment: string) {
  await page.goto('/seller');
  await expect(page.getByRole('heading', { name: 'Добавить товар' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
  await page.getByRole('textbox', { name: 'Цена, ₸', exact: true }).fill('4200');
  await page.getByRole('textbox', { name: 'Комментарий продавца', exact: true }).fill(comment);
}

async function confirmOffer(page: Page) {
  await page.getByRole('button', { name: 'Создать изменение' }).click();
  await page.getByRole('button', { name: 'Подтвердить и создать Offer' }).click();
  await expect(page.getByText('Offer создан', { exact: true })).toBeVisible();
}

async function searchLamb(page: Page, query = 'баранина', label = 'Какой товар ищете?') {
  await page.goto('/');
  await page.getByLabel(label).fill(query);
  await page.getByLabel(label).press('Enter');
}

test.describe('translator on', () => {
  test.use({ baseURL: translatorOnBaseURL });

  test('Seller in ru writes Kazakh; Buyer in ru reads the translation and can open the original, Buyer in kk sees the original', async ({ page }, testInfo) => {
    const phones = phonesFor(testInfo.project.name, 'on');
    const sellerName = `Аударма ${testInfo.project.name}`;
    await cleanup(phones.login);
    try {
      await login(page, phones.login);
      await prepareSeller(phones.login, phones.public, sellerName);
      await publishOffer(page, kkComment);

      // Nothing in the form asks for or assumes the comment language.
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Создать изменение' }) });
      await expect(form.getByRole('combobox')).toHaveCount(0);
      await expect(form.getByRole('radio')).toHaveCount(0);
      await expect(page.getByText('Покупатели увидят комментарий на своём языке — это автоперевод.')).toBeVisible();
      await page.getByRole('button', { name: 'Проверить перевод' }).click();
      const preview = page.getByRole('status', { name: 'Так покупатели увидят комментарий' });
      await expect(preview).toContainText(ruTranslation);
      await expect(page.getByRole('textbox', { name: 'Комментарий продавца', exact: true })).toHaveValue(kkComment);
      await confirmOffer(page);

      const card = page.getByRole('article').filter({ has: page.getByText(sellerName, { exact: true }) });
      await expect(async () => {
        await searchLamb(page);
        await expect(card.getByText(ruTranslation, { exact: true })).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 15000 });
      await expect(card.getByText('Автоперевод', { exact: true })).toBeVisible();
      await expect(card.getByText(ruTranslation, { exact: true })).toHaveAttribute('lang', 'ru');

      const toggle = card.getByRole('button', { name: 'Показать оригинал' });
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(card.getByText(kkComment, { exact: true })).toHaveAttribute('lang', 'kk');
      await card.getByRole('button', { name: 'Показать перевод' }).click();
      await expect(card.getByText(ruTranslation, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Қазақша' }).click();
      await expect(card.getByText(kkComment, { exact: true })).toBeVisible();
      await expect(card.getByText('Автоаударма')).toHaveCount(0);
      await expect(card.getByText(/Аударма қолжетімсіз/)).toHaveCount(0);
      await expect(card.getByText(sellerName, { exact: true })).toBeVisible();
    } finally {
      await cleanup(phones.login);
    }
  });
});

test.describe('translator off', () => {
  test('comments show exactly as written and the Seller form has no translation hint or preview', async ({ page }, testInfo) => {
    const phones = phonesFor(testInfo.project.name, 'off');
    const sellerName = `Аудармасыз ${testInfo.project.name}`;
    await cleanup(phones.login);
    try {
      await login(page, phones.login);
      await prepareSeller(phones.login, phones.public, sellerName);
      await publishOffer(page, kkComment);
      await expect(page.getByText('Покупатели увидят комментарий на своём языке — это автоперевод.')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Проверить перевод' })).toHaveCount(0);
      await confirmOffer(page);

      const card = page.getByRole('article').filter({ has: page.getByText(sellerName, { exact: true }) });
      await searchLamb(page);
      await expect(card.getByText(kkComment, { exact: true })).toBeVisible();
      await expect(card.getByText('Автоперевод')).toHaveCount(0);
      await expect(card.getByText(/Перевод недоступен/)).toHaveCount(0);

      await page.getByRole('button', { name: 'Қазақша' }).click();
      await expect(card.getByText(kkComment, { exact: true })).toBeVisible();
      await expect(card.getByText(/Автоаударма|Аударма қолжетімсіз/)).toHaveCount(0);
    } finally {
      await cleanup(phones.login);
    }
  });
});
