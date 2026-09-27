'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetItemView, SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import { useI18n } from '../../../../../i18n/I18nProvider';
import type { MessageKey } from '../../../../../i18n/messages';
import { formatOfferPrice } from '../../../_components/cabinet-data';
import { photoUrl } from '../../../../../modules/media/contracts/photo.contract';
import { formatAmount } from '../../../../_components/OfferCard';
import { pluralKey } from '../../../_components/card-model';
import { Bar, Ic, LoadError, LoginRequired, Phone, Thumb } from '../../../_kaida/ui';

type ApiResponse = { changeSet?: SellerChangeSetView; error?: { code?: string } };
type Phase = 'pending' | 'confirming' | 'failed' | 'conflict';
type Action = SellerChangeSetItemView['action'];

const kindKey: Record<Action, MessageKey> = {
  create_offer: 'confirm.kindCreate',
  update_offer: 'confirm.kindUpdate',
  deactivate_offer: 'confirm.kindDisable',
  activate_offer: 'confirm.kindEnable',
};

const noticeFor: Record<Action, string> = {
  create_offer: 'created',
  update_offer: 'updated',
  deactivate_offer: 'disabled',
  activate_offer: 'enabled',
};

// Only cabinet paths are accepted as a return target.
function safeBack(value: string | null, fallback: string) {
  return value && value.startsWith('/seller') && !value.startsWith('//') ? value : fallback;
}

function priceText(price: SellerChangeSetItemView['price']) {
  const formatted = formatOfferPrice(price);
  return formatted ? `${formatted.amount}${formatted.unit ? ` / ${formatted.unit}` : ''}` : null;
}

function Kv({ label, value, old }: { label: string; value: string; old?: string | null }) {
  return <div className="kv"><span>{label}</span><span className="num">{old && old !== value ? `${old} → ${value}` : value}</span></div>;
}

export function SellerConfirmChange({ changeSetId }: { changeSetId: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const targetOfferId = params.get('offer');
  const [changeSet, setChangeSet] = useState<SellerChangeSetView | null>(null);
  const [owned, setOwned] = useState<SellerOfferView[] | null>(null);
  const [load, setLoad] = useState<'loading' | 'anonymous' | 'error' | 'ready'>('loading');
  const [phase, setPhase] = useState<Phase>('pending');
  const [failure, setFailure] = useState<MessageKey>('confirm.failedText');
  const [attempt, setAttempt] = useState(0);

  const readOwnedOffers = useCallback(async () => {
    const response = await fetch(`/api/seller/offers?locale=${locale}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json() as { offers: SellerOfferView[] }).offers;
  }, [locale]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/seller/change-sets/${changeSetId}?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (response.status === 401) {
          setLoad('anonymous');
          return;
        }
        const data = await response.json() as ApiResponse;
        if (!response.ok || !data.changeSet) throw new Error('load');
        const offers = data.changeSet.status === 'proposed' && targetOfferId ? await readOwnedOffers() : null;
        if (!alive) return;
        setChangeSet(data.changeSet);
        setOwned(offers);
        setLoad('ready');
      } catch {
        if (alive) setLoad('error');
      }
    })();
    return () => { alive = false; };
  }, [changeSetId, locale, targetOfferId, readOwnedOffers, attempt]);

  if (load === 'loading') {
    return (
      <Phone>
        <Bar title={t('confirm.cardTitle')} />
        <main className="body" style={{ gap: 14 }} aria-busy="true">
          <span className="vh" role="status">{t('cabinet.loading')}</span>
          <div className="sk" style={{ height: 160, borderRadius: 14 }} />
          <div className="sk" style={{ height: 20, width: '60%' }} />
        </main>
      </Phone>
    );
  }
  if (load === 'anonymous') return <Phone><Bar title={t('confirm.cardTitle')} /><LoginRequired /></Phone>;
  if (load === 'error' || !changeSet) {
    return (
      <Phone>
        <Bar title={t('confirm.cardTitle')} onBack={() => router.push('/seller')} />
        <main className="body" style={{ gap: 14 }}>
          <LoadError title={t('review.loadError')} onRetry={() => { setLoad('loading'); setAttempt((value) => value + 1); }} />
        </main>
        <div className="foot"><Link className="btn btn-g w" href="/seller">{t('confirm.toOffers')}</Link></div>
      </Phone>
    );
  }

  const items = changeSet.items;
  const first = items[0]!;
  const isBatch = items.length > 1;
  const isCreate = !isBatch && first.action === 'create_offer';
  const publishes = !isBatch && (first.action === 'create_offer' || first.action === 'update_offer' || first.action === 'activate_offer');
  const back = safeBack(params.get('back'), '/seller');
  // seller-showcase-editor: the card editor passes the query that reopens it with this proposal's values.
  const reopen = params.get('reopen');
  const cardMode = items.every((item) => (item.action === 'create_offer' || item.action === 'update_offer') && item.cardId === first.cardId)
    && (reopen !== null || !isBatch);
  const editHref = reopen && /^[a-z]+=[0-9a-f-]+$|^new=1$/.test(reopen)
    ? `/seller?${reopen}&from=${changeSetId}`
    : isCreate
    ? `${back}${back.includes('?') ? '&' : '?'}new=1&from=${changeSetId}`
    : isBatch
      ? '/seller/batch'
      : first.action === 'update_offer' && targetOfferId
        ? `${back}${back.includes('?') ? '&' : '?'}edit=${targetOfferId}&from=${changeSetId}`
        : back;
  const current = targetOfferId ? owned?.find((offer) => offer.id === targetOfferId) : undefined;
  // The photo list the card will have after confirm: the proposed one, or the current one when the item keeps it.
  const resultingPhotoIds = (item: SellerChangeSetItemView) => item.photos
    ? item.photos.map((photo) => photo.id)
    : item.action === 'create_offer' ? [] : (current?.photos ?? []).map((photo) => photo.id);
  const withoutPhotos = !isBatch && (first.action === 'create_offer' || first.action === 'update_offer')
    && (first.action === 'create_offer' || first.photos !== undefined || current !== undefined)
    && resultingPhotoIds(first).length === 0;

  // A new card without photos has no photo list in the proposal; an edit without one keeps its photos unchanged.
  const cardPhotoIds = first.photos?.map((photo) => photo.id) ?? (first.action === 'create_offer' ? [] : undefined);
  const cardWithoutPhotos = cardMode && cardPhotoIds !== undefined && cardPhotoIds.length === 0;

  async function confirm() {
    setPhase('confirming');
    try {
      const response = await fetch(`/api/seller/change-sets/${changeSetId}/confirm`, { method: 'POST' });
      const data = await response.json() as ApiResponse;
      if (response.ok && data.changeSet) {
        const resultId = data.changeSet.items[0]?.resultOffer?.id ?? targetOfferId;
        // A card in several points is one publish for the Seller, not a batch.
        const kind = cardMode
          ? (items.every((item) => item.action === 'create_offer') ? 'created' : 'updated')
          : isBatch ? 'batch' : noticeFor[first.action];
        const query = new URLSearchParams({ notice: kind });
        if (resultId && (cardMode || !isBatch)) query.set('offer', resultId);
        // Replace, not push: Back from the list must not reopen an actionable review.
        router.replace(`${back}${back.includes('?') ? '&' : '?'}${query.toString()}`);
        return;
      }
      if (data.error?.code === 'OFFER_CHANGED') {
        setOwned(await readOwnedOffers());
        setPhase('conflict');
        return;
      }
      setFailure(data.error?.code === 'OFFER_PRICE_REQUIRED' ? 'confirm.priceRequiredText' : 'confirm.failedText');
      setPhase('failed');
    } catch {
      setFailure('confirm.failedText');
      setPhase('failed');
    }
  }

  // Re-propose the Seller's own values on top of the current Offer, then review again.
  async function refresh() {
    if (isBatch || !targetOfferId || first.action === 'create_offer') {
      router.replace(isBatch ? '/seller/batch' : back);
      return;
    }
    const body = first.action === 'update_offer'
      ? {
        action: 'update_offer',
        price: { amount: first.price?.amount ?? '', unit: first.price?.unitChoice ?? null },
        sellerComment: first.sellerComment ?? '',
        ...(first.photos ? { photoIds: first.photos.map((photo) => photo.id) } : {}),
      }
      : { action: first.action };
    setPhase('confirming');
    try {
      const response = await fetch(`/api/seller/offers/${targetOfferId}/change-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.changeSet) {
        router.replace(back);
        return;
      }
      const next = new URLSearchParams({ back, offer: targetOfferId });
      router.replace(`/seller/change-sets/${data.changeSet.id}?${next.toString()}`);
    } catch {
      router.replace(back);
    }
  }

  // Confirm · AI off: the frame of every confirm state — back to editing in the bar, the actions in the foot.
  const busy = phase === 'confirming';
  const shell = (title: string, content: React.ReactNode, foot: React.ReactNode) => (
    <Phone>
      <Bar title={title} onBack={() => router.push(editHref)} backLabel={busy ? t('confirm.backDisabled') : t('confirm.backToEdit')} backDisabled={busy} />
      <main className="body" style={{ gap: 14, opacity: busy ? 0.55 : undefined }} aria-busy={busy || undefined}>{content}</main>
      <div className="foot">{foot}</div>
    </Phone>
  );
  const errorBanner = (title: string, text: string) => (
    <div className="banner err" role="alert" style={{ padding: '12px 14px', borderRadius: 14, flexDirection: 'row', gap: 10 }}>
      <Ic name="alert" className="dn" /><div style={{ flex: 1 }}><div className="ts">{title}</div><p className="c c2">{text}</p></div>
    </div>
  );
  const conflictBanner = (title: string, text: string) => (
    <div className="banner warn" role="alert" style={{ padding: '12px 14px', borderRadius: 14, flexDirection: 'row', gap: 10 }}>
      <Ic name="refresh" style={{ color: 'var(--warning)' }} /><div style={{ flex: 1 }}><div className="ts">{title}</div><p className="c c2">{text}</p></div>
    </div>
  );
  const responsibility = (
    <div className="banner info" role="note" style={{ padding: '12px 14px', borderRadius: 14, flexDirection: 'row', gap: 10 }}>
      <Ic name="info" style={{ color: 'var(--info)' }} /><p className="c" style={{ color: 'var(--ink)', flex: 1 }}>{t('confirm.responsibility')}</p>
    </div>
  );
  const noPhotoBanner = (
    <div className="banner gray" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14 }}>
      <Ic name="image" className="c2" />
      <div style={{ flex: 1 }}><div className="ts">{t('confirm.noPhotoTitle')}</div><p className="c c2">{t('confirm.noPhotoText')}</p></div>
      <Link className="btn btn-o sm" href={editHref}>{t('confirm.addPhoto')}</Link>
    </div>
  );
  const backButton = (label: string) => busy
    ? <button type="button" className="btn btn-g w dis" disabled>{label}</button>
    : <Link className="btn btn-g w" href={editHref}>{label}</Link>;

  function describe(item: SellerChangeSetItemView, withOld: boolean) {
    const old = withOld && current && item.action === 'update_offer' ? current : undefined;
    const photoIds = resultingPhotoIds(item);
    const editsCard = item.action === 'create_offer' || item.action === 'update_offer';
    return (
      <div key={item.id} className="card p16" style={{ gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ts" style={{ flex: 1 }}>{item.product.name}</div>
          <span className="bd bd-p">{t(kindKey[item.action])}</span>
        </div>
        <div className="hr" />
        <Kv label={t('confirm.point')} value={item.location.name} />
        <Kv label={t('confirm.price')} value={priceText(item.price) ?? t('review.noPrice')} old={old ? priceText(old.price) : null} />
        {editsCard && <Kv label={t('confirm.comment')} value={item.sellerComment ?? t('confirm.noComment')} old={old ? old.sellerComment ?? t('confirm.noComment') : null} />}
        {editsCard && <Kv label={t('confirm.photos')} value={photoIds.length > 0 ? String(photoIds.length) : t('confirm.noPhotos')} />}
      </div>
    );
  }

  if (changeSet.status === 'confirmed') {
    return (
      <Phone>
        <Bar title={t('confirm.doneTitle')} onBack={() => router.push('/seller')} />
        <main className="body" style={{ gap: 14 }}>{items.map((item) => describe(item, false))}</main>
        <div className="foot"><Link className="btn btn-p lg w" href="/seller">{t('confirm.toOffers')}</Link></div>
      </Phone>
    );
  }

  if (cardMode) {
    const creates = items.filter((item) => item.action === 'create_offer').length;
    const updates = items.length - creates;
    const commonItem = items.find((item) => !item.priceOwn) ?? first;
    const amount = (value: string) => `${formatAmount(value)} ₸`;
    const title = updates > 0 ? t('confirm.changesTitle') : t('confirm.cardTitle');
    const previous = commonItem.previousPriceAmount && commonItem.price && Number(commonItem.previousPriceAmount) !== Number(commonItem.price.amount)
      ? commonItem.previousPriceAmount : null;
    const countText = updates === 0
      ? t(pluralKey('confirm.willPublish', creates), { count: creates })
      : `${t(pluralKey('card.willChange', updates), { count: updates })}${creates > 0 ? ` · ${t(pluralKey('card.willCreate', creates), { count: creates })}` : ''}`;
    const coverId = (cardPhotoIds ?? current?.photos?.map((photo) => photo.id) ?? [])[0];
    const head = (
      <div style={{ display: 'flex', gap: 12 }}>
        <Thumb photoUrl={coverId ? photoUrl(coverId, 'thumb') : null} size={72} radius={12} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="ts">{first.product.name}</div>
          {first.packLabel && phase === 'pending' && <p className="c c2">{first.packLabel}</p>}
          {commonItem.price && <div><span className="pr">{amount(commonItem.price.amount)}</span>{commonItem.price.unit && <> <span className="c2">/ {commonItem.price.unit}</span></>}</div>}
          {previous && phase === 'pending' && <p className="c num">{t('card.pricePrevious', { price: amount(previous) }).toLowerCase()}</p>}
        </div>
      </div>
    );

    if (phase === 'conflict') {
      const mine = commonItem.price ? amount(commonItem.price.amount) : t('review.noPrice');
      const live = owned?.find((offer) => offer.cardId === commonItem.cardId && offer.location.id === commonItem.location.id);
      const now = live?.price ? amount(live.price.amount) : null;
      return shell(title, (
        <>
          {conflictBanner(t('card.changedElsewhere'), now ? t('confirm.conflictPrice', { now, mine }) : t('confirm.conflictText'))}
          {now && <Kv label={t('confirm.nowOnShowcase')} value={now} />}
          <Kv label={t('confirm.yourEdit')} value={mine} />
        </>
      ), (
        <>
          <Link className="btn btn-p lg w" href={editHref} replace><Ic name="refresh" className="sm" />{t('card.reload')}</Link>
          {backButton(t('confirm.backToEdit'))}
        </>
      ));
    }

    const single = items.length === 1 && updates === 0;
    return shell(title, (
      <>
        {phase === 'failed' && errorBanner(t('confirm.failedTitle'), t('card.sendErrorText'))}
        {cardWithoutPhotos && phase === 'pending' && noPhotoBanner}
        <div className="card p16" style={{ gap: 10 }}>
          {head}
          {phase === 'pending' && (
            <>
              <div className="hr" />
              {single ? <Kv label={t('confirm.point')} value={first.location.name} /> : items.map((item) => {
                const now = item.price?.amount ?? '';
                const before = item.previousPriceAmount;
                const value = before && Number(before) !== Number(now) ? `${formatAmount(before)} → ${formatAmount(now)}` : amount(now);
                return <Kv key={item.id} label={item.location.name} value={`${value}${item.priceOwn ? ` · ${t('cardScreen.own')}` : ''}`} />;
              })}
              {cardPhotoIds !== undefined && <Kv label={t('confirm.photos')} value={cardPhotoIds.length > 0 ? String(cardPhotoIds.length) : t('confirm.noPhotos')} />}
              {cardPhotoIds !== undefined && first.sellerComment && <Kv label={t('confirm.comment')} value={first.sellerComment} />}
            </>
          )}
        </div>
        {phase !== 'failed' && (
          busy
            ? <p className="t">{countText}</p>
            : <p className="t" style={{ fontWeight: 500 }}><Ic name="layers" className="sm" style={{ verticalAlign: -4 }} /> {countText}</p>
        )}
        {!busy && responsibility}
      </>
    ), (
      <>
        <button type="button" className="btn btn-p lg w" onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
          {busy && <span className="spin" />}
          {phase === 'failed' && <Ic name="refresh" className="sm" />}
          {phase === 'failed' ? t('cabinet.retry') : busy ? t('confirm.publishing') : cardWithoutPhotos ? t('confirm.publishWithoutPhoto') : t('confirm.publishCard')}
        </button>
        {backButton(t('confirm.backToEdit'))}
      </>
    ));
  }

  const primaryLabel = phase === 'failed'
    ? t('cabinet.retry')
    : busy ? (publishes ? t('confirm.publishing') : t('confirm.confirming'))
      : withoutPhotos ? t('confirm.publishWithoutPhoto')
        : publishes ? t('confirm.publish') : t('confirm.confirm');
  const secondary = isCreate || first.action === 'update_offer' ? t('confirm.backToEdit') : t('confirm.cancel');

  if (phase === 'conflict') {
    return shell(t('confirm.title'), (
      <>
        {conflictBanner(t('confirm.conflictTitle'), t('confirm.conflictText'))}
        {items.map((item) => {
          const now = current;
          const showsStatus = item.action === 'activate_offer' || item.action === 'deactivate_offer';
          const mine = showsStatus
            ? t(item.action === 'activate_offer' ? 'offers.statusActive' : 'offers.statusInactive')
            : `${priceText(item.price) ?? t('review.noPrice')} · ${item.sellerComment ?? t('confirm.noComment')}`;
          const theirs = now
            ? showsStatus
              ? t(now.status === 'active' ? 'offers.statusActive' : 'offers.statusInactive')
              : `${priceText(now.price) ?? t('review.noPrice')} · ${now.sellerComment ?? t('confirm.noComment')}`
            : null;
          return (
            <div key={item.id} className="card p16" style={{ gap: 10 }}>
              <div className="ts">{t(kindKey[item.action])} · {item.product.name}</div>
              {theirs && <Kv label={t('confirm.current')} value={theirs} />}
              <Kv label={t('confirm.yours')} value={mine} />
            </div>
          );
        })}
      </>
    ), (
      <>
        <button type="button" className="btn btn-p lg w" onClick={() => void refresh()} disabled={busy}><Ic name="refresh" className="sm" />{t('confirm.refresh')}</button>
        <button type="button" className="btn btn-g w" onClick={() => router.replace(back)} disabled={busy}>{t('confirm.cancel')}</button>
      </>
    ));
  }

  return shell(t('confirm.title'), (
    <>
      {phase === 'failed' && errorBanner(t('confirm.failedTitle'), t(failure))}
      {withoutPhotos && phase === 'pending' && noPhotoBanner}
      {items.map((item) => describe(item, true))}
      <p className="t" style={{ fontWeight: 500 }}><Ic name="layers" className="sm" style={{ verticalAlign: -4 }} /> {t('confirm.count', { count: items.length })}</p>
      <p className="c c2">{t('confirm.hint')}</p>
    </>
  ), (
    <>
      <button type="button" className="btn btn-p lg w" onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
        {busy && <span className="spin" />}
        {phase === 'failed' && <Ic name="refresh" className="sm" />}{primaryLabel}
      </button>
      {backButton(secondary)}
    </>
  ));
}
