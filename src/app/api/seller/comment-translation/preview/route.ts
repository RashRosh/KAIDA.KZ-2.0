import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import {
  CommentTranslationDisabledError,
  CommentTranslationRateLimitedError,
  CommentTranslationSellerRequiredError,
  CommentTranslationUnavailableError,
  commentTranslationPreviewBodySchema,
  previewSellerCommentTranslation,
} from '@/modules/offers/translation/preview-seller-comment-translation';
import { getSellerCommentTranslator } from '@/modules/offers/translation/seller-comment-translation.runtime';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStore });
}

export async function POST(request: NextRequest): Promise<Response> {
  const translator = getSellerCommentTranslator();
  if (!translator) return error('TRANSLATION_DISABLED', 'Автоперевод отключён.', 404);

  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Comment translation preview current user resolution failed');
    return error('AUTH_UNAVAILABLE', 'Не удалось проверить вход.', 503);
  }
  if (!user) return error('AUTH_REQUIRED', 'Войдите, чтобы проверить перевод.', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_PREVIEW_REQUEST', 'Проверьте текст комментария.', 400);
  }
  const parsed = commentTranslationPreviewBodySchema.safeParse(body);
  if (!parsed.success) return error('INVALID_PREVIEW_REQUEST', 'Проверьте текст комментария.', 400);

  try {
    const preview = await previewSellerCommentTranslation(user.id, parsed.data.text, { translator });
    return NextResponse.json({ preview }, { status: 200, headers: noStore });
  } catch (caught) {
    if (caught instanceof CommentTranslationDisabledError) return error(caught.code, 'Автоперевод отключён.', 404);
    if (caught instanceof CommentTranslationSellerRequiredError) return error(caught.code, 'Сначала создайте профиль продавца.', 409);
    if (caught instanceof CommentTranslationRateLimitedError) return error(caught.code, 'Слишком много проверок. Попробуйте через минуту.', 429);
    if (caught instanceof CommentTranslationUnavailableError) return error(caught.code, 'Перевод сейчас недоступен.', 503);
    console.error('Comment translation preview failed');
    return error('TRANSLATION_UNAVAILABLE', 'Перевод сейчас недоступен.', 503);
  }
}
