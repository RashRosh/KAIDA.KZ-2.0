import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '../../../../../modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '../../../../../modules/identity/session/session-cookie';
import { LocationNotFoundError } from '../../../../../modules/locations/application/location-errors';
import { updateOwnedLocation } from '../../../../../modules/locations/application/update-owned-location';
import { locationIdentitySchema } from '../../../../../modules/locations/contracts/location.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };
const locationIdSchema = z.string().uuid();

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Location update current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы изменить торговую точку.' } }, { status: 401, headers: noStore });
  }

  const parsedId = locationIdSchema.safeParse((await context.params).id);
  if (!parsedId.success) {
    return NextResponse.json({ error: { code: 'LOCATION_NOT_FOUND', message: 'Точка не найдена.' } }, { status: 404, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  const parsed = locationIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_LOCATION', message: 'Проверьте данные торговой точки.' } }, { status: 400, headers: noStore });
  }

  try {
    const location = await updateOwnedLocation(user.id, parsedId.data, parsed.data);
    return NextResponse.json({ location }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof LocationNotFoundError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404, headers: noStore });
    }
    console.error('Location update failed');
    return NextResponse.json({ error: { code: 'LOCATION_UNAVAILABLE', message: 'Не удалось изменить торговую точку.' } }, { status: 503, headers: noStore });
  }
}
