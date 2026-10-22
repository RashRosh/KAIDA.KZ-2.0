import { describe, expect, it } from 'vitest';
import { projectPointPublicContacts } from '../../src/modules/locations/details/point-public-contacts';
import { InvalidTelegramUsernameError, normalizeTelegramUsername } from '../../src/modules/locations/details/telegram-username';
import { buildContactActions } from '../../src/modules/sellers/contact/build-contact-actions';

// seller-ai-text-real-parser §17: Telegram username input, storage form and the link KAIDA builds.
describe('Telegram username normalization', () => {
  it.each([
    ['kaida_shop', 'kaida_shop'],
    ['@Kaida_Shop', 'kaida_shop'],
    ['  @kaida_shop  ', 'kaida_shop'],
    ['t.me/kaida_shop', 'kaida_shop'],
    ['https://t.me/kaida_shop', 'kaida_shop'],
    ['https://t.me/kaida_shop/', 'kaida_shop'],
    ['http://www.t.me/Kaida_Shop', 'kaida_shop'],
    ['telegram.me/kaida_shop', 'kaida_shop'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTelegramUsername(input)).toBe(expected);
  });

  it('an empty field clears the contact', () => {
    expect(normalizeTelegramUsername('')).toBeNull();
    expect(normalizeTelegramUsername('   ')).toBeNull();
    expect(normalizeTelegramUsername(null)).toBeNull();
  });

  it.each([
    ['https://t.me/+AbCdEf123', 'invite'],
    ['t.me/joinchat/AAAAAE', 'invite'],
    ['https://t.me/kaida_shop/123', 'format'],
    ['https://t.me/s/kaida_shop', 'format'],
    ['https://t.me/c/123/45', 'format'],
    ['https://example.com/kaida_shop', 'format'],
    ['https://instagram.com/kaida_shop', 'format'],
    ['kai', 'format'],
    ['1kaida', 'format'],
    ['kaida_', 'format'],
    ['kaida shop', 'format'],
    ['кайда_шоп', 'format'],
    ['+77010000001', 'format'],
    ['a'.repeat(33), 'format'],
  ])('%s is rejected (%s)', (input, reason) => {
    expect(() => normalizeTelegramUsername(input)).toThrow(InvalidTelegramUsernameError);
    try {
      normalizeTelegramUsername(input);
    } catch (error) {
      expect((error as InvalidTelegramUsernameError).reason).toBe(reason);
    }
  });
});

describe('buyer contacts', () => {
  it('a saved username is public and KAIDA builds the t.me link; numbers still need verification', () => {
    const { contacts } = projectPointPublicContacts({ phoneE164: '+77010000001', whatsappPhoneE164: null, telegramUsername: 'kaida_shop' }, new Set());
    expect(contacts).toEqual({ telegramUsername: 'kaida_shop' });
    expect(buildContactActions(contacts!)).toEqual([{ label: 'Telegram', href: 'https://t.me/kaida_shop' }]);
  });

  it('no Telegram is inferred from a phone number', () => {
    const { contacts } = projectPointPublicContacts({ phoneE164: '+77010000001', whatsappPhoneE164: '+77010000001', telegramUsername: null }, new Set(['+77010000001']));
    expect(buildContactActions(contacts!).map((action) => action.label)).toEqual(['Позвонить', 'WhatsApp']);
  });
});
