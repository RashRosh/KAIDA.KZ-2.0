import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = await resolveCurrentUser(token);
    return NextResponse.json({ user: user ? { id: user.id, phone: user.phoneE164 } : null }, { status: 200, headers });
  } catch {
    console.error('Current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers });
  }
}
