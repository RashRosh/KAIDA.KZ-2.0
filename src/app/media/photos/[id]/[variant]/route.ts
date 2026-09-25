import type { NextRequest } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { readPhoto } from '@/modules/media/application/read-photo';
import { photoIdSchema, photoVariantSchema } from '@/modules/media/contracts/photo.contract';

export const runtime = 'nodejs';

function notFound() {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; variant: string }> },
): Promise<Response> {
  const params = await context.params;
  const id = photoIdSchema.safeParse(params.id);
  const variant = photoVariantSchema.safeParse(params.variant);
  if (!id.success || !variant.success) return notFound();

  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const viewer = sessionToken ? await resolveCurrentUser(sessionToken).catch(() => null) : null;
    const result = await readPhoto(id.data, variant.data, viewer?.id ?? null);
    if (result.status === 'not_found') return notFound();
    return new Response(new Uint8Array(result.data), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
        // Photo files are immutable (a new photo is a new id), so a public copy may be cached for long.
        'Cache-Control': result.visibility === 'public' ? 'public, max-age=86400, immutable' : 'private, no-store',
      },
    });
  } catch {
    console.error('Photo read failed');
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
