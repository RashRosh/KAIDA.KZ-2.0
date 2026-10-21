import { NextRequest, NextResponse } from 'next/server';
import { applySellerTextInput } from '@/modules/seller-text-input/application/apply-seller-text-input';
import {
  sellerTextInputBodySchema,
  TextInputParserError,
  TextInputRequestConflictError,
  TextInputUnavailableError,
} from '@/modules/seller-text-input/contracts/seller-text-input.contract';
import { DraftSellerRequiredError } from '@/modules/offers/drafts/offer-drafts';
import { jsonError, noStore, sellerUser } from '../cards/_shared';

export const runtime = 'nodejs';
// seller-ai-text-real-parser §6.2: longer than the largest parser timeout (180 s) plus the database work.
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;

  const parsed = sellerTextInputBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_TEXT', 'Введите текст со списком товаров.', 400);

  try {
    const { replayed, ...result } = await applySellerTextInput(
      user,
      parsed.data.text,
      { requestId: parsed.data.requestId },
    );
    return NextResponse.json(result, { status: replayed ? 200 : 201, headers: noStore });
  } catch (error) {
    if (error instanceof TextInputUnavailableError) return jsonError(error.code, error.message, 503);
    if (error instanceof DraftSellerRequiredError) return jsonError(error.code, error.message, 400);
    if (error instanceof TextInputRequestConflictError) return jsonError(error.code, error.message, 409);
    if (error instanceof TextInputParserError) {
      return jsonError(error.code, error.message, error.code === 'TEXT_INPUT_BUSY' ? 429 : 503);
    }
    console.error('Seller text input failed');
    return jsonError('TEXT_INPUT_FAILED', 'Не удалось разобрать текст. Попробуйте ещё раз.', 503);
  }
}
