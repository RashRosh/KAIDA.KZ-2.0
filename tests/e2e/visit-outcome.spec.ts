import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../src/db/client';
import { testDatabaseUrl } from '../integration/database';
import { returningVisitorState } from './browser-state';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';

test.describe('CJM 24.11 #2 visit outcome (matched / problem)', () => {
  test('guest 1-tap matched, guest 5-reason problem (including no-photo mismatch) with operator unverified badge, verified visit signal, and 320px/200% layout', async ({ browser }) => {
    const connection = createDatabase(testDatabaseUrl());
    const { pool, db } = connection;
    const sellerId = randomUUID();
    const sellerPhone = '+77000991401';
    const buyerPhone = '+77000991402';
    const operatorPhone = '+77000991403';
    const cardIds: string[] = [];

    const guestCtx = await browser.newContext({ baseURL: 'http://127.0.0.1:3100', storageState: returningVisitorState, viewport: { width: 360, height: 780 } });
    const buyerCtx = await browser.newContext({ baseURL: 'http://127.0.0.1:3100', storageState: returningVisitorState, viewport: { width: 360, height: 780 } });
    const opCtx = await browser.newContext({ baseURL: 'http://127.0.0.1:3100', storageState: returningVisitorState, viewport: { width: 360, height: 780 } });

    try {
      const fixturePhones = [sellerPhone, buyerPhone, operatorPhone];
      await pool.query('DELETE FROM operator_feed_marks WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))', [fixturePhones]);
      await pool.query('DELETE FROM users WHERE phone_e164=ANY($1::text[])', [fixturePhones]);
      await pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,now())', [sellerId, sellerPhone]);
      const seller = await setupSeller(
        sellerId,
        {
          seller: { displayName: 'Синтетический продавец исходов' },
          location: { name: 'Точка исходов E2E', type: 'shop', addressText: 'ул. Сейфуллина, 10' },
        },
        { database: db },
      );
      const locationId = seller.locations[0]!.id;
      await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95, phone_e164=$2 WHERE id=$1', [locationId, sellerPhone]);

      const makeOffer = async (title: string) => {
        const set = await createCardChangeSet(
          sellerId,
          cardCreateBodySchema.parse({
            title,
            productId: null,
            price: '950',
            unit: { code: 'kg' },
            pack: null,
            sellerComment: 'Синтетическая карточка исхода',
            photoIds: [],
            points: [{ locationId }],
          }),
          { database: db },
        );
        const confirmed = await confirmSellerChangeSet(sellerId, set.id, { database: db });
        const offerId = confirmed.items[0]!.resultOffer!.id;
        const cardId = (await pool.query('SELECT card_id FROM offers WHERE id=$1', [offerId])).rows[0].card_id as string;
        cardIds.push(cardId);
        return { offerId, cardId };
      };

      const matchedOffer = await makeOffer('Яблоки исхода 1');
      const problemOffer = await makeOffer('Груши исхода 2');

      // 1. Guest opens B08 at 360px: sees "Были здесь?" with 2 side-by-side buttons >= 44px, taps "Всё совпало" in 1 tap.
      const guestPage = await guestCtx.newPage();
      await guestPage.goto(`/offers/${matchedOffer.offerId}`);
      const section = guestPage.getByTestId('visit-outcome-section');
      await expect(section).toBeVisible();
      await expect(section).toContainText('Были здесь?');
      const matchedBtn = guestPage.getByTestId('outcome-matched');
      const problemBtn = guestPage.getByTestId('outcome-problem');
      const [mBox, pBox] = [await matchedBtn.boundingBox(), await problemBtn.boundingBox()];
      expect(Math.round(mBox!.height)).toBeGreaterThanOrEqual(44);
      expect(Math.round(pBox!.height)).toBeGreaterThanOrEqual(44);
      expect(Math.abs(mBox!.y - pBox!.y)).toBeLessThanOrEqual(2);

      await matchedBtn.click();
      await expect(guestPage.getByTestId('outcome-matched-done')).toContainText('Спасибо, отметили.');
      await expect(guestPage.getByTestId('outcome-guest-note')).toContainText('Анонимный ответ сохранён для проверки.');

      const guestMatchedRows = await pool.query('SELECT outcome, is_verified, has_visit_signal, reporter_user_id, visitor_key_hash FROM visit_outcomes WHERE card_id=$1', [matchedOffer.cardId]);
      expect(guestMatchedRows.rows).toHaveLength(1);
      expect(guestMatchedRows.rows[0].outcome).toBe('matched');
      expect(guestMatchedRows.rows[0].is_verified).toBe(false);
      expect(guestMatchedRows.rows[0].has_visit_signal).toBe(false);
      expect(guestMatchedRows.rows[0].reporter_user_id).toBeNull();
      expect(guestMatchedRows.rows[0].visitor_key_hash).toMatch(/^[a-f0-9]{64}$/);

      // Reload & tap again -> idempotent duplicate message, still 1 DB row.
      await guestPage.reload();
      await guestPage.getByTestId('outcome-matched').click();
      await expect(guestPage.getByTestId('outcome-matched-done')).toContainText('Ваш ответ по этому предложению уже сохранён.');
      expect((await pool.query('SELECT count(*)::int n FROM visit_outcomes WHERE card_id=$1', [matchedOffer.cardId])).rows[0].n).toBe(1);

      // 2. Guest opens second card, taps "Есть проблема": sees exact 5 reasons, picks "Не как на фото" even with 0 photos, sends without login.
      await guestPage.goto(`/offers/${problemOffer.offerId}`);
      await guestPage.getByTestId('outcome-problem').click();
      const reasonButtons = guestPage.locator('.report-reason');
      await expect(reasonButtons).toHaveCount(5);
      await expect(reasonButtons.nth(0)).toContainText('Товара не было');
      await expect(reasonButtons.nth(1)).toContainText('Цена другая');
      await expect(reasonButtons.nth(2)).toContainText('Не как на фото');
      await expect(reasonButtons.nth(3)).toContainText('Точка закрыта');
      await expect(reasonButtons.nth(4)).toContainText('Другое');

      await reasonButtons.nth(2).click();
      await expect(guestPage.getByTestId('outcome-no-photo-note')).toContainText('У карточки нет фото — оператор сверит с описанием.');
      await guestPage.getByLabel('Комментарий · необязательно').fill('Витрина не соответствует описанию.');
      await guestPage.getByRole('button', { name: 'Отправить', exact: true }).click();
      await expect(guestPage.getByText('Сообщение отправлено', { exact: true })).toBeVisible();
      await expect(guestPage.getByText('Спасибо, мы проверим предложение.', { exact: true })).toBeVisible();
      await expect(guestPage.getByTestId('outcome-guest-note')).toContainText('Анонимный ответ сохранён для проверки.');

      // 3. Operator opens /operator/reports: sees guest report with "Не как на фото" and "Без входа · только на проверку" badge, no PII.
      const issuedOp = await (await opCtx.request.post('/api/auth/otp/request', { data: { phone: operatorPhone } })).json();
      expect((await opCtx.request.post('/api/auth/otp/verify', { data: { challengeId: issuedOp.challenge.id, code: issuedOp.delivery.code } })).ok()).toBe(true);
      const opPage = await opCtx.newPage();
      await opPage.goto('/operator/reports');
      const reportCard = opPage.getByRole('article').filter({ hasText: 'Груши исхода 2' });
      await expect(reportCard).toContainText('Не как на фото');
      await expect(reportCard.getByTestId('report-unverified-badge')).toHaveText('Без входа · только на проверку');
      await reportCard.getByRole('button', { name: 'Рассмотреть' }).click();
      await expect(opPage.getByTestId('report-unverified-badge')).toHaveText('Без входа · только на проверку');
      await expect(opPage.getByRole('region', { name: 'Сообщение покупателя' })).toContainText('Витрина не соответствует описанию.');

      // 4. Verified buyer clicks route (visit signal) then submits "Всё совпало" -> is_verified=true, has_visit_signal=true.
      const issuedBuyer = await (await buyerCtx.request.post('/api/auth/otp/request', { data: { phone: buyerPhone } })).json();
      expect((await buyerCtx.request.post('/api/auth/otp/verify', { data: { challengeId: issuedBuyer.challenge.id, code: issuedBuyer.delivery.code } })).ok()).toBe(true);
      const buyerPage = await buyerCtx.newPage();
      await buyerPage.goto(`/offers/${matchedOffer.offerId}`);
      // Prevent opening external map tab while still firing onClick -> markVisitSignal
      await buyerPage.evaluate(() => {
        const route = document.querySelector('a[href*="/route"]');
        route?.addEventListener('click', (e) => e.preventDefault());
      });
      await buyerPage.getByRole('link', { name: /Построить маршрут|Маршрут до/ }).click();
      await buyerPage.getByTestId('outcome-matched').click();
      await expect(buyerPage.getByTestId('outcome-matched-done')).toContainText('Спасибо, отметили.');
      await expect(buyerPage.getByTestId('outcome-guest-note')).toHaveCount(0);

      const verifiedRow = await pool.query(
        'SELECT is_verified, has_visit_signal, reporter_user_id, visitor_key_hash FROM visit_outcomes WHERE card_id=$1 AND is_verified=true',
        [matchedOffer.cardId],
      );
      expect(verifiedRow.rows).toHaveLength(1);
      expect(verifiedRow.rows[0].has_visit_signal).toBe(true);
      expect(verifiedRow.rows[0].reporter_user_id).toBeTruthy();
      expect(verifiedRow.rows[0].visitor_key_hash).toMatch(/^[a-f0-9]{64}$/);

      // 5. Layout stress check (§18.4): 320px + 200% text -> vertical stack, zero clipping, plus KK labels.
      const stressPage = await browser.newPage({ baseURL: 'http://127.0.0.1:3100', storageState: returningVisitorState, viewport: { width: 320, height: 780 } });
      try {
        await stressPage.goto(`/offers/${problemOffer.offerId}`);
        await stressPage.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const check = await stressPage.evaluate(() => {
          const h1 = document.querySelector('header h1')!;
          const m = document.querySelector('[data-testid="outcome-matched"]')!;
          const p = document.querySelector('[data-testid="outcome-problem"]')!;
          const mr = m.getBoundingClientRect();
          const pr = p.getBoundingClientRect();
          const h1r = h1.getBoundingClientRect();
          return {
            docOverflow: document.documentElement.scrollWidth > window.innerWidth,
            h1Clipped: h1.scrollWidth > h1.clientWidth + 1 || h1r.right > window.innerWidth + 1,
            mClipped: m.scrollWidth > m.clientWidth + 1 || mr.right > window.innerWidth + 1,
            pClipped: p.scrollWidth > p.clientWidth + 1 || pr.right > window.innerWidth + 1,
            stackedVertically: pr.top >= mr.bottom - 1,
            sameLeftEdge: Math.abs(mr.left - pr.left) <= 1,
          };
        });
        expect(check).toEqual({
          docOverflow: false,
          h1Clipped: false,
          mClipped: false,
          pClipped: false,
          stackedVertically: true,
          sameLeftEdge: true,
        });

        // KK locale labels check
        await stressPage.context().addCookies([{ name: 'kaida_locale', value: 'kk', url: 'http://127.0.0.1:3100' }]);
        await stressPage.reload();
        await expect(stressPage.getByTestId('visit-outcome-section')).toContainText('Осында болдыңыз ба?');
        await expect(stressPage.getByTestId('outcome-matched')).toContainText('Бәрі сәйкес келді');
        await expect(stressPage.getByTestId('outcome-problem')).toContainText('Мәселе бар');
      } finally {
        await stressPage.close();
      }
    } finally {
      await guestCtx.close();
      await buyerCtx.close();
      await opCtx.close();
      for (const cardId of cardIds) {
        await pool.query('DELETE FROM visit_outcome_receipts WHERE outcome_id IN (SELECT id FROM visit_outcomes WHERE card_id=$1)', [cardId]);
        await pool.query('DELETE FROM visit_outcomes WHERE card_id=$1', [cardId]);
        await pool.query('DELETE FROM offer_reports WHERE card_id=$1', [cardId]);
        await pool.query('DELETE FROM offer_card_removals WHERE card_id=$1', [cardId]);
      }
      const own = 'SELECT id FROM sellers WHERE owner_user_id=$1';
      await pool.query(`DELETE FROM seller_change_items WHERE change_set_id IN (SELECT id FROM seller_change_sets WHERE seller_id IN (${own}))`, [sellerId]);
      await pool.query(`DELETE FROM seller_change_sets WHERE seller_id IN (${own})`, [sellerId]);
      await pool.query(`DELETE FROM offers WHERE seller_id IN (${own})`, [sellerId]);
      await pool.query(`DELETE FROM locations WHERE seller_id IN (${own})`, [sellerId]);
      await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [sellerId]);
      const phones = [sellerPhone, buyerPhone, operatorPhone];
      await pool.query('DELETE FROM operator_feed_marks WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))', [phones]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE phone_e164=ANY($1::text[]))', [phones]);
      await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=ANY($1::text[])', [phones]);
      await pool.query('DELETE FROM users WHERE phone_e164=ANY($1::text[])', [phones]);
      await pool.end();
    }
  });
});
