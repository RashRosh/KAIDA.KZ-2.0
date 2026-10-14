import { describe, expect, it } from 'vitest';
import { contactChips, formatLoginPhone, holdsLoginNumber } from '../../src/app/seller/_components/contact-chips';
import { ru, kk } from '../../src/i18n/messages';

// contact-default §4 and §11: when the chips show, and the wording rules of the new and changed strings.

const LOGIN = '+77010000001';

describe('chips', () => {
  it('login-number chip: only when the number is known and «Телефон» is empty', () => {
    expect(contactChips({ phone: '', whatsapp: '' }, LOGIN).loginNumber).toBe(true);
    expect(contactChips({ phone: '   ', whatsapp: '' }, LOGIN).loginNumber).toBe(true);
    expect(contactChips({ phone: '', whatsapp: '' }, null).loginNumber).toBe(false); // /api/auth/me failed or has no number
    expect(contactChips({ phone: '+77010007299', whatsapp: '' }, LOGIN).loginNumber).toBe(false); // a copied or typed number
    expect(contactChips({ phone: '+77010007299', whatsapp: '+77010007299' }, LOGIN).loginNumber).toBe(false);
  });

  it('WhatsApp chip: only when «Телефон» holds a number and «WhatsApp» is empty, with or without a known login number', () => {
    expect(contactChips({ phone: '+77010007299', whatsapp: '' }, LOGIN).samePhone).toBe(true);
    expect(contactChips({ phone: '+77010007299', whatsapp: '' }, null).samePhone).toBe(true);
    expect(contactChips({ phone: '', whatsapp: '' }, LOGIN).samePhone).toBe(false);
    expect(contactChips({ phone: '+77010007299', whatsapp: '+77010007288' }, LOGIN).samePhone).toBe(false); // a copied field shows no chip
    expect(contactChips({ phone: '', whatsapp: '+77010007288' }, LOGIN).samePhone).toBe(false);
  });

  it('chips come back when a field is cleared', () => {
    expect(contactChips({ phone: LOGIN, whatsapp: '' }, LOGIN).loginNumber).toBe(false);
    expect(contactChips({ phone: '', whatsapp: '' }, LOGIN).loginNumber).toBe(true);
    expect(contactChips({ phone: LOGIN, whatsapp: LOGIN }, LOGIN).samePhone).toBe(false);
    expect(contactChips({ phone: LOGIN, whatsapp: '' }, LOGIN).samePhone).toBe(true);
  });

  it('notices only while the field holds the login number, in any spelling of it', () => {
    expect(contactChips({ phone: LOGIN, whatsapp: '' }, LOGIN)).toMatchObject({ phoneNotice: true, whatsappNotice: false });
    expect(contactChips({ phone: '8 701 000 00 01', whatsapp: '+7 701 000 00 01' }, LOGIN)).toMatchObject({ phoneNotice: true, whatsappNotice: true });
    expect(contactChips({ phone: '+77010007299', whatsapp: '+77010007299' }, LOGIN)).toMatchObject({ phoneNotice: false, whatsappNotice: false });
    expect(contactChips({ phone: LOGIN, whatsapp: LOGIN }, null)).toMatchObject({ phoneNotice: false, whatsappNotice: false });
    expect(holdsLoginNumber('not a number', LOGIN)).toBe(false);
  });

  it('formats the login number for the chip with non-breaking spaces', () => {
    expect(formatLoginPhone(LOGIN)).toBe('+7 701 000 00 01');
    expect(formatLoginPhone('+12025550100')).toBe('+12025550100');
  });
});

// Short prepositions and conjunctions must not end a line: after them only a non-breaking space (U+00A0) is allowed.
const SHORT_WORD = /(^|[ «(—·,. ])(в|во|на|с|со|к|ко|по|за|от|до|из|у|о|об|и|а|но|не|ни|да|же|ли|бы|для|при|про|над|под|без|или) /iu; // a regular space only
const NEW_OR_CHANGED_RU = [
  'pointDetails.contactsHelp',
  'pointDetails.useLoginNumber',
  'pointDetails.sameAsPhone',
  'pointDetails.loginNoticePhone',
  'pointDetails.loginNoticeWhatsapp',
] as const;

describe('wording of the contact-default strings', () => {
  it('has no short preposition or conjunction before a breaking space in new or changed RU strings', () => {
    for (const key of NEW_OR_CHANGED_RU) expect((ru as Record<string, string>)[key], key).not.toMatch(SHORT_WORD);
  });

  it('has the exact notices and chip labels of the contract (with the non-breaking spaces)', () => {
    const nb = ' ';
    expect(ru['pointDetails.loginNoticePhone']).toBe(`Это${nb}номер, с${nb}которого вы${nb}вошли. Покупатели смогут позвонить на${nb}этот${nb}номер.`);
    expect(ru['pointDetails.loginNoticeWhatsapp']).toBe(`Покупатели смогут написать на${nb}этот${nb}номер.`);
    expect(ru['pointDetails.sameAsPhone']).toBe(`Тот${nb}же номер, что в${nb}«Телефоне»`);
    expect(ru['pointDetails.useLoginNumber']).toBe(`Указать мой${nb}номер {phone}`);
  });

  it('no longer says that every number needs a code', () => {
    expect(ru['pointDetails.contactsHelp']).not.toMatch(/только после подтверждения кодом/);
    expect(ru['pointDetails.contactsHelp']).toContain('Номер входа');
  });

  it('has a Kazakh string for every new or changed key', () => {
    for (const key of NEW_OR_CHANGED_RU) {
      const value = (kk as Record<string, string>)[key];
      expect(value, key).toBeTruthy();
      expect(value, key).not.toBe((ru as Record<string, string>)[key]);
    }
    expect(kk['pointDetails.useLoginNumber']).toContain('{phone}');
  });
});
