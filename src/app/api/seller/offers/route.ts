import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { listOwnedOffers } from '@/modules/offers/application/list-owned-offers';
import { SellerOffersSellerRequiredError } from '@/modules/offers/contracts/seller-offer.contract';
import { localeFromApiRequest } from '../../../../i18n/api';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest): Promise<Response> {
  void localeFromApiRequest(request);
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Seller offers current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }

  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы открыть предложения.' } }, { status: 401, headers: noStore });
  }

  try {
    const offers = await listOwnedOffers(user.id);
    return NextResponse.json({ offers }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof SellerOffersSellerRequiredError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Seller offers loading failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось загрузить предложения продавца.' } }, { status: 503, headers: noStore });
  }
}
