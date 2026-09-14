import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '../../../modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '../../../modules/identity/session/session-cookie';

export const interestsNoStore = { 'Cache-Control': 'no-store' };

export async function resolveInterestUser(request: NextRequest) {
  try {
    const user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы управлять интересами.' } },
          { status: 401, headers: interestsNoStore },
        ),
      } as const;
    }
    return { ok: true, user } as const;
  } catch {
    console.error('Interests current user resolution failed');
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } },
        { status: 503, headers: interestsNoStore },
      ),
    } as const;
  }
}

export async function hasNonEmptyBody(request: NextRequest): Promise<boolean> {
  return (await request.text()).length > 0;
}
