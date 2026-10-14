import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { undoReconfirmations } from '@/modules/seller-input/application/reconfirm-actuality';
import { SellerRequiredError } from '@/modules/seller-input/contracts/seller-change-set.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

// actuality-words §7.2: «Отменить» after the one-tap «Всё актуально» — restores the previous confirmation time of exactly the
// cards the given reconfirmation ChangeSets confirmed, within the server window; refused cards are listed and keep their confirmation.
const bodySchema = z.object({ changeSetIds: z.array(z.uuid()).min(1).max(500) }).strict();

export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Actuality undo current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы отменить подтверждение.' } }, { status: 401, headers: noStore });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_UNDO_INPUT', message: 'Нечего отменять.' } }, { status: 400, headers: noStore });
  }
  try {
    const result = await undoReconfirmations(user.id, parsed.data.changeSetIds);
    if (result.undone.length === 0) {
      const first = result.failed[0]!;
      return NextResponse.json({ error: { code: first.code, message: first.message }, failed: result.failed }, { status: 409, headers: noStore });
    }
    return NextResponse.json(result, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof SellerRequiredError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409, headers: noStore });
    }
    console.error('Actuality undo failed');
    return NextResponse.json({ error: { code: 'SELLER_INPUT_UNAVAILABLE', message: 'Не удалось отменить подтверждение.' } }, { status: 503, headers: noStore });
  }
}
