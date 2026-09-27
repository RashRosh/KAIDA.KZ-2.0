import { Suspense } from 'react';
import { AppHeader } from '../../../_components/AppHeader';
import { SellerCabinetFrame } from '../../_components/SellerCabinetFrame';
import { SellerConfirmChange } from './_components/SellerConfirmChange';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getRequestLocale();
  return (
    <>
      <AppHeader showAuth={false} contextLabel={messages[locale]['context.seller']} />
      <SellerCabinetFrame active="showcase" mobileNav={false}>
        <Suspense><SellerConfirmChange changeSetId={id} /></Suspense>
      </SellerCabinetFrame>
    </>
  );
}
