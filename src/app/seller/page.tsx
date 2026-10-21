import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { SellerShowcase } from './_components/SellerShowcase';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { isSellerCommentTranslationEnabled } from '@/modules/offers/translation/seller-comment-translation.config';
import { isTextInputEnabledForSession } from '@/modules/seller-text-input/application/text-input-access';

export default async function Page() {
  // The translation switch is read per request, not at build time.
  await connection();
  const textInputEnabled = await isTextInputEnabledForSession((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  return (
    <Suspense>
      <SellerShowcase
        commentTranslationEnabled={isSellerCommentTranslationEnabled()}
        textInputEnabled={textInputEnabled}
      />
    </Suspense>
  );
}
