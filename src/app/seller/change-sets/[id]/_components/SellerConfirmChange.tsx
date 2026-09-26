'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetItemView, SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../../../cabinet.module.css';
import { useI18n } from '../../../../../i18n/I18nProvider';
import type { MessageKey } from '../../../../../i18n/messages';
import { CabinetIcon } from '../../../_components/SellerCabinetFrame';
import { CabinetLoadError, CabinetLoginRequired, CabinetSkeleton } from '../../../_components/CabinetStates';
import { formatOfferPrice } from '../../../_components/cabinet-data';
import { photoUrl } from '../../../../../modules/media/contracts/photo.contract';

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

function PhotosRow({ label, photoIds, text }: { label: string; photoIds: string[]; text: string }) {
  return (
    <div className={styles.summaryRow}>
      <dt>{label}</dt>
      <dd className={styles.photosValue}>
        {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo route */}
        {photoIds[0] && <img src={photoUrl(photoIds[0], 'thumb')} alt="" className={styles.coverThumb} />}
        <span>{text}</span>
      </dd>
    </div>
  );
}

function Row({ label, value, old }: { label: string; value: string; old?: string | null }) {
  return (
    <div className={styles.summaryRow}>
      <dt>{label}</dt>
      <dd>{old && old !== value && <><span className={styles.oldValue}>{old}</span> → </>}<span>{value}</span></dd>
    </div>
  );
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

  if (load === 'loading') return <CabinetSkeleton rows={2} />;
  if (load === 'anonymous') return <CabinetLoginRequired help="review.loginHelp" />;
  if (load === 'error' || !changeSet) {
    return (
      <>
        <CabinetLoadError title={t('review.loadError')} onRetry={() => { setLoad('loading'); setAttempt((value) => value + 1); }} />
        <Link className={styles.textLink} href="/seller/offers">{t('confirm.toOffers')}</Link>
      </>
    );
  }

  const items = changeSet.items;
  const first = items[0]!;
  const isBatch = items.length > 1;
  const isCreate = !isBatch && first.action === 'create_offer';
  const publishes = !isBatch && (first.action === 'create_offer' || first.action === 'update_offer' || first.action === 'activate_offer');
  const back = safeBack(params.get('back'), isBatch ? '/seller/offers' : isCreate ? '/seller' : '/seller/offers');
  const editHref = isCreate
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

  async function confirm() {
    setPhase('confirming');
    try {
      const response = await fetch(`/api/seller/change-sets/${changeSetId}/confirm`, { method: 'POST' });
      const data = await response.json() as ApiResponse;
      if (response.ok && data.changeSet) {
        const resultId = data.changeSet.items[0]?.resultOffer?.id ?? targetOfferId;
        const query = new URLSearchParams({ notice: isBatch ? 'batch' : noticeFor[first.action] });
        if (resultId && !isBatch) query.set('offer', resultId);
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

  function describe(item: SellerChangeSetItemView, withOld: boolean) {
    const old = withOld && current && item.action === 'update_offer' ? current : undefined;
    return (
      <dl className={styles.summaryRows}>
        <Row label={t('confirm.product')} value={item.product.name} />
        <Row label={t('confirm.point')} value={item.location.name} />
        <Row label={t('confirm.price')} value={priceText(item.price) ?? t('review.noPrice')} old={old ? priceText(old.price) : null} />
        {(item.action === 'create_offer' || item.action === 'update_offer') && (
          <Row label={t('confirm.comment')} value={item.sellerComment ?? t('confirm.noComment')} old={old ? old.sellerComment ?? t('confirm.noComment') : null} />
        )}
        {(item.action === 'create_offer' || item.action === 'update_offer') && (() => {
          const photoIds = resultingPhotoIds(item);
          return (
            <PhotosRow
              label={t('confirm.photos')}
              photoIds={photoIds}
              text={photoIds.length > 0 ? t('confirm.photosCount', { count: photoIds.length }) : t('confirm.noPhotos')}
            />
          );
        })()}
      </dl>
    );
  }

  if (changeSet.status === 'confirmed') {
    return (
      <section aria-labelledby="confirm-heading">
        <h1 id="confirm-heading" className={styles.title}>{t('confirm.doneTitle')}</h1>
        <div className={`${styles.panel} ${styles.spaceTop}`}>
          {items.map((item) => (
            <div key={item.id} className={styles.itemBlock}>
              <span className={styles.badge}>{t(kindKey[item.action])}</span>
              {describe(item, false)}
            </div>
          ))}
        </div>
        <Link className={styles.textLink} href="/seller/offers">{t('confirm.toOffers')}</Link>
      </section>
    );
  }

  const busy = phase === 'confirming';
  const primaryLabel = phase === 'failed'
    ? t('cabinet.retry')
    : busy ? (publishes ? t('confirm.publishing') : t('confirm.confirming'))
      : withoutPhotos ? t('confirm.publishWithoutPhoto')
        : publishes ? t('confirm.publish') : t('confirm.confirm');

  return (
    <section aria-labelledby="confirm-heading">
      {phase !== 'conflict' && (
        <Link className={`${styles.textLink} ${styles.backLink}`} href={editHref}><CabinetIcon name="back" />{isCreate || first.action === 'update_offer' ? t('confirm.backToEdit') : t('confirm.cancel')}</Link>
      )}
      <h1 id="confirm-heading" className={styles.title}>{t('confirm.title')}</h1>
      <p className={styles.lead}>{t('confirm.hint')}</p>
      <div className={styles.confirmLayout}>
        <div>
          {phase === 'failed' && (
            <div className={styles.notice} role="alert">
              <CabinetIcon name="alert" />
              <div><strong>{t('confirm.failedTitle')}</strong><p>{t(failure)}</p></div>
            </div>
          )}
          {phase === 'conflict' && (
            <div className={styles.notice} role="alert">
              <CabinetIcon name="alert" />
              <div><strong>{t('confirm.conflictTitle')}</strong><p>{t('confirm.conflictText')}</p></div>
            </div>
          )}
          {withoutPhotos && phase === 'pending' && (
            <div className={styles.infoNotice}>
              <CabinetIcon name="alert" />
              <div>
                <strong>{t('confirm.noPhotoTitle')}</strong>
                <p>{t('confirm.noPhotoText')}</p>
                <Link className={styles.textLink} href={editHref}>{t('confirm.addPhoto')}</Link>
              </div>
            </div>
          )}
          <div className={phase === 'failed' || phase === 'conflict' || (withoutPhotos && phase === 'pending') ? `${styles.panel} ${styles.spaceTop}` : styles.panel}>
            {phase === 'conflict' ? items.map((item) => {
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
                <div key={item.id} className={styles.itemBlock}>
                  <span className={styles.badge}>{t(kindKey[item.action])} · {item.product.name}</span>
                  <dl className={styles.summaryRows}>
                    {theirs && <Row label={t('confirm.current')} value={theirs} />}
                    <Row label={t('confirm.yours')} value={mine} />
                  </dl>
                </div>
              );
            }) : items.map((item) => (
              <div key={item.id} className={styles.itemBlock}>
                <span className={styles.badge}>{t(kindKey[item.action])}</span>
                {describe(item, true)}
              </div>
            ))}
          </div>
        </div>
        <aside className={styles.confirmBar} aria-label={t('confirm.title')}>
          <h2>{t('confirm.count', { count: items.length })}</h2>
          <p>{t('confirm.hint')}</p>
          {phase === 'conflict' ? (
            <>
              <button type="button" className={`${styles.primary} ${styles.large}`} onClick={() => void refresh()} disabled={busy}><CabinetIcon name="retry" />{t('confirm.refresh')}</button>
              <button type="button" className={styles.secondary} onClick={() => router.replace(back)} disabled={busy}>{t('confirm.cancel')}</button>
            </>
          ) : (
            <>
              <button type="button" className={`${styles.primary} ${styles.large}`} onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
                {phase === 'failed' && <CabinetIcon name="retry" />}{primaryLabel}
              </button>
              <Link className={styles.secondary} href={editHref}>{isCreate || first.action === 'update_offer' ? t('confirm.backToEdit') : t('confirm.cancel')}</Link>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
