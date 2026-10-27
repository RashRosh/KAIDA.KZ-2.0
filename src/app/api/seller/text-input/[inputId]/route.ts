import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerTextSubmission } from '@/modules/seller-text-input/application/apply-seller-text-input';
import { apiLocale } from '@/i18n/config';
import { jsonError, noStore, sellerUser } from '../../cards/_shared';

export const runtime = 'nodejs';

// Review recovery (seller-ai-text-real-parser §16): one of the Seller's own submissions while it is retained (24 h).
// Another Seller's id, an expired one and an unknown one all answer the same 404: nothing tells them apart.
export async function GET(request: NextRequest, context: { params: Promise<{ inputId: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const inputId = z.uuid().safeParse((await context.params).inputId);
  if (!inputId.success) return jsonError('TEXT_INPUT_REVIEW_UNAVAILABLE', 'Разбор этого списка недоступен.', 404);
  try {
    const submission = await getSellerTextSubmission(user.id, inputId.data, { locale: apiLocale(request.nextUrl.searchParams.get('locale')) });
    if (!submission) return jsonError('TEXT_INPUT_REVIEW_UNAVAILABLE', 'Разбор этого списка недоступен.', 404);
    return NextResponse.json({ submission }, { headers: noStore });
  } catch {
    console.error('Seller text input review failed');
    return jsonError('TEXT_INPUT_FAILED', 'Не удалось загрузить разбор.', 503);
  }
}
