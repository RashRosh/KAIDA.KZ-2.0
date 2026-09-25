import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { uploadPhoto } from '@/modules/media/application/upload-photo';
import { PHOTO_MAX_UPLOAD_BYTES } from '@/modules/media/config/photo-limits';
import { PhotoRejectedError, photoUrl } from '@/modules/media/contracts/photo.contract';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };
// Room for the multipart envelope around a file at the limit.
const MAX_REQUEST_BYTES = PHOTO_MAX_UPLOAD_BYTES + 64 * 1024;

const rejectionStatus = {
  PHOTO_UNSUPPORTED_TYPE: 415,
  PHOTO_TOO_LARGE: 413,
  PHOTO_TOO_SMALL: 422,
  PHOTO_UNATTACHED_LIMIT: 409,
} as const;

function rejected(code: keyof typeof rejectionStatus) {
  return NextResponse.json({ error: { code, message: code } }, { status: rejectionStatus[code], headers: noStore });
}

export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    console.error('Photo upload current user resolution failed');
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы добавить фото.' } }, { status: 401, headers: noStore });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_REQUEST_BYTES) return rejected('PHOTO_TOO_LARGE');

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return rejected('PHOTO_UNSUPPORTED_TYPE');
  }
  if (!(file instanceof File)) return rejected('PHOTO_UNSUPPORTED_TYPE');
  if (file.size > PHOTO_MAX_UPLOAD_BYTES) return rejected('PHOTO_TOO_LARGE');

  try {
    const photo = await uploadPhoto(user.id, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({
      photo: { ...photo, thumbUrl: photoUrl(photo.id, 'thumb'), displayUrl: photoUrl(photo.id, 'display') },
    }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof PhotoRejectedError) return rejected(error.code);
    console.error('Photo upload failed');
    return NextResponse.json({ error: { code: 'PHOTO_UPLOAD_UNAVAILABLE', message: 'Не удалось сохранить фото.' } }, { status: 503, headers: noStore });
  }
}
