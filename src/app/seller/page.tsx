import { connection } from 'next/server';
import { Suspense } from 'react';
import { SellerShowcase } from './_components/SellerShowcase';
import { isSellerCommentTranslationEnabled } from '@/modules/offers/translation/seller-comment-translation.config';

export default async function Page() {
  // The translation switch is read per request, not at build time.
  await connection();
  return <Suspense><SellerShowcase commentTranslationEnabled={isSellerCommentTranslationEnabled()} /></Suspense>;
}
