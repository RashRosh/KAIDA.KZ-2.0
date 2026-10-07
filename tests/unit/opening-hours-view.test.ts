import { describe, expect, it } from 'vitest';
import { kk, ru } from '../../src/i18n/messages';
import { openingState, templateOpeningHours, WEEKDAYS, type DaySchedule, type OpeningHours } from '../../src/modules/locations/hours/opening-hours';
import {
  formatInterval,
  groupContains,
  groupSchedule,
  localWeekday,
  openingStatus,
  statusMessage,
  type OpeningStatus,
} from '../../src/modules/locations/hours/opening-hours-view';

// card-opening-hours (docs/slices/card-opening-hours): the words of the status line, the day of a closing, and the Offer page groups.
// Almaty is UTC+5: local = UTC + 5 h. 2026-09-21 is a Monday. The results never depend on the zone of the machine running the test.
const at = (localIso: string) => new Date(new Date(`${localIso}:00Z`).getTime() - 5 * 3600_000);

const iv = (...pairs: [string, string][]): DaySchedule => ({ kind: 'intervals', intervals: pairs.map(([open, close]) => ({ open, close })) });
const SHUT: DaySchedule = { kind: 'closed' };
const ALL: DaySchedule = { kind: '24h' };
function week(days: Record<(typeof WEEKDAYS)[number], DaySchedule>): OpeningHours {
  return { timeZone: 'Asia/Almaty', days };
}
const same = (day: DaySchedule) => week({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day });
const base = templateOpeningHours(); // Mon-Fri 9:00-18:00, Sat-Sun closed
const withDays = (overrides: Partial<OpeningHours['days']>): OpeningHours => ({ ...base, days: { ...base.days, ...overrides } });

// Renders a status the way the page does: the message of the interface language, the day named by its short key.
function render(locale: typeof ru | typeof kk, status: OpeningStatus): string {
  const { key, time, day } = statusMessage(status);
  let text = (locale as Record<string, string>)[key]!;
  if (time !== undefined) text = text.replaceAll('{time}', time);
  if (day !== undefined) text = text.replaceAll('{day}', (locale as Record<string, string>)[`hours.day.${day}`]!);
  return text;
}
const both = (hours: OpeningHours, local: string) => {
  const status = openingStatus(hours, at(local));
  return { ru: render(ru, status), kk: render(kk, status), state: status.state };
};
const NB = ' ';

describe('status line words (§3.1)', () => {
  const lunch = withDays({ mon: iv(['09:00', '13:00'], ['14:00', '18:00']) });
  it('open, closing, and closed with the next opening — Russian and Kazakh', () => {
    expect(both(base, '2026-09-21T11:00')).toEqual({ ru: 'Открыто до 18:00', kk: '18:00 дейін ашық', state: 'open' });
    expect(both(base, '2026-09-21T17:20')).toEqual({ ru: 'Закрывается в 18:00', kk: '18:00 жабылады', state: 'closing' });
    expect(both(base, '2026-09-21T19:00')).toEqual({ ru: `Закрыто, откроется в 9:00${NB}ВТ`, kk: `Жабық, СС${NB}9:00 ашылады`, state: 'closed' });
    expect(both(base, '2026-09-21T07:30')).toEqual({ ru: 'Закрыто, откроется в 9:00', kk: 'Жабық, 9:00 ашылады', state: 'closed' });
  });
  it('a break is «closed, opens at 14:00» on the same day', () => {
    expect(both(lunch, '2026-09-21T13:30').ru).toBe('Закрыто, откроется в 14:00');
  });
  it('a closed point always says when it opens — the next week day across the week end too', () => {
    expect(both(base, '2026-09-26T12:00').ru).toBe(`Закрыто, откроется в 9:00${NB}ПН`);
    expect(both(base, '2026-09-27T23:59').ru).toBe(`Закрыто, откроется в 9:00${NB}ПН`);
  });
  it('around the clock every day, and a schedule with no working day', () => {
    expect(both(same(ALL), '2026-09-23T03:00')).toEqual({ ru: 'Открыто круглосуточно', kk: 'Тәулік бойы ашық', state: 'open' });
    expect(both(same(SHUT), '2026-09-23T03:00')).toEqual({ ru: 'Закрыто, рабочих дней нет', kk: 'Жабық, жұмыс күндері жоқ', state: 'closed' });
  });
});

describe('the closing day of an overnight status (§3.2)', () => {
  const night = withDays({ sat: iv(['18:00', '02:00']), sun: iv(['20:00', '03:00']) });
  it('names the real day when it is not today, and no day when it is today', () => {
    expect(both(night, '2026-09-27T22:00').ru).toBe(`Открыто до 3:00${NB}ПН`); // Sunday evening, closes Monday
    expect(both(night, '2026-09-28T01:30').ru).toBe('Открыто до 3:00'); // Monday small hours: closes today
    expect(both(night, '2026-09-26T22:00').ru).toBe(`Открыто до 2:00${NB}ВС`); // Saturday evening, closes Sunday
    expect(both(night, '2026-09-27T01:30').ru).toBe('Закрывается в 2:00'); // Sunday small hours, within the hour
    expect(both(night, '2026-09-27T01:30').kk).toBe('2:00 жабылады');
    expect(both(night, '2026-09-27T22:00').kk).toBe(`ДС${NB}3:00 дейін ашық`); // Monday
  });
  it('the week boundary: Sunday into Monday, 23:59 → 00:00, closing exactly at midnight', () => {
    const lateSunday = withDays({ sun: iv(['20:00', '00:00']) }); // closes at 00:00 = Monday midnight
    expect(both(lateSunday, '2026-09-27T21:00').ru).toBe(`Открыто до 0:00${NB}ПН`);
    expect(both(night, '2026-09-27T23:59').ru).toBe(`Открыто до 3:00${NB}ПН`);
    expect(both(night, '2026-09-28T00:00').ru).toBe('Открыто до 3:00'); // now it is Monday: no day
    expect(both(night, '2026-09-28T02:30').ru).toBe('Закрывается в 3:00');
    expect(both(night, '2026-09-28T03:00').ru).toBe('Закрыто, откроется в 9:00'); // Monday 03:00: closed (end excluded)
    expect(both(withDays({ sun: iv(['20:00', '00:00']) }), '2026-09-27T23:30')).toMatchObject({ ru: `Закрывается в 0:00${NB}ПН`, state: 'closing' });
  });
  it('a 24-hour Saturday and Sunday joined to Monday morning names Monday', () => {
    const merged = withDays({ sat: ALL, sun: ALL, mon: iv(['00:00', '10:00']) });
    expect(both(merged, '2026-09-26T23:30').ru).toBe(`Открыто до 10:00${NB}ПН`);
    expect(both(merged, '2026-09-28T09:30').ru).toBe('Закрывается в 10:00');
  });
  it('uses the point zone, not the zone of the machine', () => {
    // 2026-09-27 22:00 in Almaty is 17:00 UTC: a machine in Los Angeles would see Sunday 10:00 and a machine in Auckland Monday 06:00
    const night2 = withDays({ sun: iv(['20:00', '03:00']) });
    expect(localWeekday(night2, new Date('2026-09-27T17:00:00Z'))).toBe('sun');
    expect(localWeekday(night2, new Date('2026-09-27T19:30:00Z'))).toBe('mon'); // 00:30 Monday in Almaty
    expect(both(night2, '2026-09-27T22:00').ru).toBe(`Открыто до 3:00${NB}ПН`);
  });
});

describe('the calculation is the existing one', () => {
  it('open at the opening time, closed at the closing time, closing within 60 minutes inclusive', () => {
    expect(openingStatus(base, at('2026-09-21T09:00')).state).toBe('open');
    expect(openingStatus(base, at('2026-09-21T08:59')).state).toBe('closed');
    expect(openingStatus(base, at('2026-09-21T16:59')).state).toBe('open');
    expect(openingStatus(base, at('2026-09-21T17:00')).state).toBe('closing');
    expect(openingStatus(base, at('2026-09-21T18:00')).state).toBe('closed');
    expect(openingState(base, at('2026-09-21T17:00')).state).toBe('closing');
  });
});

describe('Offer page schedule groups (§3.3)', () => {
  const label = (group: { from: number; to: number }) => `${WEEKDAYS[group.from]}${group.from === group.to ? '' : `-${WEEKDAYS[group.to]}`}`;
  it('groups consecutive identical days; different days stay apart', () => {
    const groups = groupSchedule(withDays({ fri: iv(['13:00', '18:00']) }));
    expect(groups.map(label)).toEqual(['mon-thu', 'fri', 'sat-sun']);
  });
  it('breaks, overnight intervals, closed days and 24h days group like any other schedule', () => {
    const lunch = iv(['09:00', '13:00'], ['14:00', '18:00']);
    expect(groupSchedule(withDays({ mon: lunch, tue: lunch, wed: lunch, thu: lunch, fri: lunch, sat: iv(['09:00', '14:00']) })).map(label)).toEqual(['mon-fri', 'sat', 'sun']);
    const night = iv(['18:00', '02:00']);
    expect(groupSchedule(withDays({ fri: night, sat: night, sun: iv(['20:00', '03:00']) })).map(label)).toEqual(['mon-thu', 'fri-sat', 'sun']);
    expect(groupSchedule(withDays({ mon: ALL, tue: ALL, sat: SHUT, sun: SHUT })).map(label)).toEqual(['mon-tue', 'wed-fri', 'sat-sun']);
  });
  it('the same intervals in another order or with another time are different schedules', () => {
    expect(groupSchedule(withDays({ tue: iv(['09:00', '18:30']) })).map(label)).toEqual(['mon', 'tue', 'wed-fri', 'sat-sun']);
    expect(groupSchedule(withDays({ mon: iv(['14:00', '18:00'], ['09:00', '13:00']), tue: iv(['09:00', '13:00'], ['14:00', '18:00']) })).map(label)).toEqual(['mon', 'tue', 'wed-fri', 'sat-sun']);
  });
  it('seven identical days are one row; Sunday and Monday are never merged (no wrap)', () => {
    expect(groupSchedule(same(ALL)).map(label)).toEqual(['mon-sun']);
    expect(groupSchedule(same(SHUT)).map(label)).toEqual(['mon-sun']);
    expect(groupSchedule(withDays({ sat: iv(['09:00', '18:00']), sun: iv(['09:00', '18:00']) })).map(label)).toEqual(['mon-sun']);
    expect(groupSchedule(withDays({ mon: SHUT, sun: SHUT })).map(label)).toEqual(['mon', 'tue-fri', 'sat-sun']);
  });
  it('every stored interval is shown exactly once', () => {
    const lunch = iv(['09:00', '13:00'], ['14:00', '18:00']);
    const hours = withDays({ mon: lunch, tue: lunch, fri: iv(['13:00', '18:00']) });
    const shown = groupSchedule(hours).flatMap((group) => (group.schedule.kind === 'intervals' ? group.schedule.intervals.map(formatInterval) : []));
    expect(shown).toEqual(['9:00–13:00', '14:00–18:00', '9:00–18:00', '13:00–18:00']);
    // days covered: every weekday belongs to exactly one group
    const covered = groupSchedule(hours).flatMap((group) => WEEKDAYS.filter((day) => groupContains(group, day)));
    expect(covered).toEqual([...WEEKDAYS]);
  });
  it('finds the group that holds today', () => {
    const groups = groupSchedule(withDays({ fri: iv(['13:00', '18:00']) }));
    expect(groups.findIndex((group) => groupContains(group, 'wed'))).toBe(0);
    expect(groups.findIndex((group) => groupContains(group, 'fri'))).toBe(1);
    expect(groups.findIndex((group) => groupContains(group, 'sun'))).toBe(2);
  });
  it('times read 9:00–18:00 with a colon and no leading zero', () => {
    expect(formatInterval({ open: '09:00', close: '18:30' })).toBe('9:00–18:30');
    expect(formatInterval({ open: '18:00', close: '02:00' })).toBe('18:00–2:00');
  });
});
