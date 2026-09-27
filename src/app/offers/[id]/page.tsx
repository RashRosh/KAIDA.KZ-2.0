import { z } from 'zod';
import { AppHeader } from '../../_components/AppHeader';
import styles from '../../page.module.css';
import { getRequestLocale } from '@/i18n/server';
import { getBuyerOffer, type BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { BuyerOfferView, OfferUnavailable } from './BuyerOfferView';

export const dynamic = 'force-dynamic';

// Buyer Offer page (offer-photos contract §2): the same eligibility as Search, never a hidden Offer.
export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getRequestLocale();
  let offer: BuyerOfferPage | null = null;
  let failed = false;
  if (z.uuid().safeParse(id).success) {
    try {
      offer = await getBuyerOffer(id, { locale });
    } catch {
      console.error('Buyer Offer page read failed');
      failed = true;
    }
  }

  return (
    <>
      <AppHeader />
      <div className={styles.shell}>
        <main className={styles.main}>
          {offer ? <BuyerOfferView offer={offer} /> : <OfferUnavailable failed={failed} />}
        </main>
      </div>
    </>
  );
}
