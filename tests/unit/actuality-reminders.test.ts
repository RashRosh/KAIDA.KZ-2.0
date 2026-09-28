import { describe, expect, it } from 'vitest';
import type { ActualityPolicy } from '../../src/modules/offers/actuality/actuality';
import { isQuietHour, parseReminderMoments, readPushConfig, reminderText } from '../../src/modules/reminders/config/reminders.config';

// actuality-reminders §7: moments, quiet hours in Almaty time, texts.

const policy: ActualityPolicy = { dueHours: 24, ageingHours: 48, hiddenHours: 168, archiveHours: 336 };

describe('reminder moments', () => {
  it('defaults to the day before dropping and the day before hiding', () => {
    expect(parseReminderMoments(undefined, policy)).toEqual([
      { hours: 24, until: 48, kind: 'drop' },
      { hours: 144, until: 168, kind: 'hide' },
    ]);
    expect(parseReminderMoments(' 30 , 150 ', policy).map((moment) => moment.hours)).toEqual([30, 150]);
  });

  it('refuses a wrong count or a moment after its drop', () => {
    expect(() => parseReminderMoments('24', policy)).toThrow();
    expect(() => parseReminderMoments('48,144', policy)).toThrow();
    expect(() => parseReminderMoments('24,168', policy)).toThrow();
    expect(() => parseReminderMoments('24,x', policy)).toThrow();
  });
});

describe('quiet hours 21:00–09:00 Almaty (UTC+5)', () => {
  const almaty = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 28, hour - 5, minute));
  it('is quiet exactly from 21:00 to 08:59', () => {
    expect(isQuietHour(almaty(20, 59))).toBe(false);
    expect(isQuietHour(almaty(21, 0))).toBe(true);
    expect(isQuietHour(almaty(2, 0))).toBe(true);
    expect(isQuietHour(almaty(8, 59))).toBe(true);
    expect(isQuietHour(almaty(9, 0))).toBe(false);
  });
});

describe('texts and keys', () => {
  it('names the drop or the hiding and counts cards in Russian', () => {
    expect(reminderText('drop', 1)).toEqual({ title: 'Подтвердите актуальность', body: 'Иначе завтра карточки опустятся в поиске · 1 карточка' });
    expect(reminderText('hide', 3).body).toBe('Подтвердите актуальность · 3 карточки');
    expect(reminderText('hide', 11).body).toBe('Подтвердите актуальность · 11 карточек');
    expect(reminderText('drop', 22).body).toBe('Иначе завтра карточки опустятся в поиске · 22 карточки');
  });

  it('push is off unless all three keys are set', () => {
    expect(readPushConfig({})).toBeNull();
    expect(readPushConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: 'a', WEB_PUSH_VAPID_PRIVATE_KEY: 'b' })).toBeNull();
    expect(readPushConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: 'a', WEB_PUSH_VAPID_PRIVATE_KEY: 'b', WEB_PUSH_SUBJECT: 'mailto:ops@kaida.kz' }))
      .toEqual({ publicKey: 'a', privateKey: 'b', subject: 'mailto:ops@kaida.kz' });
  });
});
