import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { CardRemovedByOperatorError } from '@/modules/moderation/contracts/moderation.contract';
import { reconfirmCards } from '@/modules/seller-input/application/reconfirm-actuality';
import {
  OfferAlreadyInactiveError,
  OfferChangedError,
  OfferNotFoundError,
  OfferPriceRequiredError,
  SellerRequiredError,
} from '@/modules/seller-input/contracts/seller-change-set.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

// offer-actuality: «Подтвердить актуальность» (one card) and «Всё актуально» (every due card) — applied at once.
const bodySchema = z.object({ cardIds: z.array(z.uuid()).min(1).max(500) }).strict();

export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Actuality confirm current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы подтвердить актуальность.' } }, { status: 401, headers: noStore });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_ACTUALITY_INPUT', message: 'Выберите карточки.' } }, { status: 400, headers: noStore });
  }
  try {
    const changeSet = await reconfirmCards(user.id, parsed.data.cardIds);
    return NextResponse.json({ changeSet }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404, headers: noStore });
    }
    if (
      error instanceof SellerRequiredError
      || error instanceof CardRemovedByOperatorError
      || error instanceof OfferAlreadyInactiveError
      || error instanceof OfferChangedError
      || error instanceof OfferPriceRequiredError
    ) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Actuality confirm failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось подтвердить актуальность.' } }, { status: 503, headers: noStore });
  }
}
