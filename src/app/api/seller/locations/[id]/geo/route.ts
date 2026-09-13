import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { locationGeoSchema } from '@/modules/locations/contracts/location.contract';
import { LocationNotFoundError, setOwnedLocationGeo } from '@/modules/locations/application/set-owned-location-geo';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };
const locationIdSchema = z.string().uuid();

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Location geo current user resolution failed');
    return NextResponse.json(
      { error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } },
      { status: 503, headers: noStore },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы сохранить местоположение.' } },
      { status: 401, headers: noStore },
    );
  }

  const parsedLocationId = locationIdSchema.safeParse((await context.params).id);
  if (!parsedLocationId.success) {
    return NextResponse.json(
      { error: { code: 'LOCATION_NOT_FOUND', message: 'Точка не найдена.' } },
      { status: 404, headers: noStore },
    );
  }

  const body = await request.json().catch(() => null);
  const parsedGeo = locationGeoSchema.safeParse(body);
  if (!parsedGeo.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_LOCATION_GEO', message: 'Проверьте данные местоположения.' } },
      { status: 400, headers: noStore },
    );
  }

  try {
    const location = await setOwnedLocationGeo(user.id, parsedLocationId.data, parsedGeo.data);
    return NextResponse.json({ location }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof LocationNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404, headers: noStore },
      );
    }

    console.error('Location geo update failed');
    return NextResponse.json(
      { error: { code: 'LOCATION_UNAVAILABLE', message: 'Не удалось сохранить местоположение.' } },
      { status: 503, headers: noStore },
    );
  }
}
