import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { offerEditor } from './offer-editor-helpers';

function phonesFor(projectName: string) {
  return projectName === 'mobile'
    ? { login: '+77000013710', public: '+77000013711' }
    : { login: '+77000013750', public: '+77000013751' };
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

// A Seller with one buyer-eligible trading point is a prerequisite, not the behavior under test.
async function prepareSeller(page: Page, phones: { login: string; public: string }, sellerName: string) {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone: phones.login } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phones.login]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name, contact_phone_e164) VALUES ($1,$2,$3) RETURNING id', [user.rows[0].id, sellerName, phones.public]);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы, бірлік','shop',43.24,76.88)", [seller.rows[0].id, `${sellerName} точка`]);
  });
}

async function switchLocale(page: Page, name: 'Қазақша' | 'Русский') {
  const control = page.getByRole('button', { name }).filter({ visible: true }).last();
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
}

function backToEdit(page: Page, label = 'Вернуться к правке') {
  return page.getByRole('link', { name: label }).filter({ visible: true }).first();
}

test('Seller chooses a canonical or own price unit that survives locale switch and return from review, and buyers see it localized', async ({ page }, testInfo) => {
  const phones = phonesFor(testInfo.project.name);
  const sellerName = `Бірлік ${testInfo.project.name}`;
  await cleanup(phones.login);
  try {
    await prepareSeller(page, phones, sellerName);

    await page.goto('/seller/offers?new=1');
    let editor = offerEditor(page);
    const unit = editor.getByLabel('Единица', { exact: true });
    await expect(unit.locator('option')).toHaveText(['не указана', 'кг', 'шт', 'л', 'упак.', 'другое']);
    await expect(unit).toHaveValue('');
    await editor.getByRole('textbox', { name: 'Товар', exact: true }).fill('Баранина');
    await editor.getByRole('textbox', { name: 'Цена', exact: true }).fill('4200');
    for (const code of ['kg', 'piece', 'liter', 'package']) {
      await unit.selectOption(code);
      await expect(unit).toHaveValue(code);
      await expect(editor.getByLabel('Своя единица')).toHaveCount(0);
    }

    // «другое» needs the Seller's own value; the error sits on that field.
    await unit.selectOption('other');
    const custom = editor.getByRole('textbox', { name: 'Своя единица' });
    await expect(editor.getByText('Вес или объём упаковки — не единица: «500 г» укажите в комментарии.')).toBeVisible();
    await editor.getByRole('button', { name: 'Далее' }).click();
    await expect(editor.getByText('Укажите свою единицу или выберите другую.')).toBeVisible();
    await expect(custom).toBeFocused();
    await expect(custom).toHaveAttribute('aria-invalid', 'true');
    await custom.fill('ведро');

    // Locale switch keeps both the choice and the own value; only labels change.
    await switchLocale(page, 'Қазақша');
    const unitKk = editor.getByLabel('Өлшем бірлігі', { exact: true });
    await expect(unitKk).toHaveValue('other');
    await expect(unitKk.locator('option')).toHaveText(['көрсетілмеген', 'кг', 'дана', 'л', 'қапт.', 'басқа']);
    await expect(editor.getByRole('textbox', { name: 'Өз өлшем бірлігі' })).toHaveValue('ведро');
    await switchLocale(page, 'Русский');
    await expect(unit).toHaveValue('other');
    await expect(custom).toHaveValue('ведро');

    await editor.getByRole('button', { name: 'Далее' }).click();
    await editor.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
    await expect(page.getByText(/4\s200 ₸ \/ ведро/)).toBeVisible();

    // Return from review keeps the draft, including the own unit.
    await backToEdit(page).click();
    await expect(page).toHaveURL(/\/seller\/offers\?.*new=1.*from=[0-9a-f-]+/);
    editor = offerEditor(page);
    await expect(unit).toHaveValue('other');
    await expect(custom).toHaveValue('ведро');
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue(/^4200(\.00)?$/);
    // An explicit canonical choice clears the own value.
    await unit.selectOption('kg');
    await expect(editor.getByLabel('Своя единица')).toHaveCount(0);
    await editor.getByRole('button', { name: 'Далее' }).click();
    await editor.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByText(/4\s200 ₸ \/ кг/)).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/offers(\?.*)?$/);

    // Edit the existing Offer from кг to шт, with a return from review in between.
    await page.goto('/seller/offers');
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Баранина', exact: true }) });
    await expect(card.getByText('/ кг')).toBeVisible();
    await card.getByRole('link', { name: 'Изменить', exact: true }).click();
    editor = offerEditor(page);
    const editUnit = editor.getByLabel('Единица', { exact: true });
    await expect(editUnit).toHaveValue('kg');
    await editUnit.selectOption('piece');
    await editor.getByRole('button', { name: 'Далее' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+\?/);
    await expect(page.getByText(/4\s200 ₸ \/ шт/)).toBeVisible();
    await backToEdit(page).click();
    await expect(page).toHaveURL(/\/seller\/offers\?.*edit=[0-9a-f-]+.*from=[0-9a-f-]+/);
    editor = offerEditor(page);
    await expect(editor.getByLabel('Единица', { exact: true })).toHaveValue('piece');
    await editor.getByRole('button', { name: 'Далее' }).click();
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    // The notice query is stripped right after it is read, so either form of the list URL is fine.
    await expect(page).toHaveURL(/\/seller\/offers(\?.*)?$/);
    await expect(card.getByText('/ шт')).toBeVisible();

    // Canonical labels follow the interface language in the cabinet and in buyer reads.
    // The product name is localized too, so the card is found by its stable id.
    const cardTestId = (await card.getAttribute('data-testid'))!;
    await switchLocale(page, 'Қазақша');
    await expect(page.getByTestId(cardTestId).getByText('/ дана')).toBeVisible();
    const lamb = async (locale: 'ru' | 'kk') => {
      const body = await (await page.request.get(`/api/search?q=${encodeURIComponent('баранина')}&locale=${locale}`)).json();
      return body.offers.find((offer: { seller: { displayName: string } }) => offer.seller.displayName === sellerName).price;
    };
    expect(await lamb('kk')).toEqual({ amount: '4200', currency: 'KZT', unit: 'дана' });
    expect(await lamb('ru')).toEqual({ amount: '4200', currency: 'KZT', unit: 'шт' });

    // The own-value field fits a 320 px phone in the longer Kazakh copy.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/seller/offers?new=1');
    editor = offerEditor(page);
    const narrowUnitKk = editor.getByLabel('Өлшем бірлігі', { exact: true });
    await narrowUnitKk.selectOption('other');
    await expect(editor.getByRole('textbox', { name: 'Өз өлшем бірлігі' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await narrowUnitKk.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  } finally {
    await cleanup(phones.login);
  }
});
