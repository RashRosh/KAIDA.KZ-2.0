import { z } from 'zod';

// Point opening hours (point-contacts-hours contract §2): a weekly schedule in the point's local time. Every day is
// closed, open around the clock, or 1–3 intervals; an interval whose close is not after its open ends on the next day.

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = typeof WEEKDAYS[number];

export const MAX_INTERVALS_PER_DAY = 3;
export const DEFAULT_TIME_ZONE = 'Asia/Almaty';
const DAY = 1440;
const WEEK = 7 * DAY;
export const CLOSING_SOON_MINUTES = 60;

const timeSchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);

const intervalSchema = z.object({ open: timeSchema, close: timeSchema }).strict()
  .refine((interval) => interval.open !== interval.close, 'An interval needs different open and close times');

export const dayScheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('closed') }).strict(),
  z.object({ kind: z.literal('24h') }).strict(),
  z.object({ kind: z.literal('intervals'), intervals: z.array(intervalSchema).min(1).max(MAX_INTERVALS_PER_DAY) }).strict()
    .refine((day) => !intervalsOverlap(day.intervals), 'Intervals of one day must not overlap'),
]);

export const openingHoursSchema = z.object({
  timeZone: z.literal(DEFAULT_TIME_ZONE),
  days: z.object(Object.fromEntries(WEEKDAYS.map((day) => [day, dayScheduleSchema])) as Record<Weekday, typeof dayScheduleSchema>).strict(),
}).strict();

export type DaySchedule = z.infer<typeof dayScheduleSchema>;
export type OpeningHours = z.infer<typeof openingHoursSchema>;
export type Interval = { open: string; close: string };

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

// [start, end) in minutes from the start of its own day; end may pass midnight.
function span(interval: Interval): [number, number] {
  const start = toMinutes(interval.open);
  const close = toMinutes(interval.close);
  return [start, close > start ? close : close + DAY];
}

function intervalsOverlap(intervals: Interval[]): boolean {
  const spans = intervals.map(span).sort((a, b) => a[0] - b[0]);
  return spans.some((current, index) => index > 0 && current[0] < spans[index - 1]![1]);
}

// First-point template: visibly a template, to be adjusted by the Seller.
export function templateOpeningHours(): OpeningHours {
  const weekday: DaySchedule = { kind: 'intervals', intervals: [{ open: '09:00', close: '18:00' }] };
  return {
    timeZone: DEFAULT_TIME_ZONE,
    days: { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: { kind: 'closed' }, sun: { kind: 'closed' } },
  };
}

// ---- State now ----

export type OpeningState =
  | { state: 'open' | 'closing'; closesAt: { weekday: Weekday; time: string } | null }
  | { state: 'closed'; opensAt: { weekday: Weekday; time: string; sameDay: boolean } | null };

function weekSegments(hours: OpeningHours): [number, number][] {
  const raw: [number, number][] = [];
  // Three unrolled weeks, so a segment crossing Sunday→Monday and the lookups around "now" never fall off an edge.
  for (let week = 0; week < 3; week += 1) {
    WEEKDAYS.forEach((day, index) => {
      const schedule = hours.days[day];
      const base = week * WEEK + index * DAY;
      if (schedule.kind === '24h') raw.push([base, base + DAY]);
      if (schedule.kind === 'intervals') for (const interval of schedule.intervals) {
        const [start, end] = span(interval);
        raw.push([base + start, base + end]);
      }
    });
  }
  raw.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const segment of raw) {
    const last = merged.at(-1);
    if (last && segment[0] <= last[1]) last[1] = Math.max(last[1], segment[1]);
    else merged.push([...segment]);
  }
  return merged;
}

export function localWeekMinute(now: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return weekday * DAY + Number(get('hour')) * 60 + Number(get('minute'));
}

function pointOf(weekMinute: number) {
  const inWeek = ((weekMinute % WEEK) + WEEK) % WEEK;
  const minute = inWeek % DAY;
  return {
    weekday: WEEKDAYS[Math.floor(inWeek / DAY)]!,
    time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
  };
}

export function openingState(hours: OpeningHours, now: Date): OpeningState {
  const segments = weekSegments(hours);
  const current = WEEK + localWeekMinute(now, hours.timeZone);
  const inside = segments.find(([start, end]) => start <= current && current < end);
  if (inside) {
    // Open for the whole unrolled range: around the clock every day.
    if (inside[1] - current > WEEK) return { state: 'open', closesAt: null };
    return { state: inside[1] - current <= CLOSING_SOON_MINUTES ? 'closing' : 'open', closesAt: pointOf(inside[1]) };
  }
  const next = segments.find(([start]) => start > current);
  if (!next) return { state: 'closed', opensAt: null };
  return {
    state: 'closed',
    opensAt: { ...pointOf(next[0]), sameDay: Math.floor(next[0] / DAY) === Math.floor(current / DAY) },
  };
}
