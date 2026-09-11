import { NextResponse } from 'next/server';
import { requestOtp } from '@/modules/identity/application/request-otp';
import { AuthError, requestOtpBodySchema } from '@/modules/identity/contracts/auth.contract';
import { testOtpDelivery } from '@/modules/identity/delivery/otp-delivery';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = requestOtpBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_PHONE', message: 'Введите корректный номер телефона.' } }, { status: 400, headers: noStore });
  }

  try {
    const result = await requestOtp(parsed.data, { delivery: testOtpDelivery });
    return NextResponse.json({
      challenge: { id: result.challenge.id, expiresAt: result.challenge.expiresAt.toISOString() },
      delivery: result.delivery,
    }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: noStore });
    }
    console.error('Auth OTP request failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось выполнить вход. Попробуйте ещё раз.' } }, { status: 503, headers: noStore });
  }
}
