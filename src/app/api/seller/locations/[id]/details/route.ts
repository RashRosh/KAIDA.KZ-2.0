import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { replaceOwnedPointDetails } from '@/modules/locations/details/point-details.application';
import { pointDetailsInputSchema } from '@/modules/locations/details/point-details.contract';
import { currentUserOr401, fail, noStore, pointErrorResponse } from '../../../points/_shared';

export const runtime = 'nodejs';

// PUT replaces the point's contacts and hours as a whole.
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await currentUserOr401(request);
  if (user instanceof Response) return user;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return fail('LOCATION_NOT_FOUND', 'Точка не найдена.', 404);
  const parsed = pointDetailsInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_POINT_DETAILS', 'Проверьте контакты и режим работы.', 400);
  try {
    return NextResponse.json({ point: await replaceOwnedPointDetails(user.id, id.data, parsed.data) }, { headers: noStore });
  } catch (error) {
    return pointErrorResponse(error, 'Point details update');
  }
}
