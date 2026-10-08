'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { previewHref } from '../../../modules/offers/preview/preview-link';
import type { SellerChangeSetView } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { formatAmount } from '../../_components/format-amount';
import { Bar, focusPointEditLabel, Ic, LoadError, LoginRequired, Nav, Phone, PointEditLabel, Sheet, SkeletonRows, Thumb, Toast, TOAST_MS } from '../_kaida/ui';
import { ActualityScreen, ActualityTask, ArchiveScreen, daysLabel, FreshPlaque, useReconfirm } from './ActualityScreens';
import { CardEditor, type CardEditorInitial, type CardEditorMode } from './CardEditor';
import { SellerTradingPoints } from './SellerTradingPoints';
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
  reconfirmed: 'actuality.confirmed',
};

// AI-S01 «Моя витрина» · AI off (seller-showcase-editor §2): one primary action, cards grouped by product across
// points, drafts, the incomplete-card reminder; the editor and the card screen replace it while open.
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
    const timer = window.setTimeout(() => setNotice(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const go = useCallback((query: string) => {
    // Leaving the showcase ends its toast; it must not pop up again on the way back.
    setNotice(null);
    router.push(query ? `/seller?${query}` : '/seller', { scroll: false });
  }, [router]);
  const closeOverlay = useCallback(() => {
    setOverride(null);
    router.replace(tab === 'drafts' ? '/seller?tab=drafts' : '/seller', { scroll: false });
  }, [router, tab]);

  const cta = (
    <button type="button" className="btn btn-p lg w" onClick={() => setSourceOpen(true)} aria-haspopup="dialog">
      <Ic name="plus" />{t('showcase.cta')}
    </button>
  );
  const screen = (content: React.ReactNode, extra?: React.ReactNode) => (
    <Phone>
      <Bar title={t('showcase.title')} />
      {content}
      {extra}
      <Nav active="showcase" />
      {sourceOpen && <SourceSheet onClose={() => setSourceOpen(false)} onManual={() => { setSourceOpen(false); go('new=1'); }} />}
    </Phone>
  );

  if (data.kind === 'anonymous') return screen(<LoginRequired />);
  if (data.kind === 'loading') return screen(<main className="body" style={{ gap: 12 }} aria-busy="true">{cta}<SkeletonRows /></main>);
  if (data.kind === 'error') return screen(<main className="body" style={{ gap: 12 }}>{cta}<LoadError title={t('offers.loadError')} onRetry={reload} /></main>);

  const cards = groupCards(data.offers);
  // offer-actuality: archived cards live only in «Архив»; due ones (oldest first) feed the task and «Актуальность».
  const archivedCards = cards.filter((card) => card.actuality?.archived);
  const liveCards = cards.filter((card) => !card.actuality?.archived);
  const dueCards = liveCards.filter((card) => card.actuality?.due)
    .sort((a, b) => a.actuality!.lastConfirmedAt.localeCompare(b.actuality!.lastConfirmedAt));
  const overlay = (
    <Overlays
      cards={cards}
      dueCards={dueCards}
      archivedCards={archivedCards}
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
      onRefresh={reload}
      onReconfirmed={() => {
        setNotice({ text: 'actuality.confirmed', offerId: null });
        reload();
        closeOverlay();
      }}
      onReload={(values, photoIds) => {
        setOverride({ key: String(Date.now()), initial: { values, photoIds } });
        reload();
      }}
      go={go}
    />
  );
  if (isOverlayOpen(params, cards, data.drafts)) return overlay;

  const entries = showcaseEntries(liveCards, data.drafts).filter((entry) => tab === 'all' || entry.kind === 'draft');
  const empty = cards.length === 0 && data.drafts.length === 0;
  const toast = notice && <Toast>{t(notice.text)}</Toast>;

  if (empty) {
    return screen(
      <main className="body" style={{ justifyContent: 'center', gap: 20, padding: '24px 20px' }}>
        <h2 className="h1" style={{ textAlign: 'center' }}>{t('showcase.emptyTitle')}</h2>
        <p className="t c2" style={{ textAlign: 'center' }}>{t('showcase.emptyText')}</p>
        {cta}
      </main>,
      toast,
    );
  }

  return screen(
    <main className="body" style={{ gap: 12 }}>
      {cta}
      <ActualityTask due={dueCards} onCheck={() => go('actuality=1')} />
      {data.drafts.length > 0 || archivedCards.length > 0 ? (
        <nav className="chips" aria-label={t('showcase.tabs')}>
          <Link href="/seller" scroll={false} className={`chip${tab === 'all' ? ' on' : ''}`} aria-current={tab === 'all' ? 'page' : undefined}>{t('showcase.tabAll', { count: liveCards.length + data.drafts.length })}</Link>
          {data.drafts.length > 0 && <Link href="/seller?tab=drafts" scroll={false} className={`chip${tab === 'drafts' ? ' on' : ''}`} aria-current={tab === 'drafts' ? 'page' : undefined}>{t('showcase.tabDrafts', { count: data.drafts.length })}</Link>}
          {archivedCards.length > 0 && <Link href="/seller?tab=archive" scroll={false} className="chip">{t('archive.chip', { count: archivedCards.length })}</Link>}
        </nav>
      ) : (
        <h2 className="h3">{t('showcase.cardsCount', { count: liveCards.length })}</h2>
      )}
      {entries.length === 0 && <p className="t c2">{t('showcase.draftsEmpty')}</p>}
      {entries.map((entry) => entry.kind === 'card'
        ? <CardRow key={entry.card.cardId} card={entry.card} highlighted={highlight === entry.card.cardId} onOpen={() => go(`card=${entry.card.cardId}`)} onAddPhoto={() => go(`edit=${entry.card.cardId}&focus=photos`)} />
        : <DraftRow key={entry.draft.id} draft={entry.draft} onOpen={() => go(`draft=${entry.draft.id}`)} />)}
    </main>,
    toast,
  );
}

function isOverlayOpen(params: URLSearchParams, cards: SellerCard[], drafts: OfferDraftView[]) {
  if (params.get('actuality') === '1' || params.get('tab') === 'archive') return true;
  if (params.get('new') === '1') return true;
  if (drafts.some((draft) => draft.id === params.get('draft'))) return true;
  return Boolean(findCard(cards, params.get('edit')) || findCard(cards, params.get('point')) || findCard(cards, params.get('card')));
}

function priceLine(card: SellerCard, t: ReturnType<typeof useI18n>['t']) {
  const unit = card.lead.price?.unit;
  const amount = card.commonPrice ?? card.lowestPrice;
  if (!amount) return null;
  const text = `${formatAmount(amount)} ₸`;
  const points = card.offers.length;
  return (
    <div className="c c2">
      <b className="num" style={{ color: 'var(--ink)' }}>{card.commonPrice ? text : t('showcase.priceFrom', { price: text })}</b>
      {unit ? ` / ${unit}` : ''} · {t(pluralKey('showcase.points', points), { count: points })}
    </div>
  );
}

function CardRow({ card, highlighted, onOpen, onAddPhoto }: { card: SellerCard; highlighted: boolean; onOpen: () => void; onAddPhoto: () => void }) {
  const { t } = useI18n();
  const lead = card.lead;
  const cover = lead.photos?.[0];
  const missing: MessageKey[] = [];
  // the Offers buyers can open right now (the same visibility as Search); only these can be previewed
  const previewable = card.offers.filter((offer) => offer.buyerVisible);
  if (!cover) missing.push('showcase.noPhoto');
  if (!lead.sellerComment) missing.push('showcase.noComment');
  return (
    <article className={`card${highlighted ? ' hl is-new' : ''}`} aria-labelledby={`card-${card.cardId}`} data-testid={`seller-card-${card.cardId}`}
      style={{ position: 'relative', ...(card.removal ? { border: '1.5px solid var(--danger)' } : {}) }}>
      <button type="button" className="rowbtn" onClick={onOpen} aria-labelledby={`card-${card.cardId}`}>
        <Thumb photoUrl={cover ? photoUrl(cover.id, 'thumb') : null} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="ts" id={`card-${card.cardId}`}>{lead.product.name}{lead.packLabel ? ` · ${lead.packLabel}` : ''}</div>
          {priceLine(card, t)}
          {card.removal ? (
            <>
              <span className="bd bd-err"><Ic name="eyeoff" />{t('removal.status')}</span>
              <p className="c">{t('removal.rowHint', { reason: t(`removal.short.${card.removal.reason}`) })}</p>
            </>
          ) : card.actuality?.stage === 'hidden' ? (
            <>
              <span className="bd bd-warn"><Ic name="eyeoff" />{t('actuality.needConfirm')}</span>
              <p className="c">{t('actuality.hiddenFor', { days: daysLabel(card.actuality.days, t) })}</p>
            </>
          ) : card.live ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="bd bd-ok"><Ic name="check" />{t('showcase.statusLive')}{highlighted ? ` · ${t('showcase.statusNow')}` : ''}</span>
              {card.actuality?.due && <span className="bd bd-warn"><Ic name="clock" />{t('actuality.confirmDue')}</span>}
            </div>
          ) : <span className="bd bd-n"><Ic name="power" />{t('showcase.statusOff')}</span>}
        </div>
      </button>
      {!cover && (
        <button type="button" className="photo-shortcut" onClick={onAddPhoto} aria-label={`${t('source.photos')}: ${lead.product.name}`}>
          <Ic name="plus" />
        </button>
      )}
      {missing.length > 0 && (
        <p className="c" style={{ paddingLeft: 68 }}>{missing.map((key) => t(key)).join(' · ')}. {t('showcase.incomplete')}</p>
      )}
      {/* post-publication-buyer-preview §3.2 (3): right after publishing — one point opens the buyer page, several points open the card screen with its points. */}
      {highlighted && !card.removal && previewable.length > 0 && (
        <div style={{ paddingLeft: 68 }}>
          {previewable.length === 1 && card.offers.length === 1
            ? <Link href={previewHref(previewable[0]!.id, '/seller')} className="act" data-testid="preview-action"><Ic name="eye" className="sm" /><span>{t('preview.action')}</span></Link>
            : <button type="button" className="act" data-testid="preview-action" onClick={onOpen}><Ic name="eye" className="sm" /><span>{t('preview.action')}</span></button>}
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
    <article className="card" aria-labelledby={`draft-${draft.id}`} data-testid={`seller-draft-${draft.id}`}>
      <button type="button" className="rowbtn" onClick={onOpen} aria-labelledby={`draft-${draft.id}`}>
        <Thumb photoUrl={cover ? photoUrl(cover, 'thumb') : null} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="ts" id={`draft-${draft.id}`}>{draft.payload.title.trim() || t('showcase.draftUntitled')}</div>
          <span className="bd bd-n"><Ic name="pencil" />{t('showcase.statusDraft')}</span>
          <p className="c">{missing.length > 0 ? t('showcase.missing', { fields: missing.map((key) => t(key)).join(', ') }) : t('showcase.draftReady')}</p>
        </div>
      </button>
    </article>
  );
}

// AI-S02 · Source · AI outage: the AI ways are visible but off with the reason; the manual way is active.
function SourceSheet({ onClose, onManual }: { onClose: () => void; onManual: () => void }) {
  const { t } = useI18n();
  const ai: { key: MessageKey; icon: string }[] = [
    { key: 'source.video', icon: 'video' },
    { key: 'source.photos', icon: 'image' },
    { key: 'source.voice', icon: 'mic' },
  ];
  return (
    <Sheet title={t('source.title')} onClose={onClose}>
      <div className="banner gray" role="status" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14 }}>
        <Ic name="info" className="c2" /><p className="c c2" style={{ flex: 1 }}>{t('source.outage')}</p>
      </div>
      <div className="ov">{t('source.ai')}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ai.map((item) => (
          <button key={item.key} type="button" className="li" disabled style={{ color: 'var(--ink3)', background: 'transparent', border: 0, cursor: 'default' }}>
            <div className="lic ai" title={t('source.ai')}><Ic name={item.icon} /></div>
            <div className="mid"><div className="ts">{t(item.key)}</div><p className="c">{t('source.unavailable')}</p></div>
          </button>
        ))}
      </div>
      <div className="hr" role="separator" style={{ margin: '4px 0' }} />
      <button type="button" className="li card hl" onClick={onManual} data-autofocus style={{ padding: '8px 12px', flexDirection: 'row' }}>
        <div className="lic p"><Ic name="pencil" /></div>
        <div className="mid"><div className="ts">{t('source.manual')}</div></div>
        <Ic name="right" className="pt" />
      </button>
    </Sheet>
  );
}

// The editor and the card screen, opened from the address: `new=1`, `draft=`, `edit=`, `point=`, `card=`; `from=` a
// proposed ChangeSet when the Seller returns from the review page.
function Overlays({ cards, dueCards, archivedCards, drafts, seller, commentTranslationEnabled, override, onClose, onSaved, onReconfirmed, onRefresh, onReload, go }: {
  cards: SellerCard[];
  dueCards: SellerCard[];
  archivedCards: SellerCard[];
  drafts: OfferDraftView[];
  seller: SellerView | null;
  commentTranslationEnabled: boolean;
  override: { key: string; initial: CardEditorInitial } | null;
  onClose: () => void;
  onSaved: (kind: 'draftSaved' | 'draftDeleted') => void;
  onReconfirmed: () => void;
  onRefresh: () => void;
  onReload: (values: CardValues, photoIds: string[]) => void;
  go: (query: string) => void;
}) {
  const params = useSearchParams();
  const from = params.get('from');
  const initialFocus = params.get('focus') === 'photos' ? 'photos' : undefined;
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
        initialFocus={initialFocus}
        reopen={reopen}
        commentTranslationEnabled={commentTranslationEnabled}
        onClose={onClose}
        onSaved={onSaved}
        onReload={onReload}
      />
    );
  }
  if (screenCard) return <CardScreen card={screenCard} seller={seller} onClose={onClose} go={go} onRefresh={onRefresh} />;
  if (params.get('actuality') === '1') return <ActualityScreen due={dueCards} onClose={onClose} onDone={onReconfirmed} go={go} />;
  if (params.get('tab') === 'archive') return <ArchiveScreen cards={archivedCards} onClose={onClose} go={go} />;
  return null;
}

// AI-S15 · Card · Removed by operator: the reason in plain words, no on/off switches; the only way back is to fix
// the card and publish it again (operator-post-check §2 «Seller side»).
function RemovedCardScreen({ card, title, onClose, go }: { card: SellerCard; title: string; onClose: () => void; go: (query: string) => void }) {
  const { locale, t } = useI18n();
  const removal = card.removal!;
  const cover = card.lead.photos?.[0];
  const date = new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { day: 'numeric', month: 'long' }).format(new Date(removal.removedAt));
  return (
    <Phone>
      <Bar title={title} onBack={onClose} />
      <main className="body" style={{ gap: 14 }}>
        <div className={`img${cover ? '' : ' fb'}`} style={{ height: 150, borderRadius: 20, opacity: 0.6, flex: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo route */}
          {cover ? <img src={photoUrl(cover.id, 'display')} alt="" /> : <Ic name="logo" />}
        </div>
        <span className="bd bd-err" style={{ alignSelf: 'flex-start' }}><Ic name="eyeoff" />{t('removal.status')}</span>
        <div className="card p16" style={{ gap: 6 }}>
          <h2 className="ov">{t('removal.why')}</h2>
          <p className="t">{t(`removal.text.${removal.reason}`)} {t('removal.hidden')}</p>
          {removal.comment && <p className="t">{t('removal.comment', { comment: removal.comment })}</p>}
          <p className="c">{t('removal.removedOn', { date })}</p>
        </div>
        <p className="c c2">{t('removal.hint')}</p>
      </main>
      <div className="foot">
        <button type="button" className="btn btn-p lg w" onClick={() => go(`edit=${card.cardId}`)}>{t('removal.fix')}</button>
      </div>
    </Phone>
  );
}

// AI-S15 · Card: one point — photo, status, price and actions (Published / Off); several points — every point with its
// price and state (Points); change everywhere, in one point, or switch a point on or off.
function CardScreen({ card, seller, onClose, go, onRefresh }: { card: SellerCard; seller: SellerView | null; onClose: () => void; go: (query: string) => void; onRefresh: () => void }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const reconfirm = useReconfirm();
  const [reconfirmed, setReconfirmed] = useState(false);
  useEffect(() => {
    if (!reconfirmed) return;
    const timer = window.setTimeout(() => setReconfirmed(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [reconfirmed]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // seller-card-point-link: one of the card's points opens for editing over the card screen.
  const [editingPoint, setEditingPoint] = useState<string | null>(null);
  const [pointReturn, setPointReturn] = useState<{ focusKey: string; n: number } | null>(null);
  const [pointSaved, setPointSaved] = useState(false);
  useEffect(() => {
    if (!pointSaved) return;
    const timer = window.setTimeout(() => setPointSaved(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [pointSaved]);
  useEffect(() => {
    if (!editingPoint && pointReturn) focusPointEditLabel(pointReturn.focusKey);
  }, [editingPoint, pointReturn]);

  function editPoint(locationId: string, focusKey: string) {
    setPointReturn((current) => ({ focusKey, n: (current?.n ?? 0) + 1 }));
    setEditingPoint(locationId);
  }

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
  const cover = lead.photos?.[0];
  const title = `${lead.product.name}${lead.packLabel ? ` · ${lead.packLabel}` : ''}`;
  // the amount with «₸» never breaks; the unit follows by words (large text)
  const priceParts = (offer: SellerOfferView) => offer.price ? <><span style={{ whiteSpace: 'nowrap' }}>{formatAmount(offer.price.amount)} ₸</span>{offer.price.unit ? ` / ${offer.price.unit}` : ''}</> : null;
  const badge = (offer: SellerOfferView) => offer.status === 'active'
    ? <span className="bd bd-ok"><Ic name="check" />{t('showcase.statusLive')}{!offer.buyerVisible ? ` · ${t('offers.hidden')}` : ''}</span>
    : <span className="bd bd-n"><Ic name="power" />{t('showcase.statusOff')}</span>;
  const errorBanner = error && (
    <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12 }}><p className="c" style={{ color: 'var(--ink)' }}>{t('offers.actionError')}</p></div>
  );

  if (card.removal) return <RemovedCardScreen card={card} title={title} onClose={onClose} go={go} />;

  // offer-actuality (S15): the task badge or the hidden / archived state, and «Подтвердить актуальность».
  const actuality = card.actuality;
  const actualityStatus = actuality && (actuality.archived ? (
    <>
      <span className="bd bd-n"><Ic name="clock" />{t('archive.status')}</span>
      <p className="c">{t('archive.since', { date: new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { day: 'numeric', month: 'long' }).format(new Date(actuality.lastConfirmedAt)) })}</p>
    </>
  ) : actuality.stage === 'hidden' ? (
    <>
      <span className="bd bd-warn"><Ic name="eyeoff" />{t('actuality.needConfirm')}</span>
      <p className="c">{t('actuality.hiddenFor', { days: daysLabel(actuality.days, t) })}</p>
    </>
  ) : actuality.due ? <span className="bd bd-warn"><Ic name="clock" />{t('actuality.confirmDue')}</span> : null);
  async function confirmActuality() {
    if (await reconfirm.confirm([card.cardId])) {
      setReconfirmed(true);
      onRefresh();
    }
  }
  const reconfirmError = reconfirm.error && (
    <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12 }}><p className="c" style={{ color: 'var(--ink)' }}>{t('actuality.confirmError')}</p></div>
  );
  const reconfirmToast = reconfirmed && <Toast>{t('actuality.confirmed')}</Toast>;

  if (card.offers.length === 1) {
    const offer = card.offers[0]!;
    const off = offer.status !== 'active';
    return (
      <Phone>
        <Bar title={title} onBack={onClose} />
        <main className="body" style={{ gap: 12 }}>
          <div className={`img${cover ? '' : ' fb'}`} style={{ height: 170, borderRadius: 20, opacity: off ? 0.55 : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo route */}
            {cover ? <img src={photoUrl(cover.id, 'display')} alt="" /> : <Ic name="logo" />}
            <FreshPlaque card={card} />
          </div>
          {actuality?.archived || actuality?.stage === 'hidden'
            // Hidden or archived: the actuality state replaces «На витрине» (buyers do not see the card).
            ? actualityStatus
            : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badge(offer)}{actuality?.due && actualityStatus}</div>}
          {offer.price && <div><span className="pr-lg">{formatAmount(offer.price.amount)} ₸</span>{offer.price.unit && <> <span className="c2">/ {offer.price.unit}</span></>}</div>}
          <p className="c">{offer.location.name}</p>
          {errorBanner}
          {reconfirmError}
          {off ? (
            <>
              <div className="banner gray" style={{ padding: 12, borderRadius: 14 }}><p className="c c2">{t('cardScreen.offText')}</p></div>
              <button type="button" className="btn btn-p lg w" onClick={() => void toggle(offer)} disabled={busyId !== null}><Ic name="power" className="sm" />{t('offerManage.enable')}</button>
              <button type="button" className="btn btn-o w" onClick={() => go(`edit=${card.cardId}`)}><Ic name="pencil" className="sm" />{t('cardScreen.edit')}</button>
            </>
          ) : (
            <div className="card" style={{ gap: 0, padding: '0 12px' }}>
              <button type="button" className="li" onClick={() => void confirmActuality()} disabled={reconfirm.busy} style={{ background: 'transparent', border: 0 }}>
                <Ic name="check" className="pt" /><div className="mid"><div className="ts">{t('actuality.confirm')}</div><p className="c">{t('actuality.confirmHint')}</p></div>
              </button>
              <button type="button" className="li" onClick={() => go(`edit=${card.cardId}`)} style={{ background: 'transparent', border: 0, borderTop: '1px solid var(--line)' }}>
                <Ic name="pencil" className="c2" /><div className="mid"><div className="ts">{t('cardScreen.edit')}</div></div>
              </button>
              {/* post-publication-buyer-preview §3.2 (1): the real buyer page, only while buyers can see the Offer */}
              {offer.buyerVisible && (
                <Link href={previewHref(offer.id, `/seller?card=${card.cardId}`)} className="li" data-testid="preview-action" style={{ background: 'transparent', border: 0, borderTop: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
                  <Ic name="eye" className="c2" /><div className="mid"><div className="ts">{t('preview.action')}</div></div>
                </Link>
              )}
              <button type="button" className="li" onClick={() => void toggle(offer)} disabled={busyId !== null} style={{ background: 'transparent', border: 0, borderTop: '1px solid var(--line)' }}>
                <Ic name="power" className="c2" /><div className="mid"><div className="ts">{t('offerManage.disable')}</div><p className="c">{t('cardScreen.disableHint')}</p></div>
              </button>
            </div>
          )}
        </main>
        {reconfirmToast}
      </Phone>
    );
  }

  if (editingPoint) {
    return (
      <SellerTradingPoints
        seller={seller}
        onSellerChange={() => onRefresh()}
        editLocationId={editingPoint}
        onClose={(result) => {
          setEditingPoint(null);
          if (result === 'saved') { setPointSaved(true); onRefresh(); }
        }}
      />
    );
  }

  return (
    <Phone>
      <Bar title={title} onBack={onClose} />
      <main className="body" style={{ gap: 12 }}>
        <div className={`img${cover ? '' : ' fb'}`} style={{ height: 76, borderRadius: 16, flex: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo route */}
          {cover ? <img src={photoUrl(cover.id, 'display')} alt="" /> : <Ic name="logo" />}
          <FreshPlaque card={card} />
        </div>
        {actualityStatus}
        {actuality && (
          <button type="button" className="btn btn-p w" onClick={() => void confirmActuality()} disabled={reconfirm.busy}>
            <Ic name="check" className="sm" />{t('actuality.confirm')}
          </button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-o sm" style={{ flex: 1, whiteSpace: 'normal', height: 'auto', minHeight: 44, paddingBlock: 8, textAlign: 'center' }} onClick={() => go(`edit=${card.cardId}`)}><Ic name="pencil" className="sm" /><span>{t('cardScreen.editAll')}</span></button>
        </div>
        {errorBanner}
        {reconfirmError}
        <h2 className="ov">{t('cardScreen.inPoints', { count: card.offers.length })}</h2>
        {card.offers.map((offer) => (
          <div key={offer.id} className="card" style={{ gap: 4 }}>
            {/* large text: the header wraps (the badge goes under the name), the name breaks by words, the amount is never broken */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px' }}>
              <div style={{ flex: '1 1 11em', minWidth: 0 }}>
                <div className="ts" style={{ overflowWrap: 'anywhere' }}>{offer.location.name}</div>
                <p className="c num">{priceParts(offer)}{offer.priceOwn ? ` · ${t('cardScreen.own')}` : ''}</p>
              </div>
              <span style={{ flex: 'none' }}>{badge(offer)}</span>
              <PointEditLabel label={t('points.editNamed', { name: offer.location.name })} focusKey={`card:${offer.id}`} onClick={() => editPoint(offer.location.id, `card:${offer.id}`)} />
            </div>
            {!offer.buyerVisible && <p className="c c2" style={{ margin: 0 }} data-testid="preview-unavailable">{t('preview.notShown')}</p>}
            {/* post-publication-buyer-preview §3.2 (2): a compact stack of quiet actions, 44 px targets edge to edge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
              <button type="button" className="act" onClick={() => go(`point=${offer.id}`)}><Ic name="pencilpart" className="sm" /><span>{t('cardScreen.editPoint')}</span></button>
              {offer.buyerVisible && (
                <Link href={previewHref(offer.id, `/seller?card=${card.cardId}`)} className="act" data-testid="preview-action"><Ic name="eye" className="sm" /><span>{t('preview.action')}</span></Link>
              )}
              <button type="button" className="act" onClick={() => void toggle(offer)} disabled={busyId !== null}>
                <span>{offer.status === 'active' ? t('offerManage.disable') : t('offerManage.enable')}</span>
              </button>
            </div>
          </div>
        ))}
      </main>
      {pointSaved && <Toast>{t('points.saved')}</Toast>}
    </Phone>
  );
}
