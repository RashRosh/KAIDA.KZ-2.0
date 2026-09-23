'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetView } from '@/modules/seller-input/contracts/seller-change-set.contract';
import styles from '../cabinet.module.css';
import legacy from '../page.module.css';
import { useI18n } from '../../../i18n/I18nProvider';
import { CabinetIcon } from './SellerCabinetFrame';
import { CabinetLoadError, CabinetLoginRequired, CabinetNotice, CabinetSkeleton, useConfirmedNotice } from './CabinetStates';
import { CommentTranslationAssist } from './CommentTranslationAssist';
import { formatConfirmed, formatOfferPrice, useCabinetData } from './cabinet-data';

type Filter = 'all' | 'active' | 'inactive';
type ChangeResponse = { changeSet?: SellerChangeSetView };

function parseFilter(value: string | null): Filter {
  return value === 'active' || value === 'inactive' ? value : 'all';
}

// Small action menu; focus moves in once on open and back to the trigger on close (DESIGN_SYSTEM.md §13.1).
function ActionMenu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.iconButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <CabinetIcon name="dots" />
      </button>
      {open && <div className={styles.menu} role="menu" aria-label={label}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function EditForm({ offer, submitting, translationEnabled, onSubmit, onCancel }: {
  offer: SellerOfferView;
  submitting: boolean;
  translationEnabled: boolean;
  onSubmit: (values: { amount: string; unit: string; comment: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(offer.price?.amount ?? '');
  const [unit, setUnit] = useState(offer.price?.unit ?? '');
  const [comment, setComment] = useState(offer.sellerComment ?? '');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (amount.trim() === '') {
      setError(t('offerCreate.priceRequired'));
      return;
    }
    setError('');
    onSubmit({ amount: amount.trim(), unit, comment });
  }

  return (
    <form className={legacy.inlineForm} onSubmit={submit} noValidate>
      <label htmlFor={`offer-price-${offer.id}`}>{t('offerCreate.price')}</label>
      <input id={`offer-price-${offer.id}`} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={submitting} placeholder={t('offerCreate.required')} aria-required="true" />
      <label htmlFor={`offer-unit-${offer.id}`}>{t('offerCreate.unit')}</label>
      <input id={`offer-unit-${offer.id}`} value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={32} disabled={submitting || amount.trim() === ''} placeholder={t('offerCreate.unitExample')} />
      <label htmlFor={`offer-comment-${offer.id}`}>{t('offerCreate.comment')}</label>
      <textarea id={`offer-comment-${offer.id}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} disabled={submitting} placeholder={t('batch.noComment')} />
      <CommentTranslationAssist enabled={translationEnabled} comment={comment} />
      {error && <p className={legacy.error} role="alert">{error}</p>}
      <div className={legacy.actions}>
        <button type="submit" disabled={submitting}>{submitting ? t('offerCreate.creating') : t('offerManage.review')}</button>
        <button type="button" className={legacy.secondaryButton} onClick={onCancel} disabled={submitting}>{t('offerManage.cancel')}</button>
      </div>
    </form>
  );
}

export function SellerOffersList({ commentTranslationEnabled = false }: { commentTranslationEnabled?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseFilter(params.get('status'));
  const { data, retry } = useCabinetData(locale);
  const { offerId: noticeOfferId } = useConfirmedNotice();
  const [highlightId] = useState(noticeOfferId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const filterHref = (value: Filter) => (value === 'all' ? pathname : `${pathname}?status=${value}`);
  const returnPath = filter === 'all' ? '/seller/offers' : `/seller/offers?status=${filter}`;

  async function propose(offerId: string, body: unknown) {
    setActionError('');
    setSubmittingId(offerId);
    try {
      const response = await fetch(`/api/seller/offers/${offerId}/change-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json() as ChangeResponse;
      if (!response.ok || !result.changeSet) {
        setActionError(t('offers.actionError'));
        return;
      }
      const next = new URLSearchParams({ back: returnPath, offer: offerId });
      router.push(`/seller/change-sets/${result.changeSet.id}?${next.toString()}`);
    } catch {
      setActionError(t('offers.actionError'));
    } finally {
      setSubmittingId(null);
    }
  }

  const header = (
    <div className={styles.pageHead}>
      <h1>{t('cabinet.offers')}</h1>
      <div className={styles.cardActions}>
        <Link className={styles.primary} href="/seller/offers/new"><CabinetIcon name="plus" />{t('seller.addProduct')}</Link>
        <ActionMenu label={t('offers.moreActions')}>
          {(close) => <Link className={styles.menuItem} role="menuitem" href="/seller/batch" onClick={close}>{t('seller.batchLink')}</Link>}
        </ActionMenu>
      </div>
    </div>
  );

  if (data.kind === 'loading') return <>{header}<CabinetSkeleton rows={3} /></>;
  if (data.kind === 'anonymous') return <CabinetLoginRequired />;
  if (data.kind === 'error') return <>{header}<CabinetLoadError title={t('offers.loadError')} onRetry={retry} /></>;

  const offers = data.offers;
  if (offers.length === 0) {
    return (
      <>
        {header}
        <section className={styles.panel} aria-labelledby="offers-empty">
          <h2 id="offers-empty">{t('offers.emptyTitle')}</h2>
          <p className={styles.lead}>{t('offers.emptyText')}</p>
          <Link className={styles.primary} href="/seller/offers/new"><CabinetIcon name="plus" />{t('seller.addProduct')}</Link>
        </section>
      </>
    );
  }

  const counts = {
    all: offers.length,
    active: offers.filter((offer) => offer.status === 'active').length,
    inactive: offers.filter((offer) => offer.status === 'inactive').length,
  };
  const visible = filter === 'all' ? offers : offers.filter((offer) => offer.status === filter);

  return (
    <>
      {header}
      <ul className={styles.filters} aria-label={t('cabinet.offers')}>
        {([['all', 'offers.filterAll'], ['active', 'offers.filterActive'], ['inactive', 'offers.filterInactive']] as const).map(([value, key]) => (
          <li key={value}>
            <Link className={styles.filter} href={filterHref(value)} aria-current={filter === value ? 'true' : undefined} scroll={false}>
              {t(key, { count: counts[value] })}
            </Link>
          </li>
        ))}
      </ul>
      {actionError && <p className={legacy.error} role="alert">{actionError}</p>}
      {visible.length === 0 && <p className={styles.lead}>{t('offers.filterEmpty')}</p>}
      <ul className={styles.offerList}>
        {visible.map((offer) => {
          const price = formatOfferPrice(offer.price);
          const isActive = offer.status === 'active';
          const submitting = submittingId === offer.id;
          const editing = editingId === offer.id;
          const canEnable = offer.price !== null;
          return (
            <li key={offer.id}>
              <article className={styles.offerCard} data-highlight={highlightId === offer.id ? 'true' : undefined} aria-labelledby={`offer-${offer.id}`} data-testid={`seller-offer-${offer.id}`}>
                <span className={styles.badge}>
                  <CabinetIcon name={isActive ? 'check' : 'pause'} />
                  {isActive ? t('offers.statusActive') : t('offers.statusInactive')}
                </span>
                <div className={styles.offerTop}>
                  <h2 id={`offer-${offer.id}`} lang={offer.product.nameLocale}>{offer.product.name}</h2>
                  <span className={styles.offerPrice}>
                    {price ? <>{price.amount}{price.unit && <span className={styles.offerUnit}> / {price.unit}</span>}</> : t('offerManage.priceRequired')}
                  </span>
                </div>
                <p className={styles.offerMeta}>{offer.location.name} · {offer.buyerVisible ? t('offers.visible') : t('offers.hidden')}</p>
                <p className={styles.offerTime}><CabinetIcon name="clock" />{formatConfirmed(offer.lastConfirmedAt, locale, t)}</p>
                {!editing && (
                  <div className={styles.cardActions}>
                    {isActive || !canEnable ? (
                      <button type="button" className={styles.secondary} onClick={() => setEditingId(offer.id)} disabled={submitting}>{t('offerManage.edit')}</button>
                    ) : (
                      <button type="button" className={styles.secondary} onClick={() => void propose(offer.id, { action: 'activate_offer' })} disabled={submitting}>
                        {submitting ? t('offerCreate.creating') : t('offerManage.enable')}
                      </button>
                    )}
                    <ActionMenu label={t('offers.moreActionsFor', { name: offer.product.name })}>
                      {(close) => isActive ? (
                        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(); void propose(offer.id, { action: 'deactivate_offer' }); }}>{t('offerManage.disable')}</button>
                      ) : canEnable ? (
                        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(); setEditingId(offer.id); }}>{t('offerManage.edit')}</button>
                      ) : (
                        <button type="button" role="menuitem" className={styles.menuItem} disabled>{t('offerManage.priceFirst')}</button>
                      )}
                    </ActionMenu>
                  </div>
                )}
                {editing && (
                  <EditForm
                    offer={offer}
                    submitting={submitting}
                    translationEnabled={commentTranslationEnabled}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => void propose(offer.id, {
                      action: 'update_offer',
                      price: { amount: values.amount, unit: values.unit },
                      sellerComment: values.comment,
                    })}
                  />
                )}
              </article>
            </li>
          );
        })}
      </ul>
      <CabinetNotice offers={offers} />
    </>
  );
}
