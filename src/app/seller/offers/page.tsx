import { Suspense } from 'react';
import { AppHeader } from '../../_components/AppHeader';
import { SellerCabinetFrame } from '../_components/SellerCabinetFrame';
import { SellerOffersList } from '../_components/SellerOffersList';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';
import { isSellerCommentTranslationEnabled } from '@/modules/offers/translation/seller-comment-translation.config';

export default async function Page() {
  const locale = await getRequestLocale();
  return (
    <>
      <AppHeader showAuth={false} contextLabel={messages[locale]['context.seller']} />
      <SellerCabinetFrame active="offers">
        <Suspense><SellerOffersList commentTranslationEnabled={isSellerCommentTranslationEnabled()} /></Suspense>
      </SellerCabinetFrame>
    </>
  );
}
