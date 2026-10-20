import { NextRequest, NextResponse } from 'next/server';
import { applySellerTextInput } from '@/modules/seller-text-input/application/apply-seller-text-input';
import {
  sellerTextInputBodySchema,
  TextInputUnavailableError,
} from '@/modules/seller-text-input/contracts/seller-text-input.contract';
import { DraftSellerRequiredError } from '@/modules/offers/drafts/offer-drafts';
import { jsonError, noStore, sellerUser } from '../cards/_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;

  const parsed = sellerTextInputBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_TEXT', 'Введите текст со списком товаров.', 400);

  try {
    const result = await applySellerTextInput(user.id, parsed.data.text);
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof TextInputUnavailableError) {
      return jsonError(error.code, error.message, 503);
    }
    if (error instanceof DraftSellerRequiredError) {
      return jsonError(error.code, error.message, 400);
    }
    console.error('Seller text input failed', error);
    return jsonError('TEXT_INPUT_FAILED', 'Не удалось разобрать текст. Попробуйте ещё раз.', 503);
  }
}
