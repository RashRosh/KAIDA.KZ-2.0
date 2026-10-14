import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// contact-default §10 and §11: the chips on a point form, the notices, nothing stored before «Сохранить», and the buyer icons.

// One phone per test: the tests of a file run in parallel and each cleans up its own Seller.
const phoneFor = (project: string, test: 1 | 2 | 3 | 4 | 5 | 6) => `+7700008${project === 'mobile' ? '1' : '2'}00${test}`;
const LOGIN_CHIP = /^Указать\sмой\sномер\s\+7\s700\s008\s[12]0\s0[1-6]$/;
const SAME_CHIP = 'Тот же номер, что в «Телефоне»';
const NOTICE_PHONE = 'Это номер, с которого вы вошли. Покупатели смогут позвонить на этот номер.';
const NOTICE_WHATSAPP = 'Покупатели смогут написать на этот номер.';
const SHORT = new Set(['в', 'во', 'на', 'с', 'со', 'к', 'ко', 'по', 'за', 'от', 'до', 'из', 'у', 'о', 'об', 'и', 'а', 'но', 'не', 'ни', 'да', 'же', 'ли', 'бы']);

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
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM seller_verified_phones WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${bySeller})`, [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function login(page: Page, phone: string) {
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
}

// A Seller with points; each point is [name, phone|null, whatsapp|null], created in this order.
async function seedSeller(phone: string, points: [string, string | null, string | null][]) {
  return withPool(async (pool) => {
    const user = (await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone])).rows[0];
    const seller = (await pool.query("INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,'Контакты продавец') RETURNING id", [user.id])).rows[0];
    const ids: string[] = [];
    for (const [index, [name, pointPhone, whatsapp]] of points.entries()) {
      const row = (await pool.query(
        "INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude,phone_e164,whatsapp_phone_e164,created_at) VALUES ($1,$2,'Алматы','shop',43.25,76.95,$3,$4, now() + make_interval(secs => $5)) RETURNING id",
        [seller.id, name, pointPhone, whatsapp, index],
      )).rows[0];
      ids.push(row.id);
    }
    return { sellerId: seller.id as string, ids };
  });
}

const target = async (locator: ReturnType<Page['locator']>) => {
  // A target of at least 44 px, allowing the sub-pixel rounding of the layout (43.99998).
  await expect.poll(async () => (await locator.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
};

test('first point: no prefill, a chip fills the login number, the notice and the WhatsApp chip follow; nothing is stored before saving; buyers get the icons', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const phone = phoneFor(testInfo.project.name, 1);
  const pointName = `Контакты точка ${testInfo.project.name}`;
  const detailsCalls: string[] = [];
  page.on('request', (request) => { if (/\/api\/seller\/locations\/[^/]+\/details$/.test(request.url()) && request.method() === 'PUT') detailsCalls.push(request.url()); });
  await cleanup(phone);
  try {
    await login(page, phone);
    await page.goto('/seller/points');
    await expect(page.getByRole('heading', { name: 'Новая торговая точка', level: 1 })).toBeVisible();

    // Nothing is prefilled; the chip waits under «Телефон»; the WhatsApp chip is not shown while the phone is empty.
    const phoneField = page.getByLabel('Телефон', { exact: true });
    const whatsappField = page.getByLabel('WhatsApp', { exact: true });
    await expect(phoneField).toHaveValue('');
    await expect(whatsappField).toHaveValue('');
    const chip = page.getByTestId('chip-login-number');
    await expect(chip).toHaveText(LOGIN_CHIP);
    await target(chip);
    await expect(page.getByTestId('chip-same-phone')).toHaveCount(0);
    await expect(page.getByText(NOTICE_PHONE, { exact: true })).toHaveCount(0);

    // One tap: the number is in the field, confirmed, with its notice; the WhatsApp chip appears.
    await chip.click();
    await expect(phoneField).toHaveValue(phone);
    await expect(page.getByText(NOTICE_PHONE, { exact: true })).toBeVisible();
    await expect(page.getByText('Подтверждён', { exact: true })).toHaveCount(1);
    await expect(chip).toHaveCount(0);
    const same = page.getByRole('button', { name: SAME_CHIP, exact: true });
    await expect(same).toBeVisible();
    await target(same);
    await expect(page.getByText(NOTICE_WHATSAPP, { exact: true })).toHaveCount(0);

    // Clearing the field with its own control brings the login chip back, the notice and the WhatsApp chip go away.
    await phoneField.fill('');
    await expect(chip).toBeVisible();
    await expect(page.getByText(NOTICE_PHONE, { exact: true })).toHaveCount(0);
    await expect(same).toHaveCount(0);
    await chip.click();

    // The second chip copies the number of «Телефон».
    await same.click();
    await expect(whatsappField).toHaveValue(phone);
    await expect(page.getByText(NOTICE_WHATSAPP, { exact: true })).toBeVisible();
    await expect(same).toHaveCount(0);

    // Nothing was stored by the chips (no point exists yet).
    expect(detailsCalls).toEqual([]);
    expect(await withPool(async (pool) => (await pool.query('SELECT count(*)::int AS n FROM sellers s JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0].n)).toBe(0);

    await page.getByLabel('Имя', { exact: true }).fill(`Контакты ${testInfo.project.name}`);
    await page.getByRole('textbox', { name: 'Название для покупателей', exact: true }).fill(pointName);
    await page.getByLabel('Тип торговой точки').selectOption('shop');
    await page.getByRole('textbox', { name: 'Адрес', exact: true }).fill('Алматы, контактный адрес');
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.locator('[data-testid^="trading-point-"]').getByText(pointName, { exact: true })).toBeVisible();
    expect(detailsCalls).toHaveLength(1);

    // Saved: the login number is recorded as verified for the Seller, and the point holds both numbers.
    const stored = await withPool(async (pool) => (await pool.query(
      'SELECT l.phone_e164 AS phone, l.whatsapp_phone_e164 AS whatsapp, (SELECT array_agg(v.phone_e164) FROM seller_verified_phones v WHERE v.seller_id=s.id) AS verified FROM locations l JOIN sellers s ON s.id=l.seller_id JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1',
      [phone],
    )).rows);
    expect(stored).toEqual([{ phone, whatsapp: phone, verified: [phone] }]);

    // The buyer sees the call and WhatsApp icons, not the number as text.
    await withPool(async (pool) => {
      const product = (await pool.query("SELECT id FROM products WHERE name='Баранина'")).rows[0].id;
      const point = (await pool.query('SELECT l.id, l.seller_id FROM locations l JOIN sellers s ON s.id=l.seller_id JOIN users u ON u.id=s.owner_user_id WHERE u.phone_e164=$1', [phone])).rows[0];
      await pool.query('UPDATE locations SET latitude=43.2, longitude=76.9 WHERE id=$1', [point.id]);
      await pool.query(`INSERT INTO offers (product_id,seller_id,location_id,price_amount,price_currency,status,last_confirmed_at,title,title_search,card_id)
        VALUES ($1,$2,$3,'100','KZT','active',now(),(SELECT name FROM products WHERE id=$1::uuid),lower((SELECT name FROM products WHERE id=$1::uuid)),$4)`, [product, point.seller_id, point.id, randomUUID()]);
    });
    await page.goto('/');
    await page.getByLabel('Какой товар ищете?').fill('баранина');
    await page.getByLabel('Какой товар ищете?').press('Enter');
    const offer = page.locator('article').filter({ hasText: pointName }).first();
    await expect(offer).toBeVisible();
    await expect(offer.getByRole('link', { name: 'Позвонить продавцу', exact: true })).toHaveAttribute('href', `tel:${phone}`);
    await expect(offer.getByRole('link', { name: 'Написать в WhatsApp', exact: true })).toHaveAttribute('href', `https://wa.me/${phone.slice(1)}`);
    expect(await offer.innerText()).not.toContain(phone.slice(2));
  } finally {
    await cleanup(phone);
  }
});

test('leaving the form after a chip tap stores nothing', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const phone = phoneFor(testInfo.project.name, 2);
  await cleanup(phone);
  try {
    await login(page, phone);
    const { ids, sellerId } = await seedSeller(phone, [['Пустая точка', null, null]]);
    await page.goto('/seller/points');
    await page.getByRole('button', { name: 'Изменить торговую точку Пустая точка' }).click();
    // An existing point with an empty phone shows the chip too; a tap fills the field only.
    const chip = page.getByTestId('chip-login-number');
    await expect(chip).toHaveText(LOGIN_CHIP);
    await chip.click();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue(phone);
    await page.getByRole('button', { name: 'Отмена' }).click();
    expect(await withPool(async (pool) => (await pool.query('SELECT phone_e164, whatsapp_phone_e164 FROM locations WHERE id=$1', [ids[0]])).rows[0]))
      .toEqual({ phone_e164: null, whatsapp_phone_e164: null });
    expect(await withPool(async (pool) => (await pool.query('SELECT count(*)::int AS n FROM seller_verified_phones WHERE seller_id=$1', [sellerId])).rows[0].n)).toBe(0);

    // The same chip, then «Сохранить»: the existing point now holds the number.
    await page.getByRole('button', { name: 'Изменить торговую точку Пустая точка' }).click();
    await page.getByTestId('chip-login-number').click();
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText('Торговая точка сохранена.', { exact: true })).toBeVisible();
    expect(await withPool(async (pool) => (await pool.query('SELECT phone_e164 FROM locations WHERE id=$1', [ids[0]])).rows[0].phone_e164)).toBe(phone);
    expect(await withPool(async (pool) => (await pool.query('SELECT phone_e164 FROM seller_verified_phones WHERE seller_id=$1', [sellerId])).rows.map((row) => row.phone_e164))).toEqual([phone]);
  } finally {
    await cleanup(phone);
  }
});

test('a copied non-empty phone shows no chip; a later point with an empty latest phone shows it; a point with a number shows none', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const copyPhone = phoneFor(testInfo.project.name, 3);
  const emptyPhone = phoneFor(testInfo.project.name, 4);
  await cleanup(copyPhone);
  await cleanup(emptyPhone);
  try {
    // (C) two points, the latest has a phone: «Добавить» copies it, no chip.
    await login(page, copyPhone);
    await seedSeller(copyPhone, [['Первая', null, null], ['Вторая', '+77010008399', null]]);
    await page.goto('/seller/points');
    await page.getByRole('button', { name: 'Добавить торговую точку' }).click();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue('+77010008399');
    await expect(page.getByText(/^Контакты и режим работы как у точки «Вторая»/)).toBeVisible();
    await expect(page.getByTestId('chip-login-number')).toHaveCount(0);
    // WhatsApp is empty and the phone holds a number: the WhatsApp chip is offered (copy of «Телефон», not of the login number).
    await expect(page.getByRole('button', { name: SAME_CHIP, exact: true })).toBeVisible();
    await expect(page.getByText(NOTICE_PHONE, { exact: true })).toHaveCount(0);
    // Editing the point that holds a number shows no login chip either.
    await page.getByRole('button', { name: 'Отмена' }).click();
    await page.getByRole('button', { name: 'Изменить торговую точку Вторая' }).click();
    await expect(page.getByTestId('chip-login-number')).toHaveCount(0);
    await page.getByRole('button', { name: 'Отмена' }).click();

    // A second point whose latest point has no phone shows the login chip.
    await page.context().clearCookies();
    await login(page, emptyPhone);
    await seedSeller(emptyPhone, [['Без телефона', null, null]]);
    await page.goto('/seller/points');
    await page.getByRole('button', { name: 'Добавить торговую точку' }).click();
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue('');
    await expect(page.getByTestId('chip-login-number')).toHaveText(LOGIN_CHIP);
  } finally {
    await cleanup(copyPhone);
    await cleanup(emptyPhone);
  }
});

test('without the login number (/api/auth/me fails) there is no chip and no error', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const phone = phoneFor(testInfo.project.name, 5);
  await cleanup(phone);
  try {
    await login(page, phone);
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"AUTH_UNAVAILABLE"}}' }));
    await page.goto('/seller/points');
    await expect(page.getByRole('heading', { name: 'Новая торговая точка', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Телефон', { exact: true })).toBeVisible();
    await expect(page.getByTestId('chip-login-number')).toHaveCount(0);
    await expect(page.locator('.banner.err')).toHaveCount(0);
    await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue('');
  } finally {
    await cleanup(phone);
  }
});

// RU wording at 320 px: no horizontal scroll, no short preposition or conjunction at the end of a line in the new texts.
async function lineEnds(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const ends: string[] = [];
    for (const element of Array.from(document.querySelectorAll(sel))) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const words: { text: string; top: number }[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (const match of text.matchAll(/[^\s]+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index!);
          range.setEnd(node, match.index! + match[0].length);
          const rect = range.getClientRects()[0];
          if (rect && rect.width > 0) words.push({ text: match[0], top: Math.round(rect.top) });
        }
      }
      words.forEach((word, index) => {
        const next = words[index + 1];
        if (!next || Math.abs(next.top - word.top) > 4) ends.push(word.text.toLowerCase().replace(/[.,;:·]+$/g, ''));
      });
    }
    return ends;
  }, selector);
}

test('texts fit at 320 and 390 px without short words at line ends or horizontal scroll', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const phone = phoneFor(testInfo.project.name, 6);
  await cleanup(phone);
  try {
    await login(page, phone);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto('/seller/points');
      await expect(page.getByRole('heading', { name: 'Новая торговая точка', level: 1 })).toBeVisible();
      await page.getByTestId('chip-login-number').click();
      await expect(page.getByTestId('chip-same-phone')).toBeVisible();
      await page.getByTestId('chip-same-phone').click();
      await expect(page.getByText(NOTICE_WHATSAPP, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const ends = await lineEnds(page, '[data-testid^="chip-"], .banner.info p, p.c.c2');
      expect(ends.filter((word) => SHORT.has(word))).toEqual([]);
    }
  } finally {
    await cleanup(phone);
  }
});
