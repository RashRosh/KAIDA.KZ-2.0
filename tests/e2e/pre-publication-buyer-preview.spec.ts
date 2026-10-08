import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { setLocaleCookie } from './buyer-helpers';
import { choosePoints, fillOfferFields, offerEditor, openNewCard } from './offer-editor-helpers';

// pre-publication-buyer-preview (docs/slices/pre-publication-buyer-preview, contract rev 1): the Seller opens a PRIVATE preview of
// the card from the editor — new card or edit — before anything is published. The page is the buyer's own with a permanent note,
// route and contacts are inert, nothing is saved, the editor keeps what was typed, the device Back closes the preview.

function phoneFor(projectName: string) {
  return `+7700004${projectName === 'mobile' ? '8' : '9'}000`;
}
async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  try { return await run(pool); } finally { await pool.end(); }
}
async function cleanup(phone: string) {
  await withPool(async (pool) => {
    const users = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    for (const row of users.rows) {
      const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}
async function login(request: APIRequestContext, phone: string) {
  const requested = await (await request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}
async function offerCount(phone: string) {
  return withPool(async (pool) => Number((await pool.query(
    'SELECT count(*) FROM offers WHERE seller_id IN (SELECT s.id FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1)', [phone])).rows[0].count));
}

test('the preview from the editor: new card, several points, edit; private, inert, nothing saved, the editor keeps its values', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name);
  const tag = testInfo.project.name;
  const points = [`Точка А ${tag}`, `Точка Б ${tag}`];
  const existing = { card: randomUUID(), offer: randomUUID(), title: `Предпросмотр готовая ${tag}` };
  try {
    await cleanup(phone);
    await login(page.request, phone);
    await withPool(async (pool) => {
      const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
      const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, `Витрина предпросмотра ${tag}`]);
      const locations: string[] = [];
      for (const point of points) {
        const location = await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95) RETURNING id", [seller.rows[0].id, point]);
        locations.push(location.rows[0].id);
      }
      await pool.query(
        `INSERT INTO offers (id, product_id, seller_id, location_id, title, title_search, card_id, price_amount, price_currency, price_unit_code, status, last_confirmed_at, price_own)
         VALUES ($1, NULL, $2, $3, $4, lower($4), $5, '4500', 'KZT', 'kg', 'active', now(), false)`,
        [existing.offer, seller.rows[0].id, locations[0], existing.title, existing.card],
      );
    });
    const before = await offerCount(phone);

    // a new card: the button is there but waits for a title, a price and a point, and says what is missing
    const editor = await openNewCard(page);
    const open = editor.getByTestId('preview-open');
    await expect(open).toHaveText('Как увидят покупатели');
    await expect(open).toBeDisabled();
    await expect(editor.getByTestId('preview-reason')).toContainText('Укажите название и цену');
    await fillOfferFields(page, { product: `Предпросмотр новая ${tag}`, price: '1200', unit: 'kg', comment: 'Свежая партия' });
    await expect(open).toBeDisabled();
    await expect(editor.getByTestId('preview-reason')).toContainText('Выберите точку');
    await choosePoints(page, [points[0]!]);
    await expect(open).toBeEnabled();

    // one point: the buyer's own page with the permanent unpublished note; route and contacts are inert; no interest action
    const interest: string[] = [];
    page.on('request', (item) => { if (item.url().includes('/api/interests')) interest.push(item.url()); });
    await open.click();
    const note = page.getByRole('note');
    await expect(note).toContainText('Покупатели этого пока не видят');
    await expect(page.getByTestId('card-preview').getByRole('heading', { level: 1 })).toHaveText(`Предпросмотр новая ${tag}`);
    await expect(page.getByTestId('card-preview')).toContainText('Свежая партия');
    await expect(page.getByTestId('card-preview').getByText(/1\s?200\s?₸/).first()).toBeVisible();
    await expect(page.getByTestId('offer-actions-inert')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: /избранное/ })).toHaveCount(0);
    expect(interest).toEqual([]);
    expect(page.url()).not.toContain('preview:');

    // back to the editor by the button: what was typed is still there; nothing was saved
    await note.getByRole('button', { name: 'Вернуться к редактированию' }).click();
    await expect(editor.getByRole('combobox', { name: 'Название товара' })).toHaveValue(`Предпросмотр новая ${tag}`);
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue('1200');
    expect(await offerCount(phone)).toBe(before);

    // the device Back closes the preview first and keeps the editor
    await open.click();
    await expect(page.getByRole('note')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('note')).toHaveCount(0);
    await expect(editor.getByRole('combobox', { name: 'Название товара' })).toHaveValue(`Предпросмотр новая ${tag}`);

    // several points: a list with the price at each point, then the page of the chosen one, then back to the list
    await choosePoints(page, [points[1]!]);
    await open.click();
    const rows = page.getByTestId('preview-point');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(/1\s?200\s?₸/);
    await rows.nth(1).click();
    await expect(page.getByTestId('card-preview').getByRole('heading', { level: 1 })).toHaveText(`Предпросмотр новая ${tag}`);
    await page.getByRole('button', { name: 'К списку точек' }).first().click();
    await expect(rows).toHaveCount(2);
    await page.getByRole('button', { name: 'Вернуться к редактированию' }).first().click();
    await expect(editor.getByTestId('preview-open')).toBeVisible();
    expect(await offerCount(phone)).toBe(before);

    // the synthetic id has no address of its own
    await page.goto('/offers/preview:0');
    await expect(page.getByRole('heading', { name: 'Предложение больше недоступно' })).toBeVisible();

    // edit of a published card: the note says buyers still see the old version; the new price is shown, the real page is unchanged
    await page.goto(`/seller?card=${existing.card}`);
    await page.getByRole('button', { name: /^(Редактировать|Изменить во всех точках)$/ }).click();
    const edit = offerEditor(page);
    await edit.getByRole('textbox', { name: 'Цена', exact: true }).fill('9900');
    await edit.getByTestId('preview-open').click();
    await expect(page.getByRole('note')).toContainText('Покупатели видят прежнюю версию');
    await expect(page.getByTestId('card-preview').getByText(/9\s?900\s?₸/).first()).toBeVisible();
    const real = await (await page.request.get(`/api/search?q=${encodeURIComponent(existing.title)}`)).json();
    expect(real.offers.find((item: { id: string }) => item.id === existing.offer).price.amount).toBe('4500.00');

    // Kazakh on a narrow screen with large text: the note and the page wrap, nothing sideways
    await setLocaleCookie(page.context(), 'kk');
    await page.setViewportSize({ width: 320, height: 800 });
    await page.reload();
    await page.getByRole('button', { name: /^(Өзгерту|Барлық нүктеде өзгерту|Редактировать)/ }).first().click();
    const kk = offerEditor(page);
    await kk.getByRole('textbox', { name: /^Баға/ }).fill('9900');
    await kk.getByTestId('preview-open').click();
    await expect(page.getByRole('note')).toContainText('Өзгерістерді алдын ала қарау');
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cleanup(phone);
  }
});
