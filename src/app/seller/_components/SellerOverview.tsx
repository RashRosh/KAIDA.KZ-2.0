'use client';

import Link from 'next/link';
import styles from '../cabinet.module.css';
import { useI18n } from '../../../i18n/I18nProvider';
import { CabinetIcon } from './SellerCabinetFrame';
import { CabinetLoginRequired, CabinetLoadError, CabinetSkeleton, CabinetNotice } from './CabinetStates';
import { byMostRecentlyConfirmed, formatConfirmed, useCabinetData } from './cabinet-data';
import { OfferEditorHost, useEditorHrefs } from './OfferEditorHost';

export function SellerOverview({ commentTranslationEnabled = false }: { commentTranslationEnabled?: boolean }) {
  const { locale, t } = useI18n();
  const { data, retry } = useCabinetData(locale);
  const { createHref } = useEditorHrefs();

  if (data.kind === 'loading') {
    return (
      <>
        <div className={styles.pageHead}><h1>{t('cabinet.overview')}</h1></div>
        <CabinetSkeleton rows={3} />
      </>
    );
  }
  if (data.kind === 'anonymous') return <CabinetLoginRequired />;
  if (data.kind === 'error') {
    return (
      <>
        <div className={styles.pageHead}><h1>{t('cabinet.overview')}</h1></div>
        <CabinetLoadError title={t('overview.loadError')} onRetry={retry} />
      </>
    );
  }

  const { seller, offers } = data;
  const editor = <OfferEditorHost seller={seller} offers={offers} commentTranslationEnabled={commentTranslationEnabled} />;
  if (!seller || offers.length === 0) {
    return (
      <section aria-labelledby="overview-first-run">
        <p className={styles.eyebrowMuted}>{t('cabinet.title')}</p>
        <h1 id="overview-first-run" className={styles.title}>{t('overview.firstRunTitle')}</h1>
        <p className={styles.lead}>{t('overview.firstRunText')}</p>
        <Link className={`${styles.primary} ${styles.large}`} href={createHref} scroll={false}>
          <CabinetIcon name="plus" />{t('seller.addProduct')}
        </Link>
        <CabinetNotice offers={offers} />
        {editor}
      </section>
    );
  }

  const active = offers.filter((offer) => offer.status === 'active').length;
  const inactive = offers.length - active;
  const recent = [...offers].sort(byMostRecentlyConfirmed).slice(0, 3);

  return (
    <>
      <div className={styles.pageHead}>
        <h1>{t('cabinet.overview')}</h1>
        <Link className={styles.secondary} href={createHref} scroll={false}><CabinetIcon name="plus" />{t('seller.addProduct')}</Link>
      </div>
      <ul className={styles.stats} aria-label={t('overview.summary')}>
        <li className={styles.stat}><strong>{seller.locations.length}</strong><span>{t('overview.points')}</span></li>
        <li className={styles.stat}><strong>{active}</strong><span>{t('overview.active')}</span></li>
        <li className={styles.stat}><strong>{inactive}</strong><span>{t('overview.inactive')}</span></li>
      </ul>
      <div className={styles.overviewGrid}>
        <section className={styles.panel} aria-labelledby="overview-recent">
          <h2 id="overview-recent">{t('overview.recent')}</h2>
          <ul className={styles.recentList}>
            {recent.map((offer) => (
              <li key={offer.id}>
                <span lang={offer.product.nameLocale}>{offer.product.name}</span>
                <span className={styles.recentMeta}>
                  {offer.status === 'active' ? formatConfirmed(offer.lastConfirmedAt, locale, t) : t('offers.statusInactive')}
                </span>
              </li>
            ))}
          </ul>
          <Link className={styles.textLink} href="/seller/offers">{t('overview.allOffers')}</Link>
        </section>
      </div>
      <CabinetNotice offers={offers} />
      {editor}
    </>
  );
}
