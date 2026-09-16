import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { confirmSellerChangeSet } from '@/modules/seller-input/application/confirm-seller-change-set';
import {
  ChangeSetNotFoundError,
  OfferChangedError,
  OfferPriceRequiredError,
  SellerRequiredError,
  sellerChangeSetIdSchema,
} from '@/modules/seller-input/contracts/seller-change-set.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Seller change set confirm current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы подтвердить изменение.' } }, { status: 401, headers: noStore });

  const parsedId = sellerChangeSetIdSchema.safeParse((await context.params).id);
  if (!parsedId.success) return NextResponse.json({ error: { code: 'INVALID_CHANGE_SET_ID', message: 'Некорректный идентификатор изменения.' } }, { status: 400, headers: noStore });

  try {
    const changeSet = await confirmSellerChangeSet(user.id, parsedId.data);
    return NextResponse.json({ changeSet }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof SellerRequiredError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    if (error instanceof ChangeSetNotFoundError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404, headers: noStore });
    if (error instanceof OfferChangedError || error instanceof OfferPriceRequiredError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Seller change set confirmation failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось подтвердить изменение продавца.' } }, { status: 503, headers: noStore });
  }
}
