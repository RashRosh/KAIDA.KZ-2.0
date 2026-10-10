import { z } from 'zod';
import { getRequestLocale } from '@/i18n/server';
import { getBuyerOffer, type BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { BuyerOfferView, OfferUnavailable } from './BuyerOfferView';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';

export const dynamic = 'force-dynamic';

// Buyer Offer page (offer-photos contract §2): the same eligibility as Search, never a hidden Offer; B02 layout.
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
  return offer ? <BuyerOfferView offer={offer} reporting={reportsEnabled()} /> : <OfferUnavailable failed={failed} />;
}
