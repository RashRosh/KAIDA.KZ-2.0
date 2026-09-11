import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/modules/identity/application/logout';
import { loadIdentityConfig } from '@/modules/identity/config/identity.config';
import { buildLogoutCookie, SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  try {
    await logout(token);
    const config = loadIdentityConfig();
    const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(buildLogoutCookie(config.cookieSecure));
    return response;
  } catch {
    console.error('Logout failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось выйти.' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
