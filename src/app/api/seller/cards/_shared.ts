import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { CardNotFoundError, CardPointAlreadyAddedError, CommonPriceMissingError } from '@/modules/seller-input/contracts/seller-card.contract';
import {
  LocationNotFoundError,
  OfferChangedError,
  OfferNotFoundError,
  OfferUpdateNoChangesError,
  PhotoNotFoundError,
  ProductNotFoundError,
  SellerRequiredError,
} from '@/modules/seller-input/contracts/seller-change-set.contract';
import { DraftNotFoundError, DraftSellerRequiredError } from '@/modules/offers/drafts/offer-drafts';

// seller-showcase-editor: shared auth and error mapping for card, point-price and draft endpoints.

export const noStore = { 'Cache-Control': 'no-store' };

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStore });
}

export async function sellerUser(request: NextRequest): Promise<{ id: string } | Response> {
  try {
    const user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    return user ?? jsonError('AUTH_REQUIRED', 'Войдите, чтобы продолжить.', 401);
  } catch {
    console.error('Seller card current user resolution failed');
    return jsonError('AUTH_UNAVAILABLE', 'Не удалось проверить вход.', 503);
  }
}

const statusByError: [new (...args: never[]) => Error & { code: string }, number][] = [
  [SellerRequiredError, 409],
  [DraftSellerRequiredError, 409],
  [LocationNotFoundError, 404],
  [ProductNotFoundError, 404],
  [OfferNotFoundError, 404],
  [CardNotFoundError, 404],
  [DraftNotFoundError, 404],
  [PhotoNotFoundError, 422],
  [OfferChangedError, 409],
  [OfferUpdateNoChangesError, 409],
  [CardPointAlreadyAddedError, 409],
  [CommonPriceMissingError, 409],
];

export function mapCardError(error: unknown, logLabel: string) {
  for (const [type, status] of statusByError) {
    if (error instanceof type) return jsonError(error.code, error.message, status);
  }
  console.error(logLabel);
  return jsonError('SELLER_INPUT_UNAVAILABLE', 'Не удалось сохранить изменение.', 503);
}
