import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

function phonesFor(projectName: string, slot: number) {
  const base = (projectName === 'mobile' ? 10 : 50) + slot * 2;
  return { login: `+770000034${base}`, public: `+770000034${base + 1}` };
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

async function login(request: APIRequestContext, phone: string) {
  const requested = await (await request.post('/api/auth/otp/request', { data: { phone } })).json();
  const verified = await request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } });
  expect(verified.ok()).toBe(true);
}

// Seller, two trading points and three Offers (two active, one switched off) are prerequisites, not the behavior under test.
async function prepareCabinet(request: APIRequestContext, phones: { login: string; public: string }, sellerName: string) {
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phones.login]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name, contact_phone_e164) VALUES ($1,$2,$3) RETURNING id', [user.rows[0].id, sellerName, phones.public]);
    await pool.query(
      "INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,$2,'Алматы, первая','shop',43.24,76.88),($1,$3,'Алматы, вторая','market',NULL,NULL)",
      [seller.rows[0].id, `${sellerName} лавка`, `${sellerName} базар`],
    );
  });
  const { seller } = await (await request.get('/api/seller/me')).json();
  const byName = (suffix: string) => seller.locations.find((location: { name: string }) => location.name === `${sellerName} ${suffix}`);
  const shop = byName('лавка');
  const market = byName('базар');
  for (const [productName, amount, locationId] of [['Баранина', '3200', market.id], ['Говядина', '2700', shop.id], ['Баранина', '3100', shop.id]] as const) {
    const created = await (await request.post('/api/seller/change-sets', { data: { productName, locationId, price: { amount, unit: { code: 'kg' } }, sellerComment: null } })).json();
    expect((await request.post(`/api/seller/change-sets/${created.changeSet.id}/confirm`)).ok()).toBe(true);
  }
  const { offers } = await (await request.get('/api/seller/offers')).json();
  const beefOff = offers.find((offer: { product: { name: string } }) => offer.product.name === 'Говядина');
  const off = await (await request.post(`/api/seller/offers/${beefOff.id}/change-sets`, { data: { action: 'deactivate_offer' } })).json();
  expect((await request.post(`/api/seller/change-sets/${off.changeSet.id}/confirm`)).ok()).toBe(true);
}

function card(page: Page, product: string, point: string) {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name: product, exact: true }) }).filter({ hasText: point });
}

async function expectNoTechnicalWords(page: Page) {
  await expect(page.getByText(/\bOffer\b|ChangeSet|Change Set|ChangeItem|proposed|ID:/)).toHaveCount(0);
}

test('Seller cabinet: navigation, first run, overview counts, filters, switch off and on through confirmation', async ({ page }, testInfo) => {
  const phones = phonesFor(testInfo.project.name, 0);
  const sellerName = `Кабинет ${testInfo.project.name}`;
  const mobile = testInfo.project.name === 'mobile';
  await cleanup(phones.login);
  try {
    await login(page.request, phones.login);

    // First run: one primary action, no invented numbers.
    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Начните с первого предложения', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Добавить товар' })).toHaveCount(1);

    await prepareCabinet(page.request, phones, sellerName);
    await page.goto('/seller');
    const summary = page.getByRole('list', { name: 'Сводка' });
    await expect(summary.getByRole('listitem').filter({ hasText: 'точки' })).toContainText('2');
    await expect(summary.getByRole('listitem').filter({ hasText: 'активны' })).toContainText('2');
    await expect(summary.getByRole('listitem').filter({ hasText: 'выключено' })).toContainText('1');
    await expect(page.getByRole('heading', { name: 'Последние изменения' })).toBeVisible();
    await expectNoTechnicalWords(page);

    // Navigation: mobile has three items plus «Ещё»; desktop has all four destinations and logout.
    const nav = page.getByRole('navigation', { name: 'Разделы кабинета' }).filter({ visible: true });
    if (mobile) {
      await expect(nav.getByRole('link')).toHaveText(['Обзор', 'Предложения', 'Точки']);
      await nav.getByRole('button', { name: 'Ещё' }).click();
      const sheet = page.getByRole('dialog', { name: 'Ещё' });
      await expect(sheet.getByRole('link', { name: 'Контакты' })).toBeFocused();
      await expect(sheet.getByRole('button', { name: 'Выйти' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(nav.getByRole('button', { name: 'Ещё' })).toBeFocused();
    } else {
      await expect(nav.getByRole('link')).toHaveText(['Обзор', 'Предложения', 'Точки', 'Контакты']);
      await expect(nav.getByRole('button', { name: 'Выйти' })).toBeVisible();
    }
    await expect(page.locator('[aria-disabled="true"], nav button:disabled')).toHaveCount(0);

    // Offers list: status by text, filter counts, filter kept in the URL across reload.
    await nav.getByRole('link', { name: 'Предложения' }).click();
    await expect(page).toHaveURL(/\/seller\/offers$/);
    await expect(page.getByRole('link', { name: 'Все · 3' })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('link', { name: 'Активные · 2' }).click();
    await expect(page).toHaveURL(/status=active/);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Активные · 2' })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('article')).toHaveCount(2);
    const visibleCard = card(page, 'Баранина', `${sellerName} лавка`);
    await expect(visibleCard.getByText('Активно', { exact: true })).toBeVisible();
    await expect(visibleCard.getByText(/Видно покупателям/)).toBeVisible();
    await expect(card(page, 'Баранина', `${sellerName} базар`).getByText(/Не видно покупателям/)).toBeVisible();
    await expect(visibleCard.getByRole('link', { name: 'Изменить' })).toBeVisible();
    await expectNoTechnicalWords(page);

    // Switch off through the confirmation page; Back never returns to an actionable review.
    await visibleCard.getByRole('button', { name: /Другие действия/ }).click();
    await page.getByRole('menuitem', { name: 'Выключить' }).click();
    await expect(page).toHaveURL(/\/seller\/change-sets\//);
    await expect(page.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();
    await expect(page.getByText('Выключение предложения')).toBeVisible();
    await expectNoTechnicalWords(page);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page).toHaveURL(/\/seller\/offers\?status=active$/);
    await expect(page.getByRole('status').filter({ hasText: 'Предложение выключено' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Активные · 1' })).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/change-sets/);

    // Switch it back on from «Выключены».
    await page.goto('/seller/offers?status=inactive');
    const offCard = card(page, 'Баранина', `${sellerName} лавка`);
    await expect(offCard.getByText('Выключено', { exact: true })).toBeVisible();
    await offCard.getByRole('button', { name: 'Включить' }).click();
    await expect(page.getByText('Включение предложения')).toBeVisible();
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    await expect(page).toHaveURL(/\/seller\/offers\?status=inactive$/);
    await expect(page.getByRole('status').filter({ hasText: 'Предложение включено и видно покупателям' })).toBeVisible();

    // A confirmed deep link is read-only.
    const { offers } = await (await page.request.get('/api/seller/offers')).json();
    expect(offers.find((offer: { location: { name: string }; product: { name: string } }) => offer.product.name === 'Баранина' && offer.location.name === `${sellerName} лавка`).status).toBe('active');

    // Batch stays reachable from the list header.
    await page.goto('/seller/offers');
    await page.getByRole('button', { name: 'Другие действия', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Изменить несколько товаров' }).click();
    await expect(page).toHaveURL(/\/seller\/batch$/);
  } finally {
    await cleanup(phones.login);
  }
});

test('Confirm conflict from a second device applies nothing and offers a safe retry', async ({ page, browser }, testInfo) => {
  const phones = phonesFor(testInfo.project.name, 1);
  const sellerName = `Конфликт ${testInfo.project.name}`;
  await cleanup(phones.login);
  try {
    await login(page.request, phones.login);
    await prepareCabinet(page.request, phones, sellerName);

    await page.goto('/seller/offers?status=active');
    const target = card(page, 'Баранина', `${sellerName} лавка`);
    await target.getByRole('link', { name: 'Изменить' }).click();
    const editor = page.getByRole('dialog', { name: 'Изменить предложение' });
    await editor.getByRole('textbox', { name: 'Цена', exact: true }).fill('3400');
    await editor.getByRole('button', { name: 'Далее' }).click();
    await expect(page.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();
    await expect(page.getByText('3 100 ₸ / кг').first()).toBeVisible();

    // Second device changes the same Offer while the review is open.
    const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      await login(other.request, phones.login);
      const { offers } = await (await other.request.get('/api/seller/offers')).json();
      const offer = offers.find((item: { product: { name: string }; location: { name: string } }) => item.product.name === 'Баранина' && item.location.name === `${sellerName} лавка`);
      const change = await (await other.request.post(`/api/seller/offers/${offer.id}/change-sets`, { data: { action: 'update_offer', price: { amount: '3300', unit: { code: 'kg' } }, sellerComment: '' } })).json();
      expect((await other.request.post(`/api/seller/change-sets/${change.changeSet.id}/confirm`)).ok()).toBe(true);
    } finally {
      await other.close();
    }

    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Предложение уже изменилось' });
    await expect(alert).toContainText('Мы ничего не применили');
    await expect(page.getByText('Сейчас в предложении')).toBeVisible();
    await expect(page.getByText(/3\s300 ₸ \/ кг/)).toBeVisible();
    await expect(page.getByText(/3\s400 ₸ \/ кг/)).toBeVisible();

    const { offers: afterConflict } = await (await page.request.get('/api/seller/offers')).json();
    expect(afterConflict.find((item: { product: { name: string }; location: { name: string } }) => item.product.name === 'Баранина' && item.location.name === `${sellerName} лавка`).price.amount).toBe('3300');

    await page.getByRole('button', { name: 'Обновить и проверить заново' }).click();
    await expect(page.getByRole('heading', { name: 'Проверьте изменения', level: 1 })).toBeVisible();
    await expect(page.getByText('Предложение уже изменилось')).toHaveCount(0);
    await page.getByRole('button', { name: 'Подтвердить и опубликовать' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Изменения сохранены' })).toBeVisible();
    await expect(card(page, 'Баранина', `${sellerName} лавка`)).toContainText(/3\s400 ₸/);
  } finally {
    await cleanup(phones.login);
  }
});

test('Seller cabinet in Kazakh on a phone width keeps the same structure without clipping', async ({ page, context, baseURL }, testInfo) => {
  const phones = phonesFor(testInfo.project.name, 2);
  const sellerName = `Қазақша ${testInfo.project.name}`;
  await cleanup(phones.login);
  try {
    await context.addCookies([{ name: 'kaida_locale', value: 'kk', url: baseURL! }]);
    await page.setViewportSize({ width: 320, height: 720 });
    await login(page.request, phones.login);
    await prepareCabinet(page.request, phones, sellerName);

    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Шолу', level: 1 })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Жиынтық' })).toContainText('белсенді');
    await page.goto('/seller/offers');
    await expect(page.getByRole('link', { name: 'Барлығы · 3' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Қой еті, жауырын' }).first()).toHaveAttribute('lang', 'kk');
    await expect(page.getByText('Белсенді', { exact: true }).first()).toBeVisible();
    await expectNoTechnicalWords(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await cleanup(phones.login);
  }
});
