import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { createOfferManagementChangeSet } from '@/modules/seller-input/application/create-offer-management-change-set';
import {
  OfferAlreadyInactiveError,
  OfferNotFoundError,
  OfferPriceRequiredError,
  OfferUpdateNoChangesError,
  PhotoNotFoundError,
  SellerRequiredError,
  sellerOfferChangeBodySchema,
  sellerOfferIdSchema,
} from '@/modules/seller-input/contracts/seller-change-set.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Seller offer change current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }

  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы изменить предложение.' } }, { status: 401, headers: noStore });
  }

  const parsedOfferId = sellerOfferIdSchema.safeParse((await context.params).id);
  if (!parsedOfferId.success) {
    return NextResponse.json({ error: { code: 'INVALID_OFFER_ID', message: 'Некорректный идентификатор предложения.' } }, { status: 400, headers: noStore });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerOfferChangeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_OFFER_CHANGE_INPUT', message: 'Проверьте данные изменения предложения.' } }, { status: 400, headers: noStore });
  }

  try {
    const changeSet = await createOfferManagementChangeSet(user.id, parsedOfferId.data, parsed.data);
    return NextResponse.json({ changeSet }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof SellerRequiredError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    if (error instanceof PhotoNotFoundError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 422, headers: noStore });
    }
    if (error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404, headers: noStore });
    }
    if (
      error instanceof OfferUpdateNoChangesError
      || error instanceof OfferAlreadyInactiveError
      || error instanceof OfferPriceRequiredError
    ) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Seller offer change creation failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось сохранить изменение предложения.' } }, { status: 503, headers: noStore });
  }
}
