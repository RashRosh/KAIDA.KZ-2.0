import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDraftFromHeldLine } from '@/modules/seller-text-input/application/apply-seller-text-input';
import { TextInputReviewUnavailableError } from '@/modules/seller-text-input/contracts/seller-text-input.contract';
import { jsonError, noStore, sellerUser } from '../../../../../cards/_shared';

export const runtime = 'nodejs';

// text-duplicates §4.5: «Это другой товар — создать черновик» for one held line; repeat-safe (same draft back).
export async function POST(request: NextRequest, context: { params: Promise<{ inputId: string; index: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const params = await context.params;
  const inputId = z.uuid().safeParse(params.inputId);
  const index = z.coerce.number().int().min(0).max(59).safeParse(params.index);
  if (!inputId.success || !index.success) return jsonError('TEXT_INPUT_REVIEW_UNAVAILABLE', 'Разбор этого списка недоступен.', 404);
  try {
    const result = await createDraftFromHeldLine(user.id, inputId.data, index.data);
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: noStore });
  } catch (error) {
    if (error instanceof TextInputReviewUnavailableError) return jsonError(error.code, error.message, 404);
    console.error('Seller text held draft failed');
    return jsonError('TEXT_INPUT_FAILED', 'Не удалось создать черновик. Попробуйте ещё раз.', 503);
  }
}
