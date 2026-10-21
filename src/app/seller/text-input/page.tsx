import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { SellerTextInputScreen } from '../_components/SellerTextInput';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { isTextInputEnabledForSession } from '@/modules/seller-text-input/application/text-input-access';

export default async function Page() {
  await connection();
  if (!await isTextInputEnabledForSession((await cookies()).get(SESSION_COOKIE_NAME)?.value)) notFound();
  return <SellerTextInputScreen />;
}
