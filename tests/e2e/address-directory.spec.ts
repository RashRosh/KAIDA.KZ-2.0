import { expect, test, type Locator, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { fillOfferFields, offerEditor } from './offer-editor-helpers';

function phoneFor(project: string, surface: 'points' | 'card') {
  return `+7799999${surface === 'points' ? '1' : '2'}${project === 'mobile' ? '1' : '2'}01`;
}

async function authenticate(page: Page, phone: string) {
  const requested = await page.request.post('/api/auth/otp/request', { data: { phone } });
  const payload = await requested.json() as { challenge: { id: string }; delivery: { code: string } };
  const verified = await page.request.post('/api/auth/otp/verify', { data: { challengeId: payload.challenge.id, code: payload.delivery.code } });
  expect(verified.status()).toBe(200);
}

async function seedDirectory() {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    await pool.query(`
      INSERT INTO address_directory_imports
        (id,source_url,source_timestamp,source_checksum,importer_version,status,entry_count,counts,finished_at)
      VALUES
        ('70000000-0000-4000-8000-000000000221','https://download.geofabrik.de/asia/kazakhstan-latest.osm.pbf',
         '2026-10-01T00:00:00Z',$1,'e2e-v1','active',2,$2::jsonb,now())
      ON CONFLICT (id) DO NOTHING
    `, ['b'.repeat(64), JSON.stringify({ addresses: 1, streets: 0, marketplaces: 1, retail: 0, total: 2 })]);
    await pool.query(`
      INSERT INTO address_directory_entries
        (import_id,source_key,kind,display_name,address_text,search_text,latitude,longitude)
      VALUES
        ('70000000-0000-4000-8000-000000000221','osm:r221','marketplace','Зелёный базар','Алматы, Зелёный базар','зеленый базар алматы',43.263,76.956),
        ('70000000-0000-4000-8000-000000000221','osm:n222','address','Абая, 10','Алматы, Абая, 10','абая 10 алматы',43.238,76.91)
      ON CONFLICT DO NOTHING
    `);
  } finally {
    await pool.end();
  }
}

async function cleanup(phone: string) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try {
    const user = (await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone])).rows[0];
    if (user) {
      await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [user.id]);
      await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [user.id]);
      await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [user.id]);
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [user.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [user.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [user.id]);
      await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  } finally {
    await pool.end();
  }
}

async function chooseGreenMarket(address: Locator) {
  await address.fill('Зелёный');
  const option = address.page().getByRole('option', { name: /Зелёный базар/ });
  await expect(option).toBeVisible();
  await expect(address.page().getByText('© OpenStreetMap contributors · ODbL').first()).toBeVisible();
  await option.click();
  await expect(address).toHaveValue('Алматы, Зелёный базар');
  await expect(address.page().getByText('43.263000, 76.956000')).toBeVisible();
}

test.beforeEach(async () => { await seedDirectory(); });

test('a directory result saves canonical address and geo from the Trading Points workspace', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'points');
  await cleanup(phone);
  try {
    await authenticate(page, phone);
    await page.goto('/seller/points');
    await page.getByLabel('Название для покупателей').fill(`Directory point ${testInfo.project.name}`);
    await page.getByLabel('Тип торговой точки').selectOption('market');
    const address = page.getByRole('textbox', { name: 'Адрес', exact: true });
    await chooseGreenMarket(address);
    await address.fill('Ручной адрес');
    await expect(page.getByText('43.263000, 76.956000')).toHaveCount(0);
    await chooseGreenMarket(address);
    const detailsSaved = page.waitForResponse((response) => /\/api\/seller\/locations\/[0-9a-f-]+\/details$/.test(response.url()) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    expect((await detailsSaved).status()).toBe(200);

    const me = await page.request.get('/api/seller/me');
    expect((await me.json()).seller.locations[0]).toMatchObject({
      addressText: 'Алматы, Зелёный базар', geo: { latitude: 43.263, longitude: 76.956 },
    });
  } finally {
    await cleanup(phone);
  }
});

test('the embedded card flow uses the same directory selection and keeps the typed product', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 'card');
  await cleanup(phone);
  try {
    await authenticate(page, phone);
    await page.goto('/seller');
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).click();
    await page.getByRole('button', { name: /^Заполнить вручную/ }).click();
    const editor = offerEditor(page);
    await fillOfferFields(page, { product: 'Баранина', price: '5000', unit: 'kg', comment: 'Directory card' });
    await editor.getByRole('button', { name: /^Добавить торговую точку/ }).click();
    await page.getByRole('textbox', { name: 'Название для покупателей', exact: true }).fill(`Embedded point ${testInfo.project.name}`);
    const address = page.getByRole('textbox', { name: 'Где находится точка', exact: true });
    await chooseGreenMarket(address);
    await page.getByRole('combobox', { name: 'Тип', exact: true }).selectOption('shop');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue('5000');

    const me = await page.request.get('/api/seller/me');
    expect((await me.json()).seller.locations[0]).toMatchObject({
      addressText: 'Алматы, Зелёный базар', geo: { latitude: 43.263, longitude: 76.956 },
    });
  } finally {
    await cleanup(phone);
  }
});
