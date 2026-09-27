import { NextRequest, NextResponse } from 'next/server';
import { createCardChangeSet } from '@/modules/seller-input/application/card-change-sets';
import { cardCreateBodySchema } from '@/modules/seller-input/contracts/seller-card.contract';
import { jsonError, mapCardError, noStore, sellerUser } from '../_shared';

export const runtime = 'nodejs';

// seller-showcase-editor: a new card in one or more points (one proposal, confirmed on the review page).
export async function POST(request: NextRequest): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const parsed = cardCreateBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_CARD_INPUT', 'Проверьте название, цену, «Цена за» и точки.', 400);
  try {
    return NextResponse.json({ changeSet: await createCardChangeSet(user.id, parsed.data) }, { status: 201, headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller card creation failed');
  }
}
