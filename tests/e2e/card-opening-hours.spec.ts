import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDatabase } from '../../src/db/client';
import { offerTitleSearchText } from '../../src/modules/offers/title/offer-title';
import { templateOpeningHours, type DaySchedule, type OpeningHours, type Weekday } from '../../src/modules/locations/hours/opening-hours';
import { testDatabaseUrl } from '../integration/database';
import { resultCard } from './buyer-helpers';

// card-opening-hours (docs/slices/card-opening-hours): the result card says in words whether the point is open and when it
// opens or closes; the Offer page shows the grouped week. The spec owns its Seller, points and Offers (letters-only suffix
// per execution, only these rows are removed). Monday 2026-09-21 11:00 and Sunday 2026-09-27 22:00, Almaty time (UTC+5).

const iv = (...pairs: [string, string][]): DaySchedule => ({ kind: 'intervals', intervals: pairs.map(([open, close]) => ({ open, close })) });
const SHUT: DaySchedule = { kind: 'closed' };
const ALL: DaySchedule = { kind: '24h' };
const same = (day: DaySchedule): OpeningHours => ({ timeZone: 'Asia/Almaty', days: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day } });
function hours(overrides: Partial<Record<Weekday, DaySchedule>>): OpeningHours {
  const base = templateOpeningHours();
  return { ...base, days: { ...base.days, ...overrides } };
}

const MONDAY_11 = new Date('2026-09-21T06:00:00Z');
const SUNDAY_22 = new Date('2026-09-27T17:00:00Z');

const POINTS: { key: string; hours: OpeningHours }[] = [
  { key: 'open', hours: hours({}) },
  { key: 'closing', hours: hours({ mon: iv(['09:00', '11:30']) }) },
  { key: 'tomorrow', hours: hours({ mon: iv(['09:00', '10:00']) }) },
  { key: 'lunch', hours: hours({ mon: iv(['09:00', '10:30'], ['14:00', '18:00']) }) },
  { key: 'around', hours: same(ALL) },
  { key: 'never', hours: same(SHUT) },
  { key: 'night', hours: hours({ sun: iv(['20:00', '03:00']) }) },
];

test('the card says open / closing / when it opens in words, the Offer page groups the week; ru and kk, narrow and large text', async ({ page }) => {
  const suffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const sellerId = randomUUID();
  const connection = createDatabase(testDatabaseUrl());
  const ids = new Map<string, { offerId: string; title: string }>();
  try {
    await connection.pool.query('INSERT INTO sellers (id,display_name) VALUES ($1,$2)', [sellerId, `Hrs seller ${suffix}`]);
    for (const point of POINTS) {
      const locationId = randomUUID();
      const offerId = randomUUID();
      const title = `Часы ${point.key} ${suffix}`;
      ids.set(point.key, { offerId, title });
      await connection.pool.query(
        "INSERT INTO locations (id,seller_id,name,address_text,type,opening_hours,opening_hours_needs_review) VALUES ($1,$2,$3,$4,'shop',$5,false)",
        [locationId, sellerId, `Hrs point ${point.key} ${suffix}`, `Hrs address ${point.key}`, JSON.stringify(point.hours)],
      );
      await connection.pool.query(
        `INSERT INTO offers (id,product_id,seller_id,location_id,price_amount,price_currency,price_unit_code,status,last_confirmed_at,created_at,updated_at,title,title_search,card_id)
         VALUES ($1,NULL,$2,$3,'1000','KZT','kg','active',now(),now(),now(),$4,$5,gen_random_uuid())`,
        [offerId, sellerId, locationId, title, offerTitleSearchText(title)],
      );
    }
    // the search field is found by its role, so the same steps work in the Russian and the Kazakh interface
    const search = async (query: string) => { const input = page.getByRole('search').locator('input[type="search"]').first(); await input.fill(query); await input.press('Enter'); };
    const statusOf = async (key: string) => resultCard(page, ids.get(key)!.title).getByTestId('opening-hours');
    const noOverflow = () => page.evaluate(() => {
      const wide = [...document.querySelectorAll<HTMLElement>('[data-testid="opening-hours"], [data-testid="opening-schedule"]')].filter((element) => element.scrollWidth > element.clientWidth + 1);
      return { page: document.documentElement.scrollWidth <= window.innerWidth, wide: wide.length };
    });

    // ---- Monday 11:00 ----
    await page.clock.setFixedTime(MONDAY_11);
    await page.goto('/');
    await search(suffix);
    await expect(resultCard(page, ids.get('open')!.title)).toHaveCount(1);
    await expect(await statusOf('open')).toHaveText('Открыто до 18:00');
    await expect(await statusOf('open')).toHaveAttribute('data-state', 'open');
    await expect(await statusOf('closing')).toHaveText('Закрывается в 11:30');
    await expect(await statusOf('closing')).toHaveAttribute('data-state', 'closing');
    await expect(await statusOf('tomorrow')).toHaveText('Закрыто, откроется в 9:00 ВТ');
    await expect(await statusOf('tomorrow')).toHaveAttribute('data-state', 'closed');
    await expect(await statusOf('lunch')).toHaveText('Закрыто, откроется в 14:00');
    await expect(await statusOf('around')).toHaveText('Открыто круглосуточно');
    await expect(await statusOf('never')).toHaveText('Закрыто, рабочих дней нет');
    // the card carries no schedule, button or expansion
    await expect(page.getByTestId('opening-schedule')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Расписание|Кесте/ })).toHaveCount(0);

    // narrow screen and enlarged text: nothing clipped, no sideways scroll
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    expect(await noOverflow()).toEqual({ page: true, wide: 0 });
    await page.setViewportSize({ width: 390, height: 844 });

    // ---- Kazakh (cookie) ----
    await page.context().addCookies([{ name: 'kaida_locale', value: 'kk', url: page.url() }]);
    await page.goto('/');
    await search(suffix);
    await expect(await statusOf('open')).toHaveText('18:00 дейін ашық');
    await expect(await statusOf('tomorrow')).toHaveText('Жабық, СС 9:00 ашылады');
    await expect(await statusOf('never')).toHaveText('Жабық, жұмыс күндері жоқ');
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await noOverflow()).toEqual({ page: true, wide: 0 });
    await page.context().addCookies([{ name: 'kaida_locale', value: 'ru', url: page.url() }]);
    await page.setViewportSize({ width: 390, height: 844 });

    // ---- Offer page: the grouped week, today in bold ----
    await page.goto(`/offers/${ids.get('tomorrow')!.offerId}`);
    const schedule = page.getByTestId('opening-schedule');
    const rows = schedule.getByRole('listitem');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('ПН');
    await expect(rows.nth(0)).toContainText('9:00–10:00');
    await expect(rows.nth(0)).toHaveAttribute('aria-current', 'date');
    await expect(rows.nth(1)).toContainText('ВТ–ПТ');
    await expect(rows.nth(1)).toContainText('9:00–18:00');
    await expect(rows.nth(2)).toContainText('СБ–ВС');
    await expect(rows.nth(2)).toContainText('выходной');
    expect((await rows.nth(0).evaluate((element) => getComputedStyle(element.querySelector('span:last-child')!).fontWeight))).toBe('700');
    expect(await noOverflow()).toEqual({ page: true, wide: 0 });
    await page.goto(`/offers/${ids.get('lunch')!.offerId}`);
    await expect(page.getByTestId('opening-schedule').getByRole('listitem').first()).toContainText('9:00–10:30, 14:00–18:00');
    await page.goto(`/offers/${ids.get('around')!.offerId}`);
    await expect(page.getByTestId('opening-schedule').getByRole('listitem')).toHaveCount(1);
    await expect(page.getByTestId('opening-schedule')).toContainText('ПН–ВС');
    await expect(page.getByTestId('opening-schedule')).toContainText('Круглосуточно');
    await page.goto(`/offers/${ids.get('never')!.offerId}`);
    await expect(page.getByTestId('opening-schedule').getByRole('listitem')).toHaveCount(1);
    await expect(page.getByTestId('opening-schedule')).toContainText('выходной');

    // ---- Sunday 22:00: the overnight status names Monday; the closed template names the next day ----
    await page.clock.setFixedTime(SUNDAY_22);
    await page.goto('/');
    await search(suffix);
    await expect(await statusOf('night')).toHaveText('Открыто до 3:00 ПН');
    await expect(await statusOf('open')).toHaveText('Закрыто, откроется в 9:00 ПН');
    await expect(await statusOf('around')).toHaveText('Открыто круглосуточно');
    await page.goto(`/offers/${ids.get('night')!.offerId}`);
    await expect(page.getByTestId('opening-hours')).toHaveText('Открыто до 3:00 ПН');
    await expect(page.getByTestId('opening-schedule').getByRole('listitem').last()).toHaveAttribute('aria-current', 'date');
  } finally {
    await connection.pool.query('DELETE FROM offers WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM locations WHERE seller_id = $1', [sellerId]);
    await connection.pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
    await connection.pool.end();
  }
});

