import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateCardChangeSet } from '@/modules/seller-input/application/card-change-sets';
import { cardUpdateBodySchema } from '@/modules/seller-input/contracts/seller-card.contract';
import { jsonError, mapCardError, noStore, sellerUser } from '../../_shared';

export const runtime = 'nodejs';

// seller-showcase-editor: «Изменить во всех точках» — shared fields everywhere, the price where chosen, added points.
export async function POST(request: NextRequest, context: { params: Promise<{ cardId: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const cardId = z.uuid().safeParse((await context.params).cardId);
  if (!cardId.success) return jsonError('INVALID_CARD_ID', 'Некорректный идентификатор карточки.', 400);
  const parsed = cardUpdateBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_CARD_INPUT', 'Проверьте название, цену, «Цена за» и точки.', 400);
  try {
    return NextResponse.json({ changeSet: await updateCardChangeSet(user.id, cardId.data, parsed.data) }, { status: 201, headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller card update failed');
  }
}
