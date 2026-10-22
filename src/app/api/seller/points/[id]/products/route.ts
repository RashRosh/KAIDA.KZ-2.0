import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listOwnedOffers } from '@/modules/offers/application/list-owned-offers';
import { listOfferDrafts } from '@/modules/offers/drafts/offer-drafts';
import { pointProducts } from '@/modules/offers/point-products';
import { listOwnedLocations } from '@/modules/locations/application/list-owned-locations';
import { localeFromApiRequest } from '../../../../../../i18n/api';
import { currentUserOr401, fail, noStore, pointErrorResponse } from '../../_shared';

export const runtime = 'nodejs';

// seller-ai-text-real-parser §21: the products of one of the Seller's own points (cards and drafts). Another Seller's
// point and an unknown id answer the same 404.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await currentUserOr401(request);
  if (user instanceof Response) return user;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return fail('LOCATION_NOT_FOUND', 'Точка не найдена.', 404);
  try {
    const locations = await listOwnedLocations(user.id);
    const point = locations.find((location) => location.id === id.data);
    if (!point) return fail('LOCATION_NOT_FOUND', 'Точка не найдена.', 404);
    const [offers, drafts] = await Promise.all([
      listOwnedOffers(user.id, { locale: localeFromApiRequest(request) }),
      listOfferDrafts(user.id),
    ]);
    const products = pointProducts(offers, drafts, point.id);
    return NextResponse.json({ point: { id: point.id, name: point.name, addressText: point.addressText }, ...products }, { headers: noStore });
  } catch (error) {
    return pointErrorResponse(error, 'Point products read');
  }
}
