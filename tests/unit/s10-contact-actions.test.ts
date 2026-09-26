import { describe, expect, it } from 'vitest';
import { buildContactActions } from '../../src/modules/sellers/contact/build-contact-actions';
import type { PointPublicContacts } from '../../src/modules/locations/details/point-public-contacts';

// S10 as revised by point-contacts-hours: phone and WhatsApp of the point, targets built by KAIDA.
describe('S10 fixed Buyer contact actions', () => {
  it('builds exact fixed destinations in approved visual order', () => {
    expect(buildContactActions({ phoneE164: '+77001234567', whatsappPhoneE164: '+447911123456' })).toEqual([
      { label: 'Позвонить', href: 'tel:+77001234567' },
      { label: 'WhatsApp', href: 'https://wa.me/447911123456' },
    ]);
  });

  it('builds only actions for available channels', () => {
    expect(buildContactActions({ whatsappPhoneE164: '+77001234567' })).toEqual([
      { label: 'WhatsApp', href: 'https://wa.me/77001234567' },
    ]);
    expect(buildContactActions({} as PointPublicContacts)).toEqual([]);
  });

  it('does not let Seller-controlled URL-like fields change scheme or host', () => {
    const forged = {
      phoneE164: '+77001234567',
      url: 'https://evil.example/',
      href: 'javascript:alert(1)',
      telegramUsername: 'evil',
    } as PointPublicContacts & Record<string, string>;
    const actions = buildContactActions(forged);
    expect(actions).toEqual([{ label: 'Позвонить', href: 'tel:+77001234567' }]);
    expect(actions.map((action) => action.href).join(' ')).not.toContain('evil');
  });
});
