'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import type { SellerChangeSetView } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { formatAmount } from '../../_components/OfferCard';
import styles from '../cabinet.module.css';
import showcase from './showcase.module.css';
import { CabinetIcon } from './SellerCabinetFrame';
import { CabinetLoadError, CabinetLoginRequired, CabinetSkeleton } from './CabinetStates';
import { CardEditor, type CardEditorInitial, type CardEditorMode } from './CardEditor';
import { valuesFromChangeSet, type CardValues } from './card-editor-state';
import { findCard, groupCards, missingDraftFields, pluralKey, showcaseEntries, type SellerCard } from './card-model';

type Data =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'error' }
  | { kind: 'ready'; seller: SellerView | null; offers: SellerOfferView[]; drafts: OfferDraftView[] };

function useShowcaseData(locale: string) {
  const [data, setData] = useState<Data>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const sellerResponse = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (sellerResponse.status === 401) { setData({ kind: 'anonymous' }); return; }
        if (!sellerResponse.ok) throw new Error('seller');
        const { seller } = await sellerResponse.json() as { seller: SellerView | null };
        if (!seller) { if (alive) setData({ kind: 'ready', seller: null, offers: [], drafts: [] }); return; }
        const [offersResponse, draftsResponse] = await Promise.all([
          fetch(`/api/seller/offers?locale=${locale}`, { cache: 'no-store' }),
          fetch('/api/seller/drafts', { cache: 'no-store' }),
        ]);
        if (!offersResponse.ok || !draftsResponse.ok) throw new Error('offers');
        const { offers } = await offersResponse.json() as { offers: SellerOfferView[] };
        const { drafts } = await draftsResponse.json() as { drafts: OfferDraftView[] };
        if (alive) setData({ kind: 'ready', seller, offers, drafts });
      } catch {
        // Already shown data stays on screen; only a first load shows the error block.
        if (alive) setData((current) => current.kind === 'ready' ? current : { kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [locale, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, reload };
}

const noticeText: Record<string, MessageKey> = {
  updated: 'showcase.updated',
  enabled: 'notice.enabled',
  disabled: 'notice.disabled',
  batch: 'notice.batch',
  draftSaved: 'card.draftSaved',
};

// AI-S01 «Моя витрина» in the «ИИ выключен» mode (seller-showcase-editor §2): one primary action, cards grouped by
// product across points, drafts, the incomplete-card reminder; the editor and the card screen open over it.
export function SellerShowcase({ commentTranslationEnabled = false }: { commentTranslationEnabled?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { data, reload } = useShowcaseData(locale);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: MessageKey; offerId: string | null } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [override, setOverride] = useState<{ key: string; initial: CardEditorInitial } | null>(null);
  const tab = params.get('tab') === 'drafts' ? 'drafts' : 'all';

  // Messages from the review page (`notice=`, `offer=`) are read once, then removed from the address.
  const noticeKind = params.get('notice');
  const noticeOffer = params.get('offer');
  useEffect(() => {
    if (!noticeKind || data.kind !== 'ready') return;
    const offer = data.offers.find((item) => item.id === noticeOffer);
    const text: MessageKey = noticeKind === 'created'
      ? (offer?.buyerVisible ? 'showcase.published' : 'notice.created')
      : noticeText[noticeKind] ?? 'notice.updated';
    const timer = window.setTimeout(() => {
      setNotice({ text, offerId: noticeOffer });
      setHighlight(offer?.cardId ?? null);
    }, 0);
    const rest = new URLSearchParams(params);
    rest.delete('notice');
    rest.delete('offer');
    router.replace(rest.size > 0 ? `/seller?${rest.toString()}` : '/seller', { scroll: false });
    return () => window.clearTimeout(timer);
  }, [noticeKind, noticeOffer, data, params, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const go = useCallback((query: string) => {
    router.push(query ? `/seller?${query}` : '/seller', { scroll: false });
  }, [router]);
  const closeOverlay = useCallback(() => {
    setOverride(null);
    router.replace(tab === 'drafts' ? '/seller?tab=drafts' : '/seller', { scroll: false });
  }, [router, tab]);

  const header = (
    <div className={showcase.head}>
      <h1>{t('showcase.title')}</h1>
    </div>
  );
  const cta = (
    <button type="button" className={`${styles.primary} ${showcase.cta}`} onClick={() => setSourceOpen(true)} aria-haspopup="dialog">
      <CabinetIcon name="plus" />{t('showcase.cta')}
    </button>
  );

  if (data.kind === 'anonymous') return <CabinetLoginRequired />;
  if (data.kind === 'loading') return <>{header}{cta}<CabinetSkeleton rows={3} /></>;
  if (data.kind === 'error') return <>{header}{cta}<CabinetLoadError title={t('offers.loadError')} onRetry={reload} /></>;

  const cards = groupCards(data.offers);
  const entries = showcaseEntries(cards, data.drafts).filter((entry) => tab === 'all' || entry.kind === 'draft');
  const empty = cards.length === 0 && data.drafts.length === 0;

  return (
    <>
      {header}
      {empty ? (
        <section className={showcase.empty} aria-labelledby="showcase-empty">
          <h2 id="showcase-empty">{t('showcase.emptyTitle')}</h2>
          <p>{t('showcase.emptyText')}</p>
          {cta}
        </section>
      ) : (
        <>
          {cta}
          <nav className={showcase.tabs} aria-label={t('showcase.tabs')}>
            <Link href="/seller" scroll={false} aria-current={tab === 'all' ? 'page' : undefined}>{t('showcase.tabAll', { count: cards.length + data.drafts.length })}</Link>
            <Link href="/seller?tab=drafts" scroll={false} aria-current={tab === 'drafts' ? 'page' : undefined}>{t('showcase.tabDrafts', { count: data.drafts.length })}</Link>
          </nav>
          {entries.length === 0 && <p className={styles.lead}>{t('showcase.draftsEmpty')}</p>}
          <ul className={showcase.list}>
            {entries.map((entry) => entry.kind === 'card'
              ? <li key={entry.card.cardId}><CardRow card={entry.card} highlighted={highlight === entry.card.cardId} onOpen={() => go(`card=${entry.card.cardId}`)} onComplete={() => go(`edit=${entry.card.cardId}`)} /></li>
              : <li key={entry.draft.id}><DraftRow draft={entry.draft} onOpen={() => go(`draft=${entry.draft.id}`)} /></li>)}
          </ul>
        </>
      )}
      {notice && <p className={styles.toast} role="status"><CabinetIcon name="check" />{t(notice.text)}</p>}
      {sourceOpen && <SourceSheet onClose={() => setSourceOpen(false)} onManual={() => { setSourceOpen(false); go('new=1'); }} />}
      <Overlays
        cards={cards}
        drafts={data.drafts}
        seller={data.seller}
        commentTranslationEnabled={commentTranslationEnabled}
        override={override}
        onClose={closeOverlay}
        onSaved={(kind) => {
          if (kind === 'draftSaved') setNotice({ text: 'card.draftSaved', offerId: null });
          reload();
          closeOverlay();
        }}
        onReload={(values, photoIds) => {
          setOverride({ key: String(Date.now()), initial: { values, photoIds } });
          reload();
        }}
        go={go}
      />
    </>
  );
}

function Price({ card }: { card: SellerCard }) {
  const { t } = useI18n();
  const unit = card.lead.price?.unit;
  const amount = card.commonPrice ?? card.lowestPrice;
  if (!amount) return null;
  const text = `${formatAmount(amount)} ₸`;
  return (
    <span className={showcase.price}>
      {card.commonPrice ? text : t('showcase.priceFrom', { price: text })}
      {unit && <span className={showcase.unit}> / {unit}</span>}
    </span>
  );
}

function CardRow({ card, highlighted, onOpen, onComplete }: { card: SellerCard; highlighted: boolean; onOpen: () => void; onComplete: () => void }) {
  const { t } = useI18n();
  const lead = card.lead;
  const cover = lead.photos?.[0];
  const missing: MessageKey[] = [];
  if (!cover) missing.push('showcase.noPhoto');
  if (!lead.sellerComment) missing.push('showcase.noComment');
  const points = card.offers.length;
  return (
    <article className={showcase.card} data-highlight={highlighted ? 'true' : undefined} aria-labelledby={`card-${card.cardId}`} data-testid={`seller-card-${card.cardId}`}>
      <button type="button" className={showcase.cardMain} onClick={onOpen} aria-labelledby={`card-${card.cardId}`}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-only photo route
          <img className={showcase.thumb} src={photoUrl(cover.id, 'thumb')} alt="" />
        ) : (
          <span className={`${showcase.thumb} ${showcase.thumbEmpty}`} aria-hidden="true" />
        )}
        <span className={showcase.cardText}>
          <strong id={`card-${card.cardId}`}>{lead.product.name}{lead.packLabel ? ` · ${lead.packLabel}` : ''}</strong>
          <span><Price card={card} /><span className={showcase.meta}> · {t(pluralKey('showcase.points', points), { count: points })}</span></span>
          <span className={showcase.badge} data-state={card.live ? 'live' : 'off'}>
            <CabinetIcon name={card.live ? 'check' : 'pause'} />{card.live ? t('showcase.statusLive') : t('showcase.statusOff')}
          </span>
        </span>
      </button>
      {missing.length > 0 && (
        <div className={showcase.reminder}>
          <CabinetIcon name="alert" />
          <span>{missing.map((key) => t(key)).join(' · ')}. {t('showcase.incomplete')}</span>
          <button type="button" className={showcase.action} onClick={onComplete}>{t('showcase.complete')}</button>
        </div>
      )}
    </article>
  );
}

function DraftRow({ draft, onOpen }: { draft: OfferDraftView; onOpen: () => void }) {
  const { t } = useI18n();
  const missing = missingDraftFields(draft.payload);
  const cover = draft.payload.photoIds[0];
  return (
    <article className={showcase.card} aria-labelledby={`draft-${draft.id}`} data-testid={`seller-draft-${draft.id}`}>
      <button type="button" className={showcase.cardMain} onClick={onOpen} aria-labelledby={`draft-${draft.id}`}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-only photo route
          <img className={showcase.thumb} src={photoUrl(cover, 'thumb')} alt="" />
        ) : (
          <span className={`${showcase.thumb} ${showcase.thumbEmpty}`} aria-hidden="true" />
        )}
        <span className={showcase.cardText}>
          <strong id={`draft-${draft.id}`}>{draft.payload.title.trim() || t('showcase.draftUntitled')}</strong>
          <span className={showcase.meta}>
            {missing.length > 0 ? t('showcase.missing', { fields: missing.map((key) => t(key)).join(', ') }) : t('showcase.draftReady')}
          </span>
          <span className={showcase.badge} data-state="draft"><CabinetIcon name="clock" />{t('showcase.statusDraft')}</span>
        </span>
      </button>
    </article>
  );
}

// AI-S02 · AI outage: the AI ways are visible but off with the reason; the manual way is active.
function SourceSheet({ onClose, onManual }: { onClose: () => void; onManual: () => void }) {
  const { t } = useI18n();
  const ids = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  const ai: MessageKey[] = ['source.video', 'source.photos', 'source.voice'];
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div ref={sheetRef} className={`${styles.sheet} ${showcase.source}`} role="dialog" aria-modal="true" aria-labelledby={`${ids}-t`} onClick={(event) => event.stopPropagation()}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <h2 id={`${ids}-t`}>{t('source.title')}</h2>
        <p className={showcase.outage}>{t('source.outage')}</p>
        <p className={showcase.group}>{t('source.ai')}</p>
        {ai.map((key) => (
          <button key={key} type="button" className={showcase.sourceRow} disabled aria-describedby={`${ids}-off`}>
            <strong>{t(key)}</strong><span>{t('source.unavailable')}</span>
          </button>
        ))}
        <span id={`${ids}-off`} hidden>{t('source.unavailable')}</span>
        <p className={showcase.group}>{t('source.noAi')}</p>
        <button type="button" className={`${showcase.sourceRow} ${showcase.sourceManual}`} onClick={onManual}>
          <strong>{t('source.manual')}</strong><span>{t('source.manualHint')}</span>
        </button>
        <button type="button" className={styles.sheetClose} onClick={onClose}>{t('cabinet.close')}</button>
      </div>
    </div>
  );
}

// The editor and the card screen, opened from the address: `new=1`, `draft=`, `edit=`, `point=`, `card=`; `from=` a
// proposed ChangeSet when the Seller returns from the review page.
function Overlays({ cards, drafts, seller, commentTranslationEnabled, override, onClose, onSaved, onReload, go }: {
  cards: SellerCard[];
  drafts: OfferDraftView[];
  seller: SellerView | null;
  commentTranslationEnabled: boolean;
  override: { key: string; initial: CardEditorInitial } | null;
  onClose: () => void;
  onSaved: (kind: 'draftSaved' | 'draftDeleted') => void;
  onReload: (values: CardValues, photoIds: string[]) => void;
  go: (query: string) => void;
}) {
  const params = useSearchParams();
  const from = params.get('from');
  const creating = params.get('new') === '1';
  const draft = drafts.find((item) => item.id === params.get('draft')) ?? null;
  const editCard = findCard(cards, params.get('edit'));
  const pointId = params.get('point');
  const pointCard = findCard(cards, pointId);
  const pointOffer = pointCard?.offers.find((offer) => offer.id === pointId);
  const screenCard = findCard(cards, params.get('card'));
  const [restored, setRestored] = useState<{ from: string; initial: CardEditorInitial | null } | null>(null);

  const mode: CardEditorMode | null = creating ? { kind: 'create', draft: null }
    : draft ? { kind: 'create', draft }
      : editCard ? { kind: 'edit', card: editCard }
        : pointCard && pointOffer ? { kind: 'point', card: pointCard, offer: pointOffer } : null;
  const modeCard = mode && mode.kind !== 'create' ? mode.card : null;

  useEffect(() => {
    if (!from || !mode) return;
    let alive = true;
    void (async () => {
      let initial: CardEditorInitial | null = null;
      try {
        const response = await fetch(`/api/seller/change-sets/${encodeURIComponent(from)}`, { cache: 'no-store' });
        const data = response.ok ? await response.json() as { changeSet?: SellerChangeSetView } : {};
        if (data.changeSet?.status === 'proposed') {
          const byLocation = new Map((modeCard?.offers ?? []).map((offer) => [offer.location.id, offer.id]));
          initial = valuesFromChangeSet(data.changeSet, byLocation);
        }
      } catch {
        // An unreadable proposal opens the editor with its usual values.
      }
      if (alive) setRestored({ from, initial });
    })();
    return () => { alive = false; };
    // The proposal is read once per `from`; the card itself may refresh underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, Boolean(mode)]);

  if (mode) {
    if (from && restored?.from !== from) return null;
    const initial = override?.initial ?? (from ? restored?.initial ?? undefined : undefined);
    const reopen = creating ? 'new=1' : draft ? `draft=${draft.id}` : editCard ? `edit=${editCard.cardId}` : `point=${pointId}`;
    return (
      <CardEditor
        key={`${reopen}:${from ?? ''}:${override?.key ?? ''}`}
        mode={mode}
        seller={seller}
        initial={initial}
        reopen={reopen}
        commentTranslationEnabled={commentTranslationEnabled}
        onClose={onClose}
        onSaved={onSaved}
        onReload={onReload}
      />
    );
  }
  if (screenCard) return <CardScreen card={screenCard} onClose={onClose} go={go} />;
  return null;
}

// AI-S15 · Card · Points: every point with its price and state; change everywhere, in one point, or switch a point.
function CardScreen({ card, onClose, go }: { card: SellerCard; onClose: () => void; go: (query: string) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const ids = useId();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('h2')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);

  async function toggle(offer: SellerOfferView) {
    setBusyId(offer.id);
    setError(false);
    try {
      const response = await fetch(`/api/seller/offers/${offer.id}/change-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: offer.status === 'active' ? 'deactivate_offer' : 'activate_offer' }),
      });
      const result = await response.json() as { changeSet?: SellerChangeSetView };
      if (!response.ok || !result.changeSet) throw new Error('toggle');
      router.push(`/seller/change-sets/${result.changeSet.id}?${new URLSearchParams({ back: '/seller', offer: offer.id }).toString()}`);
    } catch {
      setError(true);
      setBusyId(null);
    }
  }

  const lead = card.lead;
  const several = card.offers.length > 1;
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${styles.sheet} ${showcase.screen}`} role="dialog" aria-modal="true" aria-labelledby={`${ids}-t`} onClick={(event) => event.stopPropagation()}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <div className={showcase.screenHead}>
          {lead.photos?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- owner-only photo route
            <img className={showcase.thumb} src={photoUrl(lead.photos[0].id, 'thumb')} alt="" />
          )}
          <h2 id={`${ids}-t`} tabIndex={-1}>{lead.product.name}{lead.packLabel ? ` · ${lead.packLabel}` : ''}</h2>
        </div>
        <button type="button" className={styles.primary} onClick={() => go(`edit=${card.cardId}`)}>
          {several ? t('cardScreen.editAll') : t('offerManage.edit')}
        </button>
        {error && <p className={showcase.error} role="alert">{t('offers.actionError')}</p>}
        <h3 className={showcase.group}>{t('cardScreen.inPoints', { count: card.offers.length })}</h3>
        <ul className={showcase.pointList}>
          {card.offers.map((offer) => (
            <li key={offer.id} className={showcase.pointItem}>
              <strong>{offer.location.name}</strong>
              <span>
                {offer.price ? `${formatAmount(offer.price.amount)} ₸${offer.price.unit ? ` / ${offer.price.unit}` : ''}` : ''}
                {offer.priceOwn && several ? ` · ${t('cardScreen.own')}` : ''}
              </span>
              <span className={showcase.badge} data-state={offer.status === 'active' ? 'live' : 'off'}>
                <CabinetIcon name={offer.status === 'active' ? 'check' : 'pause'} />
                {offer.status === 'active' ? t('showcase.statusLive') : t('showcase.statusOff')}
                {offer.status === 'active' && !offer.buyerVisible ? ` · ${t('offers.hidden')}` : ''}
              </span>
              <div className={showcase.pointActions}>
                {several && <button type="button" className={showcase.action} onClick={() => go(`point=${offer.id}`)}>{t('cardScreen.editPoint')}</button>}
                <button type="button" className={showcase.action} onClick={() => void toggle(offer)} disabled={busyId !== null}>
                  {offer.status === 'active' ? t('offerManage.disable') : t('offerManage.enable')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.sheetClose} onClick={onClose}>{t('cabinet.close')}</button>
      </div>
    </div>
  );
}
