import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '../../../modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '../../../modules/identity/session/session-cookie';
import { listFavourites, putFavourite, removeFavourite } from '../../../modules/favourites/application/manage-favourites';
import { FavouriteUnavailable } from '../../../modules/favourites/contracts/favourites.contract';
import { hasUnsupportedQuery, localeFromApiRequest } from '../../../i18n/api';
import { z } from 'zod';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const addSchema = z.object({ offerId: z.uuid(), locationId: z.uuid() }).strict();
const removeSchema = z.object({ id: z.uuid() }).strict();

async function handle(request: NextRequest): Promise<Response> {
  try {
    const user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!user) return NextResponse.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401, headers });
    const locale = localeFromApiRequest(request);
    if (hasUnsupportedQuery(request.nextUrl.searchParams, [])) return NextResponse.json({ error: { code: 'INVALID_FAVOURITE' } }, { status: 400, headers });
    if (request.method === 'GET') {
      if (request.body !== null) return NextResponse.json({ error: { code: 'INVALID_FAVOURITE' } }, { status: 400, headers });
      const favourites = await listFavourites(user.id, { locale });
      return NextResponse.json({ userId: user.id, favourites, count: favourites.length }, { headers });
    }
    // Browser writes must be same-origin; non-browser clients still use the existing authenticated session.
    const origin = request.headers.get('origin');
    // Next's internal request URL can use its bind hostname; the browser's origin uses the actual Host.
    const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`;
    if (origin && origin !== expectedOrigin) return NextResponse.json({ error: { code: 'INVALID_FAVOURITE' } }, { status: 403, headers });
    const body: unknown = await request.json().catch(() => null);
    if (request.method === 'PUT') {
      const input = addSchema.safeParse(body);
      if (!input.success) return NextResponse.json({ error: { code: 'INVALID_FAVOURITE' } }, { status: 400, headers });
      await putFavourite(user.id, input.data.offerId, input.data.locationId, { locale });
    } else {
      const input = removeSchema.safeParse(body);
      if (!input.success) return NextResponse.json({ error: { code: 'INVALID_FAVOURITE' } }, { status: 400, headers });
      await removeFavourite(user.id, input.data.id);
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof FavouriteUnavailable) return NextResponse.json({ error: { code: 'OFFER_UNAVAILABLE' } }, { status: 409, headers });
    console.error('Favourites request failed');
    return NextResponse.json({ error: { code: 'FAVOURITES_UNAVAILABLE' } }, { status: 503, headers });
  }
}
export const GET = handle;
export const PUT = handle;
export const DELETE = handle;
