import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';

// actuality-words §10: the one-tap «Всё актуально · N» on «Моя витрина», partial success, the review list, and the
// wording at 320 / 390 px (no horizontal scroll, no short preposition or conjunction at the end of a line).

const phoneFor = (project: string) => `+7700006${project === 'mobile' ? '1' : '2'}001`;
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
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${bySeller}))`, [row.id]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${bySeller})`, [row.id]);
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

// A Seller with one point and cards of given ages (hours since confirmation), inserted directly: the passage of time is
// not the behavior under test.
async function seed(phone: string, cards: { title: string; hours: number }[]) {
  return withPool(async (pool) => {
    const user = (await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone])).rows[0];
    const seller = (await pool.query("INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,'Слова продавец') RETURNING id", [user.id])).rows[0];
    const location = (await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,'Слова точка','Алматы','shop',43.25,76.95) RETURNING id", [seller.id])).rows[0];
    const ids: Record<string, string> = {};
    for (const card of cards) {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO offers (id,seller_id,location_id,status,last_confirmed_at,title,title_search,card_id,price_amount,price_currency,price_unit_code) VALUES ($1,$2,$3,'active', now() - make_interval(hours => $4), $5, lower($5), $6, 1000, 'KZT', 'kg')",
        [id, seller.id, location.id, card.hours, card.title, randomUUID()],
      );
      ids[card.title] = id;
    }
    return ids;
  });
}

// The last word of every rendered line of an element (words joined by non-breaking spaces are one word).
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

test('one tap confirms the due cards buyers see; a card that cannot be confirmed is reported and the list opens', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const phone = phoneFor(testInfo.project.name);
  try {
    await cleanup(phone);
    await login(page.request, phone);
    const ids = await seed(phone, [
      { title: 'Слова курага', hours: 30 },
      { title: 'Слова изюм', hours: 100 },
      { title: 'Слова сыр', hours: 1 },
      { title: 'Слова чай', hours: 200 },
    ]);
    await page.goto('/seller');
    const task = page.getByTestId('actuality-task');
    await expect(task).toContainText('3 карточки · 1 уже скрыта с витрины');
    await expect(task.getByRole('button', { name: 'Всё актуально · 2' })).toBeVisible();
    // «Проверить» stays, as a secondary button.
    await expect(task.getByRole('button', { name: 'Проверить' })).toHaveClass(/btn-o/);

    // One card stops being confirmable after the page loaded (switched off in another tab).
    await withPool((pool) => pool.query("UPDATE offers SET status='inactive' WHERE id=$1", [ids['Слова изюм']]));
    await task.getByRole('button', { name: 'Всё актуально · 2' }).click();
    const partial = page.getByRole('status').filter({ hasText: 'Подтверждено 1, не удалось 1' });
    await expect(partial).toBeVisible();
    const view = partial.getByRole('button', { name: 'Посмотреть' });
    // The toast settles after its entry animation; the action is at least 44 px tall (R3).
    await expect.poll(async () => (await view.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // The confirmed card changed, the failing one did not.
    await withPool(async (pool) => {
      const rows = (await pool.query('SELECT title, last_confirmed_at > now() - interval \'1 hour\' AS fresh FROM offers WHERE id = ANY($1::uuid[]) ORDER BY title', [[ids['Слова курага'], ids['Слова изюм']]])).rows;
      expect(rows).toEqual([{ title: 'Слова изюм', fresh: false }, { title: 'Слова курага', fresh: true }]);
    });
    await view.click();
    await expect(page.getByRole('heading', { name: /^Актуальность · \d$/, level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Товар есть, цена та же: Слова чай/ })).toBeVisible();
    const row = page.getByRole('button', { name: /^Товар есть, цена та же: Слова чай/ });
    await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => (await row.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  } finally {
    await cleanup(phone);
  }
});

test('texts fit at 320 and 390 px without short words at line ends or horizontal scroll', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const phone = phoneFor(testInfo.project.name);
  try {
    await cleanup(phone);
    await login(page.request, phone);
    await seed(phone, [
      { title: 'Слова мёд', hours: 30 },
      { title: 'Слова рис', hours: 100 },
      { title: 'Слова скрытый', hours: 200 },
    ]);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto('/seller');
      const task = page.getByTestId('actuality-task');
      await expect(task.getByRole('button', { name: 'Всё актуально · 2' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect((await lineEnds(page, '[data-testid="actuality-task"] .ts, [data-testid="actuality-count"]')).filter((word) => SHORT.has(word))).toEqual([]);

      await task.getByRole('button', { name: 'Проверить' }).click();
      await expect(page.getByRole('heading', { name: 'Актуальность · 3', level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect((await lineEnds(page, '.li .c, main > p.c')).filter((word) => SHORT.has(word))).toEqual([]);
      await page.getByRole('button', { name: 'Назад' }).click();
    }
  } finally {
    await cleanup(phone);
  }
});
