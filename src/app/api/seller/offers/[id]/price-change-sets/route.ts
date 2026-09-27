import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pointPriceChangeSet } from '@/modules/seller-input/application/card-change-sets';
import { pointPriceBodySchema } from '@/modules/seller-input/contracts/seller-card.contract';
import { jsonError, mapCardError, noStore, sellerUser } from '../../../cards/_shared';

export const runtime = 'nodejs';

// seller-showcase-editor: «Изменить только в этой точке» — the price of one point, or back to the common price.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const offerId = z.uuid().safeParse((await context.params).id);
  if (!offerId.success) return jsonError('INVALID_OFFER_ID', 'Некорректный идентификатор предложения.', 400);
  const parsed = pointPriceBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_PRICE_INPUT', 'Укажите цену больше 0 ₸.', 400);
  try {
    return NextResponse.json({ changeSet: await pointPriceChangeSet(user.id, offerId.data, parsed.data) }, { status: 201, headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller point price change failed');
  }
}
