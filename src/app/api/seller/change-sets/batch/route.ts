import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { createBatchSellerChangeSet } from '@/modules/seller-input/application/create-batch-seller-change-set';
import {
  BatchOfferConflictError,
  LocationNotFoundError,
  OfferAlreadyInactiveError,
  OfferNotFoundError,
  OfferPriceRequiredError,
  OfferUpdateNoChangesError,
  ProductAmbiguousError,
  ProductNotFoundError,
  SellerRequiredError,
  sellerBatchChangeSetCreateBodySchema,
} from '@/modules/seller-input/contracts/seller-change-set.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Seller batch change set current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }

  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы изменить товары.' } }, { status: 401, headers: noStore });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerBatchChangeSetCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_BATCH_CHANGE_SET_INPUT', message: 'Проверьте пакет изменений.' } }, { status: 400, headers: noStore });
  }

  try {
    const changeSet = await createBatchSellerChangeSet(user.id, parsed.data);
    return NextResponse.json({ changeSet }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof SellerRequiredError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    if (error instanceof LocationNotFoundError || error instanceof ProductNotFoundError || error instanceof OfferNotFoundError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404, headers: noStore });
    }
    if (
      error instanceof ProductAmbiguousError
      || error instanceof OfferUpdateNoChangesError
      || error instanceof OfferAlreadyInactiveError
      || error instanceof OfferPriceRequiredError
      || error instanceof BatchOfferConflictError
    ) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Seller batch change set creation failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось сохранить пакет изменений.' } }, { status: 503, headers: noStore });
  }
}
