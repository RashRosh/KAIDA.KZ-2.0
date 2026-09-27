import { NextRequest, NextResponse } from 'next/server';
import { listOwnedPointDetails } from '@/modules/locations/details/point-details.application';
import { currentUserOr401, noStore, pointErrorResponse } from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await currentUserOr401(request);
  if (user instanceof Response) return user;
  try {
    return NextResponse.json({ points: await listOwnedPointDetails(user.id) }, { headers: noStore });
  } catch (error) {
    return pointErrorResponse(error, 'Point details read');
  }
}
