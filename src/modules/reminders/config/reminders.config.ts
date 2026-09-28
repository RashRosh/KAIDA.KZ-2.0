import { validateOfferValidityPeriodHours } from '../../offers/config/offer-lifecycle.config';
import type { ActualityPolicy } from '../../offers/actuality/actuality';

// actuality-reminders §2: two moments (hours since confirmation), each the day before a drop — before the ageing
// tier and before hiding. Read per run, so changed settings need no redeploy of data.

export type ReminderMoment = { hours: number; until: number; kind: 'drop' | 'hide' };

export const REMINDER_HOURS_DEFAULT = [24, 144] as const;
export const REMINDER_INTERVAL_MS = 15 * 60 * 1000;
// Almaty (UTC+5): nothing is sent from 21:00 to 09:00.
export const QUIET_HOURS = { fromHour: 21, toHour: 9, utcOffsetHours: 5 } as const;

export function parseReminderMoments(raw: string | undefined, policy: ActualityPolicy): ReminderMoment[] {
  const values = raw === undefined || raw.trim() === ''
    ? [...REMINDER_HOURS_DEFAULT]
    : raw.split(',').map((part) => validateOfferValidityPeriodHours(part.trim()));
  if (values.length !== 2) throw new Error('ACTUALITY_REMINDER_HOURS must list exactly two moments, e.g. 24,144');
  const [drop, hide] = values as [number, number];
  if (!(drop < policy.ageingHours && hide < policy.hiddenHours && drop < hide)) {
    throw new Error('Actuality reminders must come before the ageing and the hiding thresholds');
  }
  return [
    { hours: drop, until: policy.ageingHours, kind: 'drop' },
    { hours: hide, until: policy.hiddenHours, kind: 'hide' },
  ];
}

export function isQuietHour(now: Date): boolean {
  const hour = (now.getUTCHours() + QUIET_HOURS.utcOffsetHours) % 24;
  return hour >= QUIET_HOURS.fromHour || hour < QUIET_HOURS.toHour;
}

export type PushConfig = { publicKey: string; privateKey: string; subject: string };

// Without all three keys push is off: the job does not start and the button is hidden.
export function readPushConfig(env: Readonly<Record<string, string | undefined>> = process.env): PushConfig | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function reminderText(kind: ReminderMoment['kind'], count: number): { title: string; body: string } {
  const cards = pluralCards(count);
  return kind === 'drop'
    ? { title: 'Подтвердите актуальность', body: `Иначе завтра карточки опустятся в поиске · ${cards}` }
    : { title: 'Завтра карточки пропадут из поиска', body: `Подтвердите актуальность · ${cards}` };
}

function pluralCards(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'карточка'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'карточки' : 'карточек';
  return `${count} ${word}`;
}
