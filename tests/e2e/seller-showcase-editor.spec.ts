import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { choosePoints, chooseUnit, fillOfferFields, offerEditor, openNewCard, publishButton, showcaseCard } from './offer-editor-helpers';

// seller-showcase-editor §7: «Моя витрина» and the manual editor end to end, on a phone and on desktop.

function phoneFor(projectName: string, slot: number) {
  return `+7700003${projectName === 'mobile' ? '6' : '7'}${String(slot).padStart(2, '0')}0`;
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
      const bySeller = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(`DELETE FROM seller_change_item_photos WHERE item_id IN (SELECT i.id FROM seller_change_items i JOIN seller_change_sets cs ON cs.id=i.change_set_id WHERE cs.seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_drafts WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM offer_photos WHERE offer_id IN (SELECT id FROM offers WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM photos WHERE owner_user_id=$1', [row.id]);
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

// A logged-in Seller with geo-confirmed points (prerequisite, not the behavior under test).
async function prepareSeller(page: Page, phone: string, label: string, points: string[]) {
  await cleanup(phone);
  await login(page.request, phone);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, `Витрина ${label}`]);
    for (const point of points) {
      await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы','shop',43.25,76.95)", [seller.rows[0].id, point]);
    }
  });
}

async function ownedOffers(page: Page) {
  return (await (await page.request.get('/api/seller/offers')).json()).offers as {
    id: string; cardId: string; product: { name: string }; location: { name: string }; price: { amount: string }; priceOwn: boolean; sellerComment: string | null;
  }[];
}

test('a new card in two of three points with an own price is published after the responsibility note; buyers find it by a word', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 1);
  const tag = testInfo.project.name;
  const points = [`Базар ${tag}`, `Орда ${tag}`, `Сайран ${tag}`];
  try {
    await prepareSeller(page, phone, `A ${tag}`, points);
    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Моя витрина', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Покажите товары покупателям рядом' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Разделы кабинета' }).last();
    await expect(nav.getByRole('link', { name: 'Витрина' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Точки' })).toBeVisible();

    // The AI ways are visible but off; the manual way is active.
    await page.getByRole('button', { name: 'Сформировать карточки товаров' }).first().click();
    const source = page.getByRole('dialog', { name: 'Как сформировать карточки?' });
    await expect(source.getByRole('button', { name: /Снять видео/ })).toBeDisabled();
    await expect(source.getByRole('button', { name: /Надиктовать товары/ })).toBeDisabled();
    await source.getByRole('button', { name: /^Заполнить вручную/ }).click();
    const editor = offerEditor(page);
    await expect(editor.getByRole('heading', { name: 'Новая карточка' })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Надиктовать' })).toBeDisabled();

    // Required fields are reported after the first attempt, with a summary.
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await expect(editor.getByText('Заполните 4 поля')).toBeVisible();
    await expect(editor.getByText('Напишите, что это за товар')).toBeVisible();
    await expect(editor.getByText('Укажите цену больше 0 ₸')).toBeVisible();
    await expect(editor.getByText('Выберите, за что цена')).toBeVisible();
    await expect(editor.getByText('Выберите хотя бы одну точку')).toBeVisible();

    // A catalog suggestion links the card; the Seller adds their own words after it.
    const name = editor.getByRole('combobox', { name: 'Название товара' });
    await name.fill('бар');
    await editor.getByRole('option', { name: 'Баранина' }).click();
    await name.fill('Баранина, лопатка');
    await fillOfferFields(page, { price: '5000' });
    await chooseUnit(page, 'package');
    await editor.getByRole('textbox', { name: 'Вес или объём' }).fill('600');
    await expect(editor.getByText('Покупатель увидит: «Баранина, лопатка · 600 г»')).toBeVisible();
    // AI-S10: the points sheet; AI-S11: an own price for one of them.
    await editor.getByRole('button', { name: /^Выбрать торговые точки/ }).click();
    const pointsSheet = page.getByRole('dialog', { name: 'Торговые точки' });
    await pointsSheet.getByRole('checkbox', { name: points[0]! }).check();
    await pointsSheet.getByRole('checkbox', { name: points[2]! }).check();
    await expect(pointsSheet.getByText('Будет создано 2 карточки')).toBeVisible();
    await pointsSheet.getByRole('button', { name: 'Настроить цены по точкам' }).click();
    await page.getByRole('button', { name: new RegExp(`^${points[2]}`) }).click();
    await page.getByRole('textbox', { name: 'Цена', exact: true }).fill('5200');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${points[2]}`) })).toContainText('Своё');
    await page.getByRole('button', { name: 'Готово' }).click();
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();

    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await expect(page.getByRole('heading', { name: 'Проверьте карточку', level: 1 })).toBeVisible();
    await expect(page.getByText('Будут опубликованы 2 карточки')).toBeVisible();
    await expect(page.getByText('Вы несёте ответственность за то, чтобы фото, название и описание соответствовали законодательству Республики Казахстан.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: publishButton }).click();

    await expect(page).toHaveURL(/\/seller(\?|$)/);
    await expect(page.getByRole('status').filter({ hasText: 'Опубликовано. Карточка уже видна покупателям' })).toBeVisible();
    const card = showcaseCard(page, /Баранина, лопатка · 600 г/);
    await expect(card).toContainText('2 точки');
    await expect(card).toContainText('Без фото');
    const offers = await ownedOffers(page);
    expect(offers.map((offer) => [offer.location.name, offer.price.amount, offer.priceOwn]).sort()).toEqual([
      [points[0], '5000', false],
      [points[2], '5200', true],
    ]);

    // Buyers find it by the start of a word and see the pack.
    await page.goto('/?q=' + encodeURIComponent('лопат'));
    const result = page.getByRole('article').filter({ hasText: points[2]! });
    await expect(result).toContainText('Баранина, лопатка');
    await expect(result).toContainText('600 г');
  } finally {
    await cleanup(phone);
  }
});

test('a change in all points keeps an own price unless chosen; one point gets its own price and a new point is added', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 2);
  const tag = testInfo.project.name;
  const points = [`Первая ${tag}`, `Вторая ${tag}`, `Третья ${tag}`];
  try {
    await prepareSeller(page, phone, `B ${tag}`, points);
    await openNewCard(page);
    await fillOfferFields(page, { product: 'Курага', price: '1800', unit: 'kg' });
    const editor = offerEditor(page);
    await choosePoints(page, [points[0]!, points[1]!]);
    await editor.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(showcaseCard(page, /Курага/)).toBeVisible();

    // One point gets its own price.
    await showcaseCard(page, /Курага/).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Курага', level: 1 })).toBeVisible();
    await page.locator('div.card').filter({ hasText: points[1]! }).getByRole('button', { name: 'Изменить только в этой точке' }).click();
    const pointEditor = offerEditor(page);
    await expect(pointEditor.getByText(`Меняется только точка «${points[1]}»`)).toBeVisible();
    await pointEditor.getByRole('textbox', { name: 'Цена', exact: true }).fill('2000');
    await pointEditor.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Изменения опубликованы' })).toBeVisible();

    // A change in all points: the own-price point is shown unchecked and keeps its price; a third point is added.
    await showcaseCard(page, /Курага/).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Изменить во всех точках' }).click();
    const all = offerEditor(page);
    await all.getByRole('combobox', { name: 'Название товара' }).fill('Курага отборная');
    await all.getByRole('textbox', { name: 'Цена', exact: true }).fill('1700');
    await expect(all.getByRole('checkbox', { name: new RegExp(points[1]!) })).not.toBeChecked();
    await expect(all.getByText('своя цена: 2 000 ₸')).toBeVisible();
    await all.getByRole('checkbox', { name: new RegExp(points[2]!) }).check();
    await all.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await expect(page.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();
    await expect(page.getByText(/1\s800 → 1\s700/).first()).toBeVisible();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Изменения опубликованы' })).toBeVisible();

    const offers = await ownedOffers(page);
    const byPoint = new Map(offers.map((offer) => [offer.location.name, [offer.product.name, offer.price.amount]]));
    expect(Object.fromEntries(byPoint)).toEqual({
      [points[0]!]: ['Курага отборная', '1700'],
      [points[1]!]: ['Курага отборная', '2000'],
      [points[2]!]: ['Курага отборная', '1700'],
    });
    expect(new Set(offers.map((offer) => offer.cardId)).size).toBe(1);
  } finally {
    await cleanup(phone);
  }
});

test('an unfinished card is kept as a draft, resumed and published; closing with changes asks first', async ({ page }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 3);
  const tag = testInfo.project.name;
  try {
    await prepareSeller(page, phone, `C ${tag}`, [`Точка ${tag}`]);
    const editor = await openNewCard(page);
    await editor.getByRole('combobox', { name: 'Название товара' }).fill('Черешня');

    // Closing with changes: keep editing is the default; the draft can be saved from there.
    await page.keyboard.press('Escape');
    const ask = page.getByRole('alertdialog', { name: 'Закрыть без сохранения?' });
    await expect(ask.getByRole('button', { name: 'Продолжить правку' })).toBeFocused();
    await ask.getByRole('button', { name: 'Сохранить черновик' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Черновик сохранён' })).toBeVisible();
    await page.getByRole('link', { name: 'Черновики · 1' }).click();
    const draft = page.getByRole('article').filter({ hasText: 'Черешня' });
    await expect(draft).toContainText('Черновик');
    await expect(draft).toContainText('Не заполнено: цена, «Цена за»');

    // Nobody else sees a draft.
    await page.goto('/?q=' + encodeURIComponent('черешня'));
    await expect(page.getByRole('article').filter({ hasText: `Точка ${tag}` })).toHaveCount(0);

    await page.goto('/seller?tab=drafts');
    await page.getByRole('article').filter({ hasText: 'Черешня' }).getByRole('button').first().click();
    const resumed = offerEditor(page);
    await expect(resumed.getByRole('heading', { name: 'Черновик' })).toBeVisible();
    await expect(resumed.getByRole('combobox', { name: 'Название товара' })).toHaveValue('Черешня');
    await fillOfferFields(page, { price: '2500', unit: 'kg' });
    await resumed.getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(showcaseCard(page, /Черешня/)).toBeVisible();
    // With no drafts left the tabs give way to «Карточки · N».
    await expect(page.getByRole('link', { name: /^Черновики/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Карточки · 1' })).toBeVisible();
  } finally {
    await cleanup(phone);
  }
});

test('a change made on another device is caught at review; «Обновить» reopens the editor with the Seller\'s values', async ({ page, browser }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 4);
  const tag = testInfo.project.name;
  try {
    await prepareSeller(page, phone, `D ${tag}`, [`Точка ${tag}`]);
    await openNewCard(page);
    await fillOfferFields(page, { product: 'Мёд', price: '4000', unit: 'kg' });
    await offerEditor(page).getByRole('button', { name: 'Проверить и опубликовать' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(showcaseCard(page, /Мёд/)).toBeVisible();

    await showcaseCard(page, /Мёд/).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await fillOfferFields(page, { price: '4200' });
    await offerEditor(page).getByRole('button', { name: 'Проверить и сохранить' }).click();
    await expect(page.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();

    const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      await login(other.request, phone);
      const [offer] = (await (await other.request.get('/api/seller/offers')).json()).offers;
      const change = await (await other.request.post(`/api/seller/offers/${offer.id}/price-change-sets`, { data: { revision: offer.revision, price: '4100' } })).json();
      expect((await other.request.post(`/api/seller/change-sets/${change.changeSet.id}/confirm`)).ok()).toBe(true);
    } finally {
      await other.close();
    }

    await page.getByRole('button', { name: publishButton }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Карточку уже изменили с другого устройства — обновите' })).toBeVisible();
    expect((await ownedOffers(page))[0]!.price.amount).toBe('4100');
    await page.getByRole('link', { name: 'Обновить' }).click();
    const editor = offerEditor(page);
    await expect(editor.getByRole('textbox', { name: 'Цена', exact: true })).toHaveValue('4200');
    await editor.getByRole('button', { name: 'Проверить и сохранить' }).click();
    await page.getByRole('button', { name: publishButton }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Изменения опубликованы' })).toBeVisible();
    expect((await ownedOffers(page))[0]!.price.amount).toBe('4200');
  } finally {
    await cleanup(phone);
  }
});

test('in Kazakh at 320 px the showcase and the editor fit; old addresses lead to the showcase; «Ещё» has the list input', async ({ page, context, baseURL }, testInfo) => {
  const phone = phoneFor(testInfo.project.name, 5);
  const tag = testInfo.project.name;
  try {
    await prepareSeller(page, phone, `E ${tag}`, [`Нүкте ${tag}`]);
    await page.goto('/seller/offers?new=1');
    await expect(page).toHaveURL(/\/seller\?new=1$/);
    await expect(offerEditor(page)).toBeVisible();

    await context.addCookies([{ name: 'kaida_locale', value: 'kk', url: baseURL! }]);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Менің витринам', level: 1 })).toBeVisible();
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Тауар карточкаларын жасау' }).first().click();
    await page.getByRole('button', { name: /^Қолмен толтыру/ }).click();
    const editor = offerEditor(page);
    await expect(editor.getByRole('heading', { name: 'Жаңа карточка' })).toBeVisible();
    await editor.getByRole('button', { name: 'Тексеру және жариялау' }).click();
    await expect(editor.getByText('Бұл қандай тауар екенін жазыңыз')).toBeVisible();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    if (testInfo.project.name === 'mobile') {
      await page.goto('/seller');
      await page.getByRole('link', { name: 'Тағы' }).click();
      await expect(page.getByRole('link', { name: 'Тізіммен қосу' })).toBeVisible();
    }
  } finally {
    await cleanup(phone);
  }
});
