import { NextRequest, NextResponse } from 'next/server';
import { requestPointContactCode } from '@/modules/locations/details/point-details.application';
import { pointContactCodeRequestSchema } from '@/modules/locations/details/point-details.contract';
import { currentUserOr401, fail, noStore, pointErrorResponse } from '../_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const user = await currentUserOr401(request);
  if (user instanceof Response) return user;
  const parsed = pointContactCodeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_PHONE', 'Введите корректный номер телефона.', 400);
  try {
    const result = await requestPointContactCode(user.id, parsed.data.phone);
    // Test delivery (point-contacts-hours D1): the code is returned to show on screen, as at login.
    return NextResponse.json({ challenge: result.challenge, phoneE164: result.phoneE164, delivery: result.delivery }, { status: 201, headers: noStore });
  } catch (error) {
    return pointErrorResponse(error, 'Point contact code request');
  }
}
