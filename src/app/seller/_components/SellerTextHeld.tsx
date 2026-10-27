'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DuplicateCandidate, DuplicateDifference } from '../../../modules/seller-input/contracts/duplicates.contract';
import type { HeldLineView } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { formatAmount } from '../../_components/format-amount';
import { Ic, Thumb } from '../_kaida/ui';

const UNIT: Record<string, string> = { kg: 'кг', liter: 'л', piece: 'шт.', package: 'упак.' };
const HEADLINE: Record<HeldLineView['outcome'], MessageKey> = {
  same: 'duplicates.same',
  sameNoPrice: 'duplicates.sameNoPrice',
  differs: 'duplicates.differs',
  several: 'duplicates.several',
  off: 'duplicates.off',
  gone: 'duplicates.gone',
};

// text-duplicates §4.1, §4.5: the «Уже есть в точке» section. Candidates are only possible matches: the row shows their
// differences, never «the same product»; a draft is made only by the Seller's explicit action.
export function SellerTextHeld({ inputId, held, onChanged }: {
  inputId: string;
  held: HeldLineView[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const reviewUrl = encodeURIComponent(`/seller/text-input/review?input=${inputId}`);
  const price = (amount: string) => `${formatAmount(amount)} ₸`;

  function difference(item: DuplicateDifference): string {
    switch (item.kind) {
      case 'price': return t('duplicates.diffPrice', { card: price(item.card), text: price(item.text) });
      case 'priceNotStated': return t('duplicates.diffPriceNotStated');
      case 'priceUncertain': return t('duplicates.diffPriceUncertain');
      case 'priceConflict': return t('duplicates.diffPriceConflict', { prices: item.prices.map(price).join(' и ') });
      case 'nameLonger': return t('duplicates.diffNameLonger', { title: item.cardTitle });
      case 'nameShorter': return t('duplicates.diffNameShorter', { title: item.cardTitle });
      case 'nameDiffers': return t('duplicates.diffNameDiffers', { title: item.cardTitle });
      case 'nameUncertain': return t('duplicates.diffNameUncertain');
      case 'packNotInText': return t('duplicates.diffPackNotInText');
      case 'packNotInCard': return t('duplicates.diffPackNotInCard');
      case 'packUncertain': return t('duplicates.diffPackUncertain');
      case 'unitDiffers': return t('duplicates.diffUnit', { card: item.card ?? '—', text: UNIT[item.text] ?? item.text });
      case 'unitNotInText': return t('duplicates.diffUnitNotInText');
      case 'unitUncertain': return t('duplicates.diffUnitUncertain');
    }
  }

  async function createDraft(index: number) {
    setBusy(index);
    setFailed(null);
    try {
      const response = await fetch(`/api/seller/text-input/${encodeURIComponent(inputId)}/held/${index}/draft`, { method: 'POST' });
      if (!response.ok) throw new Error('held');
      onChanged();
    } catch {
      setFailed(index);
    }
    setBusy(null);
  }

  const candidateRow = (candidate: DuplicateCandidate, single: boolean) => {
    const name = candidate.packLabel ? `${candidate.title} · ${candidate.packLabel}` : candidate.title;
    const priceDiffers = candidate.differences.some((item) => item.kind === 'price' || item.kind === 'priceConflict');
    return (
      <div key={candidate.offerId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid={`held-candidate-${candidate.offerId}`}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 56 }}>
          <Thumb photoUrl={null} size={48} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="ts">{name}</div>
            {candidate.price && <p className="c c2 num">{price(candidate.price.amount)}{candidate.price.unit ? ` / ${candidate.price.unit}` : ''}</p>}
            {candidate.status === 'live'
              ? <span className="bd bd-ok"><Ic name="check" />{t('showcase.statusLive')}</span>
              : <span className="bd bd-n"><Ic name="power" />{t('showcase.statusOff')}</span>}
          </div>
          <Link className="btn btn-g sm" style={{ padding: '0 4px' }} href={`/seller?card=${candidate.cardId}`}>{t('duplicates.open')}</Link>
        </div>
        {candidate.differences.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="held-differences">
            {candidate.differences.map((item, k) => <li key={k} className="c" style={{ color: 'var(--ink)' }}>{difference(item)}</li>)}
          </ul>
        )}
        {single && priceDiffers && candidate.status === 'live' && (
          <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href={`/seller?edit=${candidate.cardId}&back=${reviewUrl}`}>{t('duplicates.editPrice')}</Link>
        )}
      </div>
    );
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="held-block">
      <div className="ov">{t('duplicates.title', { count: held.length })}</div>
      {held.map((line) => (
        <article key={line.index} className="card p16" style={{ gap: 10 }} data-testid={`held-${line.index}`}>
          <div className="ts">«{line.quote}»</div>
          {line.possiblyMerged && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--warning)' }} role="status" data-testid="held-merged">
              <Ic name="alert" className="xs" />
              <div style={{ flex: 1 }}>
                <p className="c" style={{ color: 'var(--warning)' }}>{t('duplicates.merged')}</p>
                {line.mergedFragments?.map((fragment, k) => <p key={k} className="c c2" style={{ fontStyle: 'italic' }}>«{fragment}»</p>)}
              </div>
            </div>
          )}
          <p className="c" style={{ color: 'var(--ink)' }} data-testid="held-headline"><b>{t(HEADLINE[line.outcome])}</b></p>
          {line.candidates.map((candidate) => candidateRow(candidate, line.candidates.length === 1))}
          {failed === line.index && <p className="c" role="alert" style={{ color: 'var(--danger)' }}>{t('duplicates.error')}</p>}
          {line.draftId
            ? <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href={`/seller?draft=${line.draftId}&back=${reviewUrl}`} data-testid="held-draft-made">{t('duplicates.draftMade')}</Link>
            : (
              <button type="button" className="btn btn-g" style={{ alignSelf: 'flex-start', padding: 0 }} disabled={busy !== null}
                aria-busy={busy === line.index || undefined} onClick={() => void createDraft(line.index)} data-testid="held-create-draft">
                {busy === line.index ? t('duplicates.creating') : t('duplicates.create')}
              </button>
            )}
        </article>
      ))}
    </section>
  );
}
