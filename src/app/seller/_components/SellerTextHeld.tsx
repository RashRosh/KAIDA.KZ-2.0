'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { DuplicateCandidate, DuplicateDifference } from '../../../modules/seller-input/contracts/duplicates.contract';
import type { HeldLineView } from '../../../modules/seller-text-input/contracts/seller-text-input.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { formatAmount } from '../../_components/format-amount';
import { Ic, Radio, Thumb } from '../_kaida/ui';

const UNIT: Record<string, string> = { kg: 'кг', liter: 'л', piece: 'шт.', package: 'упак.' };
const HEADLINE: Record<HeldLineView['outcome'], MessageKey> = {
  same: 'duplicates.same',
  sameNoPrice: 'duplicates.sameNoPrice',
  differs: 'duplicates.differs',
  several: 'duplicates.several',
  off: 'duplicates.off',
  gone: 'duplicates.gone',
};

const amountOf = (value: string) => Number(value.replace(',', '.'));

// text-duplicates §4.1, §4.5 and text-price-update §3: the «Уже есть в точке» section. Candidates are only possible
// matches; a draft or a price change happens only by the Seller's explicit action, one card per line.
export function SellerTextHeld({ inputId, held, pendingChangeSetIds, stickyAction, onChanged, onRefresh }: {
  inputId: string;
  held: HeldLineView[];
  pendingChangeSetIds: string[];
  stickyAction: boolean;
  onChanged: () => void;
  onRefresh: () => void;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  // text-price-update §3.2–§3.3: one chosen card per line (pre-selected only by the server's strict rule) and the
  // price chosen from a conflict.
  const [chosen, setChosen] = useState<Map<number, string>>(() => new Map(held.flatMap((line) =>
    (line.pricePreselect && line.priceProposal?.state !== 'pending' ? [[line.index, line.pricePreselect] as [number, string]] : []))));
  const [pickedPrice, setPickedPrice] = useState<Map<number, string>>(new Map());
  const [changed, setChanged] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<{ code: string; indexes: Set<number> } | null>(null);
  const [proposing, setProposing] = useState(false);
  const reviewUrl = `/seller/text-input/review?input=${inputId}`;
  const price = (amount: string) => `${formatAmount(amount)} ₸`;
  const confirmHref = (id: string) => `/seller/change-sets/${id}?back=${encodeURIComponent(reviewUrl)}`;

  const newPrice = (line: HeldLineView) => line.priceChoices && line.priceChoices.length > 1 ? pickedPrice.get(line.index) ?? null : line.linePrice;
  const proposals = useMemo(() => held.flatMap((line) => {
    const offerId = chosen.get(line.index);
    const value = newPrice(line);
    return offerId && value ? [{ line, offerId, price: value }] : [];
  }), [held, chosen, pickedPrice]); // eslint-disable-line react-hooks/exhaustive-deps
  // §3.4: two lines choosing one card with different prices block the action until one is unselected.
  const clashes = useMemo(() => {
    const byOffer = new Map<string, Set<number>>();
    for (const item of proposals) byOffer.set(item.offerId, (byOffer.get(item.offerId) ?? new Set()).add(amountOf(item.price)));
    return new Set(proposals.filter((item) => byOffer.get(item.offerId)!.size > 1).map((item) => item.line.index));
  }, [proposals]);

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

  async function proposePrices() {
    setProposing(true);
    setRejected(null);
    try {
      const response = await fetch(`/api/seller/text-input/${encodeURIComponent(inputId)}/held/price?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: proposals.map(({ line, offerId, price: value }) => ({
          index: line.index,
          shown: line.candidates.map((candidate) => ({ offerId: candidate.offerId, revision: candidate.revision })),
          offerId,
          price: value,
        })) }),
      });
      const data = await response.json() as { changeSetId?: string; error?: { code: string }; indexes?: number[] };
      if (response.ok && data.changeSetId) {
        router.push(confirmHref(data.changeSetId));
        return;
      }
      if (response.status === 409 && data.indexes) {
        const indexes = new Set(data.indexes);
        if (data.error?.code === 'TEXT_PRICE_CHANGED') {
          // Fresh rows, the changed lines' choices cleared, a new choice required (§3.5).
          setChanged(indexes);
          setChosen((current) => new Map([...current].filter(([index]) => !indexes.has(index))));
          setPickedPrice((current) => new Map([...current].filter(([index]) => !indexes.has(index))));
          onRefresh();
        } else {
          setRejected({ code: data.error?.code ?? '', indexes });
        }
        setProposing(false);
        return;
      }
      setRejected({ code: 'failed', indexes: new Set() });
    } catch {
      setRejected({ code: 'failed', indexes: new Set() });
    }
    setProposing(false);
  }

  const warn = (text: string, testId?: string) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--warning)' }} role="status" data-testid={testId}>
      <Ic name="alert" className="xs" /><p className="c" style={{ flex: 1, color: 'var(--warning)' }}>{text}</p>
    </div>
  );

  const candidateRow = (line: HeldLineView, candidate: DuplicateCandidate) => {
    const name = candidate.packLabel ? `${candidate.title} · ${candidate.packLabel}` : candidate.title;
    const proposal = line.priceProposal?.offerId === candidate.offerId ? line.priceProposal : null;
    const pending = proposal?.state === 'pending';
    const value = newPrice(line);
    const offerable = candidate.priceEligible && !pending && line.priceProposal?.state !== 'pending'
      && value !== null && candidate.price !== null && amountOf(candidate.price.amount) !== amountOf(value);
    const selected = chosen.get(line.index) === candidate.offerId;
    const unit = candidate.price?.unit ? ` / ${candidate.price.unit}` : '';
    const priceDiffers = candidate.differences.some((item) => item.kind === 'price' || item.kind === 'priceConflict');
    const select = () => setChosen((current) => new Map(current).set(line.index, candidate.offerId));
    return (
      <div key={candidate.offerId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid={`held-candidate-${candidate.offerId}`}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 56 }}>
          {offerable
            ? (
              <button type="button" role="radio" aria-checked={selected} aria-label={name} onClick={select}
                style={{ appearance: 'none', background: 'none', border: 0, padding: 10, margin: -10, cursor: 'pointer', flex: 'none', display: 'inline-flex' }} data-testid="price-choice">
                <Radio on={selected} />
              </button>
            )
            : <span style={{ width: 24, flex: 'none' }} />}
          <Thumb photoUrl={null} size={48} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="ts">{name}</div>
            {candidate.price && (offerable || pending) && value
              ? <p className="c num" style={{ color: 'var(--ink)' }} data-testid="price-change">{price(candidate.price.amount)} → <b>{price(pending ? proposal!.price : value)}</b>{unit}</p>
              : candidate.price && <p className="c c2 num">{price(candidate.price.amount)}{unit}</p>}
            {pending
              ? <span className="bd bd-warn"><Ic name="clock" />{t('price.pending')}</span>
              : candidate.status === 'live'
                ? <span className="bd bd-ok"><Ic name="check" />{t('showcase.statusLive')}</span>
                : <span className="bd bd-n"><Ic name="power" />{t('showcase.statusOff')}</span>}
          </div>
          <Link className="btn btn-g sm" style={{ padding: '0 4px' }} href={`/seller?card=${candidate.cardId}`}>{t('duplicates.open')}</Link>
        </div>
        {candidate.differences.length > 0 && !(offerable && candidate.differences.every((item) => item.kind === 'price')) && (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="held-differences">
            {candidate.differences.map((item, k) => <li key={k} className="c" style={{ color: 'var(--ink)' }}>{difference(item)}</li>)}
          </ul>
        )}
        {!candidate.priceEligible && priceDiffers && candidate.status === 'live' && line.candidates.length === 1 && (
          <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href={`/seller?edit=${candidate.cardId}&back=${encodeURIComponent(reviewUrl)}`}>{t('duplicates.editPrice')}</Link>
        )}
      </div>
    );
  };

  const anyOfferable = held.some((line) => line.priceProposal?.state !== 'pending' && line.candidates.some((candidate) => candidate.priceEligible
    && ((line.priceChoices?.length ?? 0) > 1 || (line.linePrice !== null && candidate.price !== null && amountOf(candidate.price.amount) !== amountOf(line.linePrice)))));
  const action = anyOfferable && (
    <div className={stickyAction ? 'foot' : 'card p16'} style={stickyAction ? { position: 'sticky', bottom: -16, margin: '0 -16px -16px', zIndex: 1 } : { gap: 8 }} data-testid="price-action">
      <p className="c c2">{t('price.rule')}</p>
      {rejected?.code === 'failed' && <p className="c" role="alert" style={{ color: 'var(--danger)' }}>{t('price.error')}</p>}
      <button type="button" className={`btn btn-p lg w${proposals.length === 0 || clashes.size > 0 ? ' dis' : ''}`}
        disabled={proposals.length === 0 || clashes.size > 0 || proposing} aria-busy={proposing || undefined}
        onClick={() => void proposePrices()} data-testid="price-submit">
        {proposing && <span className="spin" />}{t('price.submit', { count: proposals.length })}
      </button>
    </div>
  );

  return (
    <>
      {pendingChangeSetIds.length > 0 && (
        <div className="banner warn" role="status" style={{ padding: '12px 14px', borderRadius: 14, gap: 8 }} data-testid="price-pending">
          <p className="c" style={{ color: 'var(--ink)' }}><b>{t('price.pendingBanner')}</b></p>
          <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href={confirmHref(pendingChangeSetIds[0]!)}>{t('availability.openConfirm')}</Link>
        </div>
      )}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="held-block">
        <div className="ov">{t('duplicates.title', { count: held.length })}</div>
        {held.map((line) => {
          const conflict = Boolean(line.priceChoices && line.priceChoices.length > 1);
          // A line offers a new price only when some eligible card would actually change (or a conflict is to be chosen).
          const offerable = line.priceProposal?.state !== 'pending' && line.candidates.some((candidate) => candidate.priceEligible
            && (conflict || (line.linePrice !== null && candidate.price !== null && amountOf(candidate.price.amount) !== amountOf(line.linePrice))));
          return (
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
              {changed.has(line.index) && warn(t('price.changed'), 'price-changed')}
              {rejected?.code === 'TEXT_PRICE_SAME_CARD_CONFLICT' && rejected.indexes.has(line.index) && warn(t('price.sameCard'))}
              {clashes.has(line.index) && warn(t('price.sameCard'), 'price-same-card')}
              {line.priceProposal?.state === 'applied' && <p className="c" role="status" style={{ color: 'var(--success)' }} data-testid="price-applied">{t('price.applied', { price: price(line.priceProposal.price) })}</p>}
              <p className="c" style={{ color: 'var(--ink)' }} data-testid="held-headline">
                <b>{offerable ? t(line.candidates.length > 1 ? 'price.chooseCard' : 'price.newPrice') : t(HEADLINE[line.outcome])}</b>
              </p>
              {offerable && conflict && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="price-conflict">
                  <p className="c" style={{ color: 'var(--ink)' }}>{t('duplicates.choosePrice')}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {line.priceChoices!.map((choice) => (
                      <button key={choice} type="button" className={`chip${pickedPrice.get(line.index) === choice ? ' on' : ''}`}
                        aria-pressed={pickedPrice.get(line.index) === choice}
                        onClick={() => setPickedPrice((current) => new Map(current).set(line.index, choice))}>{price(choice)}</button>
                    ))}
                  </div>
                  <p className="c c2">{t('price.choiceNotName')}</p>
                </div>
              )}
              {line.candidates.map((candidate) => candidateRow(line, candidate))}
              {failed === line.index && <p className="c" role="alert" style={{ color: 'var(--danger)' }}>{t('duplicates.error')}</p>}
              {line.draftId
                ? <Link className="btn btn-o sm" style={{ alignSelf: 'flex-start' }} href={`/seller?draft=${line.draftId}&back=${encodeURIComponent(reviewUrl)}`} data-testid="held-draft-made">{t('duplicates.draftMade')}</Link>
                : (
                  <button type="button" className="btn btn-g" style={{ alignSelf: 'flex-start', padding: 0 }} disabled={busy !== null}
                    aria-busy={busy === line.index || undefined} onClick={() => void createDraft(line.index)} data-testid="held-create-draft">
                    {busy === line.index ? t('duplicates.creating') : t('duplicates.create')}
                  </button>
                )}
            </article>
          );
        })}
      </section>
      {action}
    </>
  );
}
