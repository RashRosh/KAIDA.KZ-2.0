'use client';

import { useState } from 'react';
import {
  MAX_INTERVALS_PER_DAY,
  WEEKDAYS,
  type DaySchedule,
  type OpeningHours,
  type Weekday,
} from '@/modules/locations/hours/opening-hours';
import type { PointContactView } from '@/modules/locations/details/point-details.contract';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import styles from '../page.module.css';

export type ContactsDraft = { phone: string; whatsapp: string };

const dayKey = (day: Weekday) => `hours.day.${day}` as MessageKey;

// Contacts block of the point form: both optional; a number is public only after it is confirmed.
export function PointContactsFields({ value, onChange, disabled, sourceName }: {
  value: ContactsDraft;
  onChange: (value: ContactsDraft) => void;
  disabled: boolean;
  sourceName?: string | null;
}) {
  const { t } = useI18n();
  return (
    <fieldset className={`${styles.field} ${styles.fieldWide}`}>
      <legend>{t('pointDetails.contacts')} <span className={styles.fieldHelp}>· {t('editor.optional')}</span></legend>
      <p className={styles.fieldHelp}>{sourceName ? t('pointDetails.copiedFrom', { name: sourceName }) : t('pointDetails.contactsHelp')}</p>
      <label htmlFor="point-phone">{t('pointDetails.phone')}</label>
      <input id="point-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 7XX XXX XX XX" value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} disabled={disabled} />
      <label htmlFor="point-whatsapp">WhatsApp</label>
      <input id="point-whatsapp" type="tel" inputMode="tel" placeholder="+7 7XX XXX XX XX" value={value.whatsapp} onChange={(event) => onChange({ ...value, whatsapp: event.target.value })} disabled={disabled} />
    </fieldset>
  );
}

function kindOf(day: DaySchedule): DaySchedule['kind'] { return day.kind; }

// Opening hours editor (point-contacts-hours §2): any weekly schedule — closed, around the clock, or up to three
// intervals per day, an interval may end after midnight.
export function OpeningHoursFields({ value, onChange, disabled, needsReview }: {
  value: OpeningHours;
  onChange: (value: OpeningHours) => void;
  disabled: boolean;
  needsReview: boolean;
}) {
  const { t } = useI18n();
  const setDay = (day: Weekday, schedule: DaySchedule) => onChange({ ...value, days: { ...value.days, [day]: schedule } });
  const [announce, setAnnounce] = useState('');

  function setKind(day: Weekday, kind: DaySchedule['kind']) {
    if (kind === 'intervals') setDay(day, { kind, intervals: [{ open: '09:00', close: '18:00' }] });
    else setDay(day, { kind } as DaySchedule);
  }

  function copyMondayToWeekdays() {
    const monday = value.days.mon;
    onChange({ ...value, days: { ...value.days, tue: monday, wed: monday, thu: monday, fri: monday } });
    setAnnounce(t('hoursEditor.copied'));
  }

  return (
    <fieldset className={`${styles.field} ${styles.fieldWide}`} aria-describedby="hours-help">
      <legend>{t('hours.label')} <span aria-hidden="true">*</span></legend>
      <p id="hours-help" className={styles.fieldHelp}>{needsReview ? t('pointDetails.hoursReview') : t('hoursEditor.help')}</p>
      <button type="button" className={styles.secondaryButton} onClick={copyMondayToWeekdays} disabled={disabled}>{t('hoursEditor.sameWeekdays')}</button>
      <div className={styles.hoursGrid}>
        {WEEKDAYS.map((day) => {
          const schedule = value.days[day];
          return (
            <div key={day} className={styles.hoursRow} role="group" aria-label={t(dayKey(day))}>
              <span className={styles.hoursDay}>{t(dayKey(day))}</span>
              <select aria-label={t('hoursEditor.kindFor', { day: t(dayKey(day)) })} value={kindOf(schedule)} onChange={(event) => setKind(day, event.target.value as DaySchedule['kind'])} disabled={disabled}>
                <option value="intervals">{t('hoursEditor.open')}</option>
                <option value="24h">{t('hours.aroundTheClock')}</option>
                <option value="closed">{t('hoursEditor.closed')}</option>
              </select>
              {schedule.kind === 'intervals' && (
                <div className={styles.hoursIntervals}>
                  {schedule.intervals.map((interval, index) => (
                    <span key={index} className={styles.hoursInterval}>
                      <input type="time" aria-label={t('hoursEditor.from', { day: t(dayKey(day)), n: index + 1 })} value={interval.open} disabled={disabled}
                        onChange={(event) => setDay(day, { kind: 'intervals', intervals: schedule.intervals.map((item, i) => (i === index ? { ...item, open: event.target.value } : item)) })} />
                      <span aria-hidden="true">–</span>
                      <input type="time" aria-label={t('hoursEditor.to', { day: t(dayKey(day)), n: index + 1 })} value={interval.close} disabled={disabled}
                        onChange={(event) => setDay(day, { kind: 'intervals', intervals: schedule.intervals.map((item, i) => (i === index ? { ...item, close: event.target.value } : item)) })} />
                      {schedule.intervals.length > 1 && (
                        <button type="button" className={styles.linkButton} disabled={disabled} aria-label={t('hoursEditor.removeInterval', { day: t(dayKey(day)), n: index + 1 })}
                          onClick={() => setDay(day, { kind: 'intervals', intervals: schedule.intervals.filter((_, i) => i !== index) })}>×</button>
                      )}
                    </span>
                  ))}
                  {schedule.intervals.length < MAX_INTERVALS_PER_DAY && (
                    <button type="button" className={styles.linkButton} disabled={disabled}
                      onClick={() => setDay(day, { kind: 'intervals', intervals: [...schedule.intervals, { open: '14:00', close: '18:00' }] })}>
                      {t('hoursEditor.addBreak')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className={styles.srOnly} aria-live="polite">{announce}</p>
    </fieldset>
  );
}

// Card line: a contact with its state and, when not yet confirmed, the code step.
export function PointContactStatus({ label, contact, onVerified }: {
  label: string;
  contact: PointContactView;
  onVerified: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<'idle' | 'sending' | 'code' | 'checking'>('idle');
  const [challenge, setChallenge] = useState<{ id: string; testCode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function request() {
    setError('');
    setStep('sending');
    try {
      const response = await fetch('/api/seller/points/contact-codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: contact.e164 }),
      });
      const data = await response.json() as { challenge?: { id: string }; delivery?: { code?: string } };
      if (!response.ok || !data.challenge) throw new Error('request');
      setChallenge({ id: data.challenge.id, testCode: data.delivery?.code });
      setStep('code');
    } catch {
      setError(t('pointDetails.codeRequestError'));
      setStep('idle');
    }
  }

  async function confirm() {
    if (!challenge) return;
    setError('');
    setStep('checking');
    try {
      const response = await fetch('/api/seller/points/contact-codes/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.id, code: code.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: { code?: string } };
        setError(data.error?.code === 'OTP_EXPIRED' ? t('error.OTP_EXPIRED') : t('error.INVALID_OTP'));
        setStep('code');
        return;
      }
      onVerified();
    } catch {
      setError(t('pointDetails.codeRequestError'));
      setStep('code');
    }
  }

  return (
    <div className={styles.contactStatus}>
      <span>{label}: {contact.e164}</span>
      {contact.verified ? (
        <span className={styles.geoBadge}>{t('pointDetails.verified')}</span>
      ) : step === 'idle' || step === 'sending' ? (
        <>
          <span className={styles.fieldHelp}>{t('pointDetails.notVerified')}</span>
          <button type="button" className={styles.secondaryButton} onClick={() => void request()} disabled={step === 'sending'}>{t('pointDetails.verify')}</button>
        </>
      ) : (
        <form className={styles.codeForm} onSubmit={(event) => { event.preventDefault(); void confirm(); }}>
          {challenge?.testCode && <p className={styles.fieldHelp}>{t('auth.testCode', { code: challenge.testCode })}</p>}
          <label htmlFor={`code-${contact.e164}`}>{t('auth.otp')}</label>
          <input id={`code-${contact.e164}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} disabled={step === 'checking'} />
          <button type="submit" disabled={step === 'checking' || code.trim().length !== 6}>{t('pointDetails.confirmCode')}</button>
        </form>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
