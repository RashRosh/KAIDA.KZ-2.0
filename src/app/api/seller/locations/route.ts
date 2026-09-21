import { NextRequest, NextResponse } from 'next/server';
import { createOwnedLocation } from '../../../../modules/locations/application/create-owned-location';
import { SellerRequiredError } from '../../../../modules/locations/application/location-errors';
import { locationIdentitySchema } from '../../../../modules/locations/contracts/location.contract';
import { resolveCurrentUser } from '../../../../modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '../../../../modules/identity/session/session-cookie';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Location create current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы добавить торговую точку.' } }, { status: 401, headers: noStore });
  }

  const body = await request.json().catch(() => null);
  const parsed = locationIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_LOCATION', message: 'Проверьте данные торговой точки.' } }, { status: 400, headers: noStore });
  }

  try {
    const location = await createOwnedLocation(user.id, parsed.data);
    return NextResponse.json({ location }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof SellerRequiredError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Location create failed');
    return NextResponse.json({ error: { code: 'LOCATION_UNAVAILABLE', message: 'Не удалось добавить торговую точку.' } }, { status: 503, headers: noStore });
  }
}
