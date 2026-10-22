import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { SellerPointsSection } from '../_components/SellerSections';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { isTextInputEnabledForSession } from '@/modules/seller-text-input/application/text-input-access';

export default async function Page() {
  await connection();
  const textInputEnabled = await isTextInputEnabledForSession((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  return <Suspense><SellerPointsSection textInputEnabled={textInputEnabled} /></Suspense>;
}
