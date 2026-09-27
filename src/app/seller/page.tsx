import { Suspense } from 'react';
import { AppHeader } from '../_components/AppHeader';
import { SellerCabinetFrame } from './_components/SellerCabinetFrame';
import { SellerShowcase } from './_components/SellerShowcase';
import { isSellerCommentTranslationEnabled } from '@/modules/offers/translation/seller-comment-translation.config';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

export default async function Page() {
  const locale = await getRequestLocale();
  return (
    <>
      <AppHeader showAuth={false} contextLabel={messages[locale]['context.seller']} />
      <SellerCabinetFrame active="showcase">
        <Suspense><SellerShowcase commentTranslationEnabled={isSellerCommentTranslationEnabled()} /></Suspense>
      </SellerCabinetFrame>
    </>
  );
}
