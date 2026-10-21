'use client';

import { useState } from 'react';
import {
  dayScheduleSchema,
  MAX_INTERVALS_PER_DAY,
  WEEKDAYS,
  type DaySchedule,
  type OpeningHours,
  type Weekday,
} from '@/modules/locations/hours/opening-hours';
import { formatInterval, scheduleKey } from '@/modules/locations/hours/opening-hours-view';
import type { PointContactView } from '@/modules/locations/details/point-details.contract';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import { ErrorLine, Ic } from '../_kaida/ui';
import { canonicalPhone, contactChips, formatLoginPhone, formatPhone, holdsLoginNumber, type ContactsDraft } from './contact-chips';

export type { ContactsDraft };

const dayKey = (day: Weekday) => `hours.day.${day}` as MessageKey;

const WHATSAPP_ICON = '/kaida/icons/127a626f246aa48c4b8bc196e32e93a2.svg';
const TELEGRAM_ICON = '/kaida/icons/24ad95a4b3664ef668a9dad80a7f425a.svg';

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

function LoginNotice({ id, text }: { id: string; text: string }) {
  return (
    <div id={id} className="banner info" style={{ padding: '10px 12px', borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Ic name="info" className="sm" style={{ color: 'var(--info)' }} /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{text}</p>
    </div>
  );
}

function Chip({ testId, label, onClick, disabled }: { testId: string; label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" className="btn btn-o" data-testid={testId} style={{ minHeight: 44, height: 'auto', alignSelf: 'flex-start', textAlign: 'left', whiteSpace: 'normal', padding: '8px 14px' }} onClick={onClick} disabled={disabled}>{label}</button>
  );
}

// AI-S12A · Point · Contacts: both optional; a number is public only after it is confirmed (AI-S13).
export function PointContactsFields({ value, onChange, disabled, sourceName, saved, loginPhone = null, telegramSuggestion = null, telegramError = null }: {
  value: ContactsDraft;
  onChange: (value: ContactsDraft) => void;
  disabled: boolean;
  sourceName?: string | null;
  saved?: { phone?: PointContactView | null; whatsapp?: PointContactView | null };
  // The owner's login number when known (contact-default): a new point starts with it unless it copied another number.
  loginPhone?: string | null;
  // §17: a username the Seller saved before (another point or the legacy seller contact), offered by a chip.
  telegramSuggestion?: string | null;
  telegramError?: string | null;
}) {
  const { t } = useI18n();
  const chips = contactChips(value, loginPhone, telegramSuggestion);
  const badge = (contact: PointContactView | null | undefined, draft: string) => holdsLoginNumber(draft, loginPhone)
    ? <span className="bd bd-ok"><Ic name="check" />{t('pointDetails.verified')}</span>
    : contact && contact.e164 === canonicalPhone(draft)
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
        <input id="point-phone" className="inp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 7XX XXX XX XX" value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} disabled={disabled} aria-describedby={chips.phoneNotice ? 'point-phone-notice' : undefined} />
        {chips.phoneNotice && <LoginNotice id="point-phone-notice" text={t('pointDetails.loginNoticePhone')} />}
        {chips.loginNumber && loginPhone && <Chip testId="chip-login-number" label={t('pointDetails.useLoginNumber', { phone: formatLoginPhone(loginPhone) })} onClick={() => onChange({ ...value, phone: formatPhone(loginPhone) })} disabled={disabled} />}
      </div>
      <div className="fld">
        <ChannelLabel channel="whatsapp" htmlFor="point-whatsapp" label="WhatsApp" badge={badge(saved?.whatsapp, value.whatsapp)} />
        <input id="point-whatsapp" className="inp" type="tel" inputMode="tel" placeholder="+7 7XX XXX XX XX" value={value.whatsapp} onChange={(event) => onChange({ ...value, whatsapp: event.target.value })} disabled={disabled} aria-describedby={chips.whatsappNotice ? 'point-whatsapp-notice' : undefined} />
        {chips.whatsappNotice && <LoginNotice id="point-whatsapp-notice" text={t('pointDetails.loginNoticeWhatsapp')} />}
        {chips.samePhone && <Chip testId="chip-same-phone" label={t('pointDetails.sameAsPhone')} onClick={() => onChange({ ...value, whatsapp: value.phone.trim() })} disabled={disabled} />}
      </div>
      <div className="fld">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- mockup brand mark */}
          <img src={TELEGRAM_ICON} alt="" style={{ width: 20, height: 20 }} />
          <label htmlFor="point-telegram">Telegram</label>
        </div>
        <input id="point-telegram" className={`inp${telegramError ? ' er' : ''}`} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="@username"
          value={value.telegram} onChange={(event) => onChange({ ...value, telegram: event.target.value })} disabled={disabled}
          aria-invalid={telegramError ? true : undefined} aria-describedby={telegramError ? 'point-telegram-help point-telegram-error' : 'point-telegram-help'} />
        <span className="hint" id="point-telegram-help">{t('pointDetails.telegramHelp')}</span>
        {telegramError && <ErrorLine id="point-telegram-error">{telegramError}</ErrorLine>}
        {chips.telegram && telegramSuggestion && <Chip testId="chip-telegram" label={t('pointDetails.useTelegram', { username: telegramSuggestion })} onClick={() => onChange({ ...value, telegram: `@${telegramSuggestion}` })} disabled={disabled} />}
      </div>
      <p className="c">{t('pointDetails.withoutContacts')}</p>
    </>
  );
}

type EditorKind = 'intervals' | '24h' | 'closed' | 'unset';
type GroupEdit = { days: Weekday[]; original: Weekday[]; kind: EditorKind; intervals: { open: string; close: string }[] };

const WEEKDAYS_ONLY: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

// Days that share one identical schedule, in week order; a group need not be consecutive (Пн, Ср, Пт).
function scheduleGroups(hours: OpeningHours): { days: Weekday[]; schedule: DaySchedule }[] {
  const groups: { days: Weekday[]; schedule: DaySchedule }[] = [];
  for (const day of WEEKDAYS) {
    const key = scheduleKey(hours.days[day]);
    const group = groups.find((item) => scheduleKey(item.schedule) === key);
    if (group) group.days.push(day);
    else groups.push({ days: [day], schedule: hours.days[day] });
  }
  return groups;
}

// «ПН–ПТ», «ПН, СР, ПТ», «СБ»: consecutive runs as a range, the rest one by one.
function daysLabel(days: Weekday[], dayName: (day: Weekday) => string): string {
  const indexes = days.map((day) => WEEKDAYS.indexOf(day)).sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const index of indexes) {
    const last = runs.at(-1);
    if (last && index === last[last.length - 1]! + 1) last.push(index);
    else runs.push([index]);
  }
  return runs.map((run) => (run.length >= 3
    ? `${dayName(WEEKDAYS[run[0]!]!)}–${dayName(WEEKDAYS[run.at(-1)!]!)}`
    : run.map((index) => dayName(WEEKDAYS[index]!)).join(', '))).join(', ');
}

function scheduleText(schedule: DaySchedule, t: ReturnType<typeof useI18n>['t']): string {
  if (schedule.kind === 'closed') return t('hoursEditor.closed');
  if (schedule.kind === '24h') return t('hours.aroundTheClock');
  if (schedule.kind === 'unset') return t('hours.notSpecified');
  return schedule.intervals.map(formatInterval).join(', ');
}

function editedSchedule(edit: GroupEdit): DaySchedule | null {
  const candidate: DaySchedule = edit.kind === 'intervals' ? { kind: 'intervals', intervals: edit.intervals } : { kind: edit.kind } as DaySchedule;
  return dayScheduleSchema.safeParse(candidate).success ? candidate : null;
}

// Opening hours (point-contacts-hours §2, compact editor of seller-ai-text-real-parser §18): the week as a few grouped
// lines; a group opens one editor where the Seller picks days and enters shared hours once. Applying changes only the
// chosen days and says beforehand which other days it takes over; «Отмена» leaves the form as it was. Every supported
// schedule (24 h, overnight, up to three intervals, «выходной», «не указано») loads and saves unchanged.
export function OpeningHoursFields({ value, onChange, disabled, needsReview }: {
  value: OpeningHours;
  onChange: (value: OpeningHours) => void;
  disabled: boolean;
  needsReview: boolean;
}) {
  const { t } = useI18n();
  const dayName = (day: Weekday) => t(dayKey(day));
  const [edit, setEdit] = useState<GroupEdit | null>(null);
  const [announce, setAnnounce] = useState('');
  const groups = scheduleGroups(value);

  function open(days: Weekday[], schedule: DaySchedule | null) {
    setEdit({
      days: [...days],
      original: [...days],
      kind: schedule ? schedule.kind : 'intervals',
      intervals: schedule?.kind === 'intervals' ? schedule.intervals.map((interval) => ({ ...interval })) : [{ open: '', close: '' }],
    });
    setAnnounce('');
  }

  function toggleDay(day: Weekday) {
    if (!edit) return;
    setEdit({ ...edit, days: edit.days.includes(day) ? edit.days.filter((item) => item !== day) : [...edit.days, day] });
  }

  function apply() {
    if (!edit) return;
    const schedule = editedSchedule(edit);
    if (!schedule || edit.days.length === 0) return;
    const days = { ...value.days };
    for (const day of edit.days) days[day] = schedule;
    onChange({ ...value, days });
    setAnnounce(t('hoursEditor.applied', { days: daysLabel(edit.days, dayName) }));
    setEdit(null);
  }

  const candidate = edit ? editedSchedule(edit) : null;
  // Days the Seller is about to take over from another group, and days left out of the group being edited.
  const takenOver = edit ? edit.days.filter((day) => !edit.original.includes(day) && (!candidate || scheduleKey(value.days[day]) !== scheduleKey(candidate))) : [];
  const leftOut = edit ? edit.original.filter((day) => !edit.days.includes(day)) : [];
  const timesMissing = edit?.kind === 'intervals' && edit.intervals.some((interval) => !interval.open || !interval.close);

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
      <ul className="card" style={{ gap: 0, padding: '0 12px', listStyle: 'none', margin: 0 }} aria-label={t('hoursEditor.summary')} data-testid="hours-summary">
        {groups.map((group) => (
          <li key={group.days.join(',')} className="li" style={{ padding: '8px 0', gap: 8 }}>
            <span className="ts" style={{ minWidth: 72 }}>{daysLabel(group.days, dayName)}</span>
            <span className="t" style={{ flex: 1, minWidth: 0, color: group.schedule.kind === 'unset' ? 'var(--ink3)' : undefined }}>{scheduleText(group.schedule, t)}</span>
            <button type="button" className="btn btn-g sm" disabled={disabled || edit !== null} onClick={() => open(group.days, group.schedule)}
              aria-label={t('hoursEditor.editGroup', { days: daysLabel(group.days, dayName) })}>{t('hoursEditor.change')}</button>
          </li>
        ))}
      </ul>
      {edit === null ? (
        <button type="button" className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} onClick={() => open([], null)} disabled={disabled} data-testid="hours-other-days">
          <Ic name="plus" className="sm" />{t('hoursEditor.setDays')}
        </button>
      ) : (
        <div className="card p16" role="group" aria-label={t('hoursEditor.editorLabel')} style={{ gap: 12 }} data-testid="hours-editor">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-o sm" onClick={() => setEdit({ ...edit, days: [...WEEKDAYS] })} disabled={disabled}>{t('hoursEditor.everyDay')}</button>
            <button type="button" className="btn btn-o sm" onClick={() => setEdit({ ...edit, days: [...WEEKDAYS_ONLY] })} disabled={disabled}>{t('hoursEditor.weekdays')}</button>
            <button type="button" className="btn btn-o sm" onClick={() => setEdit({ ...edit, days: [] })} disabled={disabled}>{t('hoursEditor.chooseDays')}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label={t('hoursEditor.days')}>
            {WEEKDAYS.map((day) => (
              <button key={day} type="button" className={`chip${edit.days.includes(day) ? ' on' : ''}`} aria-pressed={edit.days.includes(day)}
                onClick={() => toggleDay(day)} disabled={disabled} style={{ minWidth: 44, minHeight: 44 }}>{dayName(day)}</button>
            ))}
          </div>
          <div className="fld">
            <label htmlFor="hours-kind">{t('hoursEditor.kind')}</label>
            <select id="hours-kind" className="inp" style={{ height: 44 }} value={edit.kind} disabled={disabled}
              onChange={(event) => setEdit({ ...edit, kind: event.target.value as EditorKind, intervals: edit.intervals.length > 0 ? edit.intervals : [{ open: '', close: '' }] })}>
              <option value="intervals">{t('hoursEditor.open')}</option>
              <option value="24h">{t('hours.aroundTheClock')}</option>
              <option value="closed">{t('hoursEditor.closed')}</option>
              <option value="unset">{t('hours.notSpecified')}</option>
            </select>
          </div>
          {edit.kind === 'intervals' && edit.intervals.map((interval, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="time" className="inp num" style={{ height: 44, flex: 1, minWidth: 0 }} aria-label={t('hoursEditor.fromN', { n: index + 1 })} value={interval.open} disabled={disabled}
                onChange={(event) => setEdit({ ...edit, intervals: edit.intervals.map((item, i) => (i === index ? { ...item, open: event.target.value } : item)) })} />
              <span className="c2" aria-hidden="true">–</span>
              <input type="time" className="inp num" style={{ height: 44, flex: 1, minWidth: 0 }} aria-label={t('hoursEditor.toN', { n: index + 1 })} value={interval.close} disabled={disabled}
                onChange={(event) => setEdit({ ...edit, intervals: edit.intervals.map((item, i) => (i === index ? { ...item, close: event.target.value } : item)) })} />
              {edit.intervals.length > 1 && (
                <button type="button" className="ib" style={{ width: 44, height: 44 }} disabled={disabled} aria-label={t('hoursEditor.removeIntervalN', { n: index + 1 })}
                  onClick={() => setEdit({ ...edit, intervals: edit.intervals.filter((_, i) => i !== index) })}><Ic name="close" className="c2" /></button>
              )}
            </div>
          ))}
          {edit.kind === 'intervals' && edit.intervals.length < MAX_INTERVALS_PER_DAY && (
            <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} disabled={disabled}
              onClick={() => setEdit({ ...edit, intervals: [...edit.intervals, { open: '', close: '' }] })}>{t('hoursEditor.addBreak')}</button>
          )}
          <div role="status" className="c" style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="hours-edit-summary">
            {edit.days.length === 0
              ? <span>{t('hoursEditor.pickDays')}</span>
              : candidate
                ? <span><b>{daysLabel(edit.days, dayName)}</b>: {scheduleText(candidate, t)}</span>
                : <span>{t(timesMissing ? 'hoursEditor.enterTimes' : 'hoursEditor.invalidTimes')}</span>}
            {takenOver.length > 0 && <span data-testid="hours-taken-over">{t('hoursEditor.replaces', { days: takenOver.map((day) => `${dayName(day)} (${scheduleText(value.days[day], t)})`).join(', ') })}</span>}
            {leftOut.length > 0 && <span data-testid="hours-left-out">{t('hoursEditor.keeps', { days: daysLabel(leftOut, dayName) })}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-p sm" onClick={apply} disabled={disabled || edit.days.length === 0 || !candidate}>{t('hoursEditor.apply')}</button>
            <button type="button" className="btn btn-g sm" onClick={() => setEdit(null)} disabled={disabled}>{t('offerManage.cancel')}</button>
          </div>
        </div>
      )}
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
          <div className="ts">{label}: {formatPhone(contact.e164)}</div>
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
