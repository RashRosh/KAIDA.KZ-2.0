import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { resolveCurrentUser } from '../../../../modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '../../../../modules/identity/session/session-cookie';
import { getOwnedSellerContacts } from '../../../../modules/sellers/application/get-owned-seller-contacts';
import { updateOwnedSellerContacts } from '../../../../modules/sellers/application/update-owned-seller-contacts';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

async function resolveOwner(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = await resolveCurrentUser(token);
    if (!user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы настроить контакты продавца.' } },
          { status: 401, headers: noStore },
        ),
      } as const;
    }
    return { ok: true, user } as const;
  } catch {
    console.error('Seller contacts current user resolution failed');
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } },
        { status: 503, headers: noStore },
      ),
    } as const;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const owner = await resolveOwner(request);
  if (!owner.ok) return owner.response;

  try {
    const contacts = await getOwnedSellerContacts(owner.user.id);
    if (!contacts) {
      return NextResponse.json(
        { error: { code: 'SELLER_NOT_FOUND', message: 'Сначала создайте продавца.' } },
        { status: 404, headers: noStore },
      );
    }
    return NextResponse.json({ contacts }, { status: 200, headers: noStore });
  } catch {
    console.error('Owned Seller contacts loading failed');
    return NextResponse.json(
      { error: { code: 'SELLER_UNAVAILABLE', message: 'Не удалось загрузить контакты продавца.' } },
      { status: 503, headers: noStore },
    );
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  const owner = await resolveOwner(request);
  if (!owner.ok) return owner.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_SELLER_CONTACTS', message: 'Проверьте данные контактов.' } },
      { status: 400, headers: noStore },
    );
  }

  try {
    const contacts = await updateOwnedSellerContacts(owner.user.id, body);
    if (!contacts) {
      return NextResponse.json(
        { error: { code: 'SELLER_NOT_FOUND', message: 'Сначала создайте продавца.' } },
        { status: 404, headers: noStore },
      );
    }
    return NextResponse.json({ contacts }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.message === 'Invalid Seller contact phone')) {
      return NextResponse.json(
        { error: { code: 'INVALID_SELLER_CONTACTS', message: 'Проверьте данные контактов.' } },
        { status: 400, headers: noStore },
      );
    }
    console.error('Owned Seller contacts update failed');
    return NextResponse.json(
      { error: { code: 'SELLER_UNAVAILABLE', message: 'Не удалось сохранить контакты продавца.' } },
      { status: 503, headers: noStore },
    );
  }
}
