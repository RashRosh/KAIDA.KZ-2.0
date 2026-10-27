import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { proposeTextPrices } from '@/modules/seller-text-input/application/apply-seller-text-input';
import {
  priceProposalBodySchema,
  TextInputReviewUnavailableError,
  TextPriceChangedError,
  TextPriceRejectedError,
} from '@/modules/seller-text-input/contracts/seller-text-input.contract';
import { apiLocale } from '@/i18n/config';
import { jsonError, noStore, sellerUser } from '../../../../cards/_shared';

export const runtime = 'nodejs';

// text-price-update §3.5: one price proposal for the cards chosen on held lines; repeat-safe per set of changes.
export async function POST(request: NextRequest, context: { params: Promise<{ inputId: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const inputId = z.uuid().safeParse((await context.params).inputId);
  if (!inputId.success) return jsonError('TEXT_INPUT_REVIEW_UNAVAILABLE', 'Разбор этого списка недоступен.', 404);
  const body = priceProposalBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError('INVALID_PRICE_PROPOSAL', 'Выберите карточку и цену.', 400);
  try {
    const result = await proposeTextPrices(user.id, inputId.data, body.data, { locale: apiLocale(request.nextUrl.searchParams.get('locale')) });
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: noStore });
  } catch (error) {
    if (error instanceof TextInputReviewUnavailableError) return jsonError(error.code, error.message, 404);
    if (error instanceof TextPriceChangedError || error instanceof TextPriceRejectedError) {
      const indexes = error instanceof TextPriceChangedError ? error.changed : error.indexes;
      return NextResponse.json({ error: { code: error.code, message: error.message }, indexes }, { status: 409, headers: noStore });
    }
    console.error('Seller text price proposal failed');
    return jsonError('TEXT_PRICE_FAILED', 'Не удалось подготовить изменение цены. Попробуйте ещё раз.', 503);
  }
}
