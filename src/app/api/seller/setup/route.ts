import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { SellerAlreadyExistsError, setupSeller } from '@/modules/sellers/application/setup-seller';
import { sellerSetupBodySchema } from '@/modules/sellers/contracts/seller.contract';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    user = await resolveCurrentUser(token);
  } catch {
    console.error('Seller setup current user resolution failed');
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

  const body = await request.json().catch(() => null);
  const parsed = sellerSetupBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_SELLER_SETUP', message: 'Проверьте данные продавца и точки.' } },
      { status: 400, headers: noStore },
    );
  }

  try {
    const seller = await setupSeller(user.id, parsed.data);
    return NextResponse.json({ seller }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof SellerAlreadyExistsError) {
      return NextResponse.json(
        { error: { code: 'SELLER_ALREADY_EXISTS', message: error.message } },
        { status: 409, headers: noStore },
      );
    }
    console.error('Seller setup failed');
    return NextResponse.json(
      { error: { code: 'SELLER_UNAVAILABLE', message: 'Не удалось загрузить или сохранить данные продавца.' } },
      { status: 503, headers: noStore },
    );
  }
}
