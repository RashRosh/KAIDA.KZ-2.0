import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SellerTextInputReviewScreen } from '../../_components/SellerTextInputReview';
import { isSellerTextInputEnabled } from '@/modules/seller-text-input/seller-text-input.config';

export default async function Page() {
  await connection();
  if (!isSellerTextInputEnabled()) notFound();
  return <Suspense><SellerTextInputReviewScreen /></Suspense>;
}
