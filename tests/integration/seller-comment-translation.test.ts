import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { findNearbyOffers } from '../../src/modules/discovery/application/find-nearby-offers';
import { fakeSellerCommentTranslator } from '../../src/modules/offers/translation/fake-seller-comment-translator';
import {
  CommentTranslationDisabledError,
  CommentTranslationRateLimitedError,
  CommentTranslationSellerRequiredError,
  CommentTranslationUnavailableError,
  createPreviewRateLimiter,
  previewSellerCommentTranslation,
} from '../../src/modules/offers/translation/preview-seller-comment-translation';
import type {
  PublishedSellerComment,
  SellerCommentTranslationResult,
  SellerCommentTranslator,
} from '../../src/modules/offers/translation/seller-comment-translator';
import {
  createSellerCommentTranslationScheduler,
  translatePublishedSellerComment,
  translateUntranslatedSellerComments,
} from '../../src/modules/offers/translation/translate-published-seller-comment';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-20T08:00:00.000Z');
const T1 = new Date('2026-09-20T09:00:00.000Z');
const T2 = new Date('2026-09-20T10:00:00.000Z');
const searchClock = () => new Date('2026-09-20T12:00:00.000Z');
const buyerLocation = { latitude: 43.2, longitude: 76.9 };
const kkComment = 'Жаңа, таңертеңгі жеткізілім';
const ruTranslation = 'Свежая, утренний привоз';

async function cleanupUser(userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

async function createFixture(suffix: string) {
  const userId = `5c000000-0000-4000-8000-0000000000${suffix}`;
  const phone = `+77000031${suffix}`;
  await cleanupUser(userId, phone);
  await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);
  const seller = await setupSeller(userId, {
    seller: { displayName: `Сатушы ${suffix}` },
    location: { name: `Нүкте ${suffix}`, type: 'shop', addressText: `Алматы, ${suffix}` },
  }, { database: db });
  await pool.query('UPDATE sellers SET contact_phone_e164=$2 WHERE id=$1', [seller.id, phone]);
  await pool.query('UPDATE locations SET latitude=$2,longitude=$3 WHERE id=$1', [seller.locations[0]!.id, buyerLocation.latitude, buyerLocation.longitude]);
  return { userId, phone, seller, locationId: seller.locations[0]!.id };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createOffer(
  fixture: Fixture,
  comment: string | null,
  schedule: (comments: readonly PublishedSellerComment[]) => void = () => {},
) {
  const proposal = await createSellerChangeSet(fixture.userId, sellerChangeSetCreateBodySchema.parse({
    productName: 'Баранина',
    locationId: fixture.locationId,
    price: { amount: '4200', unit: { code: 'kg' } },
    sellerComment: comment,
  }), { database: db });
  const confirmed = await confirmSellerChangeSet(fixture.userId, proposal.id, {
    database: db,
    clock: () => T0,
    scheduleCommentTranslations: schedule,
  });
  return confirmed.items[0]!.resultOffer!.id;
}

async function updateOffer(
  fixture: Fixture,
  offerId: string,
  values: { amount: string; comment: string | null },
  at: Date,
  schedule: (comments: readonly PublishedSellerComment[]) => void = () => {},
) {
  const proposal = await createOfferManagementChangeSet(fixture.userId, offerId, sellerOfferChangeBodySchema.parse({
    action: 'update_offer',
    price: { amount: values.amount, unit: { code: 'kg' } },
    sellerComment: values.comment,
  }), { database: db });
  await confirmSellerChangeSet(fixture.userId, proposal.id, { database: db, clock: () => at, scheduleCommentTranslations: schedule });
}

async function publishedComment(offerId: string): Promise<PublishedSellerComment> {
  const row = (await pool.query('SELECT seller_comment, seller_comment_version FROM offers WHERE id=$1', [offerId])).rows[0];
  return { offerId, commentVersion: row.seller_comment_version, comment: row.seller_comment };
}

async function translationRows(offerId: string) {
  return (await pool.query(
    'SELECT comment_version, target_locale, status, translated_text, detected_source_language, provenance FROM offer_comment_translations WHERE offer_id=$1 ORDER BY comment_version, target_locale',
    [offerId],
  )).rows;
}

async function buyerCard(offerId: string, locale: 'ru' | 'kk', commentTranslationEnabled = true) {
  const result = await searchOffers('баранина', db, { clock: searchClock, locale, commentTranslationEnabled });
  const offer = result.offers.find((candidate) => candidate.id === offerId);
  if (!offer) throw new Error('Offer is not buyer-visible');
  return offer;
}

function translatorReturning(result: SellerCommentTranslationResult): SellerCommentTranslator {
  return { translateComment: async () => result };
}

function deferredTranslator() {
  const calls: { text: string; resolve: (result: SellerCommentTranslationResult) => void }[] = [];
  const translator: SellerCommentTranslator = {
    translateComment: (text) => new Promise((resolve) => { calls.push({ text, resolve }); }),
  };
  return { translator, calls };
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe.sequential('Seller comment translation on PostgreSQL 18', () => {
  it('schedules translation after confirmation without waiting and bumps the comment version only on text change', async () => {
    const fixture = await createFixture('01');
    try {
      const scheduled: PublishedSellerComment[][] = [];
      let release!: () => void;
      const neverDone = new Promise<void>((resolve) => { release = resolve; });
      const offerId = await createOffer(fixture, kkComment, (comments) => {
        scheduled.push([...comments]);
        return neverDone as unknown as void;
      });
      expect(scheduled).toEqual([[{ offerId, commentVersion: 1, comment: kkComment }]]);
      expect(await translationRows(offerId)).toEqual([]);

      await updateOffer(fixture, offerId, { amount: '4500', comment: kkComment }, T1, (comments) => { scheduled.push([...comments]); });
      expect((await publishedComment(offerId)).commentVersion).toBe(1);
      expect(scheduled).toHaveLength(1);

      await updateOffer(fixture, offerId, { amount: '4500', comment: 'Үйде өсірілген, химиясыз' }, T2, (comments) => { scheduled.push([...comments]); });
      expect(await publishedComment(offerId)).toEqual({ offerId, commentVersion: 2, comment: 'Үйде өсірілген, химиясыз' });
      expect(scheduled[1]).toEqual([{ offerId, commentVersion: 2, comment: 'Үйде өсірілген, химиясыз' }]);
      release();
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('confirms normally when the scheduler throws or the translator is off', async () => {
    const fixture = await createFixture('02');
    try {
      const offerId = await createOffer(fixture, kkComment, () => { throw new Error('scheduler down'); });
      expect(offerId).toBeTruthy();
      const second = await createOffer(fixture, 'Без переводчика');
      expect(await translationRows(second)).toEqual([]);
      const card = await buyerCard(second, 'kk', false);
      expect(card.sellerComment).toBe('Без переводчика');
      expect(card.sellerCommentTranslation).toBeUndefined();
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('stores detection per version and projects translated, same-language and translator-off variants', async () => {
    const fixture = await createFixture('03');
    try {
      const offerId = await createOffer(fixture, kkComment);
      await createSellerCommentTranslationScheduler(db, fakeSellerCommentTranslator)([await publishedComment(offerId)]);

      expect(await translationRows(offerId)).toEqual([
        { comment_version: 1, target_locale: 'kk', status: 'same-language', translated_text: null, detected_source_language: 'kk', provenance: 'machine' },
        { comment_version: 1, target_locale: 'ru', status: 'available', translated_text: ruTranslation, detected_source_language: 'kk', provenance: 'machine' },
      ]);

      const ru = await buyerCard(offerId, 'ru');
      expect(ru.sellerComment).toBe(kkComment);
      expect(ru.sellerCommentTranslation).toEqual({ status: 'translated', text: ruTranslation, locale: 'ru', originalLocale: 'kk' });
      expect((await buyerCard(offerId, 'kk')).sellerCommentTranslation).toBeUndefined();
      expect((await buyerCard(offerId, 'ru', false)).sellerCommentTranslation).toBeUndefined();

      const nearby = await findNearbyOffers(buyerLocation, db, { clock: searchClock, locale: 'ru', commentTranslationEnabled: true });
      expect(nearby.offers.find((offer) => offer.id === offerId)?.sellerCommentTranslation).toEqual(ru.sellerCommentTranslation);

      // Names, point and unit stay exactly as the Seller wrote them in every locale.
      const kk = await buyerCard(offerId, 'kk');
      expect([kk.seller.displayName, kk.location.name, kk.location.addressText, kk.price.unit])
        .toEqual([ru.seller.displayName, ru.location.name, ru.location.addressText, ru.price.unit]);
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('translates a mixed-language comment as a whole and shows pending or failed as unavailable', async () => {
    const fixture = await createFixture('04');
    try {
      const mixed = await createOffer(fixture, 'Жаңа сүт, свежее молоко');
      await translatePublishedSellerComment(db, fakeSellerCommentTranslator, await publishedComment(mixed));
      const mixedRows = await translationRows(mixed);
      expect(mixedRows.find((row) => row.target_locale === 'ru')).toMatchObject({ status: 'available', translated_text: 'Автоперевод: Жаңа сүт, свежее молоко' });

      const pending = await createOffer(fixture, 'Ожидает перевода');
      expect((await buyerCard(pending, 'kk')).sellerCommentTranslation).toEqual({ status: 'unavailable' });

      const failed = await createOffer(fixture, 'Сломанный #translator-fail');
      await translatePublishedSellerComment(db, fakeSellerCommentTranslator, await publishedComment(failed));
      expect((await translationRows(failed)).map((row) => row.status)).toEqual(['failed', 'failed']);
      const card = await buyerCard(failed, 'kk');
      expect(card.sellerComment).toBe('Сломанный #translator-fail');
      expect(card.sellerCommentTranslation).toEqual({ status: 'unavailable' });

      // An adapter that reports no text for a target is a failure for that target, not an empty card.
      const empty = await createOffer(fixture, 'Пустой ответ');
      await translatePublishedSellerComment(db, translatorReturning({ detectedSourceLanguage: 'ru', translations: { kk: '  ' }, sameLanguage: ['ru'] }), await publishedComment(empty));
      expect((await translationRows(empty)).map((row) => [row.target_locale, row.status])).toEqual([['kk', 'failed'], ['ru', 'same-language']]);
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('never shows a stale translation, including a late result for an older comment version', async () => {
    const fixture = await createFixture('05');
    try {
      const offerId = await createOffer(fixture, kkComment);
      const v1 = await publishedComment(offerId);
      const slow = deferredTranslator();
      const lateJob = translatePublishedSellerComment(db, slow.translator, v1);
      await expect.poll(() => slow.calls.length).toBe(1);

      await updateOffer(fixture, offerId, { amount: '4200', comment: 'Жеткізу бар' }, T1);
      const v2 = await publishedComment(offerId);
      expect(v2.commentVersion).toBe(2);

      slow.calls[0]!.resolve({ detectedSourceLanguage: 'kk', translations: { ru: 'Устаревший перевод' }, sameLanguage: ['kk'] });
      await lateJob;
      expect((await translationRows(offerId)).every((row) => row.status === 'pending')).toBe(true);
      expect((await buyerCard(offerId, 'ru')).sellerCommentTranslation).toEqual({ status: 'unavailable' });

      // Even a stale row that did get written for v1 is never read for v2.
      await pool.query("UPDATE offer_comment_translations SET status='available', translated_text='Устаревший перевод', detected_source_language='kk' WHERE offer_id=$1 AND comment_version=1 AND target_locale='ru'", [offerId]);
      expect((await buyerCard(offerId, 'ru')).sellerCommentTranslation).toEqual({ status: 'unavailable' });

      await translatePublishedSellerComment(db, fakeSellerCommentTranslator, v2);
      expect((await buyerCard(offerId, 'ru')).sellerCommentTranslation).toEqual({ status: 'translated', text: 'Есть доставка', locale: 'ru', originalLocale: 'kk' });
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('picks up comments saved while the translator was off, leaves originals intact and does not retry failures', async () => {
    const fixture = await createFixture('06');
    try {
      const legacy = await createOffer(fixture, kkComment);
      const failed = await createOffer(fixture, 'Ошибка #translator-fail');
      await translatePublishedSellerComment(db, fakeSellerCommentTranslator, await publishedComment(failed));
      const noComment = await createOffer(fixture, null);

      const calls: string[] = [];
      const counting: SellerCommentTranslator = {
        translateComment: async (text, targets) => { calls.push(text); return fakeSellerCommentTranslator.translateComment(text, targets); },
      };
      await translateUntranslatedSellerComments(db, counting, { batchSize: 1000 });

      expect(calls).toContain(kkComment);
      expect(calls).not.toContain('Ошибка #translator-fail');
      expect((await translationRows(legacy)).find((row) => row.target_locale === 'ru')?.status).toBe('available');
      expect(await translationRows(noComment)).toEqual([]);
      expect((await publishedComment(legacy)).comment).toBe(kkComment);

      calls.length = 0;
      await translateUntranslatedSellerComments(db, counting, { batchSize: 1000 });
      expect(calls).not.toContain(kkComment);
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('previews the second language for an authenticated Seller without storing anything', async () => {
    const fixture = await createFixture('07');
    try {
      const before = (await pool.query('SELECT count(*)::int AS n FROM seller_change_sets WHERE seller_id=$1', [fixture.seller.id])).rows[0].n;
      const allow = () => true;
      await expect(previewSellerCommentTranslation(fixture.userId, kkComment, { translator: fakeSellerCommentTranslator, database: db, allowRequest: allow }))
        .resolves.toEqual({ translations: [{ locale: 'ru', text: ruTranslation }] });
      await expect(previewSellerCommentTranslation(fixture.userId, 'Свежая, утренний привоз', { translator: fakeSellerCommentTranslator, database: db, allowRequest: allow }))
        .resolves.toEqual({ translations: [{ locale: 'kk', text: kkComment }] });
      await expect(previewSellerCommentTranslation(fixture.userId, 'Fresh milk', { translator: fakeSellerCommentTranslator, database: db, allowRequest: allow }))
        .resolves.toEqual({ translations: [{ locale: 'ru', text: 'Автоперевод: Fresh milk' }, { locale: 'kk', text: 'Аударма: Fresh milk' }] });

      await expect(previewSellerCommentTranslation(fixture.userId, 'x #translator-fail', { translator: fakeSellerCommentTranslator, database: db, allowRequest: allow }))
        .rejects.toBeInstanceOf(CommentTranslationUnavailableError);
      await expect(previewSellerCommentTranslation(fixture.userId, kkComment, { translator: null, database: db, allowRequest: allow }))
        .rejects.toBeInstanceOf(CommentTranslationDisabledError);
      await expect(previewSellerCommentTranslation('5c000000-0000-4000-8000-0000000000ff', kkComment, { translator: fakeSellerCommentTranslator, database: db, allowRequest: allow }))
        .rejects.toBeInstanceOf(CommentTranslationSellerRequiredError);

      const limiter = createPreviewRateLimiter(2, 60_000, () => 0);
      await previewSellerCommentTranslation(fixture.userId, kkComment, { translator: fakeSellerCommentTranslator, database: db, allowRequest: limiter });
      await previewSellerCommentTranslation(fixture.userId, kkComment, { translator: fakeSellerCommentTranslator, database: db, allowRequest: limiter });
      await expect(previewSellerCommentTranslation(fixture.userId, kkComment, { translator: fakeSellerCommentTranslator, database: db, allowRequest: limiter }))
        .rejects.toBeInstanceOf(CommentTranslationRateLimitedError);

      const after = (await pool.query('SELECT count(*)::int AS n FROM seller_change_sets WHERE seller_id=$1', [fixture.seller.id])).rows[0].n;
      expect(after).toBe(before);
      expect((await pool.query('SELECT count(*)::int AS n FROM offer_comment_translations t JOIN offers o ON o.id=t.offer_id WHERE o.seller_id=$1', [fixture.seller.id])).rows[0].n).toBe(0);
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });

  it('rejects translation rows that break the storage invariants', async () => {
    const fixture = await createFixture('08');
    try {
      const offerId = await createOffer(fixture, kkComment);
      const insert = (values: [string, number, string, string | null, string, string]) => pool.query(
        'INSERT INTO offer_comment_translations (offer_id, comment_version, target_locale, translated_text, status, provenance) VALUES ($1,$2,$3,$4,$5,$6)',
        values,
      );
      await expect(insert([offerId, 1, 'en', null, 'pending', 'machine'])).rejects.toMatchObject({ code: '23514' });
      await expect(insert([offerId, 1, 'ru', null, 'available', 'machine'])).rejects.toMatchObject({ code: '23514' });
      await expect(insert([offerId, 1, 'ru', 'текст', 'pending', 'machine'])).rejects.toMatchObject({ code: '23514' });
      await expect(insert([offerId, 1, 'ru', null, 'pending', 'seller'])).rejects.toMatchObject({ code: '23514' });
      await expect(insert([offerId, 0, 'ru', null, 'pending', 'machine'])).rejects.toMatchObject({ code: '23514' });
      await insert([offerId, 1, 'ru', null, 'pending', 'machine']);
      await expect(insert([offerId, 1, 'ru', null, 'pending', 'machine'])).rejects.toMatchObject({ code: '23505' });
    } finally {
      await cleanupUser(fixture.userId, fixture.phone);
    }
  });
});
