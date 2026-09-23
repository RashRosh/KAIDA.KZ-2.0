import { Suspense } from 'react';
import { AppHeader } from '../../../_components/AppHeader';
import { SellerCabinetFrame } from '../../_components/SellerCabinetFrame';
import { SellerSetup } from '../../_components/SellerSetup';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';
import { isSellerCommentTranslationEnabled } from '@/modules/offers/translation/seller-comment-translation.config';

export default async function Page() {
  const locale = await getRequestLocale();
  return (
    <>
      <AppHeader showAuth={false} contextLabel={messages[locale]['context.seller']} />
      <SellerCabinetFrame active="offers">
        <Suspense><SellerSetup commentTranslationEnabled={isSellerCommentTranslationEnabled()} /></Suspense>
      </SellerCabinetFrame>
    </>
  );
}
