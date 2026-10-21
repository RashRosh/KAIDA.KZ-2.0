import { describe, expect, it } from 'vitest';
import {
  hasAnyKnownDay, openingHoursSchema, templateOpeningHours, unsetOpeningHours, type DaySchedule, type OpeningHours,
} from '../../src/modules/locations/hours/opening-hours';
import { openingStatus } from '../../src/modules/locations/hours/opening-hours-view';

// seller-ai-text-real-parser §18: «Не указано» is a day state of its own — never read as closed, never promising an
// opening after an unknown day. Points are in Asia/Almaty (UTC+5); 2026-10-21 is a Wednesday.
const at = (local: string) => new Date(`${local}+05:00`);
const open = (from: string, to: string): DaySchedule => ({ kind: 'intervals', intervals: [{ open: from, close: to }] });
function hours(days: Partial<OpeningHours['days']>): OpeningHours {
  return { ...unsetOpeningHours(), days: { ...unsetOpeningHours().days, ...days } };
}

describe('unset days', () => {
  it('is a valid stored state and a new point has nothing but it', () => {
    expect(openingHoursSchema.parse(unsetOpeningHours())).toEqual(unsetOpeningHours());
    expect(hasAnyKnownDay(unsetOpeningHours())).toBe(false);
    expect(hasAnyKnownDay(templateOpeningHours())).toBe(true);
  });

  it('today unknown → «на сегодня не указан», not closed', () => {
    expect(openingStatus(hours({ thu: open('09:00', '18:00') }), at('2026-10-21T12:00:00'))).toEqual({ state: 'unknown', kind: 'unknownToday' });
  });

  it('an opening after an unknown day is not promised', () => {
    // Wednesday closed, Thursday unknown, Friday open → «Закрыто», no «откроется в ПТ».
    expect(openingStatus(hours({ wed: { kind: 'closed' }, fri: open('09:00', '18:00') }), at('2026-10-21T12:00:00'))).toEqual({ state: 'closed', kind: 'closedNow' });
    // Closed for the rest of today with tomorrow known: the next opening is told as before.
    expect(openingStatus(hours({ wed: open('09:00', '11:00'), thu: open('09:00', '18:00') }), at('2026-10-21T12:00:00')))
      .toEqual({ state: 'closed', kind: 'opensOn', time: '9:00', day: 'thu' });
  });

  it('no known opening at all with unknown days is not «рабочих дней нет»', () => {
    expect(openingStatus(hours({ wed: { kind: 'closed' } }), at('2026-10-21T12:00:00'))).toEqual({ state: 'closed', kind: 'closedNow' });
    const allClosed = { ...unsetOpeningHours(), days: Object.fromEntries(Object.keys(unsetOpeningHours().days).map((d) => [d, { kind: 'closed' }])) } as OpeningHours;
    expect(openingStatus(allClosed, at('2026-10-21T12:00:00'))).toEqual({ state: 'closed', kind: 'noWorkingDays' });
  });

  it('an overnight interval from yesterday still counts on an unknown day', () => {
    expect(openingStatus(hours({ tue: open('20:00', '03:00') }), at('2026-10-21T01:00:00'))).toMatchObject({ state: 'open' });
  });

  it('known schedules read exactly as before', () => {
    expect(openingStatus(templateOpeningHours(), at('2026-10-21T12:00:00'))).toEqual({ state: 'open', kind: 'openUntil', time: '18:00' });
    expect(openingStatus(templateOpeningHours(), at('2026-10-24T12:00:00'))).toEqual({ state: 'closed', kind: 'opensOn', time: '9:00', day: 'mon' });
  });
});
