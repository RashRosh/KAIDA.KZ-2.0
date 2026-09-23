import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { getOwnedSeller } from '@/modules/sellers/application/get-owned-seller';
import { localeFromApiRequest } from '../../../../i18n/api';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest): Promise<Response> {
  void localeFromApiRequest(request);
  let user;
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    user = await resolveCurrentUser(token);
  } catch {
    console.error('Seller current user resolution failed');
    return NextResponse.json(
      { error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } },
      { status: 503, headers: noStore },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы настроить продавца.' } },
      { status: 401, headers: noStore },
    );
  }

  try {
    const seller = await getOwnedSeller(user.id);
    return NextResponse.json({ seller }, { status: 200, headers: noStore });
  } catch {
    console.error('Owned seller loading failed');
    return NextResponse.json(
      { error: { code: 'SELLER_UNAVAILABLE', message: 'Не удалось загрузить или сохранить данные продавца.' } },
      { status: 503, headers: noStore },
    );
  }
}
