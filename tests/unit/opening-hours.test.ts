import { describe, expect, it } from 'vitest';
import {
  openingHoursSchema,
  openingState,
  templateOpeningHours,
  type DaySchedule,
  type OpeningHours,
} from '../../src/modules/locations/hours/opening-hours';

// Almaty is UTC+5: local = UTC + 5 h. 2026-09-21 is a Monday.
const at = (localIso: string) => new Date(new Date(`${localIso}:00Z`).getTime() - 5 * 3600_000);

function hours(overrides: Partial<Record<keyof OpeningHours['days'], DaySchedule>>): OpeningHours {
  const base = templateOpeningHours();
  return { ...base, days: { ...base.days, ...overrides } };
}

const iv = (...pairs: [string, string][]): DaySchedule => ({ kind: 'intervals', intervals: pairs.map(([open, close]) => ({ open, close })) });

describe('opening hours validation', () => {
  it('accepts closed, 24h, breaks and past-midnight intervals', () => {
    expect(openingHoursSchema.safeParse(hours({ mon: { kind: '24h' }, tue: iv(['09:00', '13:00'], ['14:00', '18:00']), fri: iv(['18:00', '02:00']) })).success).toBe(true);
  });

  it('rejects overlap, equal ends, bad times, more than three intervals and a missing day', () => {
    expect(openingHoursSchema.safeParse(hours({ mon: iv(['09:00', '14:00'], ['13:00', '18:00']) })).success).toBe(false);
    expect(openingHoursSchema.safeParse(hours({ mon: iv(['09:00', '09:00']) })).success).toBe(false);
    expect(openingHoursSchema.safeParse(hours({ mon: iv(['24:00', '09:00']) })).success).toBe(false);
    expect(openingHoursSchema.safeParse(hours({ mon: iv(['01:00', '02:00'], ['03:00', '04:00'], ['05:00', '06:00'], ['07:00', '08:00']) })).success).toBe(false);
    const days: Partial<OpeningHours['days']> = { ...templateOpeningHours().days };
    delete days.mon;
    expect(openingHoursSchema.safeParse({ timeZone: 'Asia/Almaty', days }).success).toBe(false);
  });
});

describe('opening state', () => {
  const week = hours({ fri: iv(['13:00', '18:00']) });

  it('is open, then closing within the last hour, then closed with the next opening', () => {
    expect(openingState(week, at('2026-09-21T10:00'))).toEqual({ state: 'open', closesAt: { weekday: 'mon', time: '18:00' } });
    expect(openingState(week, at('2026-09-21T17:00'))).toEqual({ state: 'closing', closesAt: { weekday: 'mon', time: '18:00' } });
    expect(openingState(week, at('2026-09-21T16:59'))).toMatchObject({ state: 'open' });
    expect(openingState(week, at('2026-09-21T18:00'))).toEqual({ state: 'closed', opensAt: { weekday: 'tue', time: '09:00', sameDay: false } });
    expect(openingState(week, at('2026-09-21T07:00'))).toEqual({ state: 'closed', opensAt: { weekday: 'mon', time: '09:00', sameDay: true } });
  });

  it('skips closed days to the next opening across the week end', () => {
    expect(openingState(week, at('2026-09-26T12:00'))).toEqual({ state: 'closed', opensAt: { weekday: 'mon', time: '09:00', sameDay: false } });
  });

  it('handles past-midnight intervals, including Sunday into Monday', () => {
    const night = hours({ sat: iv(['18:00', '02:00']), sun: iv(['20:00', '03:00']) });
    expect(openingState(night, at('2026-09-27T01:30'))).toEqual({ state: 'closing', closesAt: { weekday: 'sun', time: '02:00' } });
    expect(openingState(night, at('2026-09-28T01:00'))).toEqual({ state: 'open', closesAt: { weekday: 'mon', time: '03:00' } });
  });

  it('breaks close and reopen the same day', () => {
    const lunch = hours({ mon: iv(['09:00', '13:00'], ['14:00', '18:00']) });
    expect(openingState(lunch, at('2026-09-21T13:30'))).toEqual({ state: 'closed', opensAt: { weekday: 'mon', time: '14:00', sameDay: true } });
  });

  it('is open with no closing time when open around the clock every day; closed forever when never open', () => {
    const always: DaySchedule = { kind: '24h' };
    const allDay = hours({ mon: always, tue: always, wed: always, thu: always, fri: always, sat: always, sun: always });
    expect(openingState(allDay, at('2026-09-23T03:00'))).toEqual({ state: 'open', closesAt: null });
    const shut: DaySchedule = { kind: 'closed' };
    const never = hours({ mon: shut, tue: shut, wed: shut, thu: shut, fri: shut });
    expect(openingState(never, at('2026-09-23T03:00'))).toEqual({ state: 'closed', opensAt: null });
  });

  it('merges 24h days with an adjacent interval into one opening', () => {
    const merged = hours({ sat: { kind: '24h' }, sun: iv(['00:00', '10:00']) });
    expect(openingState(merged, at('2026-09-26T23:30'))).toEqual({ state: 'open', closesAt: { weekday: 'sun', time: '10:00' } });
  });
});
