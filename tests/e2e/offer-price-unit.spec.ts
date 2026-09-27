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

    // seller-showcase-editor: «Цена за» opens a sheet with the canonical units and «Другое».
    await page.goto('/seller?new=1');
    let editor = offerEditor(page);
    const unitButton = () => offerEditor(page).getByRole('button', { name: /^(Цена за|Баға бірлігі)/ });
    await expect(unitButton()).toHaveText('Выберите');
    await unitButton().click();
    const sheet = page.getByRole('dialog', { name: 'Цена за' });
    await expect(sheet.getByRole('button')).toHaveText([/^кг/, /^л/, /^шт/, /^упак\./, /^Другое/]);
    await sheet.getByRole('button', { name: /^Другое/ }).click();
    await expect(sheet).toHaveCount(0);
    await editor.getByRole('combobox', { name: 'Название товара' }).fill('Баранина');
    await editor.getByRole('textbox', { name: 'Цена', exact: true }).fill('4200');

    // «Другое» is one word of letters; the error sits on that field.
    const custom = editor.getByRole('textbox', { name: 'Своя единица' });
    await custom.fill('два ведра');
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(editor.getByText('Напишите одно слово без цифр и пробелов')).toBeVisible();
    await expect(custom).toBeFocused();
    await expect(custom).toHaveAttribute('aria-invalid', 'true');
    await custom.fill('ведро');

    // Locale switch keeps both the choice and the own value; only labels change.
    await switchLocale(page, 'Қазақша');
    await expect(unitButton()).toHaveText('ведро');
    await expect(editor.getByRole('textbox', { name: 'Өз бірлігіңіз' })).toHaveValue('ведро');
    await switchLocale(page, 'Русский');
    await expect(custom).toHaveValue('ведро');

    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
    await expect(page.getByText(/4\s200 ₸ \/ ведро/).first()).toBeVisible();

    // Return from review keeps the draft, including the own unit.
    await backToEdit(page).click();
    await expect(page).toHaveURL(/\/seller\?.*new=1.*from=[0-9a-f-]+/);
    editor = offerEditor(page);
    await expect(unitButton()).toHaveText('ведро');
    await expect(editor.getByRole('textbox', { name: 'Своя единица' })).toHaveValue('ведро');
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue(/^4200(\.00)?$/);
    // An explicit canonical choice clears the own value.
    await unitButton().click();
    await page.getByRole('dialog', { name: 'Цена за' }).getByRole('button', { name: /^кг/ }).click();
    await expect(editor.getByRole('textbox', { name: 'Своя единица' })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(page.getByText(/4\s200 ₸ \/ кг/).first()).toBeVisible();
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);

    // Edit the card from кг to шт, with a return from review in between.
    const card = page.getByRole('article').filter({ hasText: 'Баранина' });
    await expect(card.getByText('/ кг')).toBeVisible();
    await card.getByRole('button').first().click();
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    editor = offerEditor(page);
    await expect(unitButton()).toHaveText('кг');
    await unitButton().click();
    await page.getByRole('dialog', { name: 'Цена за' }).getByRole('button', { name: /^шт/ }).click();
    await editor.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+\?/);
    await expect(page.getByText(/4\s200 ₸ \/ шт/).first()).toBeVisible();
    await backToEdit(page).click();
    await expect(page).toHaveURL(/\/seller\?.*edit=[0-9a-f-]+.*from=[0-9a-f-]+/);
    await expect(unitButton()).toHaveText('шт');
    await offerEditor(page).getByRole('button', { name: 'Проверить и сохранить' }).click();
    await page.getByRole('button', { name: /^(Подтвердить и опубликовать|Опубликовать|Опубликовать без фото)$/ }).click();
    await expect(page).toHaveURL(/\/seller(\?.*)?$/);
    await expect(card.getByText('/ шт')).toBeVisible();

    // Canonical labels follow the interface language in the cabinet and in buyer reads.
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
    await page.goto('/seller?new=1');
    await unitButton().click();
    await page.getByRole('dialog', { name: 'Баға бірлігі' }).getByRole('button', { name: /^Басқа/ }).click();
    const narrowCustom = offerEditor(page).getByRole('textbox', { name: 'Өз бірлігіңіз' });
    await expect(narrowCustom).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await narrowCustom.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  } finally {
    await cleanup(phones.login);
  }
});
