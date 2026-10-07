'use client';

import { useEffect, useState } from 'react';
import { WEEKDAYS, type OpeningHours, type Weekday } from '../../modules/locations/hours/opening-hours';
import {
  formatInterval,
  groupContains,
  groupSchedule,
  localWeekday,
  openingStatus,
  statusMessage,
  type OpeningStatus,
  type ScheduleGroup,
} from '../../modules/locations/hours/opening-hours-view';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import styles from './opening-hours-line.module.css';

// card-opening-hours: the state depends on the device clock, so it appears after mount (server and client markup stay
// equal); it is recomputed every minute and whenever the page comes back to the foreground.
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', update);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', update);
    };
  }, []);
  return now;
}

function StateIcon({ state }: { state: OpeningStatus['state'] }) {
  // A different shape per state; the words carry the meaning, so it never depends on color alone (§18.4).
  if (state === 'open') {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg>;
  }
  if (state === 'closing') {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  }
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
}

function useDayName() {
  const { t } = useI18n();
  return (weekday: Weekday) => t(`hours.day.${weekday}` as MessageKey);
}

// B01 / B02: one line — «Открыто до 18:00», «Закрыто, откроется в 9:00 ПН». A closed point always says when it opens.
// Not interactive; the room for the line is reserved before the device clock is read.
export function OpeningStatusLine({ hours }: { hours: OpeningHours | null | undefined }) {
  const { t } = useI18n();
  const dayName = useDayName();
  const now = useNow();
  if (!hours?.days) {
    return <p className={styles.line} data-testid="opening-hours"><span className={styles.text} data-muted="true">{t('hours.notSet')}</span></p>;
  }
  const status = now ? openingStatus(hours, now) : null;
  return (
    <p className={styles.line} data-state={status?.state} data-testid="opening-hours">
      {status && (
        <>
          <span className={styles.icon}><StateIcon state={status.state} /></span>
          <span className={styles.text}>{statusText(status)}</span>
        </>
      )}
    </p>
  );

  function statusText(current: OpeningStatus): string {
    const { key, time, day } = statusMessage(current);
    return t(key as MessageKey, { ...(time === undefined ? {} : { time }), ...(day === undefined ? {} : { day: dayName(day) }) });
  }
}

function groupLabel(group: ScheduleGroup, dayName: (weekday: Weekday) => string): string {
  const first = dayName(WEEKDAYS[group.from]!);
  return group.from === group.to ? first : `${first}–${dayName(WEEKDAYS[group.to]!)}`;
}

// B02: the whole week, always visible. Consecutive days with an identical schedule are one row; the row that holds
// today is bold (and named for a screen reader), never marked by color alone.
export function OpeningSchedule({ hours }: { hours: OpeningHours | null | undefined }) {
  const { t } = useI18n();
  const dayName = useDayName();
  const now = useNow();
  if (!hours?.days) return null;
  const today = now ? localWeekday(hours, now) : null;
  return (
    <ul className={styles.schedule} aria-label={t('hours.label')} data-testid="opening-schedule">
      {groupSchedule(hours).map((group) => {
        const isToday = today !== null && groupContains(group, today);
        const { schedule } = group;
        return (
          <li key={group.from} className={styles.row} data-today={isToday ? 'true' : undefined} aria-current={isToday ? 'date' : undefined}>
            <span className={styles.day}>
              {groupLabel(group, dayName)}
              {isToday && <span className={styles.srOnly}>, {t('hours.today')}</span>}
            </span>
            <span className={styles.times}>
              {schedule.kind === 'closed' && <span className={styles.off}>{t('hours.dayOff')}</span>}
              {schedule.kind === '24h' && t('hours.aroundTheClock')}
              {schedule.kind === 'intervals' && schedule.intervals.map((interval, index) => (
                <span key={index}>{index > 0 && ', '}<span className={styles.interval}>{formatInterval(interval)}</span></span>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
