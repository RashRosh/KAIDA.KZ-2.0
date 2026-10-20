import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { SellerTextInputScreen } from '../_components/SellerTextInput';
import { isSellerTextInputEnabled } from '@/modules/seller-text-input/seller-text-input.config';

export default async function Page() {
  await connection();
  if (!isSellerTextInputEnabled()) notFound();
  return <SellerTextInputScreen />;
}
