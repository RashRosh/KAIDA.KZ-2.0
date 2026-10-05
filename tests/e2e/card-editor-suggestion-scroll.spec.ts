import { expect, test, type Locator, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { testDatabaseUrl } from '../integration/database';
import { openNewCard } from './offer-editor-helpers';

// card-editor-suggestion-scroll: on a touch session the field block is scrolled near the top once when catalog
// suggestions open; mouse / keyboard focus never scrolls. Positions are read from the DOM, never from keyboard sizes.

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
      await pool.query('DELETE FROM offer_drafts WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [row.id]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [row.id]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
    }
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
  });
}

async function prepareSeller(page: Page, phone: string) {
  await cleanup(phone);
  const requested = await (await page.request.post('/api/auth/otp/request', { data: { phone } })).json();
  expect((await page.request.post('/api/auth/otp/verify', { data: { challengeId: requested.challenge.id, code: requested.delivery.code } })).ok()).toBe(true);
  await withPool(async (pool) => {
    const user = await pool.query('SELECT id FROM users WHERE phone_e164=$1', [phone]);
    const seller = await pool.query('INSERT INTO sellers (owner_user_id, display_name) VALUES ($1,$2) RETURNING id', [user.rows[0].id, 'Лавка']);
    await pool.query("INSERT INTO locations (seller_id,name,address_text,type,latitude,longitude) VALUES ($1,'Точка','Алматы','shop',43.25,76.95)", [seller.rows[0].id]);
  });
}

// scrollTop of the nearest scrolling ancestor and the field block's distance from its top edge.
async function position(field: Locator) {
  return field.evaluate((input) => {
    const block = input.closest('.fld') as HTMLElement;
    let container: HTMLElement | null = block.parentElement;
    while (container && !(container.scrollHeight > container.clientHeight && /(auto|scroll)/.test(getComputedStyle(container).overflowY))) container = container.parentElement;
    if (!container) return { scrollTop: 0, offset: 0, scrollable: false };
    return { scrollTop: container.scrollTop, offset: block.getBoundingClientRect().top - container.getBoundingClientRect().top, scrollable: true };
  });
}

async function resetScroll(field: Locator) {
  await field.evaluate((input) => {
    let container: HTMLElement | null = input.parentElement;
    while (container && !(container.scrollHeight > container.clientHeight && /(auto|scroll)/.test(getComputedStyle(container).overflowY))) container = container.parentElement;
    if (container) container.scrollTop = 0;
  });
}

test('a touch session scrolls the field near the top once per suggestion session, and again after reopening', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'touch input is emulated by the mobile project');
  const phone = '+77000007530';
  try {
    await prepareSeller(page, phone);
    // A short window stands in for the area left above an on-screen keyboard, so the form is scrollable.
    await page.setViewportSize({ width: 390, height: 460 });
    const editor = await openNewCard(page);
    const name = editor.getByRole('combobox', { name: 'Название товара' });
    await name.tap();
    await page.keyboard.type('б');
    await expect(editor.getByRole('option')).toHaveCount(0);
    // Focusing may already have moved the page natively; put it back at the top and note the field is far from it.
    await resetScroll(name);
    const before = await position(name);
    expect(before.scrollable).toBe(true);
    expect(before.scrollTop).toBe(0);
    expect(before.offset).toBeGreaterThan(16);

    await page.keyboard.type('а');
    await expect(editor.getByRole('option').first()).toBeVisible();
    await expect.poll(async () => (await position(name)).scrollTop).toBeGreaterThan(0);
    const opened = await position(name);
    expect(opened.offset).toBeGreaterThanOrEqual(0);
    expect(opened.offset).toBeLessThanOrEqual(16);

    // More typing in the same session does not scroll again (the field stays where it is).
    await page.keyboard.type('р');
    await expect(editor.getByRole('option').first()).toBeVisible();
    await page.waitForTimeout(400);
    expect((await position(name)).scrollTop).toBe(opened.scrollTop);

    // Close the list, move the page away, reopen: it scrolls again.
    await page.keyboard.press('Escape');
    await expect(editor.getByRole('option')).toHaveCount(0);
    await resetScroll(name);
    await page.keyboard.type('а');
    await expect(editor.getByRole('option').first()).toBeVisible();
    await expect.poll(async () => (await position(name)).scrollTop).toBeGreaterThan(0);
    expect((await position(name)).offset).toBeLessThanOrEqual(16);
  } finally {
    await cleanup(phone);
  }
});

test('mouse or keyboard focus never scrolls the form when suggestions open', async ({ page }, testInfo) => {
  const phone = `+7700007${testInfo.project.name === 'mobile' ? '5' : '6'}310`;
  try {
    await prepareSeller(page, phone);
    await page.setViewportSize({ width: 390, height: 460 });
    const editor = await openNewCard(page);
    const name = editor.getByRole('combobox', { name: 'Название товара' });
    // Clicking may move the page natively; what matters is that opening suggestions adds no scroll of its own.
    await name.click();
    await page.keyboard.type('б');
    const base = await position(name);
    expect(base.scrollable).toBe(true);
    await page.keyboard.type('а');
    await expect(editor.getByRole('option').first()).toBeVisible();
    await page.waitForTimeout(400);
    expect(await position(name)).toEqual(base);
    // Keyboard focus (no pointer) after a blur: still no scroll of its own.
    await page.keyboard.press('Escape');
    await name.blur();
    await name.focus();
    const keyboardBase = await position(name);
    await page.keyboard.type('р');
    await expect(editor.getByRole('option').first()).toBeVisible();
    await page.waitForTimeout(400);
    expect(await position(name)).toEqual(keyboardBase);
  } finally {
    await cleanup(phone);
  }
});
