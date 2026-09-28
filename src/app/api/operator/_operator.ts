import { NextResponse, type NextRequest } from 'next/server';
import type { CurrentUser } from '@/modules/identity/contracts/auth.contract';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { resolveOperator } from '@/modules/moderation/application/resolve-operator';

export const noStore = { 'Cache-Control': 'no-store' };

// operator-post-check: every operator endpoint answers a non-operator exactly like a missing route.
export function notFound() {
  return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Не найдено.' } }, { status: 404, headers: noStore });
}

export function unavailable() {
  return NextResponse.json({ error: { code: 'OPERATOR_UNAVAILABLE', message: 'Не удалось выполнить действие. Повторите.' } }, { status: 503, headers: noStore });
}

export async function operatorOf(request: NextRequest): Promise<CurrentUser | null | 'unavailable'> {
  try {
    return await resolveOperator(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Operator resolution failed');
    return 'unavailable';
  }
}
