import { describe, expect, it } from 'vitest';
import { isOneTapCard, type CardActuality } from '../../src/app/seller/_components/card-model';
import { actualityView, type ActualityPolicy } from '../../src/modules/offers/actuality/actuality';
import { ru, kk } from '../../src/i18n/messages';

// actuality-words §10: the set the one tap confirms (Q1) at every boundary, and the wording rules (§4 item 7, §7.1).

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const policy: ActualityPolicy = { dueHours: 24, ageingHours: 48, hiddenHours: 168, archiveHours: 336 };
const NOW = new Date('2026-09-20T12:00:00.000Z');

// A card whose only point was confirmed `ageMs` ago, as the seller screens derive it.
function oneTap(ageMs: number): boolean {
  const view = actualityView(new Date(NOW.getTime() - ageMs), NOW, policy);
  const actuality: CardActuality = { days: view.days, stage: view.stage, due: view.due, archived: view.stage === 'archived', lastConfirmedAt: '' };
  return isOneTapCard({ actuality });
}

describe('the cards one tap confirms', () => {
  it('takes live due cards from 24 h up to 167 h 59 min, never hidden (168 h) or archived (336 h) ones', () => {
    expect(oneTap(24 * H - MIN)).toBe(false); // 23 h 59 min: not due yet
    expect(oneTap(24 * H)).toBe(true);
    expect(oneTap(47 * H)).toBe(true);
    expect(oneTap(48 * H)).toBe(true); // ageing, still visible to buyers
    expect(oneTap(168 * H - MIN)).toBe(true); // 167 h 59 min
    expect(oneTap(168 * H)).toBe(false); // hidden from buyers
    expect(oneTap(335 * H)).toBe(false);
    expect(oneTap(336 * H)).toBe(false); // archived
  });

  it('ignores a card outside actuality (removed or switched off)', () => {
    expect(isOneTapCard({ actuality: null })).toBe(false);
  });
});

// Short prepositions and conjunctions must not end a line: after them only a non-breaking space (U+00A0) is allowed.
const SHORT_WORD = /(^|[ «(—·,. ])(в|во|на|с|со|к|ко|по|за|от|до|из|у|о|об|и|а|но|не|ни|да|же|ли|бы|для|при|про|над|под|без|или) /iu; // a regular space only
const NEW_OR_CHANGED_RU = [
  'actuality.confirm',
  'actuality.allGoodCount',
  'actuality.bulkDone.one', 'actuality.bulkDone.few', 'actuality.bulkDone.many',
  'actuality.undo', 'actuality.undone', 'actuality.bulkPartial', 'actuality.viewList', 'actuality.confirmItem',
  'actuality.taskHidden.one', 'actuality.taskHidden.few', 'actuality.taskHidden.many',
  'actuality.hiddenFor', 'actuality.hiddenShort', 'actuality.listHint', 'actuality.confirmError',
] as const;

describe('wording of the actuality strings', () => {
  it('has no short preposition or conjunction before a breaking space in new or changed RU strings', () => {
    for (const key of NEW_OR_CHANGED_RU) expect((ru as Record<string, string>)[key], key).not.toMatch(SHORT_WORD);
  });

  it('keeps the non-breaking spaces where the PO rule needs them', () => {
    const nb = ' ';
    expect(ru['actuality.taskHidden.many']).toBe(`{count} уже скрыты с${nb}витрины`);
    expect(ru['actuality.bulkPartial']).toBe(`Подтверждено {ok}, не${nb}удалось {failed}`);
    expect(ru['actuality.hiddenFor']).toContain(`с${nb}витрины до${nb}подтверждения`);
  });

  it('names the action «Товар есть, цена та же» and drops the duplicate hint and the unused keys', () => {
    expect(ru['actuality.confirm']).toBe('Товар есть, цена та же');
    for (const catalog of [ru, kk] as Record<string, string>[]) {
      expect(catalog['actuality.confirmHint']).toBeUndefined();
      expect(catalog['review.confirmRefresh']).toBeUndefined();
      expect(catalog['offerManage.confirmFreshness']).toBeUndefined();
    }
  });

  it('has every new key in both catalogs', () => {
    for (const key of NEW_OR_CHANGED_RU) {
      expect((kk as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
