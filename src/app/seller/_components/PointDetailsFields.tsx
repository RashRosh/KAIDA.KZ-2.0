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
import { ErrorLine, Ic } from '../_kaida/ui';

export type ContactsDraft = { phone: string; whatsapp: string };

const dayKey = (day: Weekday) => `hours.day.${day}` as MessageKey;

const WHATSAPP_ICON = '/kaida/icons/127a626f246aa48c4b8bc196e32e93a2.svg';

function ChannelLabel({ channel, htmlFor, label, badge }: { channel: 'phone' | 'whatsapp'; htmlFor: string; label: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- mockup brand mark */}
      {channel === 'phone' ? <Ic name="phone" className="sm c2" /> : <img src={WHATSAPP_ICON} alt="" style={{ width: 20, height: 20 }} />}
      <label htmlFor={htmlFor} style={{ flex: badge ? 1 : undefined }}>{label}</label>
      {badge}
    </div>
  );
}

// AI-S12A · Point · Contacts: both optional; a number is public only after it is confirmed (AI-S13).
export function PointContactsFields({ value, onChange, disabled, sourceName, saved }: {
  value: ContactsDraft;
  onChange: (value: ContactsDraft) => void;
  disabled: boolean;
  sourceName?: string | null;
  saved?: { phone?: PointContactView | null; whatsapp?: PointContactView | null };
}) {
  const { t } = useI18n();
  const badge = (contact: PointContactView | null | undefined, draft: string) => contact && contact.e164 === draft.trim()
    ? contact.verified
      ? <span className="bd bd-ok"><Ic name="check" />{t('pointDetails.verified')}</span>
      : <span className="bd bd-info"><Ic name="clock" />{t('pointDetails.waiting')}</span>
    : undefined;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 className="h3" style={{ flex: 1 }}>{t('pointDetails.contacts')}</h2><span className="c">{t('editor.optional')}</span>
      </div>
      {sourceName ? (
        <div className="banner info" style={{ padding: '10px 12px', borderRadius: 12, flexDirection: 'row', gap: 8 }}>
          <Ic name="copy" className="sm" style={{ color: 'var(--info)' }} /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('pointDetails.copiedFrom', { name: sourceName })}</p>
        </div>
      ) : (
        <p className="c c2">{t('pointDetails.contactsHelp')}</p>
      )}
      <div className="fld">
        <ChannelLabel channel="phone" htmlFor="point-phone" label={t('pointDetails.phone')} badge={badge(saved?.phone, value.phone)} />
        <input id="point-phone" className="inp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 7XX XXX XX XX" value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} disabled={disabled} />
      </div>
      <div className="fld">
        <ChannelLabel channel="whatsapp" htmlFor="point-whatsapp" label="WhatsApp" badge={badge(saved?.whatsapp, value.whatsapp)} />
        <input id="point-whatsapp" className="inp" type="tel" inputMode="tel" placeholder="+7 7XX XXX XX XX" value={value.whatsapp} onChange={(event) => onChange({ ...value, whatsapp: event.target.value })} disabled={disabled} />
      </div>
      <p className="c">{t('pointDetails.withoutContacts')}</p>
    </>
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
    <fieldset aria-describedby="hours-help" style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <legend className="h3" style={{ padding: 0, marginBottom: 4 }}>{t('hours.label')}</legend>
      {needsReview ? (
        <div id="hours-help" className="banner warn" style={{ padding: '10px 12px', borderRadius: 12, flexDirection: 'row', gap: 8 }}>
          <Ic name="clock" className="sm" style={{ color: 'var(--warning)' }} /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('pointDetails.hoursReview')}</p>
        </div>
      ) : (
        <p id="hours-help" className="c c2">{t('hoursEditor.help')}</p>
      )}
      <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} onClick={copyMondayToWeekdays} disabled={disabled}><Ic name="copy" className="sm" />{t('hoursEditor.sameWeekdays')}</button>
      <div className="card" style={{ gap: 0, padding: '0 12px' }}>
        {WEEKDAYS.map((day) => {
          const schedule = value.days[day];
          return (
            <div key={day} className="li" role="group" aria-label={t(dayKey(day))} style={{ flexWrap: 'wrap', alignItems: 'flex-start', padding: '10px 0' }}>
              <span className="ts" style={{ width: 32, lineHeight: '44px' }}>{t(dayKey(day))}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select className="inp" style={{ height: 44 }} aria-label={t('hoursEditor.kindFor', { day: t(dayKey(day)) })} value={kindOf(schedule)} onChange={(event) => setKind(day, event.target.value as DaySchedule['kind'])} disabled={disabled}>
                  <option value="intervals">{t('hoursEditor.open')}</option>
                  <option value="24h">{t('hours.aroundTheClock')}</option>
                  <option value="closed">{t('hoursEditor.closed')}</option>
                </select>
                {schedule.kind === 'intervals' && schedule.intervals.map((interval, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" className="inp num" style={{ height: 44, flex: 1, minWidth: 0 }} aria-label={t('hoursEditor.from', { day: t(dayKey(day)), n: index + 1 })} value={interval.open} disabled={disabled}
                      onChange={(event) => setDay(day, { kind: 'intervals', intervals: schedule.intervals.map((item, i) => (i === index ? { ...item, open: event.target.value } : item)) })} />
                    <span className="c2" aria-hidden="true">–</span>
                    <input type="time" className="inp num" style={{ height: 44, flex: 1, minWidth: 0 }} aria-label={t('hoursEditor.to', { day: t(dayKey(day)), n: index + 1 })} value={interval.close} disabled={disabled}
                      onChange={(event) => setDay(day, { kind: 'intervals', intervals: schedule.intervals.map((item, i) => (i === index ? { ...item, close: event.target.value } : item)) })} />
                    {schedule.intervals.length > 1 && (
                      <button type="button" className="ib" style={{ width: 36, height: 36 }} disabled={disabled} aria-label={t('hoursEditor.removeInterval', { day: t(dayKey(day)), n: index + 1 })}
                        onClick={() => setDay(day, { kind: 'intervals', intervals: schedule.intervals.filter((_, i) => i !== index) })}><Ic name="close" className="c2" /></button>
                    )}
                  </div>
                ))}
                {schedule.kind === 'intervals' && schedule.intervals.length < MAX_INTERVALS_PER_DAY && (
                  <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} disabled={disabled}
                    onClick={() => setDay(day, { kind: 'intervals', intervals: [...schedule.intervals, { open: '14:00', close: '18:00' }] })}>
                    {t('hoursEditor.addBreak')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="vh" aria-live="polite">{announce}</p>
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

  const channelIcon = label === 'WhatsApp'
    // eslint-disable-next-line @next/next/no-img-element -- mockup brand mark
    ? <img src={WHATSAPP_ICON} alt="" style={{ width: 24, height: 24 }} />
    : <Ic name="phone" className="c2" />;
  return (
    <div className="card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {channelIcon}
        <div style={{ flex: 1 }}>
          <div className="ts">{label}: {contact.e164}</div>
          <p className="c">{contact.verified ? t('pointDetails.visible') : t('pointDetails.notVerified')}</p>
        </div>
        {contact.verified
          ? <span className="bd bd-ok"><Ic name="check" />{t('pointDetails.verified')}</span>
          : <span className="bd bd-info"><Ic name="clock" />{t('pointDetails.waiting')}</span>}
      </div>
      {!contact.verified && (step === 'idle' || step === 'sending') && (
        <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} onClick={() => void request()} disabled={step === 'sending'} aria-busy={step === 'sending'}>
          {step === 'sending' && <span className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} />}{t('pointDetails.verify')}
        </button>
      )}
      {!contact.verified && (step === 'code' || step === 'checking') && (
        // Not a <form>: this block sits inside the point form, and Enter must confirm the code, not save the point.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="t c2">{t('pointDetails.codeSent', { phone: contact.e164 })}</p>
          {challenge?.testCode && <p className="c">{t('auth.testCode', { code: challenge.testCode })}</p>}
          <div className="fld">
            <label htmlFor={`code-${contact.e164}`}>{t('auth.otp')}</label>
            <input id={`code-${contact.e164}`} className={`inp num otp${error ? ' er' : ''}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} disabled={step === 'checking'} aria-invalid={error ? true : undefined}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (code.trim().length === 6) void confirm(); } }} />
            {error && <ErrorLine>{error}</ErrorLine>}
          </div>
          <button type="button" className="btn btn-p lg w" onClick={() => void confirm()} disabled={step === 'checking' || code.trim().length !== 6} aria-busy={step === 'checking'}>
            {step === 'checking' && <span className="spin" />}{t('pointDetails.confirmCode')}
          </button>
          <button type="button" className="btn btn-g w" onClick={() => void request()} disabled={step === 'checking'}>{t('pointDetails.resend')}</button>
        </div>
      )}
      {error && step === 'idle' && <div className="fld"><ErrorLine>{error}</ErrorLine></div>}
    </div>
  );
}
