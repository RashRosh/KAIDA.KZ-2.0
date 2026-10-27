import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { proposeTextAvailability } from '@/modules/seller-text-input/application/apply-seller-text-input';
import {
  availabilityProposalBodySchema,
  TextAvailabilityChangedError,
  TextInputReviewUnavailableError,
} from '@/modules/seller-text-input/contracts/seller-text-input.contract';
import { apiLocale } from '@/i18n/config';
import { jsonError, noStore, sellerUser } from '../../../cards/_shared';

export const runtime = 'nodejs';

// text-availability §4.1 item 5: one switch-off proposal from a text review, only for the candidates the Seller saw.
export async function POST(request: NextRequest, context: { params: Promise<{ inputId: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const inputId = z.uuid().safeParse((await context.params).inputId);
  if (!inputId.success) return jsonError('TEXT_INPUT_REVIEW_UNAVAILABLE', 'Разбор этого списка недоступен.', 404);
  const body = availabilityProposalBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.statements.every((statement) => statement.selected.length === 0)) {
    return jsonError('INVALID_AVAILABILITY', 'Отметьте карточки, которые нужно выключить.', 400);
  }
  try {
    const locale = apiLocale(request.nextUrl.searchParams.get('locale'));
    const result = await proposeTextAvailability(user.id, inputId.data, body.data, { locale });
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof TextInputReviewUnavailableError) return jsonError(error.code, error.message, 404);
    if (error instanceof TextAvailabilityChangedError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message }, availability: error.availability, changed: error.changed },
        { status: 409, headers: noStore },
      );
    }
    console.error('Seller text availability proposal failed');
    return jsonError('TEXT_AVAILABILITY_FAILED', 'Не удалось подготовить выключение. Попробуйте ещё раз.', 503);
  }
}
