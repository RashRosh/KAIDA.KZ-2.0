import { NextRequest, NextResponse } from 'next/server';
import { confirmPointContactCode } from '@/modules/locations/details/point-details.application';
import { pointContactCodeConfirmSchema } from '@/modules/locations/details/point-details.contract';
import { currentUserOr401, fail, noStore, pointErrorResponse } from '../../_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const user = await currentUserOr401(request);
  if (user instanceof Response) return user;
  const parsed = pointContactCodeConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_OTP', 'Неверный код.', 400);
  try {
    return NextResponse.json(await confirmPointContactCode(user.id, parsed.data), { headers: noStore });
  } catch (error) {
    return pointErrorResponse(error, 'Point contact code confirm');
  }
}
