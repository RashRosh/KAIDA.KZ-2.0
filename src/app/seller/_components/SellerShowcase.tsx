'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import type { SellerChangeSetView } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { formatAmount } from '../../_components/OfferCard';
import { Bar, Ic, LoadError, LoginRequired, Nav, Phone, Sheet, SkeletonRows, Thumb, Toast } from '../_kaida/ui';
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

  const cta = (
    <button type="button" className="btn btn-p lg w" onClick={() => setSourceOpen(true)} aria-haspopup="dialog">
      <Ic name="plus" />{t('showcase.cta')}
    </button>
  );
  const screen = (content: React.ReactNode, extra?: React.ReactNode) => (
    <Phone>
      <Bar title={t('showcase.title')} lang />
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
  const overlay = (
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
  );
  if (isOverlayOpen(params, cards, data.drafts)) return overlay;

  const entries = showcaseEntries(cards, data.drafts).filter((entry) => tab === 'all' || entry.kind === 'draft');
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
      {data.drafts.length > 0 ? (
        <nav className="chips" aria-label={t('showcase.tabs')}>
          <Link href="/seller" scroll={false} className={`chip${tab === 'all' ? ' on' : ''}`} aria-current={tab === 'all' ? 'page' : undefined}>{t('showcase.tabAll', { count: cards.length + data.drafts.length })}</Link>
          <Link href="/seller?tab=drafts" scroll={false} className={`chip${tab === 'drafts' ? ' on' : ''}`} aria-current={tab === 'drafts' ? 'page' : undefined}>{t('showcase.tabDrafts', { count: data.drafts.length })}</Link>
        </nav>
      ) : (
        <h2 className="h3">{t('showcase.cardsCount', { count: cards.length })}</h2>
      )}
      {entries.length === 0 && <p className="t c2">{t('showcase.draftsEmpty')}</p>}
      {entries.map((entry) => entry.kind === 'card'
        ? <CardRow key={entry.card.cardId} card={entry.card} highlighted={highlight === entry.card.cardId} onOpen={() => go(`card=${entry.card.cardId}`)} onComplete={() => go(`edit=${entry.card.cardId}`)} />
        : <DraftRow key={entry.draft.id} draft={entry.draft} onOpen={() => go(`draft=${entry.draft.id}`)} />)}
    </main>,
    toast,
  );
}

function isOverlayOpen(params: URLSearchParams, cards: SellerCard[], drafts: OfferDraftView[]) {
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

function CardRow({ card, highlighted, onOpen, onComplete }: { card: SellerCard; highlighted: boolean; onOpen: () => void; onComplete: () => void }) {
  const { t } = useI18n();
  const lead = card.lead;
  const cover = lead.photos?.[0];
  const missing: MessageKey[] = [];
  if (!cover) missing.push('showcase.noPhoto');
  if (!lead.sellerComment) missing.push('showcase.noComment');
  return (
    <article className={`card${highlighted ? ' hl is-new' : ''}`} aria-labelledby={`card-${card.cardId}`} data-testid={`seller-card-${card.cardId}`}>
      <button type="button" className="rowbtn" onClick={onOpen} aria-labelledby={`card-${card.cardId}`}>
        <Thumb photoUrl={cover ? photoUrl(cover.id, 'thumb') : null} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="ts" id={`card-${card.cardId}`}>{lead.product.name}{lead.packLabel ? ` · ${lead.packLabel}` : ''}</div>
          {priceLine(card, t)}
          {card.live
            ? <span className="bd bd-ok"><Ic name="check" />{t('showcase.statusLive')}{highlighted ? ` · ${t('showcase.statusNow')}` : ''}</span>
            : <span className="bd bd-n"><Ic name="power" />{t('showcase.statusOff')}</span>}
        </div>
      </button>
      {missing.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 68 }}>
          <p className="c" style={{ flex: 1 }}>{missing.map((key) => t(key)).join(' · ')}. {t('showcase.incomplete')}</p>
          <button type="button" className="btn btn-g sm" style={{ padding: 0 }} onClick={onComplete}>{t('showcase.complete')}</button>
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

// AI-S15 · Card: one point — photo, status, price and actions (Published / Off); several points — every point with its
// price and state (Points); change everywhere, in one point, or switch a point on or off.
function CardScreen({ card, onClose, go }: { card: SellerCard; onClose: () => void; go: (query: string) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

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
  const priceText = (offer: SellerOfferView) => offer.price ? `${formatAmount(offer.price.amount)} ₸${offer.price.unit ? ` / ${offer.price.unit}` : ''}` : '';
  const badge = (offer: SellerOfferView) => offer.status === 'active'
    ? <span className="bd bd-ok"><Ic name="check" />{t('showcase.statusLive')}{!offer.buyerVisible ? ` · ${t('offers.hidden')}` : ''}</span>
    : <span className="bd bd-n"><Ic name="power" />{t('showcase.statusOff')}</span>;
  const errorBanner = error && (
    <div className="banner err" role="alert" style={{ padding: '10px 12px', borderRadius: 12 }}><p className="c" style={{ color: 'var(--ink)' }}>{t('offers.actionError')}</p></div>
  );

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
          </div>
          {badge(offer)}
          {offer.price && <div><span className="pr-lg">{formatAmount(offer.price.amount)} ₸</span>{offer.price.unit && <> <span className="c2">/ {offer.price.unit}</span></>}</div>}
          <p className="c">{offer.location.name}</p>
          {errorBanner}
          {off ? (
            <>
              <div className="banner gray" style={{ padding: 12, borderRadius: 14 }}><p className="c c2">{t('cardScreen.offText')}</p></div>
              <button type="button" className="btn btn-p lg w" onClick={() => void toggle(offer)} disabled={busyId !== null}><Ic name="power" className="sm" />{t('offerManage.enable')}</button>
              <button type="button" className="btn btn-o w" onClick={() => go(`edit=${card.cardId}`)}><Ic name="pencil" className="sm" />{t('cardScreen.edit')}</button>
            </>
          ) : (
            <div className="card" style={{ gap: 0, padding: '0 12px' }}>
              <button type="button" className="li" onClick={() => go(`edit=${card.cardId}`)} style={{ background: 'transparent', border: 0 }}>
                <Ic name="pencil" className="c2" /><div className="mid"><div className="ts">{t('cardScreen.edit')}</div></div>
              </button>
              <button type="button" className="li" onClick={() => void toggle(offer)} disabled={busyId !== null} style={{ background: 'transparent', border: 0, borderTop: '1px solid var(--line)' }}>
                <Ic name="power" className="c2" /><div className="mid"><div className="ts">{t('offerManage.disable')}</div><p className="c">{t('cardScreen.disableHint')}</p></div>
              </button>
            </div>
          )}
        </main>
      </Phone>
    );
  }

  return (
    <Phone>
      <Bar title={title} onBack={onClose} />
      <main className="body" style={{ gap: 12 }}>
        <div className={`img${cover ? '' : ' fb'}`} style={{ height: 76, borderRadius: 16, flex: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo route */}
          {cover ? <img src={photoUrl(cover.id, 'display')} alt="" /> : <Ic name="logo" />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-o sm" style={{ flex: 1 }} onClick={() => go(`edit=${card.cardId}`)}><Ic name="pencil" className="sm" />{t('cardScreen.editAll')}</button>
        </div>
        {errorBanner}
        <h2 className="ov">{t('cardScreen.inPoints', { count: card.offers.length })}</h2>
        {card.offers.map((offer) => (
          <div key={offer.id} className="card" style={{ gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div className="ts">{offer.location.name}</div>
                <p className="c num">{priceText(offer)}{offer.priceOwn ? ` · ${t('cardScreen.own')}` : ''}</p>
              </div>
              {badge(offer)}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => go(`point=${offer.id}`)}>{t('cardScreen.editPoint')}</button>
              <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0, color: 'var(--ink2)' }} onClick={() => void toggle(offer)} disabled={busyId !== null}>
                {offer.status === 'active' ? t('offerManage.disable') : t('offerManage.enable')}
              </button>
            </div>
          </div>
        ))}
      </main>
    </Phone>
  );
}
