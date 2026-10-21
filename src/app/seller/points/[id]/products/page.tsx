import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { SellerPointProducts } from '../../../_components/SellerPointProducts';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { isTextInputEnabledForSession } from '@/modules/seller-text-input/application/text-input-access';

// seller-ai-text-real-parser §21: the products of one trading point (seller workspace only, never public).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const textInputEnabled = await isTextInputEnabledForSession((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  return <Suspense><SellerPointProducts pointId={id} textInputEnabled={textInputEnabled} /></Suspense>;
}
