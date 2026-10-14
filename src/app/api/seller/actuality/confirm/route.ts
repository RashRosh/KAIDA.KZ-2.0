import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { reconfirmCardsPerCard } from '@/modules/seller-input/application/reconfirm-actuality';
import {
  SellerRequiredError,
} from '@/modules/seller-input/contracts/seller-change-set.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

// offer-actuality / actuality-words: «Товар есть, цена та же» (one card) and «Всё актуально» (many cards) — applied at once,
// card by card: every card that can be confirmed is, the others are listed and stay unchanged (200 with confirmed/failed).
// Nothing confirmed → the first reason, with the status it always had (404 not found, 409 otherwise).
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
    const result = await reconfirmCardsPerCard(user.id, parsed.data.cardIds);
    if (result.confirmed.length === 0) {
      const first = result.failed[0]!;
      return NextResponse.json(
        { error: { code: first.code, message: first.message }, failed: result.failed },
        { status: first.code === 'OFFER_NOT_FOUND' ? 404 : 409, headers: noStore },
      );
    }
    return NextResponse.json({ confirmed: result.confirmed, failed: result.failed }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof SellerRequiredError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Actuality confirm failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось подтвердить актуальность.' } }, { status: 503, headers: noStore });
  }
}
