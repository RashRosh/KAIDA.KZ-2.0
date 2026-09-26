'use client';

import { useEffect, useState } from 'react';
import {
  hoursLine,
  openingState,
  type OpeningHours,
  type OpeningState,
} from '../../modules/locations/hours/opening-hours';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import styles from './opening-hours-line.module.css';

function StateIcon({ state }: { state: OpeningState['state'] }) {
  // A different shape per state, so the state never depends on color alone (§18.4).
  if (state === 'open') {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg>;
  }
  if (state === 'closing') {
    return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  }
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
}

// point-contacts-hours §2: «9.00–18.00 | ПТ 13.00–18.00 | СБ ВС» with a state icon recomputed every minute on the device.
export function OpeningHoursLine({ hours }: { hours: OpeningHours }) {
  const { t } = useI18n();
  // The state depends on the device clock, so it appears after mount to keep server and client markup equal.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  const day = (weekday: string) => t(`hours.day.${weekday}` as MessageKey);
  const clock = (time: string) => time.replace(/^0/, '');
  const state = now ? openingState(hours, now) : null;
  function describe(current: OpeningState): string {
    if (current.state === 'closed') {
      if (!current.opensAt) return t('hours.closedNow');
      const time = clock(current.opensAt.time);
      return current.opensAt.sameDay ? t('hours.opensToday', { time }) : t('hours.opensOn', { time, day: day(current.opensAt.weekday) });
    }
    if (!current.closesAt) return t('hours.openAllDay');
    const time = clock(current.closesAt.time);
    return current.state === 'closing' ? t('hours.closingAt', { time }) : t('hours.openUntil', { time });
  }
  const stateLabel = state ? describe(state) : null;

  return (
    <p className={styles.line} data-state={state?.state} data-testid="opening-hours">
      {state && (
        <span className={styles.state} role="img" aria-label={stateLabel ?? undefined} title={stateLabel ?? undefined}>
          <StateIcon state={state.state} />
        </span>
      )}
      <span className={styles.srOnly}>{t('hours.label')}: </span>
      {hoursLine(hours, t('hours.aroundTheClock')).map((part, index) => (
        <span key={index} className={styles.part}>
          {index > 0 && <span className={styles.divider} aria-hidden="true"> | </span>}
          {part.closed ? (
            <>
              <s className={styles.closed}>{part.days!.map(day).join(' ')}</s>
              <span className={styles.srOnly}> — {t('hours.dayOff')}</span>
            </>
          ) : (
            <>{part.days && <span className={styles.days}>{part.days.map(day).join(' ')} </span>}{part.text}</>
          )}
        </span>
      ))}
    </p>
  );
}
