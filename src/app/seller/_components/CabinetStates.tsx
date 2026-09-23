'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import styles from '../cabinet.module.css';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { CabinetIcon } from './SellerCabinetFrame';

export function CabinetLoginRequired({ help = 'seller.loginHelp' }: { help?: MessageKey }) {
  const { t } = useI18n();
  return (
    <section className={styles.panel} aria-labelledby="cabinet-login-required">
      <p className={styles.eyebrowMuted}>{t('cabinet.title')}</p>
      <h1 id="cabinet-login-required" className={styles.title}>{t('seller.loginRequired')}</h1>
      <p className={styles.lead}>{t(help)}</p>
      <Link className={styles.primary} href="/login">{t('auth.signIn')}</Link>
    </section>
  );
}

// Local block error (DESIGN_SYSTEM.md §7.1): what failed and what to do; nothing technical.
export function CabinetLoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <section className={`${styles.panel} ${styles.errorBlock}`} role="alert">
      <h2>{title}</h2>
      <p>{t('cabinet.unchanged')}</p>
      <button type="button" className={styles.secondary} onClick={onRetry}><CabinetIcon name="retry" />{t('cabinet.retry')}</button>
    </section>
  );
}

export function CabinetSkeleton({ rows }: { rows: number }) {
  const { t } = useI18n();
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className={styles.srOnly} role="status">{t('cabinet.loading')}</span>
      {Array.from({ length: rows }, (_, index) => <div key={index} className={styles.skeletonBlock} />)}
    </div>
  );
}

const noticeKinds = ['created', 'updated', 'enabled', 'disabled', 'batch'] as const;
type NoticeKind = typeof noticeKinds[number];

function noticeText(kind: NoticeKind, offer: SellerOfferView | undefined): MessageKey {
  if (kind === 'created') return offer?.buyerVisible ? 'notice.createdVisible' : 'notice.created';
  if (kind === 'enabled') return offer?.buyerVisible ? 'notice.enabledVisible' : 'notice.enabled';
  if (kind === 'disabled') return 'notice.disabled';
  if (kind === 'updated') return 'notice.updated';
  return 'notice.batch';
}

export function useConfirmedNotice() {
  const params = useSearchParams();
  const kind = params.get('notice');
  return {
    kind: (noticeKinds as readonly string[]).includes(kind ?? '') ? kind as NoticeKind : null,
    offerId: params.get('offer'),
  };
}

// Success message after the confirmation page replaced itself with this surface. The text is chosen from the
// canonical Offer state just read from the server, so "видно покупателям" is never claimed when it is not true.
export function CabinetNotice({ offers }: { offers: SellerOfferView[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { kind, offerId } = useConfirmedNotice();
  // Rendered only once the Offers are loaded, so the first render already knows the canonical state.
  const [message, setMessage] = useState<string | null>(
    () => kind ? t(noticeText(kind, offers.find((offer) => offer.id === offerId))) : null,
  );

  useEffect(() => {
    if (!kind) return;
    const rest = new URLSearchParams(params);
    rest.delete('notice');
    rest.delete('offer');
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [kind, params, pathname, router]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return <p className={styles.toast} role="status"><CabinetIcon name="check" />{message}</p>;
}
