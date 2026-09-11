import { NextResponse } from 'next/server';
import { verifyOtp } from '@/modules/identity/application/verify-otp';
import { AuthError, verifyOtpBodySchema } from '@/modules/identity/contracts/auth.contract';
import { loadIdentityConfig } from '@/modules/identity/config/identity.config';
import { buildSessionCookie } from '@/modules/identity/session/session-cookie';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = verifyOtpBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_AUTH_REQUEST', message: 'Проверьте код и попробуйте ещё раз.' } }, { status: 400, headers: noStore });
  }

  try {
    const result = await verifyOtp(parsed.data);
    const config = loadIdentityConfig();
    const response = NextResponse.json({ user: { id: result.user.id, phone: result.user.phoneE164 } }, { status: 200, headers: noStore });
    response.cookies.set(buildSessionCookie(result.sessionToken, result.sessionExpiresAt, result.sessionTtlSeconds, config.cookieSecure));
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: noStore });
    }
    console.error('Auth OTP verification failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось выполнить вход. Попробуйте ещё раз.' } }, { status: 503, headers: noStore });
  }
}
