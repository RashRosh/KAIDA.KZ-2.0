import { describe, expect, it } from 'vitest';

type PublicContacts = {
  phoneE164?: string;
  whatsappPhoneE164?: string;
  telegramUsername?: string;
  instagramUsername?: string;
};

type ContactAction = {
  label: 'Позвонить' | 'WhatsApp' | 'Telegram' | 'Instagram';
  href: string;
};

type ActionModule = {
  buildContactActions(contacts: PublicContacts): ContactAction[];
};

async function loadBuilder(): Promise<ActionModule> {
  const modulePath = '../../src/modules/sellers/contact/build-contact-actions';
  return import(modulePath) as Promise<ActionModule>;
}

describe('S10 fixed Buyer contact actions', () => {
  it('builds exact fixed destinations in approved visual order', async () => {
    const { buildContactActions } = await loadBuilder();
    expect(buildContactActions({
      phoneE164: '+77001234567',
      whatsappPhoneE164: '+447911123456',
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
    })).toEqual([
      { label: 'Позвонить', href: 'tel:+77001234567' },
      { label: 'WhatsApp', href: 'https://wa.me/447911123456' },
      { label: 'Telegram', href: 'https://t.me/kaida_shop' },
      { label: 'Instagram', href: 'https://www.instagram.com/kaida.shop/' },
    ]);
  });

  it('builds only actions for available channels', async () => {
    const { buildContactActions } = await loadBuilder();
    expect(buildContactActions({ telegramUsername: 'kaida_shop' })).toEqual([
      { label: 'Telegram', href: 'https://t.me/kaida_shop' },
    ]);
    expect(buildContactActions({})).toEqual([]);
  });

  it('does not let Seller-controlled URL-like fields change scheme or host', async () => {
    const { buildContactActions } = await loadBuilder();
    const forged = {
      telegramUsername: 'kaida_shop',
      instagramUsername: 'kaida.shop',
      url: 'https://evil.example/',
      href: 'javascript:alert(1)',
      link: '//evil.example/',
      redirect: 'https://evil.example/',
    } as PublicContacts & Record<string, string>;
    const actions = buildContactActions(forged);
    expect(actions).toEqual([
      { label: 'Telegram', href: 'https://t.me/kaida_shop' },
      { label: 'Instagram', href: 'https://www.instagram.com/kaida.shop/' },
    ]);
    expect(actions.map((action) => action.href).join(' ')).not.toContain('evil.example');
    expect(actions.map((action) => action.href).join(' ')).not.toContain('javascript:');
  });
});
