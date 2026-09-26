import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { AuthError } from '@/modules/identity/contracts/auth.contract';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { LocationNotFoundError, SellerRequiredError } from '@/modules/locations/application/location-errors';
import { InvalidPointPhoneError, PointContactNotOnPointError } from '@/modules/locations/details/point-details.contract';

export const noStore = { 'Cache-Control': 'no-store' };

export function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: noStore });
}

export async function currentUserOr401(request: NextRequest) {
  try {
    const user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    return user ?? fail('AUTH_REQUIRED', 'Войдите, чтобы изменить торговую точку.', 401);
  } catch {
    console.error('Point details current user resolution failed');
    return fail('AUTH_UNAVAILABLE', 'Не удалось проверить вход.', 503);
  }
}

// Known domain errors of point details, codes and verification; anything else is a 503 without details.
export function pointErrorResponse(error: unknown, context: string) {
  if (error instanceof InvalidPointPhoneError) return fail(error.code, error.message, 400, { field: error.field });
  if (error instanceof PointContactNotOnPointError) return fail(error.code, error.message, 409);
  if (error instanceof SellerRequiredError) return fail(error.code, error.message, 409);
  if (error instanceof LocationNotFoundError) return fail(error.code, error.message, 404);
  if (error instanceof AuthError) return fail(error.code, error.message, error.status);
  console.error(`${context} failed`);
  return fail('POINT_DETAILS_UNAVAILABLE', 'Не удалось сохранить данные точки.', 503);
}
