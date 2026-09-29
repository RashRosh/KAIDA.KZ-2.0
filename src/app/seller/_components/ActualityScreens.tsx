'use client';

import { useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { actualityText } from '../../_components/actuality-text';
import { formatAmount } from '../../_components/format-amount';
import { Bar, Ic, Phone, Thumb } from '../_kaida/ui';
import { pluralKey, type SellerCard } from './card-model';
import { PushToggle } from './PushToggle';

// offer-actuality (S01 task block, S15 plaque, S16 «Актуальность», S17 «Архив»): the Seller confirms that cards are
// still true; one request confirms one or many cards and applies at once (no review page).

export function useReconfirm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function confirm(cardIds: string[]): Promise<boolean> {
    if (busy || cardIds.length === 0) return false;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/seller/actuality/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds }),
      });
      if (!response.ok) throw new Error('reconfirm');
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { confirm, busy, error };
}

// The buyer's badge on the card photo (S15: «the same plaque the buyer sees»); none once hidden from buyers.
export function FreshPlaque({ card }: { card: SellerCard }) {
  const { t } = useI18n();
  const actuality = card.actuality;
  if (!actuality || actuality.days > 6 || actuality.stage === 'hidden' || actuality.stage === 'archived') return null;
  return <span className={`fresh fr${actuality.days}`}>{actualityText(actuality.days, t)}</span>;
}

export function daysLabel(days: number, t: ReturnType<typeof useI18n>['t']) {
  return t(pluralKey('actuality.days', days), { count: days });
}

// S01: the task, not a status — shown while some card has waited a day or more.
export function ActualityTask({ due, onCheck }: { due: SellerCard[]; onCheck: () => void }) {
  const { t } = useI18n();
  if (due.length === 0) return null;
  const hidden = due.filter((card) => card.actuality?.stage === 'hidden').length;
  return (
    <div className="banner warn" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14 }} data-testid="actuality-task">
      <Ic name="clock" style={{ color: 'var(--warning)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="ts">{t('actuality.taskTitle')}</div>
        <p className="c c2">
          {t(pluralKey('actuality.taskCount', due.length), { count: due.length })}
          {hidden > 0 ? ` · ${t(pluralKey('actuality.taskHidden', hidden), { count: hidden })}` : ''}
        </p>
        <PushToggle variant="task" />
      </div>
      <button type="button" className="btn btn-o sm" onClick={onCheck}>{t('actuality.check')}</button>
    </div>
  );
}

function priceText(card: SellerCard) {
  const lead = card.lead;
  const amount = card.commonPrice ?? card.lowestPrice;
  if (!amount) return '';
  return `${formatAmount(amount)} ₸${lead.price?.unit ? ` / ${lead.price.unit}` : ''}`;
}

// S16 · Actuality · Default: every due card with its age; «Всё актуально» confirms them all.
export function ActualityScreen({ due, onClose, onDone, go }: {
  due: SellerCard[];
  onClose: () => void;
  onDone: () => void;
  go: (query: string) => void;
}) {
  const { t } = useI18n();
  const { confirm, busy, error } = useReconfirm();
  const steps: [string, string, string, string][] = [
    ['0', 'var(--success-soft)', 'var(--success)', 'actuality.how0'],
    ['2', 'var(--warning-soft)', 'var(--warning)', 'actuality.how2'],
    ['7', 'var(--danger-soft)', 'var(--danger)', 'actuality.how7'],
    ['14', 'var(--sunken)', 'var(--ink2)', 'actuality.how14'],
  ];
  return (
    <Phone>
      <Bar title={t('actuality.listTitle', { count: due.length })} onBack={onClose} />
      <main className="body" style={{ gap: 0, paddingTop: 8 }}>
        {due.length === 0 ? <p className="t c2">{t('actuality.empty')}</p> : <p className="c" style={{ paddingBottom: 8 }}>{t('actuality.listHint')}</p>}
        {due.map((card) => {
          const actuality = card.actuality!;
          const hidden = actuality.stage === 'hidden';
          const age = hidden ? t('actuality.hiddenShort', { days: daysLabel(actuality.days, t) }) : actualityText(actuality.days, t);
          const name = `${card.lead.product.name}${card.lead.packLabel ? ` · ${card.lead.packLabel}` : ''}`;
          return (
            <div key={card.cardId} className="li" data-testid={`actuality-row-${card.cardId}`}>
              <Thumb photoUrl={card.lead.photos?.[0] ? photoUrl(card.lead.photos[0].id, 'thumb') : null} size={44} radius={8} />
              <div className="mid">
                <div className="ts">{name}</div>
                <p className="c num" style={hidden ? { color: 'var(--warning)' } : undefined}>{priceText(card)} · {age}</p>
              </div>
              <button type="button" className="ib" aria-label={t('actuality.editItem', { name })} onClick={() => go(`edit=${card.cardId}`)}>
                <Ic name="pencil" className="sm" />
              </button>
            </div>
          );
        })}
        <div className="card p16" style={{ gap: 10, marginTop: 16 }}>
          <h2 className="ov">{t('actuality.how')}</h2>
          {steps.map(([n, background, color, key]) => (
            <div key={n} className="step">
              {/* The 24 px circle is centred on the first 18 px text line, not on its top edge. */}
              <span className="n" style={{ background, color, marginTop: -3 }}>{n}</span>
              <p className="c c2"><b style={{ color: 'var(--ink)' }}>{t(key as 'actuality.how0')}</b> {t(`${key}Text` as 'actuality.how0Text')}</p>
            </div>
          ))}
        </div>
        {error && (
          <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12, marginTop: 12 }}>
            <p className="c" style={{ color: 'var(--ink)' }}>{t('actuality.confirmError')}</p>
          </div>
        )}
      </main>
      {due.length > 0 && (
        <div className="foot">
          <button type="button" className="btn btn-p lg w" disabled={busy} onClick={async () => {
            if (await confirm(due.map((card) => card.cardId))) onDone();
          }}>
            <Ic name="check" className="sm" />{t('actuality.allGood')}
          </button>
        </div>
      )}
    </Phone>
  );
}

// S17 · Archive · List: cards unconfirmed for 14 days; opening one leads to its card screen, where «Подтвердить
// актуальность» returns it unchanged and «Изменить» opens the editor. Nothing is deleted automatically.
export function ArchiveScreen({ cards, onClose, go }: { cards: SellerCard[]; onClose: () => void; go: (query: string) => void }) {
  const { locale, t } = useI18n();
  const format = new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { day: 'numeric', month: 'long' });
  return (
    <Phone>
      <Bar title={t('archive.title', { count: cards.length })} onBack={onClose} />
      <main className="body" style={{ gap: 10 }}>
        <p className="c">{cards.length === 0 ? t('archive.empty') : t('archive.hint')}</p>
        {cards.map((card) => (
          <button key={card.cardId} type="button" className="card" onClick={() => go(`card=${card.cardId}`)}
            style={{ flexDirection: 'row', gap: 12 }} data-testid={`archive-row-${card.cardId}`}>
            <div style={{ opacity: 0.7 }}><Thumb photoUrl={card.lead.photos?.[0] ? photoUrl(card.lead.photos[0].id, 'thumb') : null} /></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="ts">{card.lead.product.name}{card.lead.packLabel ? ` · ${card.lead.packLabel}` : ''}</div>
              <p className="c">{t('archive.since', { date: format.format(new Date(card.actuality!.lastConfirmedAt)) })}</p>
            </div>
            <Ic name="right" className="c2" />
          </button>
        ))}
      </main>
    </Phone>
  );
}
