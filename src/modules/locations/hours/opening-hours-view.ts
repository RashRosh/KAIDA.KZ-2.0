import {
  localWeekMinute,
  openingState,
  WEEKDAYS,
  type DaySchedule,
  type Interval,
  type OpeningHours,
  type Weekday,
} from './opening-hours';

// card-opening-hours: how the buyer reads the existing opening state. Pure presentation over `openingState` — the
// calculation, the boundaries and the data are not changed here.

const DAY = 1440;

// «09:00» → «9:00»
export function clockText(time: string): string {
  return time.replace(/^0/, '');
}

export function formatInterval(interval: Interval): string {
  return `${clockText(interval.open)}–${clockText(interval.close)}`;
}

// The point's own weekday at `now` (never the device's zone).
export function localWeekday(hours: OpeningHours, now: Date): Weekday {
  return WEEKDAYS[Math.floor(localWeekMinute(now, hours.timeZone) / DAY)]!;
}

// Which words the status line uses; `state` drives the icon shape (never color alone).
export type OpeningStatus =
  | { state: 'open'; kind: 'allDay' }
  | { state: 'open'; kind: 'openUntil'; time: string }
  | { state: 'open'; kind: 'openUntilOn'; time: string; day: Weekday }
  | { state: 'closing'; kind: 'closingAt'; time: string }
  | { state: 'closing'; kind: 'closingAtOn'; time: string; day: Weekday }
  | { state: 'closed'; kind: 'opensToday'; time: string }
  | { state: 'closed'; kind: 'opensOn'; time: string; day: Weekday }
  | { state: 'closed'; kind: 'noWorkingDays' };

// A closing or opening that falls on another day of the point names that day: Sunday 22:00 with a close at 03:00 on
// Monday reads «до 3:00 ПН». A closed point always says when it opens, except when no day ever opens.
export function openingStatus(hours: OpeningHours, now: Date): OpeningStatus {
  const current = openingState(hours, now);
  const today = localWeekday(hours, now);
  if (current.state === 'closed') {
    if (current.opensAt === null) return { state: 'closed', kind: 'noWorkingDays' };
    const time = clockText(current.opensAt.time);
    return current.opensAt.sameDay
      ? { state: 'closed', kind: 'opensToday', time }
      : { state: 'closed', kind: 'opensOn', time, day: current.opensAt.weekday };
  }
  if (current.closesAt === null) return { state: 'open', kind: 'allDay' };
  const time = clockText(current.closesAt.time);
  const day = current.closesAt.weekday;
  if (current.state === 'closing') {
    return day === today ? { state: 'closing', kind: 'closingAt', time } : { state: 'closing', kind: 'closingAtOn', time, day };
  }
  return day === today ? { state: 'open', kind: 'openUntil', time } : { state: 'open', kind: 'openUntilOn', time, day };
}

// The message key of a status and its placeholders; the day is a Weekday the caller names in the interface language.
export function statusMessage(status: OpeningStatus): { key: string; time?: string; day?: Weekday } {
  switch (status.kind) {
    case 'allDay': return { key: 'hours.openAllDay' };
    case 'openUntil': return { key: 'hours.openUntil', time: status.time };
    case 'openUntilOn': return { key: 'hours.openUntilOn', time: status.time, day: status.day };
    case 'closingAt': return { key: 'hours.closingAt', time: status.time };
    case 'closingAtOn': return { key: 'hours.closingAtOn', time: status.time, day: status.day };
    case 'opensToday': return { key: 'hours.opensToday', time: status.time };
    case 'opensOn': return { key: 'hours.opensOn', time: status.time, day: status.day };
    case 'noWorkingDays': return { key: 'hours.noWorkingDays' };
  }
}

// ---- The Offer page schedule: consecutive days with an identical schedule are one row ----

export type ScheduleGroup = {
  from: number; // index in WEEKDAYS, Monday first
  to: number;
  schedule: DaySchedule;
};

export function scheduleKey(day: DaySchedule): string {
  if (day.kind === 'intervals') return `intervals:${day.intervals.map((interval) => `${interval.open}-${interval.close}`).join(',')}`;
  return day.kind;
}

// Monday → Sunday, no wrap: Sunday and Monday are never merged. Identical = same kind, same intervals in the same order.
export function groupSchedule(hours: OpeningHours): ScheduleGroup[] {
  const groups: ScheduleGroup[] = [];
  WEEKDAYS.forEach((weekday, index) => {
    const schedule = hours.days[weekday];
    const last = groups.at(-1);
    if (last && scheduleKey(last.schedule) === scheduleKey(schedule)) last.to = index;
    else groups.push({ from: index, to: index, schedule });
  });
  return groups;
}

export function groupContains(group: ScheduleGroup, weekday: Weekday): boolean {
  const index = WEEKDAYS.indexOf(weekday);
  return index >= group.from && index <= group.to;
}
