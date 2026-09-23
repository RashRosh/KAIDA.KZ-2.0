'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SellerOfferView } from '@/modules/offers/contracts/seller-offer.contract';
import type { SellerView } from '@/modules/sellers/contracts/seller.contract';
import { formatAmount } from '../../_components/OfferCard';
import type { Locale } from '../../../i18n/config';
import type { MessageKey } from '../../../i18n/messages';

export type CabinetData =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'error' }
  | { kind: 'ready'; seller: SellerView | null; offers: SellerOfferView[] };

// One read of the Seller and their Offers for the overview and the list; counts are derived on the client.
export function useCabinetData(locale: Locale) {
  const [data, setData] = useState<CabinetData>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const sellerResponse = await fetch(`/api/seller/me?locale=${locale}`, { cache: 'no-store' });
        if (!alive) return;
        if (sellerResponse.status === 401) {
          setData({ kind: 'anonymous' });
          return;
        }
        if (!sellerResponse.ok) throw new Error('seller');
        const { seller } = await sellerResponse.json() as { seller: SellerView | null };
        if (!seller) {
          if (alive) setData({ kind: 'ready', seller: null, offers: [] });
          return;
        }
        const offersResponse = await fetch(`/api/seller/offers?locale=${locale}`, { cache: 'no-store' });
        if (!offersResponse.ok) throw new Error('offers');
        const { offers } = await offersResponse.json() as { offers: SellerOfferView[] };
        if (alive) setData({ kind: 'ready', seller, offers });
      } catch {
        if (alive) setData({ kind: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [locale, attempt]);

  const retry = useCallback(() => {
    setData({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { data, retry };
}

export function formatOfferPrice(price: SellerOfferView['price']) {
  if (!price) return null;
  return { amount: `${formatAmount(price.amount)} ₸`, unit: price.unit };
}

export function formatConfirmed(
  iso: string,
  locale: Locale,
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
  now: Date = new Date(),
) {
  const date = new Date(iso);
  if (now.getTime() - date.getTime() < 2 * 60 * 1000) return t('offers.confirmedNow');
  const intlLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU';
  if (date.toDateString() === now.toDateString()) {
    return t('offers.confirmedToday', { time: date.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' }) });
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return t('offers.confirmedOn', {
    date: date.toLocaleDateString(intlLocale, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }),
  });
}

export function byMostRecentlyConfirmed(a: SellerOfferView, b: SellerOfferView) {
  return b.lastConfirmedAt.localeCompare(a.lastConfirmedAt);
}
